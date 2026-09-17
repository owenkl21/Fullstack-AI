import * as RadixSlider from '@radix-ui/react-slider';
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

/*
 * A distance, by dragging.
 *
 * Radix does the dragging, the keys and the screen reader; the drawing is
 * ours. The track is the product's dashed fishing line, the filled part is
 * teal, the stops are small squares that light as the thumb passes them,
 * and the thumb is a square of ink in a paper ring with the value riding
 * above it.
 *
 * The value is held here while the thumb moves and handed out only when it
 * settles. Handing out every step re-filtered a whole feed per pixel, which
 * is what made the first version feel like dragging through mud.
 */
export function StopSlider({
   label,
   stops,
   value,
   onCommit,
   format,
   hint,
   className,
}: {
   label: string;
   stops: ReadonlyArray<number>;
   value: number;
   onCommit: (next: number) => void;
   format: (value: number) => string;
   hint?: string | null;
   className?: string;
}) {
   const id = useId();
   const last = Math.max(1, stops.length - 1);
   /* Only a drag in progress is held here; otherwise the page's value shows. */
   const [drag, setDrag] = useState<number | null>(null);
   const dragging = drag !== null;
   const index = drag ?? Math.max(0, stops.indexOf(value));

   const shown = stops[index] ?? value;

   return (
      <div className={cn('flex min-w-0 flex-col', className)}>
         <div className="flex items-baseline justify-between gap-4">
            <span id={id} className="lab">
               {label}
            </span>
            <output className="g num text-[26px] leading-none">
               {format(shown)}
            </output>
         </div>

         <RadixSlider.Root
            className="relative mt-4 flex h-11 w-full touch-none items-center select-none [will-change:transform]"
            min={0}
            max={last}
            step={1}
            value={[index]}
            aria-labelledby={id}
            onValueChange={([next]) => setDrag(next ?? 0)}
            onValueCommit={([next]) => {
               setDrag(null);
               const stop = stops[next ?? 0];
               if (typeof stop === 'number') onCommit(stop);
            }}
         >
            <RadixSlider.Track className="relative h-[2px] w-full grow [background:repeating-linear-gradient(90deg,var(--line-2)_0_8px,transparent_8px_14px)]">
               <RadixSlider.Range className="absolute h-full bg-teal" />
            </RadixSlider.Track>
            {stops.map((stop, i) => (
               <span
                  key={stop}
                  aria-hidden="true"
                  className={cn(
                     'pointer-events-none absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 border-2 transition-colors duration-150',
                     i <= index
                        ? 'border-teal bg-teal'
                        : 'border-line-2 bg-background'
                  )}
                  style={{ left: `${(i / last) * 100}%` }}
               />
            ))}
            <RadixSlider.Thumb
               aria-valuetext={format(shown)}
               className="group relative block size-6 border-[3px] border-background bg-ink shadow-[0_0_0_1px_var(--ink)] transition-transform duration-100 [transition-timing-function:var(--ease)] hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal data-[state=active]:scale-110"
            >
               <span
                  aria-hidden="true"
                  className={cn(
                     'g num pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 bg-ink px-2 py-1 text-[15px] whitespace-nowrap text-background transition-opacity duration-150',
                     dragging ? 'opacity-100' : 'opacity-0'
                  )}
               >
                  {format(shown)}
               </span>
            </RadixSlider.Thumb>
         </RadixSlider.Root>

         <div
            aria-hidden="true"
            className="num mt-1 flex justify-between text-[12px] text-ink-3"
         >
            {stops.map((stop) => (
               <span key={stop}>{format(stop)}</span>
            ))}
         </div>
         {hint ? <p className="mt-1.5 text-[14px] text-ink-3">{hint}</p> : null}
      </div>
   );
}
