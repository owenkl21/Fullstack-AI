import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { fetchPersonalBests, type PersonalBest } from '@/components/social/api';
import { useUnits, type Units } from '@/lib/units';
import { cn } from '@/lib/utils';
import { lengthParts, weightParts } from '@/components/fishing/personal-best';

/*
 * Your best fish of each species, weight first.
 *
 * A black card per species: the name, the figure the best was judged on,
 * large, and the other figure of the same fish under it. A species that has
 * been weighed is judged on its heaviest fish; one that has only ever been
 * measured shows its longest, so every species you have caught has a best.
 * A weight that was worked out from the length or guessed by eye says so,
 * because a record is only worth as much as the scale behind it.
 *
 * On a phone the cards run sideways in one row that scrolls, so the list of
 * catches under it is not pushed a screen down; from a tablet up they sit in
 * a grid. Each card opens the catch.
 */

const monthYear = (iso: string) =>
   new Date(iso).toLocaleDateString('en-ZA', {
      month: 'short',
      year: 'numeric',
   });

/* How many cards show before "Show all": two rows of the widest grid. */
const FIRST = 8;

export function PersonalBests({
   heading = 'section',
   className,
}: {
   /* 'section' draws its own heading; 'none' is for a page whose own section
      heading already says "Personal bests". */
   heading?: 'section' | 'none';
   className?: string;
}) {
   const units = useUnits();
   const [bests, setBests] = useState<PersonalBest[] | null>(null);
   const [all, setAll] = useState(false);

   useEffect(() => {
      const controller = new AbortController();
      fetchPersonalBests(controller.signal)
         .then(setBests)
         /* The row is extra to the page it sits on: if it cannot be read the
            page carries on without it rather than saying so. */
         .catch(() => setBests([]));
      return () => controller.abort();
   }, []);

   if (!bests || bests.length === 0) return null;

   const everyWeighed = bests.every((b) => b.by === 'WEIGHT');
   const aside = everyWeighed
      ? 'By recorded weight'
      : 'By weight, or length if never weighed';
   const shown = all ? bests : bests.slice(0, FIRST);

   return (
      <section
         aria-labelledby={heading === 'section' ? 'bests-heading' : undefined}
         className={className}
      >
         {heading === 'section' ? (
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
               <h2 id="bests-heading" className="g text-[30px] md:text-[36px]">
                  Personal bests
               </h2>
               <span className="text-[16px] text-ink-2 md:text-[18px]">
                  {aside}
               </span>
            </div>
         ) : (
            <p className="text-[16px] text-ink-2">{aside}</p>
         )}

         <ul
            className={cn(
               'mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2',
               /* The row runs to the phone's edges so a card half in view
                  says there is more to swipe to. */
               '-mx-4 scroll-px-4 px-4',
               'md:mx-0 md:grid md:snap-none md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4'
            )}
         >
            {shown.map((best) => (
               <li
                  key={best.speciesId}
                  className="w-[min(78vw,280px)] shrink-0 snap-start md:w-auto"
               >
                  <BestCard best={best} units={units} />
               </li>
            ))}
         </ul>

         {bests.length > FIRST ? (
            <button
               type="button"
               onClick={() => setAll((was) => !was)}
               aria-expanded={all}
               className="g-tracked mt-3 inline-flex min-h-11 items-center text-[16px] text-teal-text hover:opacity-80"
            >
               {all ? 'Show fewer' : `Show all ${bests.length}`}
            </button>
         ) : null}
      </section>
   );
}

function BestCard({ best, units }: { best: PersonalBest; units: Units }) {
   const byWeight = best.by === 'WEIGHT' && best.weightKg != null;
   const [figure, unit] = byWeight
      ? weightParts(best.weightKg!, units)
      : lengthParts(best.lengthCm ?? 0, units);
   /* A weight off the scale is the record; anything else is marked. */
   const estimated = byWeight && best.weightSource !== 'SCALE';
   const other =
      byWeight && best.lengthCm != null
         ? lengthParts(best.lengthCm, units).join(' ')
         : monthYear(best.caughtAt);

   const said = `${best.commonName}, ${figure} ${unit}${estimated ? ' estimated' : ''}, ${other}`;

   return (
      <Link
         to={`/catches/${best.catchId}`}
         aria-label={`${said}. Open the catch.`}
         className="blk group flex h-full min-h-[172px] flex-col px-[22px] pt-[22px] pb-5 transition-transform duration-150 [transition-timing-function:var(--ease)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:px-6 md:pt-6"
      >
         <span className="truncate text-[18px] tracking-[0.06em] text-paper-2 md:text-[20px]">
            {best.commonName}
         </span>
         <span className="mt-3 flex items-baseline gap-1.5">
            <span className="g num text-[56px] leading-[0.9] text-paper md:text-[64px]">
               {figure}
            </span>
            {/* Lower case, as a scale and a tape print it: KG in capitals
                read as a shout beside the figure. */}
            <span className="g text-[24px] leading-none text-paper-2 normal-case md:text-[28px]">
               {unit}
            </span>
            {estimated ? (
               <span
                  title={
                     best.weightSource === 'LENGTH'
                        ? 'Worked out from the length'
                        : 'Guessed by eye'
                  }
                  className="lab ml-1 self-center text-ink-3"
               >
                  est.
               </span>
            ) : null}
         </span>
         <span className="mt-auto flex items-center justify-between gap-3 pt-4">
            <span className="num text-[17px] text-teal-text md:text-[18px]">
               {other}
            </span>
            <ArrowRightIcon
               aria-hidden="true"
               strokeWidth={1.5}
               className="size-5 shrink-0 text-teal-text transition-transform duration-150 [transition-timing-function:var(--ease)] group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
            />
         </span>
      </Link>
   );
}
