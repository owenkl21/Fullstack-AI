import { useRef } from 'react';
import { TornEdge } from '@/components/brand/TornEdge';
import { cn } from '@/lib/utils';
import { ANCHOR, WRAP, stagger } from './layout';
import { photos } from './photos';
import { useParallaxFallback } from './useParallaxFallback';

const cards = [
   {
      photo: photos.catchOcean,
      title: 'The catch',
      body: 'Species, length and weight in both systems, and the word for how each number was taken. By eye stays by eye.',
      wide: true,
   },
   {
      photo: photos.dawnBoats,
      title: 'The conditions',
      body: 'Wind, pressure as a change since your last trip, air, sun and moon, stamped at the minute of the catch.',
      wide: false,
   },
   {
      photo: photos.heroSpot,
      title: 'The spot',
      body: 'A pin you control. Exact for you, about a kilometre for others, or hidden.',
      wide: false,
   },
   {
      photo: photos.catchDepth,
      title: 'The season',
      body: 'Blank trips count. A strip of the year with every fish scaled to its size and every empty morning as a mark.',
      wide: true,
   },
];

/* A photo band between two painted edges, carrying four black blocks: two wide with the
 * photograph beside the words, two tall. */
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
            <div className="absolute inset-0 bg-black-block/35" />
         </div>

         <div className={cn(WRAP, 'relative')}>
            <h2 className="g rv text-center text-[clamp(44px,6vw,84px)] [text-shadow:0_2px_20px_rgba(0,0,0,0.4)]">
               What it keeps
            </h2>

            <div className="mt-8 grid gap-3 md:mt-12 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
               {cards.map((card, i) => (
                  <article
                     key={card.title}
                     className={cn('blk rv', card.wide && 'md:col-span-2')}
                     style={stagger(i)}
                  >
                     <div
                        className={cn(
                           'flex h-full flex-col',
                           card.wide && 'md:flex-row'
                        )}
                     >
                        <img
                           src={card.photo}
                           alt=""
                           loading="lazy"
                           className={cn(
                              'aspect-[4/3] w-full object-cover',
                              card.wide &&
                                 'md:aspect-auto md:min-h-[320px] md:w-[58%]'
                           )}
                        />
                        <div
                           className={cn(
                              'flex flex-col gap-2.5 px-[22px] pt-[22px] pb-[26px]',
                              card.wide && 'md:justify-end'
                           )}
                        >
                           <h3 className="g text-[34px]">{card.title}</h3>
                           <p className="text-[15px] text-paper-2">
                              {card.body}
                           </p>
                        </div>
                     </div>
                  </article>
               ))}
            </div>
         </div>

         <TornEdge fill="bg-2" seed={27} />
      </section>
   );
}
