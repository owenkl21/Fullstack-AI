import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

import { cn } from '@/lib/utils';

/*
 * The track is the dashed fishing line; the part you have covered is solid. The
 * grip is a 48px teal block, square like every other control that is not an icon.
 * `aria-label` and `aria-labelledby` land on the thumb, which is the element the
 * assistive technology actually reads, so the control is never unnamed.
 */

const DASHED_TRACK =
   'repeating-linear-gradient(90deg, color-mix(in srgb, var(--teal) 60%, transparent) 0 10px, transparent 10px 18px)';

const Slider = React.forwardRef<
   React.ElementRef<typeof SliderPrimitive.Root>,
   React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(
   (
      {
         className,
         'aria-label': ariaLabel,
         'aria-labelledby': ariaLabelledBy,
         ...props
      },
      ref
   ) => (
      <SliderPrimitive.Root
         ref={ref}
         data-slot="slider"
         className={cn(
            'relative flex h-12 w-full touch-none select-none items-center data-[disabled]:opacity-50',
            className
         )}
         {...props}
      >
         <SliderPrimitive.Track
            data-slot="slider-track"
            className="relative h-[3px] w-full grow"
            style={{ backgroundImage: DASHED_TRACK }}
         >
            <SliderPrimitive.Range
               data-slot="slider-range"
               className="absolute h-full bg-teal"
            />
         </SliderPrimitive.Track>
         <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            className="block h-12 w-5 bg-teal transition-[filter] duration-150 [transition-timing-function:var(--ease)] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none"
         />
      </SliderPrimitive.Root>
   )
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
