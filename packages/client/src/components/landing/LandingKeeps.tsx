import { useRef } from 'react';
import { TornEdge } from '@/components/brand/TornEdge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ANCHOR, WRAP } from './layout';
import { photos } from './photos';
import { useParallaxFallback } from './useParallaxFallback';

/*
 * What a record holds, one part at a time.
 *
 * This was four photograph blocks stacked down the page, which ran to most of a
 * screen on a phone and leaned on stock pictures of the wrong fish in the wrong
 * hemisphere. The words were always the point, so the photographs went and the
 * four parts became four panels you switch between. The picture stays where it
 * belongs, in the band behind the plate.
 *
 * Each panel carries the real field names the record uses, so the page is
 * showing the product's own language rather than describing it.
 */
const parts = [
   {
      value: 'fish',
      tab: 'The fish',
      title: 'The fish',
      body: 'Photograph it and the two most likely names come back, in the names anglers use rather than the Latin. Pick one, or type your own and it is remembered for next time.',
      lines: [
         ['Species', 'White steenbras'],
         ['Length', '44 cm (17.3 in) on a tape'],
         ['Weight', '1.9 kg (4 lb 3 oz) by eye'],
      ],
   },
   {
      value: 'conditions',
      tab: 'The conditions',
      title: 'The conditions',
      body: 'Read at the minute of the catch and kept with it. Pressure arrives as a change since your last trip, which is the part that matters and the part nobody writes down.',
      lines: [
         ['Wind', 'SW 24 km/h, gusting 41'],
         ['Pressure', '1013 hPa, falling 6'],
         ['Moon', 'First quarter, 52 percent'],
      ],
   },
   {
      value: 'spot',
      tab: 'The spot',
      title: 'The spot',
      body: 'A pin you control. Exact for you, blurred to about a kilometre for anyone else, or off the map entirely. A mark you worked for stays yours.',
      lines: [
         ['Position', '-34.12770, 18.44860'],
         ['Shown to others', 'Within a kilometre'],
         ['Filed under', 'Kalk Bay'],
      ],
   },
   {
      value: 'season',
      tab: 'The season',
      title: 'The season',
      body: 'Blank mornings count. A strip of the year with every fish scaled to its size and every empty trip left as a mark, because the gaps are how you read a season.',
      lines: [
         ['Logged', '48 trips, 48 fish'],
         ['Species', '10 across 7 spots'],
         ['Best', 'Garrick, 94 cm'],
      ],
   },
];

export function LandingKeeps() {
   const band = useRef<HTMLDivElement>(null);
   useParallaxFallback(band, 0.18);

   return (
      <section
         id="keeps"
         className={cn(
            'relative overflow-hidden bg-black-block py-[84px] text-paper md:pt-[120px] md:pb-24',
            ANCHOR
         )}
      >
         <TornEdge fill="bg" flip seed={16} />
         <div
            ref={band}
            className="parallax-band absolute inset-x-0 top-[-14%] bottom-0"
         >
            <img
               src={photos.rockOcean}
               alt=""
               loading="lazy"
               className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black-block/45" />
         </div>

         <div className={cn(WRAP, 'relative')}>
            <h2 className="g rv max-w-[14ch] text-[clamp(44px,6vw,84px)] [text-shadow:0_2px_20px_rgba(0,0,0,0.4)]">
               What it keeps
            </h2>

            <div className="blk blk-plain rv mt-7 md:mt-10">
               <Tabs defaultValue="fish" tone="paper">
                  <TabsList>
                     {parts.map((part) => (
                        <TabsTrigger key={part.value} value={part.value}>
                           {part.tab}
                        </TabsTrigger>
                     ))}
                  </TabsList>

                  {parts.map((part) => (
                     <TabsContent key={part.value} value={part.value}>
                        <div className="grid gap-6 px-[22px] pt-6 pb-[26px] md:grid-cols-[1fr_minmax(0,320px)] md:gap-12 md:px-10 md:pt-9 md:pb-10">
                           <div className="flex flex-col gap-3">
                              <h3 className="g text-[34px] md:text-[40px]">
                                 {part.title}
                              </h3>
                              <p className="max-w-[48ch] text-[15px] text-paper-2 text-pretty md:text-[16px]">
                                 {part.body}
                              </p>
                           </div>
                           <dl className="flex flex-col self-start">
                              {part.lines.map(([label, value]) => (
                                 <div
                                    key={label}
                                    className="flex flex-col gap-1 border-t border-paper/20 py-3 first:border-t-0 first:pt-0"
                                 >
                                    <dt className="lab text-paper-2">
                                       {label}
                                    </dt>
                                    <dd className="num text-[15px] text-paper">
                                       {value}
                                    </dd>
                                 </div>
                              ))}
                           </dl>
                        </div>
                     </TabsContent>
                  ))}
               </Tabs>
            </div>
         </div>

         <TornEdge fill="bg-2" seed={27} />
      </section>
   );
}
