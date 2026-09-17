import { useState } from 'react';
import type { RivalStanding, Standing } from './api';
import { formatLength, formatMass, readUnitSystem } from '@/lib/units';
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
   { value: 'weight', label: 'Weight', head: 'Total' },
   { value: 'length', label: 'Longest', head: 'Longest' },
   { value: 'bag', label: 'Bag', head: 'Fish' },
];

export function StandingsTable({
   standings,
   emptyLine,
}: {
   standings: (Standing | RivalStanding)[];
   emptyLine: string;
}) {
   const [rankBy, setRankBy] = useState<RankBy>('points');
   const [units] = useState(() => readUnitSystem());

   if (!standings.length) {
      return <p className="text-[15px] text-ink-2">{emptyLine}</p>;
   }

   const valueOf = (s: (typeof standings)[number]) =>
      rankBy === 'weight'
         ? s.totalMassKg
         : rankBy === 'length'
           ? s.longestCm
           : rankBy === 'bag'
             ? s.qualifyingCount
             : s.points;

   /* Written the way the figure is actually measured. */
   const written = (s: (typeof standings)[number]) => {
      if (rankBy === 'weight') {
         return formatMass(s.totalMassKg, units) ?? 'Nothing yet';
      }
      if (rankBy === 'length') {
         return s.longestCm
            ? (formatLength(s.longestCm, units) ?? 'Not measured')
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
      if (!row) return null;
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

   const head = RANKS.find((r) => r.value === rankBy)?.head ?? 'Points';

   return (
      <div className="w-full min-w-0">
         <div
            role="radiogroup"
            aria-label="Order the board by"
            className="mb-3 flex flex-wrap gap-2"
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
                  {ordered.map((s, i) => {
                     const you = 'isYou' in s && s.isYou;
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
                              {positionOf(i)}
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
                           <td className="num py-3 text-right text-[17px]">
                              {written(s)}
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
      </div>
   );
}
