import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { BoardsScreen } from './BoardsScreen';
import { CatchesScreen } from './CatchesScreen';
import { FeedScreen } from './FeedScreen';
import { HomeScreen } from './HomeScreen';
import { LogSheet } from './LogSheet';
import { MapScreen } from './MapScreen';
import { RecordScreen } from './RecordScreen';
import type { Demo, DemoTab } from './useDemo';

/* The app's own bar, in the app's own order: Log sits in the middle. */
const BAR_LEFT: { tab: DemoTab; label: string }[] = [
   { tab: 'feed', label: 'Feed' },
   { tab: 'catches', label: 'Catches' },
];
const BAR_RIGHT: { tab: DemoTab; label: string }[] = [
   { tab: 'map', label: 'Map' },
   { tab: 'boards', label: 'Boards' },
];

/*
 * A slot in the bar, and the mark on the one you are looking at: a 3px teal
 * rule drawn across the top of the cell, which is what the app's own bar does
 * and the only thing in the product that says "you are here".
 */
const SLOT =
   'g-tracked relative flex items-center justify-center text-[15px] text-paper-2 transition-colors duration-150 [transition-timing-function:var(--ease)] hover:text-paper motion-reduce:transition-none md:text-[17px]';
const SLOT_ON =
   'text-paper before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-teal';

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

/* One cell of the bar: a word, and the screen it puts up. */
function Slot({
   demo,
   slot,
}: {
   demo: Demo;
   slot: { tab: DemoTab; label: string };
}) {
   const on = demo.screen === slot.tab;
   return (
      <button
         type="button"
         onClick={() => demo.goTab(slot.tab)}
         aria-current={on ? 'page' : undefined}
         className={cn(SLOT, on && SLOT_ON)}
      >
         {slot.label}
      </button>
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

            <Screen on={demo.screen === 'feed'} label="Feed">
               <FeedScreen on={demo.screen === 'feed'} />
            </Screen>

            <Screen on={demo.screen === 'catches'} label="My catches">
               <CatchesScreen on={demo.screen === 'catches'} />
            </Screen>

            <Screen on={demo.screen === 'map'} label="Map">
               <MapScreen on={demo.screen === 'map'} />
            </Screen>

            <Screen on={demo.screen === 'boards'} label="Boards">
               <BoardsScreen on={demo.screen === 'boards'} />
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

            <nav
               aria-label="App"
               className="absolute inset-x-0 bottom-0 z-[5] grid h-16 grid-cols-[1fr_1fr_84px_1fr_1fr] bg-black-block text-paper md:grid-cols-[1fr_1fr_96px_1fr_1fr]"
            >
               {BAR_LEFT.map((slot) => (
                  <Slot key={slot.tab} demo={demo} slot={slot} />
               ))}
               <button
                  type="button"
                  onClick={demo.openSheet}
                  className="g-tracked flex items-center justify-center bg-teal text-[20px] text-teal-ink transition-[filter] duration-150 active:brightness-95 motion-reduce:transition-none md:text-[22px]"
               >
                  Log
               </button>
               {BAR_RIGHT.map((slot) => (
                  <Slot key={slot.tab} demo={demo} slot={slot} />
               ))}
            </nav>
         </div>
      </div>
   );
}
