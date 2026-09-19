import { PlusIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { stagger } from './layout';
import { photos } from './photos';

const tiles = [
   {
      photo: photos.catchDepth,
      alt: 'Rainbow trout held up',
      caption: 'Lakenvlei · 31 cm',
   },
   { photo: photos.rodReel, alt: 'Rod and reel', caption: 'Penn Fierce III' },
   {
      photo: photos.catchLine,
      alt: 'A small fish on the line',
      caption: 'Kalk Bay · 27 cm',
   },
];

/* Three photographs from the sample log. A swipeable row on a phone, a row of three
 * from sm, each opening the record below. */
export function LandingMedia() {
   return (
      <div className="mt-9 flex gap-2.5 overflow-x-auto pb-1.5 [scroll-snap-type:x_mandatory] [scrollbar-width:none] sm:mt-14 sm:grid sm:grid-cols-3 sm:gap-3.5 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
         {tiles.map((tile, i) => (
            <a
               key={tile.caption}
               href="#record"
               className={cn(
                  'rv group relative aspect-[4/3] flex-[0_0_74%] overflow-hidden bg-black-block-2 [scroll-snap-align:start] sm:flex-none'
               )}
               style={stagger(i)}
            >
               <img
                  src={tile.photo}
                  alt={tile.alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-[600ms] [transition-timing-function:var(--ease)] group-hover:scale-[1.04] group-focus-visible:scale-[1.04]"
               />
               <span
                  aria-hidden="true"
                  className="absolute top-1/2 left-1/2 -mt-[22px] -ml-[22px] flex size-11 items-center justify-center rounded-full border border-paper/50 bg-black-block/55 text-paper"
               >
                  <PlusIcon className="size-[22px]" strokeWidth={1.5} />
               </span>
               <span className="g-tracked absolute bottom-3 left-3.5 text-[20px] text-paper [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
                  {tile.caption}
               </span>
            </a>
         ))}
      </div>
   );
}
