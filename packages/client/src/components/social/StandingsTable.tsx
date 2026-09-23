import { useLoadOnScroll } from '@/lib/load-on-scroll';
import { useState } from 'react';
import type { RivalStanding, Standing } from './api';
import { formatMeasure, useUnits } from '@/lib/units';
import { cn } from '@/lib/utils';

/*
 * One table for every board. Positions are numbers rather than medals: the
 * brief refuses the gamification clichés, and a trophy emoji is the first of
 * them.
 *
 * A joint position is stated in words rather than implied by two rows sharing
 * a number, because a reader should not have to notice. Tied rows do also carry
 * the same number: saying "joint with" on a row numbered 5 while the other row
 * is numbered 4 makes the words and the figures contradict each other.
 *
 * The ranking is a choice rather than a fixed opinion. The board used to sort
 * on points and then print "Longest" as its last column, so it looked ordered
 * by length while it was ordered by mass, which is the one thing a leaderboard
 * must never do. Now whichever figure the reader picks is the one the table is
 * ordered by, and it is the column that leads.
 */

export type RankBy = 'points' | 'weight' | 'length' | 'bag';

const RANKS: { value: RankBy; label: string; head: string }[] = [
   { value: 'points', label: 'Points', head: 'Points' },
   { value: 'weight', label: 'Weight', head: 'Weight' },
   { value: 'length', label: 'Longest', head: 'Longest' },
   { value: 'bag', label: 'Bag', head: 'Fish' },
];

