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
      <div aria-live="polite" className={cn('flex flex-col gap-1', className)}>
         <span className="lab">{label}</span>
         {phase === 'ready' && lines.length ? (
            <span className="num flex flex-wrap gap-x-4 gap-y-0.5 text-[15px] font-medium">
               {lines.map((line) => (
                  <span key={line.key}>{line.value}</span>
               ))}
            </span>
         ) : (
            <span className="text-[14px] text-ink-3">{note}</span>
         )}
      </div>
   );
}
