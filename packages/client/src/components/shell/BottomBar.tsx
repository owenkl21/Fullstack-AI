import { Link, NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SignedIn, SignedOut } from '@/components/shell/Signed';

const left = [
   { to: '/feed', label: 'Feed' },
   { to: '/catches/me', label: 'Catches' },
];

const right = [
   { to: '/sites/me', label: 'Spots' },
   { to: '/gear/me', label: 'Gear' },
];

/*
 * Phone navigation: four word slots around one raised teal key in the middle. The key
 * breaks the bar's top edge so the thumb finds it without looking. Signed out the bar
 * carries Feed and Sign in only, so nobody is sent into a gated page.
 */
export function BottomBar() {
   const slot =
      'g-tracked flex h-16 items-center justify-center text-[17px] text-paper-2 transition-colors duration-150 [transition-timing-function:var(--ease)] hover:text-paper';
   const active = 'text-paper shadow-[inset_0_3px_0_var(--teal)]';

   return (
      <nav
         aria-label="App"
         className="fixed inset-x-0 bottom-0 z-30 h-[calc(64px+env(safe-area-inset-bottom))] bg-black-block pb-[env(safe-area-inset-bottom)] text-paper md:hidden"
      >
         <SignedIn>
            <div className="relative grid h-16 grid-cols-[1fr_1fr_92px_1fr_1fr]">
               {left.map((s) => (
                  <NavLink
                     key={s.to}
                     to={s.to}
                     className={({ isActive }) => cn(slot, isActive && active)}
                  >
                     {s.label}
                  </NavLink>
               ))}

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

               {right.map((s) => (
                  <NavLink
                     key={s.to}
                     to={s.to}
                     className={({ isActive }) => cn(slot, isActive && active)}
                  >
                     {s.label}
                  </NavLink>
               ))}
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
