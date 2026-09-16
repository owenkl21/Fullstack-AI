import { NavLink, Link } from 'react-router-dom';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Wordmark } from '@/components/brand/Wordmark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
            <Show when="signed-in">
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
            </Show>
            <div className="ml-auto flex items-center gap-3">
               <ThemeToggle />
               <Show when="signed-out">
                  <SignInButton mode="modal">
                     <button
                        type="button"
                        className="g-tracked hidden text-[19px] text-paper-2 hover:text-paper sm:inline"
                     >
                        Sign in
                     </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                     <Button size="default">
                        <span className="hidden sm:inline">Start your log</span>
                        <span className="sm:hidden">Start</span>
                     </Button>
                  </SignUpButton>
               </Show>
               <Show when="signed-in">
                  <Button
                     asChild
                     size="default"
                     className="hidden md:inline-flex"
                  >
                     <Link to="/log">Log a catch</Link>
                  </Button>
                  <UserButton />
               </Show>
            </div>
         </div>
      </header>
   );
}
