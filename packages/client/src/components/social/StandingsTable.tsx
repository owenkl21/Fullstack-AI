import { cn } from '@/lib/utils';
import type { RivalStanding, Standing } from './api';

/*
 * One table for every board. Positions are numbers rather than medals: the
 * brief refuses the gamification clichés, and a trophy emoji is the first of
 * them.
 *
 * A joint position is stated in words rather than implied by two rows sharing
 * a number, because a reader should not have to notice. Tied rows do also carry
 * the same number: saying "joint with" on a row numbered 5 while the other row
 * is numbered 4 makes the words and the figures contradict each other.
 */
export function StandingsTable({
   standings,
   emptyLine,
}: {
   standings: (Standing | RivalStanding)[];
   emptyLine: string;
}) {
   if (!standings.length) {
      return <p className="text-[15px] text-ink-2">{emptyLine}</p>;
   }

   const tiedWith = (row: (typeof standings)[number]) =>
      standings.filter(
         (s) =>
            s.points === row.points && s.qualifyingCount === row.qualifyingCount
      );

   const jointWith = (index: number) => {
      const row = standings[index];
      if (!row) return null;
      const same = tiedWith(row);
      return same.length > 1 ? same.filter((s) => s !== row) : null;
   };

   /*
    * Competition ranking: everyone level gets the position of the first of them,
    * and the next angler down takes the position their count has earned. The
    * list is already sorted, so the first matching row is that position.
    */
   const positionOf = (index: number) => {
      const row = standings[index];
      if (!row) return index + 1;
      return standings.indexOf(tiedWith(row)[0] ?? row) + 1;
   };

   return (
      <div className="w-full min-w-0 overflow-x-auto">
         <table className="w-full border-collapse text-left">
            <thead>
               <tr className="border-b border-line">
                  <th className="lab py-2 pr-3 font-normal">#</th>
                  <th className="lab py-2 pr-3 font-normal">Angler</th>
                  <th className="lab py-2 pr-3 text-right font-normal">
                     Points
                  </th>
                  <th className="lab hidden py-2 pr-3 text-right font-normal sm:table-cell">
                     Fish
                  </th>
                  <th className="lab py-2 text-right font-normal">Longest</th>
               </tr>
            </thead>
            <tbody>
               {standings.map((s, i) => {
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
                              <span className="lab ml-2 text-ink-3">You</span>
                           ) : null}
                           {joint ? (
                              <span className="block text-[13px] text-ink-3">
                                 Joint with{' '}
                                 {joint.map((j) => j.displayName).join(', ')}
                              </span>
                           ) : null}
                        </td>
                        <td className="num py-3 pr-3 text-right text-[17px]">
                           {s.points.toFixed(1)}
                        </td>
                        <td className="num hidden py-3 pr-3 text-right text-[15px] text-ink-2 sm:table-cell">
                           {s.qualifyingCount}
                        </td>
                        <td className="num py-3 text-right text-[15px] text-ink-2">
                           {s.longestCm ? `${s.longestCm} cm` : 'Not measured'}
                        </td>
                     </tr>
                  );
               })}
            </tbody>
         </table>
      </div>
   );
}
