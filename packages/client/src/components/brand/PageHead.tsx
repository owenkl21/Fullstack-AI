import type { ReactNode, Ref } from 'react';
import { TornEdge } from '@/components/brand/TornEdge';
import { Contours } from '@/components/brand/Contours';
import { cn } from '@/lib/utils';

/*
 * The head of a page, inverted: a black plate with the title in paper and
 * the waterline under it, the way the conditions page opened. It bleeds to
 * the screen's edges from inside the page's own column, and leaves room
 * under itself for the water to hang into, so the section that follows,
 * with its contour lines, starts under the wave rather than through it.
 */
export function PageHead({
   back,
   kicker,
   kickerTone = 'teal',
   title,
   aside,
   lede,
   column = 'w-[min(1680px,100%-32px)]',
   titleRef,
   children,
}: {
   /*
    * A way back out, above everything else on the plate: an arrow and one
    * word. The slot carries the type (League Gothic 15px, tracked, paper-2),
    * so a page passes a bare link and gets the same back link every other
    * page has.
    */
   back?: ReactNode;
   kicker?: ReactNode;
   /*
    * The status line. Teal while something is live; quiet once it has
    * finished and the line is only a record of what it was.
    */
   kickerTone?: 'teal' | 'quiet';
   title: ReactNode;
   /* Something on the right: a count, a button, a line of figures. */
   aside?: ReactNode;
   /* A sentence under the title. */
   lede?: ReactNode;
   /* The page's own column, so the title lines up with what follows. */
   column?: string;
   /*
    * For a page that sends focus back to its title, after a delete has taken
    * away the row that held it. Given one, the title can take focus.
    */
   titleRef?: Ref<HTMLHeadingElement>;
   children?: ReactNode;
}) {
   return (
      <header
         className="relative left-1/2 z-[1] mb-[132px] w-screen -translate-x-1/2 bg-black-block text-paper md:mb-[180px]"
         style={
            { '--contour': 'rgba(244, 241, 236, 0.16)' } as React.CSSProperties
         }
      >
         {/* The plate itself, with the survey lines on it, edge to edge,
             drawn once. Its box reaches down through the hanging water to
             the crest, so the plate is one sheet of lines to the waterline;
             the water (a hollow edge, so it paints no plate of its own)
             covers what spills below it. Never clipped by the header. */}
         <div aria-hidden="true" className="plate-art bg-black-block">
            <Contours seed={17} className="inset-0 h-full w-full" />
         </div>
         <div
            className={cn(
               'relative mx-auto pt-7 pb-5 md:pt-10 md:pb-7',
               column
            )}
         >
            {back ? (
               <div className="g-tracked text-[15px] leading-none text-paper-2">
                  {back}
               </div>
            ) : null}
            <div
               className={cn(
                  'flex flex-wrap items-end justify-between gap-x-8 gap-y-4',
                  back && 'mt-3.5 md:mt-[18px]'
               )}
            >
               <div className="min-w-0">
                  {kicker ? (
                     <p
                        className={cn(
                           'lab',
                           kickerTone === 'quiet' ? 'text-paper-2' : 'text-teal'
                        )}
                     >
                        {kicker}
                     </p>
                  ) : null}
                  <h1
                     ref={titleRef}
                     tabIndex={titleRef ? -1 : undefined}
                     className="g mt-1 text-[44px] leading-none text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal md:text-[64px]"
                  >
                     {title}
                  </h1>
                  {lede ? (
                     <p className="mt-3 max-w-[56ch] text-[17px] text-paper-2">
                        {lede}
                     </p>
                  ) : null}
               </div>
               {aside ? (
                  <div className="text-[15px] text-paper-2">{aside}</div>
               ) : null}
            </div>
            {children ? <div className="mt-6">{children}</div> : null}
         </div>
         <TornEdge fill="black" cut hollow />
      </header>
   );
}
