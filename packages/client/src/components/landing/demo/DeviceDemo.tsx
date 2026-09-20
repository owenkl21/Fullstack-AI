import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { HomeScreen } from './HomeScreen';
import { LogSheet } from './LogSheet';
import { RecordScreen } from './RecordScreen';
import type { Demo } from './useDemo';

/* The app's own bar, in the app's own order: Log sits in the middle. */
const BAR_LEFT = ['Feed', 'Catches'];
const BAR_RIGHT = ['Map', 'Boards'];

function Screen({
   on,
   label,
   children,
}: {
   on: boolean;
   label: string;
   children: ReactNode;
}) {
   const ref = useRef<HTMLElement>(null);
   useEffect(() => {
      if (on && ref.current) ref.current.scrollTop = 0;
   }, [on]);
   return (
      <section
         ref={ref}
         aria-label={label}
         inert={!on}
         className={cn(
            'absolute inset-x-0 top-0 bottom-16 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            on ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0'
         )}
         style={{
            transition: 'opacity 0.3s var(--ease), transform 0.45s var(--ease)',
         }}
      >
         {children}
      </section>
   );
}

/*
 * The phone: a bezel with an island, a screen that scrolls inside it, and the app
 * running on sample data. Normal phone size on a desktop, full width on a phone.
 */
export function DeviceDemo({
   demo,
   phoneRef,
   stripRef,
}: {
   demo: Demo;
   phoneRef: RefObject<HTMLDivElement | null>;
   stripRef: RefObject<HTMLDivElement | null>;
}) {
   return (
      <div
         role="group"
         aria-label="The app running on sample data"
         className="relative mx-auto w-full max-w-[400px] rounded-[46px] border-2 border-paper/15 bg-black-block-2 p-2.5 [zoom:0.86] md:max-w-[420px] md:rounded-[54px] md:p-3.5 md:shadow-[0_40px_90px_rgba(0,0,0,0.45)] md:[zoom:0.8]"
      >
         <span
            aria-hidden="true"
            className="absolute top-5 left-1/2 z-[9] -ml-[42px] h-6 w-[84px] rounded-full bg-black-block md:top-[26px] md:-ml-12 md:h-7 md:w-24"
         />
         <span
            aria-hidden="true"
            className="absolute top-[190px] -right-[3px] h-[74px] w-[3px] bg-paper/20 [border-radius:0_2px_2px_0]"
         />

         <div
            ref={phoneRef}
            className="relative h-[760px] w-full overflow-hidden rounded-[36px] bg-background text-foreground md:h-[800px] md:rounded-[40px]"
         >
            <Screen on={demo.screen === 'home'} label="Now at your spot">
               <HomeScreen demo={demo} stripRef={stripRef} />
            </Screen>

            <Screen on={demo.screen === 'record'} label="Catch record">
               <RecordScreen demo={demo} />
            </Screen>

            <LogSheet demo={demo} />

            <div
               role="status"
               className={cn(
                  'absolute right-3.5 bottom-[76px] left-3.5 z-[8] flex items-center justify-between gap-3 border-l-[3px] border-teal bg-black-block px-3.5 py-2.5 text-[14px] text-paper',
                  demo.toast
                     ? 'translate-y-0 opacity-100'
                     : 'pointer-events-none translate-y-4 opacity-0'
               )}
               style={{
                  transition: 'transform 0.4s var(--ease), opacity 0.3s',
               }}
            >
               <span>
                  <b className="font-medium text-teal">{demo.toast?.lead}</b>
                  {demo.toast?.rest}
               </span>
               <button
                  type="button"
                  onClick={demo.dismissToast}
                  className="g-tracked text-[18px] text-paper"
               >
                  Undo
               </button>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-[5] grid h-16 grid-cols-[1fr_1fr_84px_1fr_1fr] bg-black-block text-paper md:grid-cols-[1fr_1fr_96px_1fr_1fr]">
               <div aria-hidden="true" className="contents">
                  {BAR_LEFT.map((word) => (
                     <span
                        key={word}
                        className={cn(
                           'g-tracked flex items-center justify-center text-[15px] text-paper-2 md:text-[17px]',
                           word === 'Feed' &&
                              'text-paper shadow-[inset_0_3px_0_var(--teal)]'
                        )}
                     >
                        {word}
                     </span>
                  ))}
               </div>
               <button
                  type="button"
                  onClick={demo.openSheet}
                  className="g-tracked flex items-center justify-center bg-teal text-[20px] text-teal-ink transition-[filter] duration-150 active:brightness-95 md:text-[22px]"
               >
                  Log
               </button>
               <div aria-hidden="true" className="contents">
                  {BAR_RIGHT.map((word) => (
                     <span
                        key={word}
                        className="g-tracked flex items-center justify-center text-[15px] text-paper-2 md:text-[17px]"
                     >
                        {word}
                     </span>
                  ))}
               </div>
            </div>
         </div>
      </div>
   );
}
