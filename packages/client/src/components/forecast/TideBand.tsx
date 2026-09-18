import type { CSSProperties } from 'react';
import type { ForecastHour } from './forecast-api';
import {
   BAND_W,
   clockOfMinutes,
   columnX,
   labelLeft,
   smoothPath,
   turningPoints,
} from './band-geometry';

/*
 * The tide, as a shape and not a table.
 *
 * The model carries how high the water stands each hour, so the curve is the
 * real rise and fall at this place today: where it is flooding, where it is
 * ebbing, and the hour each turn falls. What it does not carry is a datum an
 * angler can use. The heights are against global mean sea level on an eight
 * kilometre grid, and the printed tables are against chart datum, so a figure
 * here would argue with the table in the tackle box and lose. So no heights
 * are printed, anywhere: the curve says when, and the tables say how much.
 */

const H = 96;
const TOP = 20;
const BOT = 62;

const waterFill: CSSProperties = {
   fill: 'color-mix(in srgb, var(--teal) 18%, transparent)',
};

export function TideBand({ hours }: { hours: ForecastHour[] }) {
   const samples = hours.flatMap((hour, index) => {
      const level = hour.seaLevelM ?? null;
      return level === null ? [] : [{ index, level }];
   });
   if (samples.length < 4) return null;

   const levels = samples.map((s) => s.level);
   const low = Math.min(...levels);
   const high = Math.max(...levels);
   const span = high - low < 0.02 ? 0.02 : high - low;
   const y = (level: number) => BOT - ((level - low) / span) * (BOT - TOP);
   const x = (index: number) => columnX(index, hours.length);

   const points = samples.map((s) => ({ x: x(s.index), y: y(s.level) }));
   const curve = smoothPath(points);
   const skirt = `${curve} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`;
   const mean = y(levels.reduce((sum, v) => sum + v, 0) / levels.length);

   const turns = turningPoints(levels).map((turn) => {
      /* The fit lands between two samples, so the hour does too. */
      const base = Math.floor(turn.at);
      const here = samples[base].index;
      const next = samples[Math.min(base + 1, samples.length - 1)].index;
      const at = here + (turn.at - base) * (next - here);
      return {
         kind: turn.kind,
         x: x(at),
         y: y(turn.value),
         clock: clockOfMinutes(at * 60),
      };
   });

   /*
    * Ebb or flood between one turn and the next. A stretch shorter than three
    * hours is left unnamed: the word would not fit and would say nothing the
    * curve has not already said.
    */
   const edges = [0, ...turns.map((t) => t.x), BAND_W];
   const runs =
      turns.length === 0
         ? []
         : edges.slice(0, -1).flatMap((from, i) => {
              const to = edges[i + 1];
              if (to - from < (BAND_W / 24) * 3) return [];
              const after = turns[i];
              const falling = after
                 ? after.kind === 'low'
                 : turns[i - 1].kind === 'high';
              return [{ x: (from + to) / 2, word: falling ? 'Ebb' : 'Flood' }];
           });

   const sentence =
      turns.length === 0
         ? high - low < 0.02
            ? 'The water barely moves here today.'
            : levels[levels.length - 1] > levels[0]
              ? 'Water rising all day.'
              : 'Water falling all day.'
         : `Water ${turns[0].kind === 'low' ? 'falling' : 'rising'} until ${turns[0].clock}` +
           turns
              .slice(1)
              .map(
                 (turn) =>
                    `, then ${turn.kind === 'low' ? 'falling' : 'rising'} to ${turn.clock}`
              )
              .join('') +
           '.';

   return (
      <div role="img" aria-label={sentence} className="relative h-24 w-full">
         <svg
            aria-hidden="true"
            viewBox={`0 0 ${BAND_W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
         >
            <path d={skirt} style={waterFill} />
            <line
               x1="0"
               x2={BAND_W}
               y1={mean}
               y2={mean}
               className="stroke-teal"
               strokeWidth="1"
               strokeDasharray="12 10.5"
            />
            <path
               d={curve}
               pathLength={1}
               fill="none"
               strokeWidth="1.5"
               className="draw-on stroke-ink"
            />
         </svg>
         {turns.map((turn) => (
            <span key={`${turn.kind}-${turn.clock}`} aria-hidden="true">
               <span
                  className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 bg-ink"
                  style={{ left: `${(turn.x / BAND_W) * 100}%`, top: turn.y }}
               />
               <span
                  className="lab num absolute -translate-x-1/2 bg-background px-1 whitespace-nowrap text-ink"
                  style={{
                     left: `${labelLeft(turn.x)}%`,
                     top: turn.kind === 'high' ? turn.y + 6 : turn.y - 22,
                  }}
               >
                  {turn.kind === 'high' ? 'High' : 'Low'} {turn.clock}
               </span>
            </span>
         ))}
         {runs.map((run) => (
            <span
               key={`${run.word}-${Math.round(run.x)}`}
               aria-hidden="true"
               className="lab absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-ink-2"
               style={{ left: `${labelLeft(run.x)}%` }}
            >
               {run.word}
            </span>
         ))}
      </div>
   );
}
