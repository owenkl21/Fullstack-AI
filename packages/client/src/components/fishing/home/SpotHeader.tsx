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
         <div className="absolute inset-x-4 top-4 z-[2] md:inset-x-8">
            <span className="lab text-paper-2">{today}</span>
         </div>
         <div className="absolute inset-x-4 bottom-7 z-[2] flex flex-col gap-0.5 md:inset-x-8 md:bottom-12">
            {lastFished ? (
               <span className="lab text-teal">{lastFished}</span>
            ) : null}
            <h1 className="g text-[52px] text-paper md:text-[72px]">
               {spotName}
            </h1>
         </div>
         <TornEdge fill="bg" />
      </header>
   );
}
