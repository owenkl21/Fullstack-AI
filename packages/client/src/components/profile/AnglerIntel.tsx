import { useEffect, useMemo, useState } from 'react';
import {
   fetchMyCatches,
   type CatchSummary,
} from '@/components/fishing/record/api';
import { moonPhase } from '@/lib/moon';
import { cn } from '@/lib/utils';

/*
 * When the fish come, counted from the log.
 *
 * Two questions a shore angler actually asks of their own record: what time
 * of day do I catch, and on which moon. Both are counted here from the
 * catches themselves, in the browser, so there is nothing to fetch beyond
 * the log the page already has. The moon is worked out from the date, the
 * way the conditions panel does it.
 *
 * Drawn as bars in the house ink, with the best hour or phase in teal. No
 * chart library: twenty four rectangles do not need one, and a library
 * would bring its own typeface and its own idea of a grid.
 */

const PHASES = [
   'New moon',
   'Waxing crescent',
   'First quarter',
   'Waxing gibbous',
   'Full moon',
   'Waning gibbous',
   'Last quarter',
   'Waning crescent',
];

const SHORT: Record<string, string> = {
   'New moon': 'New',
   'Waxing crescent': 'Wax cr',
   'First quarter': '1st qtr',
   'Waxing gibbous': 'Wax gib',
   'Full moon': 'Full',
   'Waning gibbous': 'Wan gib',
   'Last quarter': 'Last qtr',
   'Waning crescent': 'Wan cr',
};

type Bar = { key: string; label: string; count: number };

function byHour(catches: CatchSummary[]): Bar[] {
   const counts = new Array<number>(24).fill(0);
   for (const entry of catches) {
      const at = new Date(entry.caughtAt);
      if (!Number.isNaN(at.getTime()))
         counts[at.getHours()] += entry.count ?? 1;
   }
   return counts.map((count, hour) => ({
      key: String(hour),
      label: String(hour).padStart(2, '0'),
      count,
   }));
}

function byMoon(catches: CatchSummary[]): Bar[] {
   const counts = new Map(PHASES.map((name) => [name, 0]));
   for (const entry of catches) {
      const at = new Date(entry.caughtAt);
      if (Number.isNaN(at.getTime())) continue;
      const name = moonPhase(at).name;
      counts.set(name, (counts.get(name) ?? 0) + (entry.count ?? 1));
   }
   return PHASES.map((name) => ({
      key: name,
      label: SHORT[name] ?? name,
      count: counts.get(name) ?? 0,
   }));
}

const clock = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export function AnglerIntel() {
   const [catches, setCatches] = useState<CatchSummary[] | null>(null);

   useEffect(() => {
      const controller = new AbortController();
      fetchMyCatches(controller.signal)
         .then(setCatches)
         .catch(() => {
            if (!controller.signal.aborted) setCatches([]);
         });
      return () => controller.abort();
   }, []);

   const hours = useMemo(() => (catches ? byHour(catches) : []), [catches]);
   const moons = useMemo(() => (catches ? byMoon(catches) : []), [catches]);

   if (!catches || catches.length < 3) {
      /* Three fish is the least a pattern can be read from. */
      return null;
   }

   const bestHour = hours.reduce((a, b) => (b.count > a.count ? b : a));
   const bestMoon = moons.reduce((a, b) => (b.count > a.count ? b : a));

   return (
      <section aria-labelledby="intel-heading" className="mt-10">
         <div className="flex items-baseline justify-between gap-4">
            <h2 id="intel-heading" className="lab lab-rule text-ink-3">
               When you catch
            </h2>
         </div>

         <div className="mt-4 grid gap-8 md:grid-cols-2">
            <Chart
               title="By hour of day"
               bars={hours}
               best={bestHour.key}
               sentence={
                  bestHour.count
                     ? `Most fish between ${clock(Number(bestHour.key))} and ${clock((Number(bestHour.key) + 1) % 24)}.`
                     : null
               }
               everyOther
            />
            <Chart
               title="By the moon"
               bars={moons}
               best={bestMoon.key}
               sentence={
                  bestMoon.count
                     ? `Most on the ${bestMoon.key.toLowerCase()}.`
                     : null
               }
            />
         </div>
      </section>
   );
}

function Chart({
   title,
   bars,
   best,
   sentence,
   everyOther = false,
}: {
   title: string;
   bars: Bar[];
   best: string;
   sentence: string | null;
   /* Label every second bar where there are too many to label them all. */
   everyOther?: boolean;
}) {
   const max = Math.max(1, ...bars.map((bar) => bar.count));
   const W = 100;
   const H = 40;
   const gap = 1.2;
   const slot = W / bars.length;
   const width = slot - gap;

   return (
      <figure className="min-w-0">
         <figcaption className="flex items-baseline justify-between gap-4">
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
            aria-label={`${title}: ${bars
               .filter((bar) => bar.count)
               .map((bar) => `${bar.label} ${bar.count}`)
               .join(', ')}`}
         >
            {/* The floor, so an empty hour is a gap on a line rather than
                nothing at all. */}
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
                        bar.key === best && bar.count ? 'fill-teal' : 'fill-ink'
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
