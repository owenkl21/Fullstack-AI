import { Compass, MapPinned, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const statCards = [
   { icon: MapPinned, label: 'Mapped locations', value: '1,200+' },
   { icon: Compass, label: 'Trip plans generated', value: '4,800+' },
   { icon: Sparkles, label: 'Smart insights shared', value: '12k+' },
];

export function LandingHero() {
   return (
      <section
         id="top"
         className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
      >
         <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="space-y-6 text-left">
               <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
                  Plan better fishing days
               </p>
               <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                  The all-in-one fishing companion built for every screen.
               </h1>
               <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                  Nullam tristique eros nec risus efficitur, vitae varius quam
                  facilisis. Curabitur finibus urna a augue luctus posuere.
               </p>
               <div className="flex flex-wrap gap-3">
                  <Button size="lg">Get early access</Button>
                  <Button size="lg" variant="outline">
                     Explore features
                  </Button>
               </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
               {statCards.map(({ icon: Icon, label, value }) => (
                  <Card key={label}>
                     <CardHeader className="flex flex-row items-center justify-between gap-4 pb-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                           {label}
                        </CardTitle>
                        <Icon className="size-5 text-primary" />
                     </CardHeader>
                     <CardContent>
                        <p className="text-3xl font-semibold tracking-tight">
                           {value}
                        </p>
                     </CardContent>
                  </Card>
               ))}
            </div>
         </div>
      </section>
   );
}
