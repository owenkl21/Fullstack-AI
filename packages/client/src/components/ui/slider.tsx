import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

import { cn } from '@/lib/utils';

const Slider = React.forwardRef<
   React.ElementRef<typeof SliderPrimitive.Root>,
   React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
   <SliderPrimitive.Root
      ref={ref}
      data-slot="slider"
      className={cn(
         'relative flex w-full touch-none select-none items-center data-[disabled]:opacity-50',
         className
      )}
      {...props}
   >
      <SliderPrimitive.Track
         data-slot="slider-track"
         className="bg-muted relative h-2 w-full grow overflow-hidden rounded-full"
      >
         <SliderPrimitive.Range
            data-slot="slider-range"
            className="bg-primary absolute h-full"
         />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
         data-slot="slider-thumb"
         className="border-primary bg-background ring-ring/50 block h-5 w-5 rounded-full border-2 shadow transition-colors focus-visible:ring-4 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      />
   </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
