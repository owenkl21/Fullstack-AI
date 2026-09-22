import { NavLink, Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Wordmark } from '@/components/brand/Wordmark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SignedIn, SignedOut } from '@/components/shell/Signed';
import { AccountMenu } from '@/components/shell/AccountMenu';
import { NotificationBell } from '@/components/shell/NotificationBell';

/*
 * `wide` words wait for a wide screen. All eight need about 545px, and from
 * 768 to about 1200 they ran under the wordmark and the buttons. Below xl the
 * header carries the four the phone bar carries; the other four are in the
 * account panel at every width.
 */
const destinations = [
   { to: '/', label: 'Feed', end: true },
   { to: '/catches/me', label: 'Catches' },
   { to: '/map', label: 'Map' },
   { to: '/forecast', label: 'Forecast', wide: true },
   { to: '/sites/me', label: 'Spots', wide: true },
   { to: '/gear/me', label: 'Gear', wide: true },
   { to: '/boards', label: 'Boards' },
   { to: '/competitions', label: 'Comps', wide: true },
];

/*
 * The header is black in both themes, 60px, sticky. Wordmark, the destination
 * words from md, the sun/moon switch, the one teal action, the avatar.
 */
export function AppHeader() {
   return (
      <header className="sticky top-0 z-30 h-[60px] border-b border-paper/10 bg-black-block text-paper">
         {/*
          * Three zones, not two. The destinations used to sit immediately
          * after the wordmark, which left roughly 545px of dead air before the
          * actions on a 1440 screen and read as unfinished. Centring them
          * fills the bar deliberately and keeps the wordmark and the actions
          * anchored to their own edges.
          *
          * Centring on the bar needs all of that room, so it starts at xl.
          * Below it the four words sit centred in the space between the
          * wordmark and the actions, where they cannot reach either.
          */}
         <div className="relative mx-auto flex h-[60px] w-[min(1680px,100%-32px)] items-center gap-4 md:w-[min(1200px,100%-48px)]">
            <Wordmark />
            <SignedIn>
               <nav
                  aria-label="Main"
                  className="hidden min-w-0 flex-1 items-center justify-center gap-7 md:flex xl:absolute xl:left-1/2 xl:flex-none xl:-translate-x-1/2"
               >
                  {destinations.map((d) => (
                     <NavLink
                        key={d.to}
                        to={d.to}
                        end={'end' in d && d.end}
                        className={({ isActive }) =>
                           cn(
                              'g-tracked inline-flex min-h-11 items-center text-[19px] text-paper-2 transition-colors hover:text-teal',
                              'wide' in d && d.wide && 'hidden xl:inline-flex',
                              isActive &&
                                 'text-paper shadow-[inset_0_-2px_0_var(--teal)]'
                           )
                        }
                     >
                        {d.label}
                     </NavLink>
                  ))}
               </nav>
            </SignedIn>
            <div className="ml-auto flex items-center gap-3">
               {/*
                * A 390 header was carrying the wordmark, the sun, the bell and
                * the avatar. Signed in, the sun now lives in the account
                * panel's footer on a phone and keeps its place here from md
                * up. Signed out there is no panel, so it stays in the bar.
                */}
               <SignedIn>
                  <ThemeToggle className="hidden md:inline-flex" />
               </SignedIn>
               <SignedOut>
                  <ThemeToggle />
                  <Link
                     to="/sign-in"
                     className="g-tracked hidden min-h-11 items-center text-[19px] text-paper-2 hover:text-paper sm:inline-flex"
                  >
                     Sign in
                  </Link>
                  <Button size="default" asChild>
                     <Link to="/sign-up">
                        <span className="hidden sm:inline">Start your log</span>
                        <span className="sm:hidden">Start</span>
                     </Link>
                  </Button>
               </SignedOut>
               <SignedIn>
                  <Button
                     asChild
                     size="default"
                     className="hidden md:inline-flex"
                  >
                     {/* "Log", as on the phone's key, until lg: the words
                         need the 57px on a tablet. */}
                     <Link to="/log">
                        <span className="lg:hidden">Log</span>
                        <span className="hidden lg:inline">Log a catch</span>
                     </Link>
                  </Button>
                  <NotificationBell />
                  <AccountMenu />
               </SignedIn>
            </div>
         </div>
      </header>
   );
}
