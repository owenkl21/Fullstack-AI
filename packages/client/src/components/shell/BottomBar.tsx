import {
   MapPinIcon,
   NewspaperIcon,
   WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { FishMark } from '@/components/brand/FishMark';
import { isTaskRoute } from '@/components/shell/routes';
import { SignedIn, SignedOut } from '@/components/shell/Signed';
import { cn } from '@/lib/utils';

type Slot = {
   to: string;
   label: string;
   Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/* Catches gets the house fish rather than a stock icon: it is the one slot the
 * product is actually about. */
const left: Slot[] = [
   { to: '/feed', label: 'Feed', Icon: NewspaperIcon },
   { to: '/catches/me', label: 'Catches', Icon: FishMark },
];

const right: Slot[] = [
   { to: '/sites/me', label: 'Spots', Icon: MapPinIcon },
   { to: '/gear/me', label: 'Gear', Icon: WrenchScrewdriverIcon },
];

/*
 * Phone navigation: four slots around one raised teal key in the middle. The key
 * breaks the bar's top edge so the thumb finds it without looking. Signed out the bar
 * carries Feed and Sign in only, so nobody is sent into a gated page.
 *
 * Each slot carries its mark above its word. Four bare words at this size all
 * read the same at a glance, which is the one thing a thumb bar cannot afford.
 */
export function BottomBar() {
   const { pathname } = useLocation();

   if (isTaskRoute(pathname)) {
      return null;
   }

   const slot =
      'g-tracked flex h-16 flex-col items-center justify-center gap-1 text-[13px] text-paper-2 transition-colors duration-150 [transition-timing-function:var(--ease)] hover:text-paper';
   const active = 'text-paper shadow-[inset_0_3px_0_var(--teal)]';

   const renderSlot = ({ to, label, Icon }: Slot) => (
      <NavLink
         key={to}
         to={to}
         className={({ isActive }) => cn(slot, isActive && active)}
      >
         {({ isActive }) => (
            <>
               <Icon
                  aria-hidden="true"
                  className={cn(
                     'size-[22px] shrink-0 transition-transform duration-200 [transition-timing-function:var(--ease)]',
                     isActive && 'scale-110'
                  )}
               />
               {label}
            </>
         )}
      </NavLink>
   );

   return (
      <nav
         aria-label="App"
         className="fixed inset-x-0 bottom-0 z-30 h-[calc(64px+env(safe-area-inset-bottom))] bg-black-block pb-[env(safe-area-inset-bottom)] text-paper md:hidden"
      >
         <SignedIn>
            <div className="relative grid h-16 grid-cols-[1fr_1fr_92px_1fr_1fr]">
               {left.map(renderSlot)}

               <div className="relative">
                  <NavLink
                     to="/log"
                     aria-label="Log a catch"
                     className={({ isActive }) =>
                        cn(
                           'g-tracked absolute bottom-3 left-1/2 flex size-[72px] -translate-x-1/2 items-center justify-center bg-teal text-[24px] text-teal-ink transition-[filter,transform] duration-150 [transition-timing-function:var(--ease)] hover:brightness-105 active:scale-[0.97]',
                           isActive && 'brightness-95'
                        )
                     }
                  >
                     Log
                  </NavLink>
               </div>

               {right.map(renderSlot)}
            </div>
         </SignedIn>

         <SignedOut>
            <div className="grid h-16 grid-cols-2">
               <NavLink
                  to="/feed"
                  className={({ isActive }) => cn(slot, isActive && active)}
               >
                  Feed
               </NavLink>
               <Link to="/sign-in" className={slot}>
                  Sign in
               </Link>
            </div>
         </SignedOut>
      </nav>
   );
}