export function StandingsTable({
   standings,
   emptyLine,
   rankBy: rankByProp,
   pageSize = 10,
   youId = null,
}: {
   standings: (Standing | RivalStanding)[];
   emptyLine: string;
   /* Chosen by the page, so every board on it orders the same way. Left
    * out, the table carries its own switch. */
   rankBy?: RankBy;
   /* Ten a page. The board is always the top ten first; the rest page. */
   pageSize?: number;
   /* The reader, so their row is pinned under the page when it is off it. */
   youId?: string | null;
}) {
   /* Weight first, as everywhere a fish is compared. */
   const [ownRankBy, setRankBy] = useState<RankBy>('weight');
   const rankBy = rankByProp ?? ownRankBy;
   /* The reader's own cm or in, kg or lb, the same as on a competition. */
   const units = useUnits();
   const [page, setPage] = useState(0);
   const moreSentinel = useLoadOnScroll(
      () => setPage((p) => p + 1),
      (page + 1) * pageSize < standings.length
   );

   if (!standings.length) {
      return <p className="text-[15px] text-ink-2">{emptyLine}</p>;
   }

   /*
    * On a species board the weight order ranks only weights checked by a
    * photo of the scale. The rest sit under them, heaviest first, between
    * -1 and 0 so they keep their own order, and a fish never weighed last.
    */
   const species = standings.some(
      (s) => 'bestMassKg' in s && s.bestMassKg !== undefined
   );
   const ranked = (s: (typeof standings)[number]) =>
      rankBy !== 'weight' || !species || s.bestMassKg != null;
   const valueOf = (s: (typeof standings)[number]) =>
      rankBy === 'weight'
         ? species
            ? s.bestMassKg != null
               ? s.bestMassKg
               : s.unverifiedKg != null
                 ? -1 / (1 + s.unverifiedKg)
                 : -2
            : s.totalMassKg
         : rankBy === 'length'
           ? s.longestCm
           : rankBy === 'bag'
             ? s.qualifyingCount
             : s.points;

   /* Written the way the figure is actually measured. */
   const written = (s: (typeof standings)[number]) => {
      if (rankBy === 'weight') {
         if (species) {
            if (s.bestMassKg != null) {
               return formatMeasure(s.bestMassKg, 'WEIGHT', units) ?? '';
            }
            if (s.unverifiedKg != null) {
               return `${formatMeasure(s.unverifiedKg, 'WEIGHT', units)}, not verified`;
            }
            return 'Not weighed';
         }
         return formatMeasure(s.totalMassKg, 'WEIGHT', units) ?? 'Nothing yet';
      }
      if (rankBy === 'length') {
         return s.longestCm
            ? (formatMeasure(s.longestCm, 'LENGTH', units) ?? 'Not measured')
            : 'Not measured';
      }
      if (rankBy === 'bag') {
         return String(s.qualifyingCount);
      }
      return s.points.toFixed(1);
   };

   const ordered = [...standings].sort(
      (a, b) => valueOf(b) - valueOf(a) || b.points - a.points
   );

   const tiedWith = (row: (typeof standings)[number]) =>
      ordered.filter((s) => valueOf(s) === valueOf(row));

   const jointWith = (index: number) => {
      const row = ordered[index];
      if (!row || !ranked(row)) return null;
      const same = tiedWith(row);
      return same.length > 1 ? same.filter((s) => s !== row) : null;
   };

   /*
    * Competition ranking: everyone level gets the position of the first of them,
    * and the next angler down takes the position their count has earned.
    */
   const positionOf = (index: number) => {
      const row = ordered[index];
      if (!row) return index + 1;
      return ordered.indexOf(tiedWith(row)[0] ?? row) + 1;
   };

   /* A species board's weight is the heaviest fish; a rivals board's is the
      whole bag. */
   const heaviest = standings.some(
      (s) => 'bestMassKg' in s && s.bestMassKg !== undefined
   );
   const head =
      rankBy === 'weight'
         ? heaviest
            ? 'Heaviest'
            : 'Total weight'
         : (RANKS.find((r) => r.value === rankBy)?.head ?? 'Points');

   const pages = Math.max(1, Math.ceil(ordered.length / pageSize));
   const current = Math.min(page, pages - 1);
   /* The top ten first, the rest joining them ten at a time as you scroll. */
   const shown = ordered.slice(0, (current + 1) * pageSize);
   const youIndex = ordered.findIndex(
      (s) =>
         ('isYou' in s && s.isYou) || (youId !== null && s.anglerId === youId)
   );
   const youOffPage = youIndex >= 0 && youIndex >= (current + 1) * pageSize;

   return (
      <div className="w-full min-w-0">
         <div
            role="radiogroup"
            aria-label="Order the board by"
            className={cn('mb-3 flex flex-wrap gap-2', rankByProp && 'hidden')}
         >
            {RANKS.map((option) => (
               <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={rankBy === option.value}
                  onClick={() => setRankBy(option.value)}
                  className={cn(
                     'g-tracked inline-flex h-10 items-center border px-3 text-[15px] transition-colors duration-150',
                     rankBy === option.value
                        ? 'border-ink bg-ink text-background'
                        : 'border-line text-ink-2 hover:border-ink hover:text-ink'
                  )}
               >
                  {option.label}
               </button>
            ))}
         </div>

         <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full border-collapse text-left">
               <thead>
                  <tr className="border-b border-line">
                     <th className="lab py-2 pr-3 font-normal">#</th>
                     <th className="lab py-2 pr-3 font-normal">Angler</th>
                     <th className="lab py-2 text-right font-normal">{head}</th>
                  </tr>
               </thead>
               <tbody>
                  {shown.map((s, offset) => {
                     const i = current * pageSize + offset;
                     const you =
                        ('isYou' in s && s.isYou) ||
                        (youId !== null && s.anglerId === youId);
                     const joint = jointWith(i);

                     return (
                        <tr
                           key={s.anglerId}
                           className={cn(
                              'border-b border-line/60',
                              you && 'bg-bg-2'
                           )}
                        >
                           <td className="num py-3 pr-3 text-[15px] text-ink-2">
                              {/* Not ranked: a weight no scale photo checked. */}
                              {ranked(s) ? positionOf(i) : ''}
                           </td>
                           <td className="py-3 pr-3 text-[17px]">
                              {s.displayName}
                              {you ? (
                                 <span className="lab ml-2 text-ink-3">
                                    You
                                 </span>
                              ) : null}
                              {joint ? (
                                 <span className="block text-[13px] text-ink-3">
                                    Joint with{' '}
                                    {joint.map((j) => j.displayName).join(', ')}
                                 </span>
                              ) : null}
                           </td>
                           <td
                              className={cn(
                                 'num py-3 text-right text-[17px]',
                                 !ranked(s) && 'text-[15px] text-ink-3'
                              )}
                           >
                              {written(s)}
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>

         {youOffPage ? (
            <p className="mt-2 flex items-baseline justify-between gap-4 border-t-2 border-teal pt-2 text-[15px]">
               <span>
                  <span className="num font-medium">
                     #{positionOf(youIndex)}
                  </span>{' '}
                  <span className="text-ink-2">You, of {ordered.length}</span>
               </span>
               <span className="num">{written(ordered[youIndex]!)}</span>
            </p>
         ) : null}

         <div ref={moreSentinel} aria-hidden="true" className="h-px" />
         {shown.length < ordered.length ? (
            <p className="num mt-3 text-[13px] text-ink-3">
               {shown.length} of {ordered.length}
            </p>
         ) : null}
      </div>
   );
}
