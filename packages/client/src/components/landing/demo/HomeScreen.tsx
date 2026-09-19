import { useEffect, useState, type RefObject } from 'react';
import { Contours } from '@/components/brand/Contours';
import { TornEdge } from '@/components/brand/TornEdge';
import { cn } from '@/lib/utils';
import { photos } from '../photos';
import { Counter } from './Counter';
import {
   demoMoment,
   logSays,
   nowScreen,
   readouts,
   recent,
   recentHeading,
   season,
   seasonHeading,
} from './data';
import type { Demo } from './useDemo';

/* The screen the app opens on: where you are, what the weather is doing, what your log
 * already knows about it, then the season and the last few catches. */
export function HomeScreen({
   demo,
   stripRef,
}: {
   demo: Demo;
   stripRef: RefObject<HTMLDivElement | null>;
}) {
   const [settled, setSettled] = useState(false);
   useEffect(() => {
      const raf = requestAnimationFrame(() => setSettled(true));
      return () => cancelAnimationFrame(raf);
   }, []);

   return (
      <>
         <div className="relative h-[280px] overflow-hidden bg-black-block text-paper md:h-[300px]">
            <img
               src={nowScreen.photo}
               alt={nowScreen.photoAlt}
               loading="lazy"
               className={cn(
                  'absolute inset-0 h-full w-full object-cover transition-transform duration-[12000ms] ease-linear',
                  settled ? 'scale-100' : 'scale-[1.06]'
               )}
            />
            <div className="scrim-photo absolute inset-0" />
            <div className="absolute top-14 right-[18px] left-[18px] z-[2] flex items-center justify-between md:top-16">
               <span className="lab text-[11px] text-paper-2">
                  {nowScreen.stamp}
               </span>
               <span className="lab text-[11px] text-teal">
                  {nowScreen.sunrise}
               </span>
            </div>
            <div className="absolute right-[18px] bottom-[26px] left-[18px] z-[2] flex flex-col gap-0.5">
               <span className="lab text-[12px] text-teal">
                  {nowScreen.summary}
               </span>
               <span className="g block text-[46px] md:text-[52px]">
                  {nowScreen.spot}
               </span>
            </div>
            <TornEdge fill="bg" className="bottom-[-1px] z-[3] h-10" />
         </div>

         <div className="relative grid grid-cols-3 px-4 pt-4 pb-1.5 md:px-[18px] md:pt-[18px]">
            <Contours
               seed={3}
               width={460}
               height={240}
               className="top-[-30%] left-[-10%] h-[160%] w-[120%] opacity-80"
            />
            {readouts.map((r, i) => (
               <div
                  key={r.key}
                  className={cn(
                     'relative flex flex-col pr-2 md:pr-3',
                     i > 0 && 'rule-dashed-v pl-2.5 md:pl-3'
                  )}
               >
                  <span className="lab text-[11px]">{r.key}</span>
                  <span className="g num mt-1 text-[30px] leading-none md:text-[36px]">
                     <Counter
                        to={r.to}
                        decimals={r.decimals}
                        duration={900}
                        token={demo.homeToken}
                     />
                     <small className="ml-1 font-sans text-[12px] tracking-normal text-ink-2">
                        {r.unit}
                     </small>
                  </span>
                  <span
                     className={cn(
                        'mt-0.5 text-[12px]',
                        r.teal ? 'font-medium text-teal-text' : 'text-ink-2'
                     )}
                  >
                     {r.note}
                  </span>
               </div>
            ))}
         </div>

         <div className="blk mx-[18px] my-3.5">
            <div className="flex flex-col gap-1.5 px-[18px] py-4">
               <span className="lab text-[11px] text-paper-2">
                  {logSays.label}
               </span>
               <p className="text-[15px] leading-[1.45]">{logSays.body}</p>
               <button
                  type="button"
                  onClick={demo.seeThoseThree}
                  className="g-tracked self-start text-[18px] text-teal"
               >
                  {logSays.link}
               </button>
            </div>
         </div>

         <div className="flex items-baseline justify-between px-[18px] pt-3.5">
            <span className="g text-[30px]">{seasonHeading.title}</span>
            <span className="lab text-[11px]">{seasonHeading.count}</span>
         </div>

         <div
            ref={stripRef}
            className="flex h-[206px] items-end gap-2.5 overflow-x-auto px-[18px] pt-3 pb-2 [scroll-snap-type:x_proximity] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
         >
            {season.map((mark, i) =>
               mark.kind === 'blank' ? (
                  <span
                     key={`blank-${i}`}
                     className="flex w-[22px] flex-none flex-col items-center gap-1.5"
                  >
                     <i className="rule-dashed-left block h-10 w-0" />
                     <span className="rotate-180 text-[10px] tracking-[0.12em] text-ink-3 uppercase [writing-mode:vertical-rl]">
                        blank
                     </span>
                  </span>
               ) : (
                  <button
                     key={`${mark.when}-${mark.size}`}
                     type="button"
                     onClick={demo.openRecord}
                     className="flex w-[88px] flex-none flex-col gap-[5px] text-left [scroll-snap-align:start]"
                  >
                     <span
                        className="block w-[88px] overflow-hidden bg-bg-2"
                        style={{ height: mark.height }}
                     >
                        <img
                           src={mark.photo}
                           alt=""
                           loading="lazy"
                           className="h-full w-full object-cover"
                        />
                     </span>
                     <span className="g block text-[20px] tracking-[0.04em]">
                        {mark.size}
                     </span>
                     <span className="text-[11px] text-ink-3">{mark.when}</span>
                  </button>
               )
            )}
         </div>

         <div className="flex items-baseline justify-between px-[18px] pt-3.5">
            <span className="g text-[30px]">{recentHeading.title}</span>
            <span className="lab text-[11px]">{recentHeading.count}</span>
         </div>

         <div className="flex flex-col pb-3">
            {demo.newRow ? (
               <button
                  type="button"
                  onClick={demo.openRecord}
                  className={cn(
                     'grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-line px-[18px] py-2.5 text-left',
                     demo.newRowFresh && 'shadow-[inset_3px_0_0_var(--teal)]'
                  )}
               >
                  <img
                     src={photos.catchOcean}
                     alt=""
                     className="size-[52px] bg-bg-2 object-cover"
                  />
                  <span className="min-w-0">
                     <span className="g block text-[22px] tracking-[0.04em]">
                        {demo.recordSpecies}
                     </span>
                     <span className="block text-[12px] text-ink-2">
                        {demoMoment.date}, {demoMoment.time} · {demoMoment.spot}
                     </span>
                  </span>
                  <span className="g num text-[24px] tracking-[0.03em]">
                     {demoMoment.lengthCm} cm
                  </span>
               </button>
            ) : null}

            {recent.map((row) =>
               row.blank ? (
                  <div
                     key={row.id}
                     className="grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-line px-[18px] py-2.5"
                  >
                     <span className="size-[52px] bg-bg-2" />
                     <span className="min-w-0">
                        <span className="g block text-[22px] tracking-[0.04em] text-ink-3">
                           {row.title}
                        </span>
                        <span className="block text-[12px] text-ink-2">
                           {row.meta}
                        </span>
                     </span>
                     <span />
                  </div>
               ) : (
                  <button
                     key={row.id}
                     type="button"
                     onClick={demo.openRecord}
                     className="grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-line px-[18px] py-2.5 text-left"
                  >
                     <img
                        src={row.photo}
                        alt=""
                        loading="lazy"
                        className="size-[52px] bg-bg-2 object-cover"
                     />
                     <span className="min-w-0">
                        <span className="g block text-[22px] tracking-[0.04em]">
                           {row.title}
                        </span>
                        <span className="block text-[12px] text-ink-2">
                           {row.meta}
                        </span>
                     </span>
                     <span className="g num text-[24px] tracking-[0.03em]">
                        {row.size}
                     </span>
                  </button>
               )
            )}
         </div>
      </>
   );
}
