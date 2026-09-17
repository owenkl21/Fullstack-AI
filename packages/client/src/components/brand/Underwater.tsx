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
 * The motion is meant to be seen. Bubbles rise continuously and a fish crosses
 * every twenty seconds or so, because an effect nobody notices is not worth the
 * frames it costs. It stays behind the words rather than over them, and the
 * conditions printed on top remain the reason anyone opened the page.
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
   fish = true,
}: {
   className?: string;
   seed?: number;
   count?: number;
   /** Off where the section is short enough that a fish would only fluster it. */
   fish?: boolean;
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

         {fish ? (
            <span className="swimmer">
               <svg viewBox="0 0 68 44" aria-hidden="true">
                  <path
                     d="M2 30c10-14 24-20 40-16 8 2 14 6 24 6-8 6-16 8-24 8-16 0-30-4-40 2Z"
                     fill="none"
                     stroke="currentColor"
                     strokeWidth="2.2"
                     strokeLinecap="round"
                     strokeLinejoin="round"
                  />
                  <path
                     d="M44 14c-4-6-10-8-16-8 4 4 8 6 14 6M22 24c4 4 8 4 12 2"
                     fill="none"
                     stroke="currentColor"
                     strokeWidth="2.2"
                     strokeLinecap="round"
                     strokeLinejoin="round"
                  />
               </svg>
            </span>
         ) : null}
      </div>
   );
}
