import { CalendarDays, Fish, Map, Smartphone } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const featureItems = [
   {
      title: 'Responsive trip planning',
      description:
         'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean volutpat ullamcorper tellus.',
      icon: Smartphone,
   },
   {
      title: 'Spot discovery maps',
      description:
         'Suspendisse potenti. Morbi in lectus lacus. Nunc non eros non nisi aliquet vestibulum.',
      icon: Map,
   },
   {
      title: 'Catch log tracking',
      description:
         'Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae.',
      icon: Fish,
   },
   {
      title: 'Seasonal recommendations',
      description:
         'Integer finibus, nisl non fermentum iaculis, lorem nunc posuere justo, a suscipit lorem lacus id dolor.',
      icon: CalendarDays,
   },
];

export function LandingFeatures() {
   return (
      <section id="features" className="border-y border-border/60 bg-muted/30">
         <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="mb-10 text-left">
               <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  A cleaner way to prepare your next catch
               </h2>
               <p className="mt-3 max-w-2xl text-muted-foreground">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
                  ut perspiciatis unde omnis iste natus error sit voluptatem
                  accusantium doloremque laudantium.
               </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
               {featureItems.map(({ title, description, icon: Icon }) => (
                  <Card key={title} className="h-full">
                     <CardHeader>
                        <div className="mb-2 inline-flex w-fit rounded-md bg-primary/10 p-2 text-primary">
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
         </div>
      </section>
   );
}
