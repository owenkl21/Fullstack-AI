import { useEffect, useRef, useState } from 'react';
import { TornEdge } from '@/components/brand/TornEdge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ANCHOR } from './layout';
import { photos } from './photos';
import { useParallaxFallback } from './useParallaxFallback';
import { Link } from 'react-router-dom';

/*
 * One photograph edge to edge, the promise over it, and the single teal action. The
 * three lines arrive 120ms apart once the page has painted.
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
               className="h-full w-full object-cover object-[50%_45%]"
            />
         </div>
         <div className="scrim-hero absolute inset-0" aria-hidden="true" />

         <div className="absolute inset-x-0 top-0 bottom-[84px] z-[2] flex flex-col items-center justify-center gap-3.5 px-6 text-center md:bottom-[90px] md:gap-[18px]">
            <h1
               className={cn(
                  headline.className,
                  'g max-w-[30ch] text-[clamp(52px,17vw,72px)] text-balance [text-shadow:0_2px_24px_rgba(0,0,0,0.35)] md:text-[clamp(48px,6.6vw,96px)]'
               )}
               style={headline.style}
            >
               Every fish. Every condition. The whole season.
            </h1>
            <p
               className={cn(
                  line.className,
                  'max-w-[52ch] text-[16px] text-paper/90 text-pretty [text-shadow:0_1px_14px_rgba(0,0,0,0.55)] md:text-[18px]'
               )}
               style={line.style}
            >
               One tap stamps the place, the minute and the weather. The record
               builds itself before the fish goes back.
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

         <TornEdge fill="bg" seed={5} />
      </section>
   );
}
