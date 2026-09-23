import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Sheet } from '@/components/ui/sheet';
import {
   fetchCompetitions,
   speciesWords,
   type Competition,
} from '@/components/social/competitions-api';

/*
 * Entering the catch in a competition, from the log.
 *
 * One row: the competition it is going into, or that it is going into none,
 * and one word that changes that. What it opens is the running competitions
 * this angler is already in, because entering one from here is a decision
 * about this catch, not about joining anything.
 */
export function CompetitionRow({
   competition,
   onChoose,
   layout = 'row',
   className,
}: {
   competition: Competition | null;
   onChoose: (competition: Competition | null) => void;
   /* `row` is the phone's ruled line; `cell` is the desktop's labelled one. */
   layout?: 'row' | 'cell';
   className?: string;
}) {
   const [open, setOpen] = useState(false);
   const [running, setRunning] = useState<Competition[] | null>(null);

   useEffect(() => {
      if (!open || running) return;
      const controller = new AbortController();
      fetchCompetitions(controller.signal, 1, 'mine')
         .then((result) =>
            setRunning(
               result.items.filter(
                  (c) =>
                     c.youEntered &&
                     c.status === 'running' &&
                     /* With teams, only once they are on a side. */
                     !(c.teamsEnabled && !c.yourTeamId)
               )
            )
         )
         .catch(() => setRunning([]));
      return () => controller.abort();
   }, [open, running]);

   const value = competition ? competition.name : 'Not entered';
   const action = competition ? 'Change' : 'Enter it';

   const sheet = (
      <Sheet open={open} onOpenChange={setOpen} title="Competition">
         <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
            <span className="lab">Competition</span>
            <button
               type="button"
               onClick={() => setOpen(false)}
               className="g-tracked inline-flex h-10 items-center bg-ink px-3 text-[16px] text-background"
            >
               Done
            </button>
         </div>
         <div className="thread-scroll min-h-0 overflow-y-auto">
            {running === null ? (
               <p className="px-3 py-4 text-[15px] text-ink-2">Reading</p>
            ) : running.length === 0 ? (
               <p className="px-3 py-4 text-[15px] text-ink-2">
                  None running that you are in.
               </p>
            ) : (
               <ul>
                  {[null, ...running].map((option) => {
                     const on =
                        (option?.id ?? null) === (competition?.id ?? null);
                     return (
                        <li key={option?.id ?? 'none'}>
                           <button
                              type="button"
                              onClick={() => {
                                 onChoose(option);
                                 setOpen(false);
                              }}
                              className={cn(
                                 'flex min-h-12 w-full flex-col justify-center border-l-[3px] px-3 py-2 text-left transition-colors duration-100',
                                 on
                                    ? 'border-teal bg-teal/10'
                                    : 'border-transparent hover:bg-bg-2'
                              )}
                           >
                              <span className="g-tracked truncate text-[16px]">
                                 {option ? option.name : 'Not entered'}
                              </span>
                              {option ? (
                                 <span className="text-[13px] text-ink-3">
                                    {[
                                       option.measure === 'LENGTH'
                                          ? 'Length'
                                          : 'Weight',
                                       speciesWords(option.species),
                                    ]
                                       .filter(Boolean)
                                       .join(', ')}
                                 </span>
                              ) : null}
                           </button>
                        </li>
                     );
                  })}
               </ul>
            )}
         </div>
      </Sheet>
   );

   if (layout === 'cell') {
      return (
         <div className={cn('flex min-w-0 flex-col gap-2', className)}>
            <span className="lab">Competition</span>
            <div className="flex h-11 items-center justify-between gap-3 border-b border-dashed border-line-2">
               <span
                  className={cn(
                     'min-w-0 truncate text-[15px]',
                     competition ? 'text-ink' : 'text-ink-2'
                  )}
               >
                  {value}
               </span>
               <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="g-tracked shrink-0 text-[15px] text-teal-text hover:opacity-80"
               >
                  {action}
               </button>
            </div>
            {sheet}
         </div>
      );
   }

   return (
      <div
         className={cn(
            'flex h-[52px] items-center gap-3 border-y border-line',
            className
         )}
      >
         <span className="lab shrink-0">Competition</span>
         <span
            className={cn(
               'min-w-0 truncate text-[15px]',
               competition ? 'text-ink' : 'text-ink-2'
            )}
         >
            {value}
         </span>
         <button
            type="button"
            onClick={() => setOpen(true)}
            className="g-tracked ml-auto shrink-0 text-[15px] text-teal-text hover:opacity-80"
         >
            {action}
         </button>
         {sheet}
      </div>
   );
}
