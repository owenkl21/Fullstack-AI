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
   { to: '/sites/me', label: 'Spots' },
   { to: '/gear/me', label: 'Gear' },
];

/*
 * The header is black in both themes, 60px, sticky. Wordmark, the four destination
 * words on desktop, the sun/moon switch, the one teal action, the avatar.
 */
export function AppHeader() {
   return (
      <header className="sticky top-0 z-30 h-[60px] border-b border-paper/10 bg-black-block text-paper">
         <div className="mx-auto flex h-[60px] w-[min(1200px,100%-32px)] items-center gap-4 md:w-[min(1200px,100%-48px)]">
            <Wordmark />
            <SignedIn>
               <nav
                  aria-label="Main"
                  className="hidden items-center gap-6 md:flex"
               >
                  {destinations.map((d) => (
                     <NavLink
                        key={d.to}
                        to={d.to}
                        className={({ isActive }) =>
                           cn(
                              'g-tracked py-2 text-[19px] text-paper-2 transition-colors hover:text-teal',
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
                     className="g-tracked hidden text-[19px] text-paper-2 hover:text-paper sm:inline"
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
