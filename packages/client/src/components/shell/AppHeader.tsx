import { NavLink, Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Wordmark } from '@/components/brand/Wordmark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SignedIn, SignedOut } from '@/components/shell/Signed';
import { AccountMenu } from '@/components/shell/AccountMenu';

const destinations = [
   { to: '/feed', label: 'Feed' },
   { to: '/catches/me', label: 'Catches' },
   { to: '/map', label: 'Map' },
   { to: '/sites/me', label: 'Spots' },
   { to: '/gear/me', label: 'Gear' },
   { to: '/boards', label: 'Boards' },
   { to: '/competitions', label: 'Comps' },
];

/*
 * The header is black in both themes, 60px, sticky. Wordmark, the four destination
 * words on desktop, the sun/moon switch, the one teal action, the avatar.
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
          */}
         <div className="relative mx-auto flex h-[60px] w-[min(1200px,100%-32px)] items-center gap-4 md:w-[min(1200px,100%-48px)]">
            <Wordmark />
            <SignedIn>
               <nav
                  aria-label="Main"
                  className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 md:flex"
               >
                  {destinations.map((d) => (
                     <NavLink
                        key={d.to}
                        to={d.to}
                        className={({ isActive }) =>
                           cn(
                              'g-tracked inline-flex min-h-11 items-center text-[19px] text-paper-2 transition-colors hover:text-teal',
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
               <ThemeToggle />
               <SignedOut>
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
                     <Link to="/log">Log a catch</Link>
                  </Button>
                  <AccountMenu />
               </SignedIn>
            </div>
         </div>
      </header>
   );
}
