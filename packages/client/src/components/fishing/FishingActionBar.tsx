import {
   Fish,
   LayoutGrid,
   MapPin,
   Plus,
   Radio,
   Shield,
   Wrench,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const mobileNavItems = [
   { to: '/feed', label: 'Feed', icon: Radio },
   { to: '/catches/me', label: 'Catches', icon: Fish },
   { to: '/sites/me', label: 'Sites', icon: MapPin },
   { to: '/gear/me', label: 'Gear', icon: Wrench },
   { to: '/profile', label: 'Profile', icon: Shield },
] as const;

const desktopDockItems = [
   { to: '/catches/new', label: 'Log catch', icon: Plus },
   { to: '/sites/new', label: 'Log site', icon: MapPin },
   { to: '/catches/me', label: 'My catches', icon: Fish },
   { to: '/sites/me', label: 'My locations', icon: LayoutGrid },
   { to: '/gear/new', label: 'Add gear', icon: Plus },
   { to: '/gear/me', label: 'My gear', icon: Wrench },
   { to: '/feed', label: 'Feed', icon: Radio },
] as const;

export function FishingActionBar() {
   return (
      <>
         <nav className="pointer-events-none fixed inset-x-0 top-[5.25rem] z-40 hidden justify-center px-4 md:flex">
            <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-border/70 bg-background/95 p-2 shadow-lg backdrop-blur">
               {desktopDockItems.map(({ to, label, icon: Icon }) => (
                  <NavLink
                     key={to}
                     to={to}
                     className={({ isActive }) =>
                        cn(
                           'flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition-colors',
                           isActive
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        )
                     }
                  >
                     <Icon className="h-4 w-4" />
                     <span>{label}</span>
                  </NavLink>
               ))}
            </div>
         </nav>

         <div className="hidden h-24 md:block" aria-hidden="true" />

         <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
            <div className="mx-auto grid w-full max-w-md grid-cols-5 items-end gap-1">
               {mobileNavItems.slice(0, 2).map(({ to, label, icon: Icon }) => (
                  <NavLink
                     key={to}
                     to={to}
                     className={({ isActive }) =>
                        cn(
                           'flex flex-col items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                           isActive
                              ? 'text-primary'
                              : 'text-muted-foreground hover:text-foreground'
                        )
                     }
                  >
                     <Icon className="h-5 w-5" />
                     <span>{label}</span>
                  </NavLink>
               ))}

               <Button
                  asChild
                  size="icon"
                  className="mx-auto mb-3 h-12 w-12 rounded-full shadow-lg"
               >
                  <NavLink to="/catches/new" aria-label="Log a catch">
                     <Plus className="h-5 w-5" />
                  </NavLink>
               </Button>

               {mobileNavItems.slice(2).map(({ to, label, icon: Icon }) => (
                  <NavLink
                     key={to}
                     to={to}
                     className={({ isActive }) =>
                        cn(
                           'flex flex-col items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                           isActive
                              ? 'text-primary'
                              : 'text-muted-foreground hover:text-foreground'
                        )
                     }
                  >
                     <Icon className="h-5 w-5" />
                     <span>{label}</span>
                  </NavLink>
               ))}
            </div>
         </nav>
      </>
   );
}
