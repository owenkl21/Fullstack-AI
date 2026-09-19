import { useMemo } from 'react';
import { cn } from '@/lib/utils';

/*
 * Below the waterline.
 *
 * The torn edge already divides a photograph from the page. Read as a
 * waterline, the section under it is underwater, and that is the one place this
 * product should be bold: it is a rock and surf log, and the water is the thing
 * it is about.
 *
 * Light through moving water and bubbles rising, and nothing else. A fish
 * swimming past was tried and cut: at this size it read as a logo on a loop
 * rather than as a fish, and it pulled the eye off the conditions, which are
 * the reason anyone opened the page.
 *
 * All of it is decoration, so all of it is aria-hidden and none of it takes a
 * pointer. It is CSS rather than a motion library: transforms of this kind are
 * composited by the browser, and a dependency to slide eight bubbles would be a
 * poor trade.
 */

type Bubble = {
   left: number;
   size: number;
   delay: number;
   duration: number;
   drift: number;
};

/* Deterministic, so a bubble does not jump to a new column on every render. */
function bubbles(seed: number, count: number): Bubble[] {
   let s = seed * 7919 + 13;
   const next = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
   };

   return Array.from({ length: count }, () => ({
      left: 4 + next() * 92,
      size: 3 + next() * 7,
      /* Staggered rather than ranked, but close enough together that the
       * water is visibly moving at any moment you look at it. */
      delay: next() * 9,
      duration: 6 + next() * 5,
      drift: (next() - 0.5) * 46,
   }));
}

export function Underwater({
   className,
   seed = 7,
   count = 16,
}: {
   className?: string;
   seed?: number;
   count?: number;
}) {
   const drops = useMemo(() => bubbles(seed, count), [seed, count]);

   return (
      <div aria-hidden="true" className={cn('underwater', className)}>
         {/*
          * Light from the surface, moving slowly. This is what actually says
          * "under water" rather than "dark"; the bubbles only confirm it.
          */}
         <span className="underwater-caustics" />

         {drops.map((bubble, index) => (
            <span
               key={index}
               className="bubble"
               style={
                  {
                     left: `${bubble.left}%`,
                     width: `${bubble.size}px`,
                     height: `${bubble.size}px`,
                     animationDelay: `${bubble.delay}s`,
                     animationDuration: `${bubble.duration}s`,
                     '--drift': `${bubble.drift}px`,
                  } as React.CSSProperties
               }
            />
         ))}
      </div>
   );
}
