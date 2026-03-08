import { Fish, Menu } from 'lucide-react';
import { Show, SignInButton, UserButton } from '@clerk/react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const navItems = [
   { label: 'Features', href: '/#features' },
   { label: 'How it works', href: '/#how-it-works' },
   { label: 'FAQ', href: '/#faq' },
];

export function LandingHeader() {
   return (
      <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
         <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <Link
               to="/"
               className="inline-flex items-center gap-2 text-base font-semibold sm:text-lg"
            >
               <span className="rounded-md bg-primary/10 p-2 text-primary">
                  <Fish className="size-5" />
               </span>
               <span>Fullstack AI Angler</span>
            </Link>

            <nav className="hidden items-center gap-6 md:flex ">
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

            <div className="flex items-center gap-3">
               <Show when="signed-out">
                  <SignInButton mode="modal">
                     <Button variant="ghost" size="sm">
                        Sign in
                     </Button>
                  </SignInButton>
               </Show>

               <Show when="signed-in">
                  <UserButton />
               </Show>
            </div>

            <Button
               variant="ghost"
               size="icon"
               className="sm:hidden"
               aria-label="Open navigation menu"
            >
               <Menu className="size-5" />
            </Button>
         </div>
      </header>
   );
}
