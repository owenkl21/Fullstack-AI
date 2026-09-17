import { Contours } from '@/components/brand/Contours';
import { Underwater } from '@/components/brand/Underwater';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CountIn } from '@/components/fishing/record/CountIn';
import type { toReadouts } from '@/components/fishing/record/api';
import type { WeatherSnapshot } from '@/components/fishing/record/api';
import { ConditionsDetail } from './ConditionsDetail';
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
   snapshot,
   takenAt,
   place,
   onRequest,
}: {
   status: ConditionsStatus;
   readouts: ReadoutSet | null;
   /* The whole reading, for the detail under the three headline figures. */
   snapshot?: WeatherSnapshot | null;
   takenAt: string | null;
   /* The nearest named place, once it is known. */
   place?: string | null;
   onRequest: () => void;
}) {
   const waiting = status === 'locating' || status === 'loading';

   return (
      <section
         aria-labelledby="conditions-heading"
         /* Top padding makes room for the plate's edge hanging over this
            section; the water shows through its troughs. */
         className="relative px-4 pt-[78px] pb-2 md:px-8 md:pt-[112px]"
      >
         {/*
          * This section sits directly under the torn edge, which reads as the
          * waterline, so it is the one place in the product that is literally
          * under water. The contours stay: they are the sea floor now rather
          * than decoration.
          *
          * The water runs the width of the screen, not the width of the
          * column of text. Clipped to the 860px column it stopped at a hard
          * vertical edge on a desktop, which is the one thing a sea floor
          * never does. The root hides horizontal overflow, so a 100vw layer
          * costs no scrollbar.
          */}
         <div
            aria-hidden="true"
            className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 overflow-hidden"
         >
            <Underwater seed={3} />
            {/* No fixed size: the art is generated at whatever shape this
                layer is, so it does not smear on a wide screen. */}
            <Contours seed={3} className="inset-0 h-full w-full" />
         </div>
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
               <ConditionsDetail snapshot={snapshot ?? null} />

               <p className="relative mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[14px] text-ink-3">
                  <span>
                     {place
                        ? `Conditions at ${place}`
                        : 'Conditions at your position'}
                     {takenAt ? `, taken ${takenAt}.` : '.'}
                  </span>
                  <Link
                     to="/forecast"
                     className="g-tracked text-[16px] text-ink underline-offset-4 hover:underline"
                  >
                     The week ahead
                  </Link>
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
               <div className="flex flex-wrap items-center gap-4">
                  <Button
                     type="button"
                     variant="outline"
                     size="lg"
                     onClick={onRequest}
                  >
                     {status === 'idle' ? 'Use my position' : 'Try again'}
                  </Button>
                  <Link
                     to="/forecast"
                     className="g-tracked text-[17px] text-ink underline-offset-4 hover:underline"
                  >
                     Or look up a place
                  </Link>
               </div>
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
