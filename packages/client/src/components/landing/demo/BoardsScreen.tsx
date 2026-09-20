import { TrophyIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { board, boardsHead } from './data';
import { ScreenHead } from './ScreenHead';

/*
 * One species board, drawn as the app draws every board: a table with the
 * position as a number rather than a medal, the angler, and the figure the
 * board is ordered by on the right. The reader's own row takes the quiet
 * ground and the word You, the way it does on the real table.
 */
export function BoardsScreen({ on }: { on: boolean }) {
   return (
      <>
         <ScreenHead
            on={on}
            seed={31}
            kicker={boardsHead.kicker}
            title={boardsHead.title}
         />

         <div className="px-[18px] pt-4 pb-5">
            {/* The four bar slots are all spoken for, so this is the way
                through to competitions on a phone, exactly as the real board
                carries it. */}
            <span className="g-tracked inline-flex min-h-11 items-center gap-2 border border-line px-4 text-[15px]">
               <TrophyIcon
                  aria-hidden="true"
                  className="size-[18px]"
                  strokeWidth={1.5}
               />
               {boardsHead.competitions}
            </span>

            <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
               <h2 className="g text-[30px]">{board.species}</h2>
               <p className="lab">{board.order}</p>
            </div>

            <table className="mt-4 w-full border-collapse text-left">
               <thead>
                  <tr className="border-b border-line">
                     <th className="lab py-2 pr-3 font-normal">#</th>
                     <th className="lab py-2 pr-3 font-normal">Angler</th>
                     <th className="lab py-2 text-right font-normal">
                        {board.head}
                     </th>
                  </tr>
               </thead>
               <tbody>
                  {board.rows.map((row) => {
                     const you = 'you' in row && row.you === true;
                     return (
                        <tr
                           key={row.pos}
                           className={cn(
                              'border-b border-line/60',
                              you && 'bg-bg-2'
                           )}
                        >
                           <td className="num py-3 pr-3 text-[15px] text-ink-2">
                              {row.pos}
                           </td>
                           <td className="py-3 pr-3 text-[17px]">
                              {/* The reader's own row is named You on this
                                  board, so the app's You label beside the name
                                  would only say it twice. The quiet ground is
                                  the mark. */}
                              {row.name}
                              <span className="block text-[13px] text-ink-3">
                                 {row.spot}
                              </span>
                           </td>
                           <td className="num py-3 text-right text-[17px]">
                              {row.value}
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
      </>
   );
}
