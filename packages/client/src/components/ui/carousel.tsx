import * as React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type CarouselApi = {
   scrollPrev: () => void;
   scrollNext: () => void;
   selectedIndex: () => number;
};

type CarouselProps = {
   setApi?: (api: CarouselApi) => void;
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
   className,
   children,
   ...props
}: React.ComponentProps<'div'> & CarouselProps) {
   const [index, setIndex] = React.useState(0);
   const [itemCount, setItemCount] = React.useState(0);

   const scrollPrev = React.useCallback(() => {
      setIndex((prev) => Math.max(prev - 1, 0));
   }, []);

   const scrollNext = React.useCallback(() => {
      setIndex((prev) => Math.min(prev + 1, Math.max(itemCount - 1, 0)));
   }, [itemCount]);

   React.useEffect(() => {
      if (index > itemCount - 1) {
         setIndex(Math.max(itemCount - 1, 0));
      }
   }, [index, itemCount]);

   React.useEffect(() => {
      if (!setApi) return;
      setApi({
         scrollPrev,
         scrollNext,
         selectedIndex: () => index,
      });
   }, [index, scrollNext, scrollPrev, setApi]);

   return (
      <CarouselContext.Provider
         value={{
            index,
            itemCount,
            canScrollPrev: index > 0,
            canScrollNext: index < itemCount - 1,
            setItemCount,
            scrollPrev,
            scrollNext,
         }}
      >
         <div className={cn('relative', className)} {...props}>
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
   const { index, setItemCount } = useCarousel();
   const slides = React.Children.toArray(children);

   React.useEffect(() => {
      setItemCount(slides.length);
   }, [setItemCount, slides.length]);

   return (
      <div className="overflow-hidden">
         <div
            className={cn(
               'flex transition-transform duration-300 ease-out',
               className
            )}
            style={{ transform: `translateX(-${index * 100}%)` }}
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

function CarouselPrevious({
   className,
   size = 'icon',
   variant = 'outline',
   ...props
}: React.ComponentProps<typeof Button>) {
   const { canScrollPrev, scrollPrev } = useCarousel();
   return (
      <Button
         size={size}
         variant={variant}
         className={cn(
            'absolute left-2 top-1/2 z-10 size-8 -translate-y-1/2 rounded-full',
            className
         )}
         disabled={!canScrollPrev}
         onClick={scrollPrev}
         {...props}
      >
         <ArrowLeft className="size-4" />
         <span className="sr-only">Previous slide</span>
      </Button>
   );
}

function CarouselNext({
   className,
   size = 'icon',
   variant = 'outline',
   ...props
}: React.ComponentProps<typeof Button>) {
   const { canScrollNext, scrollNext } = useCarousel();
   return (
      <Button
         size={size}
         variant={variant}
         className={cn(
            'absolute right-2 top-1/2 z-10 size-8 -translate-y-1/2 rounded-full',
            className
         )}
         disabled={!canScrollNext}
         onClick={scrollNext}
         {...props}
      >
         <ArrowRight className="size-4" />
         <span className="sr-only">Next slide</span>
      </Button>
   );
}

export {
   type CarouselApi,
   Carousel,
   CarouselContent,
   CarouselItem,
   CarouselNext,
   CarouselPrevious,
};
