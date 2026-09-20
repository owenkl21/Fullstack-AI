import { catchesHead, catchesRows } from './data';
import { ScreenHead } from './ScreenHead';

/*
 * The angler's own log: the app's row grammar, one column of them, a hairline
 * above each and the measurement on the right. A 52 pixel photograph, the fish
 * in League Gothic, one Jost line saying when and where, and no cards.
 */
export function CatchesScreen({ on }: { on: boolean }) {
   return (
      <>
         <ScreenHead
            on={on}
            seed={7}
            kicker={catchesHead.kicker}
            title={catchesHead.title}
         />

         <div className="flex items-baseline justify-between px-[18px] pt-4">
            <span className="g text-[30px]">{catchesHead.heading}</span>
            <span className="lab num">{catchesHead.count}</span>
         </div>

         <div className="mt-3 flex flex-col border-b border-line pb-0">
            {catchesRows.map((row) => (
               <div
                  key={row.id}
                  className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-line px-[18px] py-3"
               >
                  <img
                     src={row.photo}
                     alt=""
                     loading="lazy"
                     className="size-[52px] bg-bg-2 object-cover"
                  />
                  <div className="min-w-0">
                     <span className="g block truncate text-[22px] tracking-[0.04em] text-ink">
                        {row.species}
                     </span>
                     <p className="truncate text-sm text-ink-2">
                        {row.when} · {row.spot}
                     </p>
                  </div>
                  <span className="flex flex-col items-end">
                     <span className="lab text-ink-3">Length</span>
                     <span className="g num block text-[24px] tracking-[0.03em] text-ink">
                        {row.length}
                     </span>
                  </span>
               </div>
            ))}
         </div>

         <p className="lab num mt-4 mr-[18px] mb-4 ml-[18px] border-t border-line pt-4">
            {catchesHead.more}
         </p>
      </>
   );
}
