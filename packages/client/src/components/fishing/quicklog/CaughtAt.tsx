import { useState } from 'react';
import { formatClock } from '@/components/fishing/record/format';
import type { TimeSource } from './Receipt';

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) =>
   `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/*
 * When the fish came out: the clock large, the date beside it, where the
 * time came from, and an editor behind Edit for the catch logged later.
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
   const [draft, setDraft] = useState(toLocalInput(at));
   /* Where the time came from, said in words rather than a mark. */
   const note =
      timeSource === 'photo'
         ? 'From the photograph'
         : timeSource === 'typed'
           ? 'Set by you'
           : 'When you tapped Log';

   return (
      <div>
         <div className="flex items-center justify-between gap-2">
            <span className="lab">Caught at</span>
            <span className="text-[14px] whitespace-nowrap text-ink-2">
               {note}
            </span>
         </div>
         <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2.5">
               <span className="g num text-[33px] leading-none">
                  {formatClock(at)}
               </span>
               <span className="text-[14px] text-ink-2">
                  {at.toLocaleDateString(undefined, {
                     day: 'numeric',
                     month: 'short',
                     year: 'numeric',
                  })}
               </span>
            </div>
            <button
               type="button"
               aria-expanded={editing}
               onClick={() => {
                  setDraft(toLocalInput(at));
                  setEditing((open) => !open);
               }}
               className="g-tracked inline-flex min-h-11 items-center text-[15px] text-teal-text hover:opacity-80"
            >
               {editing ? 'Cancel' : 'Edit'}
            </button>
         </div>
         {editing ? (
            <div className="mt-3 border-t border-line pt-3">
               <label className="lab" htmlFor="caught-at">
                  Date and time
               </label>
               <input
                  id="caught-at"
                  type="datetime-local"
                  className="num mt-1.5 h-11 w-full border border-line-2 bg-background px-2.5 text-[16px] text-ink outline-none focus:border-ink"
                  value={draft}
                  max={toLocalInput(new Date())}
                  onChange={(event) => setDraft(event.target.value)}
               />
               <div className="mt-2 flex justify-end">
                  <button
                     type="button"
                     onClick={() => {
                        const next = new Date(draft);
                        if (!Number.isNaN(next.getTime())) onTime(next);
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
