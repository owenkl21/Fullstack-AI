import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/*
 * The conditions arriving a line at a time once the fix is in, so the angler can
 * see the weather being stamped and then put the phone away. None of it can hold up
 * the save.
 */
export type ConditionsPhase = 'waiting' | 'loading' | 'ready' | 'missing';

export type ConditionLine = { key: string; value: string };

export function Conditions({
   phase,
   lines,
   takenAt,
}: {
   phase: ConditionsPhase;
   lines: ConditionLine[];
   takenAt: string | null;
}) {
   // The first line is there as soon as the readings are; the rest follow it.
   const [revealed, setRevealed] = useState(0);

   useEffect(() => {
      if (lines.length < 2) {
         return;
      }
      let shown = 0;
      const timer = window.setInterval(() => {
         shown += 1;
         setRevealed(shown);
         if (shown >= lines.length - 1) {
            window.clearInterval(timer);
         }
      }, 260);
      return () => window.clearInterval(timer);
   }, [lines]);

   const note =
      phase === 'waiting'
         ? 'Conditions are stamped as soon as there is a fix.'
         : phase === 'loading'
           ? 'Reading the conditions'
           : phase === 'ready'
             ? takenAt
                ? `Conditions taken ${takenAt}. You can put the phone away now.`
                : 'Conditions taken. You can put the phone away now.'
             : 'Conditions not recorded here. The catch still saves.';

   return (
      <div className="flex flex-col gap-1" aria-live="polite">
         {lines.map((line, index) => (
            <div
               key={line.key}
               className={cn(
                  'flex items-baseline justify-between gap-3 text-[15px] transition-[opacity,transform] duration-[400ms] [transition-timing-function:var(--ease)]',
                  index <= revealed
                     ? 'translate-y-0 opacity-100'
                     : 'translate-y-1.5 opacity-0'
               )}
            >
               <span className="lab">{line.key}</span>
               <span className="num font-medium">{line.value}</span>
            </div>
         ))}
         <p className="text-[14px] text-ink-3">{note}</p>
      </div>
   );
}
