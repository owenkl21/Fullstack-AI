import { useEffect, useState } from 'react';
import { TornEdge } from '@/components/brand/TornEdge';
import { framingStyle, type Framing } from '@/lib/framing';
import { cn } from '@/lib/utils';

/*
 * Where you last fished: the photograph, then a solid plate carrying the name.
 *
 * The words used to sit on the picture over a gradient, which measured 1.01:1
 * against open water. Teal and sunlit sea are the same brightness, so the
 * overline was invisible, and no scrim fixes that without painting the
 * photograph out: to carry small text over a bright sky a scrim has to reach
 * about 0.93, at which point there is no photograph left to look at.
 *
 * So the picture stays a picture and the words get their own ground. Contrast
 * is then a property of the design rather than of whatever the sky was doing.
 *
 * The picture still drifts from 106% to 100% once on load, the one slow move in
 * the product, and the painted edge hands the page back to the paper underneath.
 */
export function SpotHeader({
   photoUrl,
   photoFraming,
   spotName,
   today,
   lastFished,
   lastSpot = null,
}: {
   photoUrl: string;
   /*
    * The framing of the catch photograph, when that is what this is. The band
    * is the widest crop in the product, so an upright photo keeps a sliver of
    * itself and where that sliver is taken from is the whole picture. Left
    * out for the house photograph, which was shot for the band.
    */
   photoFraming?: Framing | null;
   spotName: string;
   today: string;
   lastFished: string | null;
   /* The spot of the latest catch the reader may see. */
   lastSpot?: string | null;
}) {
   const [settled, setSettled] = useState(false);

   /* Both are already formatted for display, so compare what is on the page. */
   const sameDay = Boolean(
      lastFished &&
      today &&
      lastFished.toLowerCase().includes(today.toLowerCase())
   );

   useEffect(() => {
      const frame = requestAnimationFrame(() => setSettled(true));
      return () => cancelAnimationFrame(frame);
   }, []);

   return (
      <header className="relative bg-black-block text-paper">
         {/*
          * Tall enough on a wide screen to still be a photograph. At 260px
          * across 1440 the crop is five and a half to one, which cut the
          * angler off at the shoulders.
          */}
         <div className="relative h-[190px] overflow-hidden md:h-[340px]">
            <img
               src={photoUrl}
               alt=""
               fetchPriority="high"
               style={
                  photoFraming !== undefined
                     ? framingStyle(photoFraming)
                     : undefined
               }
               className={cn(
                  'absolute inset-0 h-full w-full object-cover transition-transform duration-[12000ms] ease-linear',
                  settled ? 'scale-100' : 'scale-[1.06]'
               )}
            />
            {/*
             * A light wash only, to seat the photograph against the plate under
             * it. Nothing is read through this any more, so it no longer has to
             * fight the sky.
             */}
            <div
               className="scrim-seat pointer-events-none absolute inset-0"
               aria-hidden="true"
            />
         </div>

         <div className="relative z-[2] pt-5 pb-9 md:pt-7 md:pb-10">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-2.5 px-4 md:px-8">
               {/*
                * Today's date is dropped when the last trip was today, because
                * the plate was printing the same date twice on one line with
                * only one of them labelled.
                */}
               <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  {lastFished ? (
                     <span className="lab text-teal">{lastFished}</span>
                  ) : (
                     <span />
                  )}
                  {sameDay ? null : (
                     <span className="lab text-paper-2">{today}</span>
                  )}
               </div>
               <h1 className="g text-[52px] text-paper md:text-[72px]">
                  {spotName}
               </h1>
               {lastSpot ? (
                  <p className="text-[15px] text-paper-2">
                     Last at <span className="text-paper">{lastSpot}</span>
                  </p>
               ) : null}
            </div>
         </div>

         <TornEdge fill="black" cut />
      </header>
   );
}
