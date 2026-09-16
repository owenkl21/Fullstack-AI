import { Contours } from '@/components/brand/Contours';
import { cn } from '@/lib/utils';
import { ANCHOR, WRAP, stagger } from './layout';
import { photos } from './photos';

const rows = [
   { key: 'Length', value: '44 cm (17.3 in) ', source: 'on a tape' },
   { key: 'Weight', value: '1.9 kg (4 lb 3 oz) ', source: 'by eye' },
   { key: 'Conditions', value: 'SW 24 km/h · 1013 hPa ', source: 'falling 6' },
   { key: 'Position', value: '-34.12770, 18.44860 ', source: '±8 m' },
];

/* One catch in full, on the secondary ground with contour art behind it. */
export function LandingRecord() {
   return (
      <section
         id="record"
         className={cn(
            'relative overflow-hidden bg-bg-2 py-14 md:py-[88px]',
            ANCHOR
         )}
      >
         <Contours
            seed={1}
            width={720}
            height={460}
            className="bottom-[-10%] left-[-8%] h-[120%] w-[70%]"
         />

         <div
            className={cn(
               WRAP,
               'relative grid items-center gap-9 lg:grid-cols-[1fr_1.1fr] lg:gap-14'
            )}
         >
            <div className="flex flex-col gap-[22px]">
               <span className="lab lab-rule rv text-ink-2">The record</span>
               <h2
                  className="g rv text-[clamp(44px,6vw,84px)]"
                  style={stagger(1)}
               >
                  One catch, in full
               </h2>
               <p
                  className="rv max-w-[46ch] text-[17px] text-ink-2 text-pretty"
                  style={stagger(2)}
               >
                  Nothing is a badge or a colour code. A number says where it
                  came from in words, so a stranger reading a shared link needs
                  no legend, and you can compare a season against itself.
               </p>
            </div>

            <article className="blk rv" style={stagger(2)}>
               <img
                  src={photos.catchOcean}
                  alt="A bass held against the sea"
                  loading="lazy"
                  className="aspect-[3/2] w-full object-cover"
               />
               <div className="flex flex-col gap-4 px-[26px] pt-6 pb-7">
                  <div className="flex items-baseline justify-between gap-4">
                     <h3 className="g text-[46px]">Bass</h3>
                     <span className="g num text-[40px] tracking-[0.03em]">
                        44 cm · 1.9 kg
                     </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                     {rows.map((row) => (
                        <div
                           key={row.key}
                           className="flex flex-col border-t border-dashed border-teal/70 pt-2"
                        >
                           <span className="lab text-paper-2">{row.key}</span>
                           <span className="num text-[17px] font-medium">
                              {row.value}
                              <i className="font-normal text-paper-2 not-italic">
                                 {row.source}
                              </i>
                           </span>
                        </div>
                     ))}
                  </div>

                  <p className="border-t border-paper/10 pt-3 text-[14px] text-paper-2">
                     Weight by eye. Position from a live fix. Conditions taken 2
                     minutes after the catch from a forecast point 4.2 km away.
                     Source: Includes weather data from Google.
                  </p>
               </div>
            </article>
         </div>
      </section>
   );
}
