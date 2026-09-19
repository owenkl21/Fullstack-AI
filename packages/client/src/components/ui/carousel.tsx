import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

import { cn } from '@/lib/utils';

/*
 * A photo carousel for a black block. The controls are the only round things in
 * the product: 48px circles on the photograph itself, in Heroicons outline. The
 * track wraps, drags on touch, answers the arrow keys, and says where you are
 * underneath rather than dotting the photo.
 */

type CarouselApi = {
   scrollPrev: () => void;
   scrollNext: () => void;
   scrollTo: (index: number) => void;
   selectedIndex: () => number;
};

type CarouselProps = {
   setApi?: (api: CarouselApi) => void;
   /** Names the set of photos for a screen reader, e.g. `Photos of Kob, 78 cm`. */
   label?: string;
};

type CarouselContextProps = {
   index: number;
   itemCount: number;
   canScrollPrev: boolean;
   canScrollNext: boolean;
   setItemCount: (count: number) => void;
   scrollPrev: () => void;
   scrollNext: () => void;
};

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
   const context = React.useContext(CarouselContext);
   if (!context) {
      throw new Error('useCarousel must be used within a <Carousel />');
   }
   return context;
}

function Carousel({
   setApi,
   label,
   className,
   children,
   ...props
}: React.ComponentProps<'div'> & CarouselProps) {
   const [index, setIndex] = React.useState(0);
   const [itemCount, setItemCount] = React.useState(0);

   const scrollPrev = React.useCallback(() => {
      setIndex((prev) =>
         itemCount > 0 ? (prev - 1 + itemCount) % itemCount : 0
      );
   }, [itemCount]);

   const scrollNext = React.useCallback(() => {
      setIndex((prev) => (itemCount > 0 ? (prev + 1) % itemCount : 0));
   }, [itemCount]);

   const scrollTo = React.useCallback(
      (next: number) => {
         setIndex(
            itemCount > 0 ? Math.min(Math.max(next, 0), itemCount - 1) : 0
         );
      },
      [itemCount]
   );

   React.useEffect(() => {
      if (itemCount > 0 && index > itemCount - 1) {
         setIndex(itemCount - 1);
      }
   }, [index, itemCount]);

   React.useEffect(() => {
      if (!setApi) return;
      setApi({ scrollPrev, scrollNext, scrollTo, selectedIndex: () => index });
   }, [index, scrollNext, scrollPrev, scrollTo, setApi]);

   const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (itemCount < 2) return;
      if (event.key === 'ArrowLeft') {
         event.preventDefault();
         scrollPrev();
      }
      if (event.key === 'ArrowRight') {
         event.preventDefault();
         scrollNext();
      }
   };

   return (
      <CarouselContext.Provider
         value={{
            index,
            itemCount,
            canScrollPrev: itemCount > 1,
            canScrollNext: itemCount > 1,
            setItemCount,
            scrollPrev,
            scrollNext,
         }}
      >
         <div
            className={cn('relative', className)}
            role="group"
            aria-roledescription="carousel"
            aria-label={label}
            onKeyDown={onKeyDown}
            {...props}
         >
            {children}
         </div>
      </CarouselContext.Provider>
   );
}

function CarouselContent({
   className,
   children,
   ...props
}: React.ComponentProps<'div'>) {
   const { index, itemCount, setItemCount, scrollPrev, scrollNext } =
      useCarousel();
   const slides = React.Children.toArray(children);
   const dragStart = React.useRef<number | null>(null);

   React.useEffect(() => {
      setItemCount(slides.length);
   }, [setItemCount, slides.length]);

   const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'mouse' || itemCount < 2) return;
      dragStart.current = event.clientX;
   };

   const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
      const start = dragStart.current;
      dragStart.current = null;
      if (start === null) return;

      const travel = event.clientX - start;
      if (Math.abs(travel) < 44) return;
      if (travel < 0) {
         scrollNext();
      } else {
         scrollPrev();
      }
   };

   return (
      <div
         className="overflow-hidden touch-pan-y"
         onPointerDown={onPointerDown}
         onPointerUp={onPointerEnd}
         onPointerCancel={() => {
            dragStart.current = null;
         }}
      >
         <div
            className={cn(
               'flex transition-transform duration-500 [transition-timing-function:var(--ease)]',
               className
            )}
            style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
            {...props}
         >
            {slides}
         </div>
      </div>
   );
}

function CarouselItem({ className, ...props }: React.ComponentProps<'div'>) {
   return (
      <div
         className={cn('w-full shrink-0 grow-0 basis-full', className)}
         {...props}
      />
   );
}

const controlClasses =
   'absolute top-1/2 z-10 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full border border-paper/45 bg-black-block/55 text-paper transition-[background-color,transform] duration-150 [transition-timing-function:var(--ease)] hover:bg-black-block/80 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal';

function CarouselPrevious({
   className,
   ...props
}: React.ComponentProps<'button'>) {
   const { canScrollPrev, scrollPrev } = useCarousel();
   if (!canScrollPrev) return null;

   return (
      <button
         type="button"
         className={cn(controlClasses, 'left-3', className)}
         onClick={scrollPrev}
         {...props}
      >
         <ChevronLeftIcon
            className="size-6"
            strokeWidth={1.5}
            aria-hidden="true"
         />
         <span className="sr-only">Previous photo</span>
      </button>
   );
}

function CarouselNext({ className, ...props }: React.ComponentProps<'button'>) {
   const { canScrollNext, scrollNext } = useCarousel();
   if (!canScrollNext) return null;

   return (
      <button
         type="button"
         className={cn(controlClasses, 'right-3', className)}
         onClick={scrollNext}
         {...props}
      >
         <ChevronRightIcon
            className="size-6"
            strokeWidth={1.5}
            aria-hidden="true"
         />
         <span className="sr-only">Next photo</span>
      </button>
   );
}

/**
 * Where you are in the set. `2 of 5` by default, sitting under the
 * photograph; pass `separator="/"` for the `2 / 5` the feed card wears as a
 * badge on the picture itself, with the badge's own look coming from
 * `className`. Whatever the separator, it is spoken as "Photo 2 of 5", so a
 * slash is never read out as one.
 */
function CarouselCounter({
   className,
   separator = 'of',
   ...props
}: React.ComponentProps<'p'> & { separator?: React.ReactNode }) {
   const { index, itemCount } = useCarousel();
   if (itemCount < 2) return null;

   return (
      <p
         className={cn('lab num', className)}
         aria-live="polite"
         aria-label={`Photo ${index + 1} of ${itemCount}`}
         {...props}
      >
         <span aria-hidden="true">
            {index + 1} {separator} {itemCount}
         </span>
      </p>
   );
}

export {
   type CarouselApi,
   Carousel,
   CarouselContent,
   CarouselItem,
   CarouselNext,
   CarouselPrevious,
   CarouselCounter,
};
