import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * Bars and a rose, in the house ink, with the best in teal.
 *
 * No chart library: a row of rectangles and eight wedges do not need one,
 * and a library would bring its own typeface and its own idea of a grid.
 * Every chart carries an aria-label that reads the figures out in words.
 */

export type Bar = { key: string; label: string; count: number };

const describe = (title: string, bars: Bar[]) =>
   `${title}: ${
      bars
         .filter((bar) => bar.count)
         .map((bar) => `${bar.label} ${bar.count}`)
         .join(', ') || 'nothing yet'
   }`;

/*
 * The widest a single bar is drawn, in viewBox units out of a hundred.
 *
 * Without a cap a chart with one or two categories is a slab across the whole
 * frame, which reads as something broken rather than as a count of one kind.
 * On a young database that is the ordinary case: the admin panel had three
 * such slabs on it at once. From about seven bars the slot is already narrower
 * than this and nothing about the older charts changes.
 */
const WIDEST_BAR = 14;

export function Bars({
   title,
   bars,
   sentence,
   everyOther = false,
}: {
   title: string;
   bars: Bar[];
   sentence?: string | null;
   /* Label every second bar where there are too many to label them all. */
   everyOther?: boolean;
}) {
   const max = Math.max(1, ...bars.map((bar) => bar.count));
   const best = bars.reduce((a, b) => (b.count > a.count ? b : a), bars[0]);
   const W = 100;
   const H = 40;
   const gap = bars.length > 12 ? 1 : 2;
   const slot = W / Math.max(1, bars.length);
   /* Centred in its slot, which comes to the same place as the old left edge
      plus half a gap whenever the cap is not biting. */
   const width = Math.min(slot - gap, WIDEST_BAR);

   return (
      <figure className="min-w-0">
         <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="lab">{title}</span>
            {sentence ? (
               <span className="text-[14px] text-ink-2">{sentence}</span>
            ) : null}
         </figcaption>
         <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="mt-2 h-24 w-full"
            role="img"
            aria-label={describe(title, bars)}
         >
            <line
               x1="0"
               y1={H - 0.3}
               x2={W}
               y2={H - 0.3}
               className="stroke-line"
               strokeWidth="0.6"
            />
            {bars.map((bar, i) => {
               const h = (bar.count / max) * (H - 2);
               return (
                  <rect
                     key={bar.key}
                     x={i * slot + (slot - width) / 2}
                     y={H - h}
                     width={width}
                     height={h}
                     className={cn(
                        best && bar.key === best.key && bar.count
                           ? 'fill-teal'
                           : 'fill-ink'
                     )}
                  >
                     <title>{`${bar.label}: ${bar.count}`}</title>
                  </rect>
               );
            })}
         </svg>
         <div
            aria-hidden="true"
            className="num mt-1 grid text-[11px] text-ink-3"
            style={{
               gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`,
            }}
         >
            {bars.map((bar, i) => (
               <span key={bar.key} className="truncate text-center">
                  {everyOther && i % 2 ? '' : bar.label}
               </span>
            ))}
         </div>
      </figure>
   );
}

/*
 * A compass rose: eight wedges, each as long as the fish that came on that
 * wind. Weather reports give where the wind comes from, so a long wedge to
 * the south west means a south westerly did well.
 */
export function Rose({
   title,
   bars,
   sentence,
   icon,
}: {
   title: string;
   bars: Bar[];
   sentence?: string | null;
   icon?: ReactNode;
}) {
   const max = Math.max(1, ...bars.map((bar) => bar.count));
   const best = bars.reduce((a, b) => (b.count > a.count ? b : a), bars[0]);
   const R = 44;
   const cx = 50;
   const cy = 50;
   const n = bars.length;

   const wedge = (i: number, r: number) => {
      const a0 = ((i - 0.5) / n) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
      const x0 = cx + Math.cos(a0) * r;
      const y0 = cy + Math.sin(a0) * r;
      const x1 = cx + Math.cos(a1) * r;
      const y1 = cy + Math.sin(a1) * r;
      return `M${cx} ${cy} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
   };

   return (
      <figure className="min-w-0">
         <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="lab">{title}</span>
            {sentence ? (
               <span className="flex items-center gap-1.5 text-[14px] text-ink-2">
                  {icon}
                  {sentence}
               </span>
            ) : null}
         </figcaption>
         <svg
            viewBox="0 0 100 100"
            className="mx-auto mt-2 aspect-square w-full max-w-[280px]"
            role="img"
            aria-label={describe(title, bars)}
         >
            {[R, R * 0.66, R * 0.33].map((r) => (
               <circle
                  key={r}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  className="stroke-line"
                  strokeWidth="0.5"
                  strokeDasharray="1.5 1.5"
               />
            ))}
            {bars.map((bar, i) => {
               const r = 4 + (bar.count / max) * (R - 4);
               return (
                  <path
                     key={bar.key}
                     d={wedge(i, bar.count ? r : 0)}
                     className={cn(
                        best && bar.key === best.key && bar.count
                           ? 'fill-teal'
                           : 'fill-ink'
                     )}
                     opacity={bar.count ? 0.92 : 0}
                  >
                     <title>{`${bar.label}: ${bar.count}`}</title>
                  </path>
               );
            })}
            {bars.map((bar, i) => {
               const a = (i / n) * Math.PI * 2 - Math.PI / 2;
               const x = cx + Math.cos(a) * (R + 5);
               const y = cy + Math.sin(a) * (R + 5);
               return (
                  <text
                     key={`${bar.key}-label`}
                     x={x}
                     y={y}
                     textAnchor="middle"
                     dominantBaseline="central"
                     className="fill-ink-3"
                     fontSize="5"
                  >
                     {bar.label}
                  </text>
               );
            })}
         </svg>
      </figure>
   );
}

/* ---- The admin panel's four ---------------------------------------------
 *
 * Same hand as the two above: a viewBox, flat fills in the house ink, the one
 * thing worth noticing in teal, and an aria-label that reads the figures out
 * in words rather than leaving a screen reader at "graphic".
 *
 * A year of days is too many to say one at a time, so where a series is long
 * the label says the shape of it: the total, the busiest day and the quiet
 * stretch. That is what a sighted reader takes from the curve anyway.
 */

export type Point = { day: string; count: number };

/* "3 Feb", the way the rest of the product writes a short date. */
const shortDay = (day: string) => {
   const date = new Date(`${day}T00:00:00`);
   return Number.isNaN(date.getTime())
      ? day
      : date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
};

const sum = (points: Point[]) => points.reduce((a, p) => a + p.count, 0);

/*
 * The two ends of a curve, written so they cannot be mistaken for each other.
 * Same year: "25 Jul" and "22 Sept". Different years: the year comes along,
 * because a curve that runs from one September to the next otherwise reads as
 * a single day.
 */
const ends = (points: Point[]): [string, string] => {
   const first = points[0]!.day;
   const last = points[points.length - 1]!.day;
   const spans = first.slice(0, 4) !== last.slice(0, 4);
   const write = (day: string) =>
      spans ? `${shortDay(day)} ${day.slice(2, 4)}` : shortDay(day);
   return [write(first), write(last)];
};

/*
 * The same shape of sentence whether a point is a day or a week. The word is
 * passed in rather than assumed: the growth curves are read by week as often
 * as by day, and a label that counts weeks and calls them days is a label that
 * lies to the one reader who cannot see the chart.
 */
const describeSeries = (title: string, points: Point[], unit = 'days') => {
   if (!points.length) return `${title}: nothing yet`;
   const total = sum(points);
   if (!total) return `${title}: nothing in this window`;
   const best = points.reduce((a, b) => (b.count > a.count ? b : a));
   const quiet = points.filter((p) => !p.count).length;
   const opens = unit === 'weeks' ? 'the week of ' : '';
   return `${title}: ${total} over ${points.length} ${unit}, busiest ${opens}${shortDay(
      best.day
   )} with ${best.count}, and ${quiet} ${unit} with none`;
};

/*
 * A curve. Filled under the line, because what this answers is "how much" and
 * an area says that faster than a stroke does.
 *
 * The line is drawn straight between points rather than smoothed: a spline
 * through counts invents days that never happened, and on a sign-up curve
 * those are the days somebody will ask about.
 */
export function Area({
   title,
   points,
   sentence,
   height = 'h-28',
   unit = 'days',
}: {
   title: string;
   points: Point[];
   sentence?: string | null;
   height?: string;
   /* What one point is, for the spoken label: 'days' or 'weeks'. */
   unit?: string;
}) {
   const W = 300;
   const H = 80;
   const max = Math.max(1, ...points.map((p) => p.count));
   const step = points.length > 1 ? W / (points.length - 1) : W;
   const at = (point: Point, i: number) => ({
      x: i * step,
      y: H - (point.count / max) * (H - 4),
   });

   const line = points
      .map((point, i) => {
         const { x, y } = at(point, i);
         return `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
   const under = points.length ? `${line} L${W} ${H} L0 ${H} Z` : '';
   const peak = points.length
      ? points.reduce((a, b) => (b.count > a.count ? b : a))
      : null;
   const peakAt = peak ? at(peak, points.indexOf(peak)) : null;

   return (
      <figure className="min-w-0">
         <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="lab">{title}</span>
            <span className="num text-[14px] text-ink-2">
               {sentence ?? `${sum(points)} in all`}
            </span>
         </figcaption>
         <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className={cn('mt-2 w-full', height)}
            role="img"
            aria-label={describeSeries(title, points, unit)}
         >
            <line
               x1="0"
               y1={H - 0.3}
               x2={W}
               y2={H - 0.3}
               className="stroke-line"
               strokeWidth="0.6"
               vectorEffect="non-scaling-stroke"
            />
            {under ? (
               <path d={under} className="fill-ink" opacity={0.12} />
            ) : null}
            {line ? (
               <path
                  d={line}
                  fill="none"
                  className="stroke-ink"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
               />
            ) : null}
            {/* The busiest day, marked, because it is the one a reader looks
                for and hunting it along a flat curve is work. */}
            {peakAt && peak?.count ? (
               <circle
                  cx={peakAt.x}
                  cy={peakAt.y}
                  r="2.5"
                  className="fill-teal"
                  vectorEffect="non-scaling-stroke"
               />
            ) : null}
         </svg>
         {points.length ? (
            <div
               aria-hidden="true"
               className="num mt-1 flex justify-between text-[11px] text-ink-3"
            >
               {/* The year is written in only when the two ends are in
                   different ones. By week a curve runs from last September to
                   this one, and "23 Sept" beside "22 Sept" reads as a single
                   day rather than as a year. */}
               <span>{ends(points)[0]}</span>
               <span>{ends(points)[1]}</span>
            </div>
         ) : null}
      </figure>
   );
}

export type Stack = { key: string; label: string; counts: number[] };

/*
 * Bars in bands: the same bar, split by what made it up.
 *
 * The bands are told apart by weight of ink rather than by hue, so the chart
 * survives a black block, a night page and a reader who cannot separate two
 * colours. The first band is teal because the first band is usually the one
 * being asked about.
 */
export function StackedBars({
   title,
   bands,
   bars,
   sentence,
}: {
   title: string;
   /* One name per band, in the order the counts arrive. */
   bands: string[];
   bars: Stack[];
   sentence?: string | null;
}) {
   const totals = bars.map((bar) => bar.counts.reduce((a, b) => a + b, 0));
   const max = Math.max(1, ...totals);
   const W = 100;
   const H = 40;
   const gap = bars.length > 12 ? 1 : 2;
   const slot = W / Math.max(1, bars.length);
   const width = Math.min(Math.max(0.5, slot - gap), WIDEST_BAR);

   const words = bars
      .map((bar, i) =>
         totals[i]
            ? `${bar.label} ${totals[i]}, of which ${bands
                 .map((band, b) => `${band} ${bar.counts[b] ?? 0}`)
                 .join(' and ')}`
            : null
      )
      .filter(Boolean)
      .join('; ');

   return (
      <figure className="min-w-0">
         <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="lab">{title}</span>
            {sentence ? (
               <span className="text-[14px] text-ink-2">{sentence}</span>
            ) : null}
         </figcaption>
         <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="mt-2 h-24 w-full"
            role="img"
            aria-label={`${title}: ${words || 'nothing yet'}`}
         >
            <line
               x1="0"
               y1={H - 0.3}
               x2={W}
               y2={H - 0.3}
               className="stroke-line"
               strokeWidth="0.6"
            />
            {bars.map((bar, i) => {
               let y = H;
               return (
                  <g key={bar.key}>
                     {bar.counts.map((count, b) => {
                        const h = (count / max) * (H - 2);
                        y -= h;
                        return (
                           <rect
                              key={bands[b] ?? b}
                              x={i * slot + (slot - width) / 2}
                              y={y}
                              width={width}
                              height={h}
                              className={b === 0 ? 'fill-teal' : 'fill-ink'}
                              opacity={
                                 b === 0 ? 1 : 1 - Math.min(b - 1, 2) * 0.28
                              }
                           >
                              <title>{`${bar.label}, ${bands[b] ?? ''}: ${count}`}</title>
                           </rect>
                        );
                     })}
                  </g>
               );
            })}
         </svg>
         <div
            aria-hidden="true"
            className="num mt-1 grid text-[11px] text-ink-3"
            style={{
               gridTemplateColumns: `repeat(${Math.max(1, bars.length)}, minmax(0, 1fr))`,
            }}
         >
            {bars.map((bar) => (
               <span key={bar.key} className="truncate text-center">
                  {bar.label}
               </span>
            ))}
         </div>
         <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {bands.map((band, b) => (
               <li
                  key={band}
                  className="flex items-center gap-1.5 text-[13px] text-ink-2"
               >
                  <span
                     aria-hidden="true"
                     className={cn(
                        'block size-2.5',
                        b === 0 ? 'bg-teal' : 'bg-ink'
                     )}
                     style={
                        b === 0
                           ? undefined
                           : { opacity: 1 - Math.min(b - 1, 2) * 0.28 }
                     }
                  />
                  {band}
               </li>
            ))}
         </ul>
      </figure>
   );
}

/*
 * A year of fishing, one square a day.
 *
 * Fifty three columns of seven, Monday at the top, the way a wall calendar
 * reads. Depth of ink says how many, in five steps: more steps than that and
 * nobody can tell two of them apart at this size.
 */
export function HeatGrid({
   title,
   points,
   sentence,
}: {
   title: string;
   points: Point[];
   sentence?: string | null;
}) {
   const max = Math.max(1, ...points.map((p) => p.count));
   /* Five steps, by share of the busiest day rather than by a fixed count, so
      the grid reads the same on a quiet app and a busy one. */
   const stepOf = (count: number) =>
      count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4));

   const cell = 11;
   const pad = 2;
   /* Monday first: getDay gives Sunday as 0, so it is rotated. */
   const rowOf = (day: string) => {
      const date = new Date(`${day}T00:00:00`);
      return (date.getDay() + 6) % 7;
   };

   const first = points[0];
   const leading = first ? rowOf(first.day) : 0;
   const columns = Math.ceil((points.length + leading) / 7);
   const W = columns * cell;
   const H = 7 * cell;

   const busiest = points.length
      ? points.reduce((a, b) => (b.count > a.count ? b : a))
      : null;

   return (
      <figure className="min-w-0">
         <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="lab">{title}</span>
            <span className="text-[14px] text-ink-2">
               {sentence ??
                  (busiest?.count
                     ? `Busiest ${shortDay(busiest.day)}, ${busiest.count}.`
                     : null)}
            </span>
         </figcaption>
         <div className="mt-2 w-full overflow-x-auto">
            <svg
               viewBox={`0 0 ${W} ${H}`}
               className="h-[92px] w-auto min-w-full"
               preserveAspectRatio="xMinYMid meet"
               role="img"
               aria-label={describeSeries(title, points)}
            >
               {points.map((point, i) => {
                  const slot = i + leading;
                  const step = stepOf(point.count);
                  return (
                     <rect
                        key={point.day}
                        x={Math.floor(slot / 7) * cell}
                        y={(slot % 7) * cell}
                        width={cell - pad}
                        height={cell - pad}
                        className={step ? 'fill-teal' : 'fill-ink'}
                        opacity={step ? 0.25 + step * 0.1875 : 0.08}
                     >
                        <title>{`${shortDay(point.day)}: ${point.count}`}</title>
                     </rect>
                  );
               })}
            </svg>
         </div>
         <div
            aria-hidden="true"
            className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-3"
         >
            <span>Quiet</span>
            {[0, 1, 2, 3, 4].map((step) => (
               <span
                  key={step}
                  className={cn('block size-2.5', step ? 'bg-teal' : 'bg-ink')}
                  style={{ opacity: step ? 0.25 + step * 0.1875 : 0.08 }}
               />
            ))}
            <span>Busy</span>
         </div>
      </figure>
   );
}

/*
 * A spread: how many fish fell in each size band.
 *
 * The same rectangles as Bars, but the labels are bucket floors rather than
 * names, so only every few are written or they collide. The median band is
 * marked in teal instead of the tallest: on a distribution the middle is the
 * finding, and the tallest bar is usually the middle anyway.
 */
export function Spread({
   title,
   bars,
   unit,
   sentence,
}: {
   title: string;
   /* floor of the bucket, and how many landed in it */
   bars: { bucket: number; count: number }[];
   unit: string;
   sentence?: string | null;
}) {
   const max = Math.max(1, ...bars.map((b) => b.count));
   const total = bars.reduce((a, b) => a + b.count, 0);
   const W = 100;
   const H = 40;
   const slot = W / Math.max(1, bars.length);
   const width = Math.min(
      Math.max(0.4, slot - (bars.length > 20 ? 0.6 : 1.4)),
      WIDEST_BAR
   );

   /* The band the middle fish sits in. */
   let running = 0;
   const median = bars.find((bar) => {
      running += bar.count;
      return running >= total / 2;
   });

   const words = bars
      .filter((bar) => bar.count)
      .map((bar) => `${bar.bucket} ${unit} ${bar.count}`)
      .join(', ');

   return (
      <figure className="min-w-0">
         <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="lab">{title}</span>
            <span className="num text-[14px] text-ink-2">
               {sentence ??
                  (median
                     ? `Middle around ${median.bucket} ${unit}.`
                     : 'Nothing measured yet.')}
            </span>
         </figcaption>
         <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="mt-2 h-24 w-full"
            role="img"
            aria-label={`${title}: ${words || 'nothing measured yet'}`}
         >
            <line
               x1="0"
               y1={H - 0.3}
               x2={W}
               y2={H - 0.3}
               className="stroke-line"
               strokeWidth="0.6"
            />
            {bars.map((bar, i) => {
               const h = (bar.count / max) * (H - 2);
               return (
                  <rect
                     key={bar.bucket}
                     x={i * slot + (slot - width) / 2}
                     y={H - h}
                     width={width}
                     height={h}
                     className={
                        median && bar.bucket === median.bucket
                           ? 'fill-teal'
                           : 'fill-ink'
                     }
                  >
                     <title>{`${bar.bucket} ${unit} and up: ${bar.count}`}</title>
                  </rect>
               );
            })}
         </svg>
         <div
            aria-hidden="true"
            className="num mt-1 grid text-[11px] text-ink-3"
            style={{
               gridTemplateColumns: `repeat(${Math.max(1, bars.length)}, minmax(0, 1fr))`,
            }}
         >
            {bars.map((bar, i) => (
               <span key={bar.bucket} className="truncate text-center">
                  {/* Every fourth, or they run into each other. */}
                  {i % 4 ? '' : bar.bucket}
               </span>
            ))}
         </div>
      </figure>
   );
}
