import { Contours } from '@/components/brand/Contours';
import { cn } from '@/lib/utils';
import { ANCHOR, WRAP, stagger } from './layout';
import { photos } from './photos';

/*
 * The fish: named off the photograph, then the record built around it.
 *
 * Two halves of one idea. The namer offers its two best guesses with how sure
 * it is and never applies either, and the record that follows says where every
 * number came from in words rather than in a legend.
 */
const guesses = [
   { name: 'Bass', sure: '91%', best: true },
   { name: 'Kob', sure: '36%', best: false },
];

const figures = [
   ['866', 'species it reads'],
   ['2', 'guesses, never applied'],
   ['±8 m', 'on a live fix'],
];

const rows = [
   ['Length', '44 cm (17.3 in)', 'on a tape'],
   ['Weight', '1.9 kg (4 lb 3 oz)', 'by eye'],
   ['Conditions', 'SW 24 km/h · 1013 hPa', 'falling 6'],
   ['Position', '-34.12770, 18.44860', '±8 m'],
];

export function LandingRecord() {
   return (
      <section
         id="record"
         className={cn(
            'relative overflow-hidden bg-background pt-[calc(var(--hang)+var(--trough)+1.25rem)] pb-14 md:pt-[calc(var(--hang)+var(--trough)+2rem)] md:pb-[88px]',
            ANCHOR
         )}
      >
         <Contours
            seed={9}
            width={700}
            height={520}
            className="bottom-[-10%] left-[-8%] h-[120%] w-[70%]"
         />

         <div
            className={cn(
               WRAP,
               'relative grid items-start gap-9 lg:grid-cols-[1fr_1.05fr] lg:gap-14'
            )}
         >
            <div className="flex flex-col gap-[22px]">
               <span className="lab lab-rule rv text-ink-2">
                  03 <span className="text-ink-3">The fish</span>
               </span>
               <h2
                  className="g rv text-[clamp(40px,5.4vw,76px)]"
                  style={stagger(1)}
               >
                  Photograph it and it names itself
               </h2>
               <p
                  className="rv max-w-[46ch] text-[17px] text-ink-2 text-pretty"
                  style={stagger(2)}
               >
                  866 species, answered in the names we use here (elf, garrick,
                  galjoen, kob, steenbras) rather than the Latin. Two guesses
                  come back with how sure it is. Take one, or type your own, and
                  the correction is kept: the next fish of that kind comes back
                  closer.
               </p>
               <p
                  className="rv max-w-[46ch] text-[17px] text-ink-2 text-pretty"
                  style={stagger(3)}
               >
                  Then the record assembles around the photograph. Every number
                  says where it came from, in words: by eye, on a tape, off a
                  live fix. Share the link and a stranger reads it the way you
                  do, with nothing to decode and nothing to take on trust.
               </p>

               <dl
                  className="rv grid grid-cols-3 gap-x-4 border-t border-line pt-4"
                  style={stagger(4)}
               >
                  {figures.map(([figure, what]) => (
                     <div key={what} className="flex flex-col gap-1">
                        <dt className="g num text-[36px] leading-[0.9] text-teal-text md:text-[44px]">
                           {figure}
                        </dt>
                        <dd className="text-[13px] text-ink-2">{what}</dd>
                     </div>
                  ))}
               </dl>
            </div>

            <div className="flex flex-col gap-3">
               {/* The namer, as the log shows it: two offers and a way out. */}
               <div className="blk rv" style={stagger(2)}>
                  <div className="flex flex-col gap-3 px-[22px] pt-5 pb-[22px] md:px-7 md:pt-6 md:pb-7">
                     <div className="flex items-baseline justify-between gap-4">
                        <span className="lab text-paper-2">Looks like</span>
                        <span className="g-tracked text-[16px] text-paper-2">
                           Neither
                        </span>
                     </div>
                     <div className="grid grid-cols-2 gap-2.5">
                        {guesses.map((guess) => (
                           <div
                              key={guess.name}
                              className={cn(
                                 'flex items-baseline justify-between gap-3 border px-3.5 py-3',
                                 guess.best
                                    ? 'border-teal text-paper'
                                    : 'border-paper/25 text-paper-2'
                              )}
                           >
                              <span className="g text-[26px] leading-none">
                                 {guess.name}
                              </span>
                              <span className="num text-[15px]">
                                 {guess.sure}
                              </span>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>

               <article className="blk rv" style={stagger(3)}>
                  <img
                     src={photos.catchOcean}
                     alt="A bass held against the sea"
                     loading="lazy"
                     className="aspect-[3/2] w-full object-cover"
                  />
                  <div className="flex flex-col gap-4 px-[22px] pt-5 pb-6 md:px-7 md:pt-6 md:pb-7">
                     <div className="flex items-baseline justify-between gap-4">
                        <h3 className="g text-[40px] md:text-[46px]">Bass</h3>
                        <span className="g num text-[34px] tracking-[0.03em] md:text-[40px]">
                           44 cm &middot; 1.9 kg
                        </span>
                     </div>

                     <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                        {rows.map(([key, value, source]) => (
                           <div
                              key={key}
                              className="flex flex-col border-t border-dashed border-teal/70 pt-2"
                           >
                              <span className="lab text-paper-2">{key}</span>
                              <span className="num text-[16px] font-medium">
                                 {value}{' '}
                                 <i className="font-normal text-paper-2 not-italic">
                                    {source}
                                 </i>
                              </span>
                           </div>
                        ))}
                     </div>

                     <p className="border-t border-paper/10 pt-3 text-[14px] text-paper-2">
                        Weight by eye. Position from a live fix. Conditions
                        taken 2 minutes after the catch from a forecast point
                        4.2 km away. Weather data by Open-Meteo.com.
                     </p>
                  </div>
               </article>
            </div>
         </div>
      </section>
   );
}
