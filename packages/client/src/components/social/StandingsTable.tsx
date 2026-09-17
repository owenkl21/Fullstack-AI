import { cn } from '@/lib/utils';
import type { RivalStanding, Standing } from './api';

/*
 * One table for every board. Positions are numbers rather than medals: the
 * brief refuses the gamification clichés, and a trophy emoji is the first of
 * them.
 *
 * A joint position is stated in words rather than implied by two rows sharing
 * a number, because a reader should not have to notice.
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

   const jointWith = (index: number) => {
      const row = standings[index];
      if (!row) return null;
      const same = standings.filter(
         (s) =>
            s.points === row.points && s.qualifyingCount === row.qualifyingCount
      );
      return same.length > 1 ? same.filter((s) => s !== row) : null;
   };

   return (
      <div className="w-full min-w-0 overflow-x-auto">
         <table className="w-full min-w-[420px] border-collapse text-left">
            <thead>
               <tr className="border-b border-line">
                  <th className="lab py-2 pr-3 font-normal">#</th>
                  <th className="lab py-2 pr-3 font-normal">Angler</th>
                  <th className="lab py-2 pr-3 text-right font-normal">
                     Points
                  </th>
                  <th className="lab py-2 pr-3 text-right font-normal">Fish</th>
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
                           {i + 1}
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
                           {s.points}
                        </td>
                        <td className="num py-3 pr-3 text-right text-[15px] text-ink-2">
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
