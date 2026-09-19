import { useEffect, useRef, useState } from 'react';
import { TornEdge } from '@/components/brand/TornEdge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ANCHOR, WRAP } from './layout';
import { photos } from './photos';
import { useParallaxFallback } from './useParallaxFallback';
import { Link } from 'react-router-dom';

/*
 * One photograph edge to edge, the promise over it, and the single teal action.
 *
 * The words sit at the bottom left rather than dead centre. Centred type over a
 * photograph is the safe arrangement and it fought the picture: the headline
 * landed on the horizon and the rock on the right had nothing to do. Anchored
 * low and left, the type sits on the dark water where it is legible without a
 * heavy scrim, and the coast keeps the top of the frame.
 *
 * The three lines arrive 120ms apart once the page has painted.
 */
export function LandingHero() {
   const band = useRef<HTMLDivElement>(null);
   useParallaxFallback(band, 0.28);

   const [entered, setEntered] = useState(false);
   useEffect(() => {
      // A short timer rather than animation frames: frames pause in a background tab,
      // and the promise must be on screen the moment the page is looked at.
      const timer = window.setTimeout(() => setEntered(true), 60);
      return () => window.clearTimeout(timer);
   }, []);

   const rise = (delay: string) => ({
      className: cn(
         'transition-[opacity,transform]',
         entered ? 'translate-y-0 opacity-100' : 'translate-y-[22px] opacity-0'
      ),
      style: {
         transitionDuration: '0.7s, 0.8s',
         transitionTimingFunction: 'var(--ease)',
         transitionDelay: entered ? delay : '0s',
      },
   });

   const headline = rise('0s');
   const line = rise('0.12s');
   const action = rise('0.24s');

   return (
      <section
         id="top"
         className={cn(
            'relative h-[clamp(600px,calc(100vh-60px),760px)] overflow-hidden bg-black-block text-paper md:h-[clamp(560px,calc(100dvh-60px),860px)]',
            ANCHOR
         )}
      >
         <div
            ref={band}
            className="parallax-hero absolute inset-x-0 top-[-12%] bottom-0"
         >
            <img
               src={photos.heroSpot}
               alt="An angler casting from the rocks at sunset"
               fetchPriority="high"
               className="h-full w-full object-cover object-[62%_45%]"
            />
         </div>
         <div className="scrim-hero absolute inset-0" aria-hidden="true" />

         <div className="absolute inset-x-0 top-0 bottom-[92px] z-[2] flex items-end md:bottom-[104px]">
            <div
               className={cn(WRAP, 'flex flex-col items-start gap-4 md:gap-5')}
            >
               <h1
                  className={cn(
                     headline.className,
                     'g max-w-[19ch] text-[clamp(42px,12.2vw,60px)] text-balance [text-shadow:0_2px_24px_rgba(0,0,0,0.45)] md:max-w-[18ch] md:text-[clamp(56px,7.4vw,104px)]'
                  )}
                  style={headline.style}
               >
                  Log the fish before it goes back
               </h1>
               <p
                  className={cn(
                     line.className,
                     'max-w-[46ch] text-[16px] text-paper text-pretty [text-shadow:0_1px_14px_rgba(0,0,0,0.6)] md:text-[19px]'
                  )}
                  style={line.style}
               >
                  One tap stamps where you are, the minute and the weather. The
                  photograph names the fish.
               </p>
               <Button
                  size="lg"
                  className={cn(
                     action.className,
                     'md:h-[52px] md:px-7 md:text-[26px]'
                  )}
                  style={action.style}
                  asChild
               >
                  <Link to="/sign-up">Start your log</Link>
               </Button>
            </div>
         </div>

         <TornEdge fill="bg" seed={5} />
      </section>
   );
}
