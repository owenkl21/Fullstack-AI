import type { CSSProperties, ReactNode } from 'react';
import { MoonPhaseIcon } from '@/components/fishing/home/ConditionIcons';
import type { ForecastDay } from './forecast-api';
import {
   BAND_W,
   arcPath,
   clockOfMinutes,
   labelAt,
   minutesOfStamp,
   minutesX,
   quarterPath,
   type NowMark,
} from './band-geometry';
import { NowStripe } from './NowStripe';

/*
 * The sun and the moon over one horizon.
 *
 * A first and last light printed as two times tells you when; an arc over the
 * hour columns tells you where you are in the day, which is the thing an
 * angler is actually working out at four in the afternoon. The arcs are
 * shapes, not altitudes: nothing here claims to know how high anything
 * stands, only when it comes up, when it is highest, and when it goes.
 *
 * They used to be two rows. They are one, because they are one question. A
 * night session is planned on where the sun went and where the moon is, and
 * reading that off two bands a hundred and seventy pixels apart is reading it
 * twice. The sun is drawn in --sun, the moon in paper, and they share the
 * dashed teal horizon, so which is which needs no key.
 *
 * The moon is the harder one. It rises about fifty minutes later each day, so
 * it wanders through the calendar: the moon that sets at 01:15 rose the night
 * before, and the moon that rises at 10:48 sets tomorrow morning. Both are
 * drawn, the tail of one and the start of the other, and a date with no rise
 * or no set at all (which happens about once a lunation) simply runs off the
 * edge rather than inventing a time.
 */

const H = 96;
const HORIZON = 62;
const PEAK = 18;

/*
 * The hours with no sun in them.
 *
 * On paper night would be a shade darker. The instrument's ground is already
 * near black, so the only way to mark a stretch of it is to lift it: night is
 * the faintly raised ground, and the lit hours are the block's own black.
 * Reversed from the obvious, and it is the reading that survives the ground,
 * which is what the block decides for everything drawn in it.
 *
 * It ran from the horizon to the foot of the row, which read as a grey
 * rectangle stuck to the bottom rather than as night: a shape of its own,
 * competing with the arcs instead of standing behind them. It is the whole
 * height of the band now, edge to edge in the hours it covers, drawn first so
 * both arcs and the horizon cross it. At full height it only needs half the
 * lift it needed as a strip, which is the faintest the block will hold and
 * still be seen: four per cent of paper puts #0b0909 at #1a1918.
 */
const NIGHT_LIFT = '4%';

const nightFill: CSSProperties = {
   fill: `color-mix(in srgb, var(--paper) ${NIGHT_LIFT}, transparent)`,
};

/*
 * A label hides whatever runs behind it by sitting on a patch of the ground it
 * is standing on, which for a moonset before sunrise is the lifted night and
 * not the block's own black. Painting every patch black would print a dark
 * rectangle inside the night, which is the same fault the night shading itself
 * had, one layer up.
 */
const patch = (night: boolean): CSSProperties => ({
   background: night
      ? `color-mix(in srgb, var(--paper) ${NIGHT_LIFT}, var(--bg))`
      : 'var(--bg)',
});

function Mark({
   x,
   top,
   children,
}: {
   x: number;
   top: number;
   children: ReactNode;
}) {
   return (
      <span
         aria-hidden="true"
         className="absolute whitespace-nowrap"
         style={{ ...labelAt(x), top }}
      >
         {children}
      </span>
   );
}

