import {
   CalendarDays,
   Fish,
   Map,
   Radar,
   Smartphone,
   Waves,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const featureItems = [
   {
      title: 'Responsive trip planning',
      description:
         'Build your ideal fishing day from mobile, tablet, or desktop with a single workflow.',
      icon: Smartphone,
      tone: 'from-sky-500/20 to-cyan-400/10',
   },
   {
      title: 'Spot discovery maps',
      description:
         'Explore nearby lakes and proven bank-access points with map-centered context.',
      icon: Map,
      tone: 'from-emerald-500/20 to-lime-400/10',
   },
   {
      title: 'Catch log timeline',
      description:
         'Track species, bait, weather, and outcomes so your future sessions are repeatable.',
      icon: Fish,
      tone: 'from-indigo-500/20 to-violet-400/10',
   },
   {
      title: 'Seasonal recommendations',
      description:
         'Get suggestions based on changing water conditions and fish activity patterns.',
      icon: CalendarDays,
      tone: 'from-fuchsia-500/20 to-rose-400/10',
   },
];

export function LandingFeatures() {
   return (
      <section id="features" className="border-y border-border/60 bg-muted/20">
         <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="mb-10 text-left">
               <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  A landing page designed like a modern product showcase
               </h2>
               <p className="mt-3 max-w-2xl text-muted-foreground">
                  Cleaner hierarchy, better color contrast, and reusable content
                  blocks inspired by premium component systems.
               </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
               {featureItems.map(({ title, description, icon: Icon, tone }) => (
                  <Card
                     key={title}
                     className="group relative h-full overflow-hidden border-primary/10 bg-card/70 backdrop-blur"
                  >
                     <div
                        className={`absolute inset-0 -z-10 bg-gradient-to-br opacity-60 transition-opacity group-hover:opacity-90 ${tone}`}
                     />
                     <CardHeader>
                        <div className="mb-2 inline-flex w-fit rounded-md bg-background/80 p-2 text-primary shadow-sm">
                           <Icon className="size-5" />
                        </div>
                        <CardTitle className="text-xl">{title}</CardTitle>
                     </CardHeader>
                     <CardContent>
                        <p className="text-sm leading-6 text-muted-foreground">
                           {description}
                        </p>
                     </CardContent>
                  </Card>
               ))}
            </div>

            <div id="use-cases" className="mt-10 grid gap-4 lg:grid-cols-3">
               <Card className="border-primary/20 lg:col-span-2">
                  <CardHeader>
                     <CardTitle className="flex items-center gap-2 text-xl">
                        <Radar className="size-5 text-primary" />
                        Tournament day preparation
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                     <p>
                        Build a quick game plan with map pins, weather checks,
                        and gear notes in one place.
                     </p>
                     <div className="rounded-xl border border-dashed border-primary/35 bg-muted/30 p-4 text-xs uppercase tracking-[0.2em] text-primary/80">
                        Placeholder for tactical illustration / dashboard image
                     </div>
                  </CardContent>
               </Card>

               <Card className="border-primary/20">
                  <CardHeader>
                     <CardTitle className="flex items-center gap-2 text-xl">
                        <Waves className="size-5 text-primary" />
                        Weekend explorer mode
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                     <p>
                        Capture casual outings, favorite spots, and best bait
                        combos without clutter.
                     </p>
                     <div className="rounded-xl border border-dashed border-primary/35 bg-muted/30 p-4 text-xs uppercase tracking-[0.2em] text-primary/80">
                        Placeholder for lifestyle art / photo
                     </div>
                  </CardContent>
               </Card>
            </div>
         </div>
      </section>
   );
}
