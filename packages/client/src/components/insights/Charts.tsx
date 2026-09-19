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
   const width = slot - gap;

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
                     x={i * slot + gap / 2}
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
