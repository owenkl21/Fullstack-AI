import {
   ArrowUpRight,
   Compass,
   MapPinned,
   Sparkles,
   WandSparkles,
} from 'lucide-react';

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
         className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-primary/10 via-background to-background"
      >
         <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24 lg:px-8">
            <div className="relative space-y-6 text-left">
               <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  <WandSparkles className="size-3.5" />
                  Inspired by modern UI libraries
               </p>
               <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                  Plan, log, and relive your best fishing days with a premium
                  UI.
               </h1>
               <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                  We redesigned the landing experience with richer color, glassy
                  surfaces, and modular sections ready for your illustrations,
                  product renders, and future marketing assets.
               </p>
               <div className="flex flex-wrap gap-3">
                  <Button size="lg" className="shadow-lg shadow-primary/35">
                     Get early access
                  </Button>
                  <Button size="lg" variant="outline">
                     View product tour
                  </Button>
               </div>
               <div className="rounded-2xl border border-dashed border-primary/40 bg-card/60 p-4 backdrop-blur">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary/80">
                     Hero illustration slot
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                     Drop a 16:10 fishing scene, app dashboard mockup, or motion
                     artwork here.
                  </p>
               </div>
            </div>

            <div className="relative space-y-4">
               <Card className="border-primary/20 bg-card/80 shadow-xl backdrop-blur">
                  <CardHeader className="space-y-4">
                     <CardTitle className="flex items-center justify-between text-base">
                        Live activity panel
                        <ArrowUpRight className="size-4 text-primary" />
                     </CardTitle>
                     <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                           Illustration slot A
                        </div>
                        <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                           Illustration slot B
                        </div>
                     </div>
                  </CardHeader>
               </Card>

               <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                  {statCards.map(({ icon: Icon, label, value }) => (
                     <Card
                        key={label}
                        className="border-primary/15 bg-card/75 backdrop-blur"
                     >
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
         </div>
      </section>
   );
}
