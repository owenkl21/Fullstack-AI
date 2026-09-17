import type { ReactNode } from 'react';
import { TornEdge } from '@/components/brand/TornEdge';
import { cn } from '@/lib/utils';

/*
 * The head of a page, inverted: a black plate with the title in paper and
 * the waterline under it, the way the conditions page opened. It bleeds to
 * the screen's edges from inside the page's own column, and leaves room
 * under itself for the water to hang into, so the section that follows,
 * with its contour lines, starts under the wave rather than through it.
 */
export function PageHead({
   kicker,
   title,
   aside,
   lede,
   column = 'w-[min(1680px,100%-32px)]',
   children,
}: {
   kicker?: string;
   title: ReactNode;
   /* Something on the right: a count, a button, a line of figures. */
   aside?: ReactNode;
   /* A sentence under the title. */
   lede?: ReactNode;
   /* The page's own column, so the title lines up with what follows. */
   column?: string;
   children?: ReactNode;
}) {
   return (
      <header className="relative left-1/2 z-[1] mb-[132px] w-screen -translate-x-1/2 bg-black-block text-paper md:mb-[180px]">
         <div className={cn('mx-auto pt-7 pb-5 md:pt-10 md:pb-7', column)}>
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
               <div className="min-w-0">
                  {kicker ? <p className="lab text-teal">{kicker}</p> : null}
                  <h1 className="g mt-1 text-[44px] leading-none text-paper md:text-[64px]">
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
         <TornEdge fill="black" cut />
      </header>
   );
}
