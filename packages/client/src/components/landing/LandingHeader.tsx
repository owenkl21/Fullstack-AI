import { Fish, Menu } from 'lucide-react';
import { Show, SignInButton, UserButton } from '@clerk/react';
import { Link } from 'react-router-dom';

import { LandingThemeToggle } from '@/components/landing/LandingThemeToggle';
import { Button } from '@/components/ui/button';

const navItems = [
   { label: 'Features', href: '/#features' },
   { label: 'Use cases', href: '/#use-cases' },
   { label: 'FAQ', href: '/#faq' },
];

export function LandingHeader() {
   return (
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
         <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <Link
               to="/"
               className="inline-flex items-center gap-2 text-base font-semibold sm:text-lg"
            >
               <span className="rounded-xl bg-primary/15 p-2 text-primary shadow-sm shadow-primary/30">
                  <Fish className="size-5" />
               </span>
               <span>Fullstack AI Angler</span>
            </Link>

            <nav className="hidden items-center gap-6 md:flex">
               <Show when="signed-in">
                  <Link
                     to="/profile"
                     className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                     Profile
                  </Link>
               </Show>
               {navItems.map((item) => (
                  <a
                     key={item.label}
                     href={item.href}
                     className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                     {item.label}
                  </a>
               ))}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
               <LandingThemeToggle />

               <Show when="signed-out">
                  <SignInButton mode="modal">
                     <Button size="sm" className="shadow-sm shadow-primary/30">
                        Sign in
                     </Button>
                  </SignInButton>
               </Show>

               <Show when="signed-in">
                  <UserButton />
               </Show>

               <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open navigation menu"
               >
                  <Menu className="size-5" />
               </Button>
            </div>
         </div>
      </header>
   );
}
