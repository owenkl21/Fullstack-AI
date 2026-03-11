import { Fish, LayoutGrid, MapPin, Plus, Radio, Wrench } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const mobileNavItems = [
   { to: '/feed', label: 'Feed', icon: Radio },
   { to: '/catches/me', label: 'Catches', icon: Fish },
   { to: '/sites/me', label: 'Sites', icon: MapPin },
   { to: '/gear/me', label: 'Gear', icon: Wrench },
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
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/70 bg-background/95 px-2 py-2 shadow-[0_8px_30px_rgb(0_0_0_/_0.12)] backdrop-blur">
               {desktopDockItems.map(({ to, label, icon: Icon }) => (
                  <NavLink
                     key={to}
                     to={to}
                     className={({ isActive }) =>
                        cn(
                           'flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200',
                           isActive
                              ? 'bg-primary/15 text-primary shadow-sm'
                              : 'text-muted-foreground hover:-translate-y-0.5 hover:bg-accent hover:text-foreground'
                        )
                     }
                     aria-label={label}
                     title={label}
                  >
                     <Icon className="h-5 w-5" />
                  </NavLink>
               ))}
            </div>
         </nav>

         <div className="hidden h-24 md:block" aria-hidden="true" />

         <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
            <div className="relative mx-auto w-full max-w-md">
               <div className="grid grid-cols-5 items-end gap-1">
                  {mobileNavItems.map(({ to, label, icon: Icon }, index) => (
                     <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                           cn(
                              index === 2
                                 ? 'col-start-4 flex flex-col items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors'
                                 : index === 3
                                   ? 'col-start-5 flex flex-col items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors'
                                   : 'flex flex-col items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
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

               <Button
                  asChild
                  size="icon"
                  className="absolute left-1/2 top-0 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg"
               >
                  <NavLink to="/catches/new" aria-label="Log a catch">
                     <Plus className="h-5 w-5" />
                  </NavLink>
               </Button>
            </div>
         </nav>
      </>
   );
}
