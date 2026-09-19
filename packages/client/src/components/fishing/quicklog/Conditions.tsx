import { cn } from '@/lib/utils';

/*
 * The conditions, stamped on the catch the moment there is a fix. One line:
 * the readings run together, and the label says when they were taken. None
 * of it can hold up the save, and none of it needs a sentence of its own.
 */
export type ConditionsPhase = 'waiting' | 'loading' | 'ready' | 'missing';

export type ConditionLine = { key: string; value: string };

export function Conditions({
   phase,
   lines,
   takenAt,
   className,
}: {
   phase: ConditionsPhase;
   lines: ConditionLine[];
   takenAt: string | null;
   className?: string;
}) {
   const label =
      phase === 'ready' && takenAt ? `Conditions at ${takenAt}` : 'Conditions';
   const note =
      phase === 'waiting'
         ? 'Stamped once there is a fix.'
         : phase === 'loading'
           ? 'Reading'
           : phase === 'missing'
             ? 'Not recorded here.'
             : null;

   return (
      <div
         aria-live="polite"
         className={cn(
            'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1',
            className
         )}
      >
         <span className="lab">{label}</span>
         {phase === 'ready' && lines.length ? (
            <span className="num text-right text-[15px] font-medium">
               {lines.map((line) => line.value).join(' · ')}
            </span>
         ) : (
            <span className="text-[14px] text-ink-3">{note}</span>
         )}
      </div>
   );
}
