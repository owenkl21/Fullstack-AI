import { cn } from '@/lib/utils';

/*
 * The conditions, stamped on the catch the moment there is a fix.
 *
 * Three readings side by side, split by hairlines: the figure large, its unit
 * small beside it, and one note under each that says the thing the figure on
 * its own leaves out. The wind's direction and its gusts, which way the
 * pressure is going, what the sky is doing. None of it can hold up the save,
 * and none of it needs a sentence.
 */
export type ConditionsPhase = 'waiting' | 'loading' | 'ready' | 'missing';

export type Readout = {
   key: string;
   value: number | null;
   unit: string;
   note: string | null;
};

const round = (value: number) =>
   Math.abs(value) >= 100 || Number.isInteger(value)
      ? String(Math.round(value))
      : value.toFixed(1);

export function Conditions({
   phase,
   readouts,
   takenAt,
   className,
}: {
   phase: ConditionsPhase;
   readouts: Readout[];
   takenAt: string | null;
   className?: string;
}) {
   const label =
      phase === 'ready' && takenAt ? `Conditions at ${takenAt}` : 'Conditions';
   /*
    * The other three phases. The fix can be refused, the weather read can
    * fail, and on a first visit neither has happened yet; the block says
    * which in one quiet line rather than going blank.
    */
   const note =
      phase === 'waiting'
         ? 'Stamped once there is a fix.'
         : phase === 'loading'
           ? 'Reading'
           : phase === 'missing'
             ? 'Not recorded here.'
             : null;

   const shown = readouts.filter((r) => r.value !== null);

   return (
      <div
         aria-live="polite"
         className={cn('flex flex-col gap-2.5', className)}
      >
         <span className="lab">{label}</span>
         {phase === 'ready' && shown.length ? (
            <div
               className="grid"
               style={{
                  gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`,
               }}
            >
               {shown.map((readout, i) => (
                  <div
                     key={readout.key}
                     className={cn(
                        'flex min-w-0 flex-col gap-0.5',
                        i === 0 ? 'pr-3' : 'border-l border-line px-3',
                        i === shown.length - 1 && i > 0 && 'pr-0'
                     )}
                  >
                     <span className="flex items-baseline gap-1">
                        <span className="g num text-[30px] leading-[0.95]">
                           {round(readout.value as number)}
                        </span>
                        <span className="lab text-[11px] tracking-[0.14em]">
                           {readout.unit}
                        </span>
                     </span>
                     <span className="truncate text-[13px] leading-[1.4] text-ink-2">
                        {readout.note ?? ''}
                     </span>
                  </div>
               ))}
            </div>
         ) : (
            <span className="text-[14px] text-ink-3">{note}</span>
         )}
      </div>
   );
}
