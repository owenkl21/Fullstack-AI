import type { CSSProperties, ReactNode } from 'react';
import { Contours } from '@/components/brand/Contours';
import { TornEdge } from '@/components/brand/TornEdge';

/*
 * The head of a page in the app, at phone size: a black plate with the survey
 * lines on it, a teal kicker over the title and the water hanging off the
 * bottom of it. The app's own PageHead cannot be used here because it bleeds
 * to the width of the window, and inside the phone the window is the page.
 *
 * The water is only drawn on the screen the reader is looking at, so the
 * screens waiting behind this one are not each running a waterline.
 */
export function ScreenHead({
   on,
   kicker,
   title,
   aside,
   seed = 11,
}: {
   on: boolean;
   kicker: string;
   title: string;
   aside?: ReactNode;
   seed?: number;
}) {
   return (
      <div className="relative bg-black-block pt-14 pb-8 text-paper">
         <Contours
            seed={seed}
            className="inset-0 h-full w-full opacity-80"
            style={
               {
                  '--contour': 'rgba(244, 241, 236, 0.16)',
               } as CSSProperties
            }
         />
         <div className="relative z-[2] flex items-end justify-between gap-4 px-[18px]">
            <span className="min-w-0">
               <span className="lab block text-[11px] text-teal">{kicker}</span>
               <span className="g mt-1.5 block text-[42px]">{title}</span>
            </span>
            {aside ? <span className="lab num shrink-0">{aside}</span> : null}
         </div>
         {on ? (
            <TornEdge fill="bg" className="bottom-[-1px] z-[3] h-8" />
         ) : null}
      </div>
   );
}
