import { useState } from 'react';
import { formatClock } from '@/components/fishing/record/format';
import { DateTimeField } from '@/components/ui/date-time-field';
import { fromLocalValue, toLocalValue } from '@/lib/local-time';
import type { TimeSource } from './Receipt';
import { dayStamp } from './stamp';

/*
 * When the fish came out: the clock large, the date beside it, where the time
 * came from at the end of the same line, and an editor behind Edit for the
 * catch logged later.
 */
export function CaughtAt({
   at,
   timeSource,
   onTime,
}: {
   at: Date;
   timeSource: TimeSource;
   onTime: (next: Date) => void;
}) {
   const [editing, setEditing] = useState(false);
   const [draft, setDraft] = useState(toLocalValue(at));
   const [problem, setProblem] = useState<string | null>(null);
   /* Where the time came from, said in words rather than a mark. */
   const note =
      timeSource === 'photo'
         ? 'From the photograph'
         : timeSource === 'typed'
           ? 'Set by you'
           : 'When you tapped Log';

   return (
      <div className="flex flex-col gap-1.5">
         <div className="flex items-center justify-between gap-2">
            <span className="lab">Caught at</span>
            <button
               type="button"
               aria-expanded={editing}
               onClick={() => {
                  setDraft(toLocalValue(at));
                  setProblem(null);
                  setEditing((open) => !open);
               }}
               className="g-tracked text-[15px] text-teal-text hover:opacity-80"
            >
               {editing ? 'Cancel' : 'Edit'}
            </button>
         </div>
         <div className="flex items-baseline gap-3">
            <span className="g num text-[36px] leading-[0.95]">
               {formatClock(at)}
            </span>
            <span className="text-[15px] text-ink-2">{dayStamp(at)}</span>
            <span
               data-time-source={timeSource}
               className="ml-auto text-[14px] whitespace-nowrap text-ink-3"
            >
               {note}
            </span>
         </div>
         {editing ? (
            <div className="mt-2 border-t border-line pt-3">
               <DateTimeField
                  label="Date and time"
                  value={draft}
                  max={toLocalValue(new Date())}
                  error={problem}
                  onChange={(next) => {
                     setDraft(next);
                     setProblem(null);
                  }}
               />
               <div className="mt-2 flex justify-end">
                  <button
                     type="button"
                     onClick={() => {
                        /* The editor stays open on a time it cannot use, and
                           says why. It used to close on a half filled field
                           as if the time had been taken. The minute's grace
                           is for a clock that ticked over while typing. */
                        const next = fromLocalValue(draft);
                        if (!next) {
                           setProblem('Set both the day and the time.');
                           return;
                        }
                        if (next.getTime() > Date.now() + 60000) {
                           setProblem('That has not happened yet.');
                           return;
                        }
                        onTime(next);
                        setEditing(false);
                     }}
                     className="g-tracked inline-flex min-h-11 items-center text-[15px] text-teal-text hover:opacity-80"
                  >
                     Use this time
                  </button>
               </div>
            </div>
         ) : null}
      </div>
   );
}
