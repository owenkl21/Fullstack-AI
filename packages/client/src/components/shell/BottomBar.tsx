import { Link, NavLink, useLocation } from 'react-router-dom';
import { isTaskRoute } from '@/components/shell/routes';
import { SignedIn, SignedOut } from '@/components/shell/Signed';
import { cn } from '@/lib/utils';

type Slot = {
   to: string;
   label: string;
};

const left: Slot[] = [
   { to: '/', label: 'Feed' },
   { to: '/catches/me', label: 'Catches' },
];

/*
 * Five destinations, four slots. Boards takes one and gear moves into the
 * account menu: gear is set up once, boards is checked every time somebody
 * else lands a fish. Boards had no way in at all on a phone before this.
 */
/*
 * The map takes the slot rather than the spot list. The list is a filing
 * cabinet; the map is where anyone decides where to fish, and it carries the
 * spots anyway. Spots and gear are in the account menu.
 */
/* Forecast takes the last slot: it is checked before every trip, the boards
   now and then. Boards lives in the account panel on a phone. */
const right: Slot[] = [
   { to: '/map', label: 'Map' },
   { to: '/forecast', label: 'Forecast' },
];

/*
 * Phone navigation: four slots around one teal key in the middle. The key
 * breaks the bar's top edge so the thumb finds it without looking. Signed out the bar
 * carries Feed and Sign in only, so nobody is sent into a gated page.
 *
 * Words, and only words. Each slot used to carry a stock mark above its name,
 * which is the one thing the house rules refuse outright: an icon beside a
 * word says the same thing twice and lands a newspaper and a trophy in a
 * fishing log. Four names at a readable size tell each other apart perfectly
 * well, and the active one is marked by the teal rule the product uses
 * everywhere else for "you are here".
 */
export function BottomBar() {
   const { pathname } = useLocation();

   if (isTaskRoute(pathname)) {
      return null;
   }

   const slot =
      'g-tracked relative flex h-16 items-center justify-center text-[17px] text-paper-2 transition-colors duration-150 [transition-timing-function:var(--ease)] hover:text-paper';
   /* A 3px teal rule across the top of the slot, drawn rather than shadowed so
      nothing in the product carries a box shadow. */
   const active =
      'text-paper before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-teal';

   const renderSlot = ({ to, label }: Slot) => (
      <NavLink
         key={to}
         to={to}
         end={to === '/'}
         className={({ isActive }) => cn(slot, isActive && active)}
      >
         {label}
      </NavLink>
   );

   return (
      <nav
         aria-label="App"
         /* The hairline the header has along its foot, along this bar's
            head: at night the page is near black too, and without it there
            was no telling where the page stopped and the bar began. */
         className="fixed inset-x-0 bottom-0 z-30 h-[calc(64px+env(safe-area-inset-bottom))] border-t border-paper/10 bg-black-block pb-[env(safe-area-inset-bottom)] text-paper md:hidden"
      >
         <SignedIn>
            <div className="relative grid h-16 grid-cols-[1fr_1fr_92px_1fr_1fr]">
               {left.map(renderSlot)}

               <div className="relative">
                  {/* The one teal action, a square block: radius is zero in
                      this product and a rounded key was the only thing in the
                      shell still pretending otherwise. */}
                  <NavLink
                     to="/log"
                     className={({ isActive }) =>
                        cn(
                           'g-tracked absolute bottom-3 left-1/2 flex size-[72px] -translate-x-1/2 items-center justify-center bg-teal text-[26px] text-teal-ink transition-[filter,transform] duration-150 [transition-timing-function:var(--ease)] hover:brightness-105 active:scale-[0.97]',
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
