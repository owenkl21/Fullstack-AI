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

export function FishingActionBar() {
   return (
      <>
         <div className="hidden flex-wrap gap-3 rounded-lg border border-border bg-card p-4 md:flex">
            <Button asChild>
               <NavLink to="/catches/new">
                  <Plus className="h-4 w-4" />
                  Log a catch
               </NavLink>
            </Button>
            <Button asChild variant="outline">
               <NavLink to="/sites/new">
                  <MapPin className="h-4 w-4" />
                  Log fishing site
               </NavLink>
            </Button>
            <Button asChild variant="outline">
               <NavLink to="/catches/me">
                  <Fish className="h-4 w-4" />
                  My catches
               </NavLink>
            </Button>
            <Button asChild variant="outline">
               <NavLink to="/sites/me">
                  <LayoutGrid className="h-4 w-4" />
                  My locations
               </NavLink>
            </Button>
            <Button asChild variant="outline">
               <NavLink to="/gear/new">
                  <Plus className="h-4 w-4" />
                  Add gear
               </NavLink>
            </Button>
            <Button asChild variant="outline">
               <NavLink to="/gear/me">
                  <Wrench className="h-4 w-4" />
                  My gear
               </NavLink>
            </Button>
            <Button asChild variant="outline">
               <NavLink to="/feed">
                  <Radio className="h-4 w-4" />
                  Feed
               </NavLink>
            </Button>
         </div>

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