export function SkyBand({
   day,
   next,
   now,
}: {
   day: ForecastDay;
   /* The day after, because a moon that rises today sets tomorrow. */
   next: ForecastDay | null;
   now: NowMark | null;
}) {
   const rise = minutesOfStamp(day.sunrise);
   const set = minutesOfStamp(day.sunset);
   const sun =
      rise !== null && set !== null && set > rise
         ? { rise, set, noon: (rise + set) / 2 }
         : null;

   const moonUp = minutesOfStamp(day.moonrise);
   const moonDown = minutesOfStamp(day.moonset);
   const nextDown = minutesOfStamp(next?.moonset);
   /* The moon that sets this morning came up yesterday: draw its tail. */
   const tail =
      moonDown !== null && (moonUp === null || moonDown < moonUp)
         ? moonDown
         : null;
   /* And the one that comes up today usually sets tomorrow. */
   const closing =
      moonUp === null
         ? null
         : moonDown !== null && moonDown > moonUp
           ? moonDown
           : nextDown !== null
             ? nextDown + 1440
             : null;
   const moonPeak =
      moonUp !== null && closing !== null ? (moonUp + closing) / 2 : null;
   const peakOnScreen = moonPeak !== null && moonPeak <= 1440;

   if (!sun && moonUp === null && moonDown === null) return null;

   /*
    * In clock order. A set earlier than the rise is last night's moon going
    * down, and reading "up 10:48, down 01:15" as one moon makes it a three
    * hour night.
    */
   const moonTimes = [
      moonUp === null
         ? null
         : { at: moonUp, word: `up ${clockOfMinutes(moonUp)}` },
      moonDown === null
         ? null
         : { at: moonDown, word: `down ${clockOfMinutes(moonDown)}` },
   ]
      .filter((t): t is { at: number; word: string } => t !== null)
      .sort((a, b) => a.at - b.at)
      .map((t) => t.word);

   const sentence = [
      sun
         ? `Sun up ${clockOfMinutes(sun.rise)}, highest ${clockOfMinutes(sun.noon)}, down ${clockOfMinutes(sun.set)}.`
         : 'The sun neither rises nor sets here today.',
      moonTimes.length > 0 ? `Moon ${moonTimes.join(', ')}.` : null,
   ]
      .filter(Boolean)
      .join(' ');

   const xNoon = sun ? minutesX(sun.noon) : 0;

   /* Whether a time falls in the hours the shading covers, so a label knows
      which ground it is standing on. */
   const isNight = (minutes: number) =>
      sun !== null && (minutes < sun.rise || minutes > sun.set);

   return (
      <div
         role="img"
         aria-label={sentence}
         className="relative w-full"
         style={{ height: H }}
      >
         <NowStripe now={now} />
         <svg
            aria-hidden="true"
            viewBox={`0 0 ${BAND_W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
         >
            {sun ? (
               <>
                  <rect
                     x="0"
                     y="0"
                     width={minutesX(sun.rise)}
                     height={H}
                     style={nightFill}
                  />
                  <rect
                     x={minutesX(sun.set)}
                     y="0"
                     width={BAND_W - minutesX(sun.set)}
                     height={H}
                     style={nightFill}
                  />
               </>
            ) : null}
            <line
               x1="0"
               x2={BAND_W}
               y1={HORIZON}
               y2={HORIZON}
               className="stroke-teal"
               strokeWidth="1"
               strokeDasharray="12 10.5"
            />
            {/* The moon first, so where the two cross the sun is on top. */}
            {tail === null ? null : (
               <path
                  d={quarterPath(0, PEAK, minutesX(tail), HORIZON)}
                  pathLength={1}
                  fill="none"
                  strokeWidth="2"
                  className="draw-on stroke-paper-2"
               />
            )}
            {moonUp === null ? null : (
               <path
                  d={
                     closing === null
                        ? quarterPath(minutesX(moonUp), HORIZON, BAND_W, PEAK)
                        : arcPath(
                             minutesX(moonUp),
                             minutesX(closing),
                             HORIZON,
                             PEAK
                          )
                  }
                  pathLength={1}
                  fill="none"
                  strokeWidth="2"
                  className="draw-on stroke-paper-2"
               />
            )}
            {sun ? (
               <path
                  d={arcPath(
                     minutesX(sun.rise),
                     minutesX(sun.set),
                     HORIZON,
                     PEAK
                  )}
                  pathLength={1}
                  fill="none"
                  strokeWidth="2"
                  className="draw-on stroke-sun"
               />
            ) : null}
         </svg>

         {/* The sun at its peak, as a disc rather than a symbol: the arc has
             already said it is the sun, and a disc keeps its shape where the
             band is stretched to whatever the hours are wide. */}
         {sun ? (
            <span
               aria-hidden="true"
               className="absolute -translate-x-1/2 -translate-y-1/2"
               style={{ left: `${(xNoon / BAND_W) * 100}%`, top: PEAK }}
            >
               <svg viewBox="0 0 10 10" className="size-2.5">
                  <circle cx="5" cy="5" r="4.5" className="fill-sun" />
               </svg>
            </span>
         ) : null}
         {peakOnScreen && moonPeak !== null ? (
            <span
               aria-hidden="true"
               className="absolute -translate-x-1/2 -translate-y-1/2 text-ink-2"
               style={{
                  left: `${(minutesX(moonPeak) / BAND_W) * 100}%`,
                  top: PEAK,
               }}
            >
               <MoonPhaseIcon fraction={day.moon.fraction} className="size-4" />
            </span>
         ) : null}

         {sun ? (
            <Mark x={xNoon} top={PEAK + 10}>
               {/* Noon is between the rise and the set by definition, so this
                   one is never standing on the night. */}
               <span className="lab num px-1 text-ink" style={patch(false)}>
                  High noon {clockOfMinutes(sun.noon)}
               </span>
            </Mark>
         ) : null}
         {moonUp === null ? null : (
            <Mark x={minutesX(moonUp)} top={HORIZON + 6}>
               <span
                  className="lab num px-1 text-ink-2"
                  style={patch(isNight(moonUp))}
               >
                  Moonrise {clockOfMinutes(moonUp)}
               </span>
            </Mark>
         )}
         {moonDown === null ? null : (
            <Mark x={minutesX(moonDown)} top={HORIZON + 6}>
               <span
                  className="lab num px-1 text-ink-2"
                  style={patch(isNight(moonDown))}
               >
                  Moonset {clockOfMinutes(moonDown)}
               </span>
            </Mark>
         )}
      </div>
   );
}
