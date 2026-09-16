import { Contours } from '@/components/brand/Contours';
import { Button } from '@/components/ui/button';
import { CountIn } from '@/components/fishing/record/CountIn';
import type { toReadouts } from '@/components/fishing/record/api';
import { cn } from '@/lib/utils';

/*
 * Wind, pressure and air at the angler's own position, divided by the dashed line
 * and drawn over faint contour art. The position is asked for only when the person
 * taps for it, never on arrival, so opening the app never opens a permission prompt.
 */
export type ConditionsStatus =
   | 'idle'
   | 'locating'
   | 'loading'
   | 'ready'
   | 'denied'
   | 'error';

type ReadoutSet = ReturnType<typeof toReadouts>;

export function Readouts({
   status,
   readouts,
   takenAt,
   onRequest,
}: {
   status: ConditionsStatus;
   readouts: ReadoutSet | null;
   takenAt: string | null;
   onRequest: () => void;
}) {
   const waiting = status === 'locating' || status === 'loading';

   return (
      <section
         aria-labelledby="conditions-heading"
         className="relative overflow-hidden px-4 pt-6 pb-2 md:px-8"
      >
         <Contours
            seed={3}
            width={460}
            height={240}
            className="top-[-30%] left-[-10%] h-[160%] w-[120%]"
         />
         <h2 id="conditions-heading" className="sr-only">
            Conditions
         </h2>

         {status === 'ready' && readouts ? (
            <>
               <div className="relative grid grid-cols-3">
                  <Readout
                     label="Wind"
                     value={readouts.wind.value}
                     unit={readouts.wind.unit}
                     note={readouts.wind.note}
                  />
                  <Readout
                     label="Pressure"
                     value={readouts.pressure.value}
                     unit={readouts.pressure.unit}
                     note={readouts.pressure.note}
                     divided
                  />
                  <Readout
                     label="Air"
                     value={readouts.air.value}
                     unit={readouts.air.unit}
                     note={readouts.air.note}
                     divided
                  />
               </div>
               <p className="relative mt-3 text-[14px] text-ink-3">
                  {takenAt
                     ? `Conditions at your position, taken ${takenAt}.`
                     : 'Conditions at your position.'}
               </p>
            </>
         ) : waiting ? (
            <div className="relative" role="status" aria-live="polite">
               <div className="grid grid-cols-3">
                  {['Wind', 'Pressure', 'Air'].map((label, position) => (
                     <div
                        key={label}
                        className={cn(
                           'flex flex-col gap-2 pr-3',
                           position > 0 && 'rule-dashed-v pl-3'
                        )}
                     >
                        <span className="lab">{label}</span>
                        <span className="h-9 w-16 bg-bg-2" />
                     </div>
                  ))}
               </div>
               <p className="mt-3 text-[14px] text-ink-3">
                  {status === 'locating'
                     ? 'Getting your position'
                     : 'Reading the conditions'}
               </p>
            </div>
         ) : (
            <div className="relative flex flex-col items-start gap-3">
               <p className="max-w-[46ch] text-[15px] text-ink-2">
                  {status === 'denied'
                     ? 'Position not available. Let this site use your location, then try again.'
                     : status === 'error'
                       ? 'Could not read the conditions here. Try again.'
                       : 'Tap to get conditions'}
               </p>
               <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={onRequest}
               >
                  {status === 'idle' ? 'Use my position' : 'Try again'}
               </Button>
            </div>
         )}
      </section>
   );
}

function Readout({
   label,
   value,
   unit,
   note,
   divided = false,
}: {
   label: string;
   value: number | null;
   unit: string;
   note: string | null;
   divided?: boolean;
}) {
   return (
      <div
         className={cn(
            'relative flex flex-col pr-3',
            divided && 'rule-dashed-v pl-3'
         )}
      >
         <span className="lab">{label}</span>
         {value === null ? (
            <span className="mt-1 text-[15px] text-ink-2">Not reported</span>
         ) : (
            <span className="g num mt-1 text-[30px] leading-none md:text-[36px]">
               <CountIn value={value} durationMs={900} />
               <small className="ml-1 font-sans text-[14px] tracking-normal text-ink-2">
                  {unit}
               </small>
            </span>
         )}
         {note ? (
            <span className="mt-1 text-[14px] text-ink-2">{note}</span>
         ) : null}
      </div>
   );
}
