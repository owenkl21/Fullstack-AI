import { Fish, Menu } from 'lucide-react';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { Button } from '@/components/ui/button';

const navItems = ['Features', 'How it works', 'FAQ'];

export function LandingHeader() {
   return (
      <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
         <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <a
               href="#top"
               className="inline-flex items-center gap-2 text-base font-semibold sm:text-lg"
            >
               <span className="rounded-md bg-primary/10 p-2 text-primary">
                  <Fish className="size-5" />
               </span>
               <span>Fullstack AI Angler</span>
            </a>

            <nav className="hidden items-center gap-6 md:flex">
               {navItems.map((item) => (
                  <a
                     key={item}
                     href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                     className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                     {item}
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

                  <SignUpButton mode="modal">
                     <Button size="sm">Join waitlist</Button>
                  </SignUpButton>
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
