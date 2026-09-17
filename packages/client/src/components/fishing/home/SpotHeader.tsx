import { useEffect, useState } from 'react';
import { TornEdge } from '@/components/brand/TornEdge';
import { cn } from '@/lib/utils';

/*
 * Where you last fished, as a photograph with the name over it. The picture drifts
 * from 106% to 100% once on load, the one slow move in the product, and the painted
 * edge hands the page back to the paper underneath.
 */
export function SpotHeader({
   photoUrl,
   spotName,
   today,
   lastFished,
}: {
   photoUrl: string;
   spotName: string;
   today: string;
   lastFished: string | null;
}) {
   const [settled, setSettled] = useState(false);

   useEffect(() => {
      const frame = requestAnimationFrame(() => setSettled(true));
      return () => cancelAnimationFrame(frame);
   }, []);

   return (
      <header className="relative h-[300px] overflow-hidden bg-black-block text-paper md:h-[380px]">
         <img
            src={photoUrl}
            alt=""
            fetchPriority="high"
            className={cn(
               'absolute inset-0 h-full w-full object-cover transition-transform duration-[12000ms] ease-linear',
               settled ? 'scale-100' : 'scale-[1.06]'
            )}
         />
         <div
            className="pointer-events-none absolute inset-0 scrim-photo"
            aria-hidden="true"
         />
         <div className="absolute inset-x-0 top-4 z-[2]">
            <div className="mx-auto w-full max-w-[860px] px-4 md:px-8">
               <span className="lab text-paper-2">{today}</span>
            </div>
         </div>
         {/*
          * The eyebrow sat 2px off the headline, which put a small teal line
          * hard against a 72px display face and made both harder to read. It
          * also ran to the viewport edge while every section below sits in an
          * 860px column, so the page had two different left margins.
          */}
         {/*
          * Clear of the torn edge, which is 56px on a phone and 90px above that
          * and paints the next section's paper at a higher layer. The headline
          * used to sit inside that band, so its feet were washed out by the
          * very shape that was meant to sit under it.
          */}
         <div className="absolute inset-x-0 bottom-[68px] z-[2] md:bottom-[104px]">
            <div className="mx-auto flex w-full max-w-[860px] flex-col gap-2.5 px-4 md:px-8">
               {lastFished ? (
                  <span className="lab text-teal">{lastFished}</span>
               ) : null}
               <h1 className="g text-[52px] text-paper md:text-[72px]">
                  {spotName}
               </h1>
            </div>
         </div>
         <TornEdge fill="bg" />
      </header>
   );
}
