import * as RadixSlider from '@radix-ui/react-slider';
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

/*
 * A fader.
 *
 * The distance control is drawn like a fader on a desk: a deep track, a
 * teal fill up to where you are, a tall grip you can actually get hold of,
 * and a ruled scale under it. Radix does the dragging, the keys and the
 * screen reader; every pixel of the drawing is ours.
 *
 * The value is held here while the grip moves and handed out only when it
 * settles. Handing out every step re-filtered a whole feed per pixel.
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
            <output
               className={cn(
                  'g num text-[34px] leading-none transition-colors duration-150',
                  dragging ? 'text-teal-text' : 'text-ink'
               )}
            >
               {format(shown)}
            </output>
         </div>

         <RadixSlider.Root
            className="fader relative mt-3 flex h-14 w-full touch-none items-center select-none"
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
            <RadixSlider.Track className="fader-track relative h-3 w-full grow bg-line">
               <RadixSlider.Range className="absolute h-full bg-teal" />
            </RadixSlider.Track>
            <RadixSlider.Thumb
               aria-valuetext={format(shown)}
               className="fader-grip group relative block h-9 w-5 cursor-grab bg-ink outline-none transition-transform duration-100 [transition-timing-function:var(--ease)] hover:scale-y-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal active:cursor-grabbing data-[state=active]:scale-y-105"
            >
               <span
                  aria-hidden="true"
                  className={cn(
                     'absolute top-1/2 left-1/2 block h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 transition-colors duration-100',
                     dragging ? 'bg-teal' : 'bg-background'
                  )}
               />
            </RadixSlider.Thumb>
         </RadixSlider.Root>

         {/* The scale: a rule under the track, a tick per stop, the figure below. */}
         <div aria-hidden="true" className="relative mt-1 h-7">
            {stops.map((stop, i) => (
               <span
                  key={stop}
                  className="absolute top-0 flex flex-col items-center"
                  style={{
                     left: `${(i / last) * 100}%`,
                     transform:
                        i === 0
                           ? 'translateX(0)'
                           : i === last
                             ? 'translateX(-100%)'
                             : 'translateX(-50%)',
                  }}
               >
                  <span
                     className={cn(
                        'block h-2 w-[2px]',
                        i <= index ? 'bg-teal' : 'bg-line-2'
                     )}
                  />
                  <span
                     className={cn(
                        'num mt-1 text-[12px] whitespace-nowrap',
                        i === index ? 'text-ink' : 'text-ink-3'
                     )}
                  >
                     {format(stop)}
                  </span>
               </span>
            ))}
         </div>
         {hint ? <p className="mt-1 text-[14px] text-ink-3">{hint}</p> : null}
      </div>
   );
}
