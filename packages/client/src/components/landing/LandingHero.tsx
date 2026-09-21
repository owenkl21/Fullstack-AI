import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { TornEdge } from '@/components/brand/TornEdge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DeviceDemo } from './demo/DeviceDemo';
import { steps } from './demo/data';
import { useDemo } from './demo/useDemo';
import { ANCHOR, WRAP, stagger } from './layout';
import { photos } from './photos';
import { useParallaxFallback } from './useParallaxFallback';
import { Link } from 'react-router-dom';

/*
 * How long each step stays on the phone when Watch it log runs, read off the
 * waits in `play` in useDemo: the sheet rising to the conditions, the
 * conditions to the photo, the photo to Save, and Save back to home. The rule
 * over a step fills across that long, so the row reads as the phone's
 * progress. A second run skips the fix and so skips step two; its rule goes
 * straight to full, the way a step that is done looks.
 */
const RUN_MS = [1000, 2400, 2800, 4200];

/*
 * The opening: the promise and the app itself, on one ground.
 *
 * This used to be two screens. A stock photograph with a slogan centred on it,
 * and then, two thousand pixels further down, the only thing on the page worth
 * looking at, which is the app actually running. Almost nobody got that far,
 * and the photograph was doing the job every fishing brand's photograph does,
 * which is to say none.
 *
 * So the phone came up here. It is not a picture of the product and it is not
 * a rectangle drawn to look like one, it is the real thing running on sample
 * data and it answers a tap. The photograph stays, dimmed, as the ground it
 * all sits on, because the coast is the subject and a black box is not.
 *
 * The four steps sit under both. Same list as before, still driving the phone,
 * but a row across the foot of this section rather than a column down a second
 * screen of its own.
 */
export function LandingHero() {
   const band = useRef<HTMLDivElement>(null);
   useParallaxFallback(band, 0.2);
   const { demo, phoneRef, stripRef } = useDemo();

   const [entered, setEntered] = useState(false);
   useEffect(() => {
      // A short timer rather than animation frames: frames pause in a background tab,
      // and the promise must be on screen the moment the page is looked at.
      const timer = window.setTimeout(() => setEntered(true), 60);
      return () => window.clearTimeout(timer);
   }, []);

   const rise = (delay: string) => ({
      className: cn(
         'transition-[opacity,transform]',
         entered ? 'translate-y-0 opacity-100' : 'translate-y-[22px] opacity-0'
      ),
      style: {
         transitionDuration: '0.7s, 0.8s',
         transitionTimingFunction: 'var(--ease)',
         transitionDelay: entered ? delay : '0s',
      },
   });

   const headline = rise('0s');
   const line = rise('0.12s');
   const action = rise('0.24s');
   const device = rise('0.36s');

   return (
      <section
         id="top"
         className={cn(
            'relative bg-black-block pt-9 pb-11 text-paper md:pt-16 md:pb-14',
            ANCHOR
         )}
      >
         {/* Its own clipping box: the section cannot clip, or the waterline
             that hangs below it is cut off. */}
         <div className="absolute inset-0 overflow-hidden">
            <div
               ref={band}
               className="parallax-hero absolute inset-x-0 top-[-10%] bottom-0"
            >
               <img
                  src={photos.heroSpot}
                  alt=""
                  fetchPriority="high"
                  className="h-full w-full object-cover object-[62%_40%]"
               />
               <div className="absolute inset-0 bg-black-block/60" />
            </div>
         </div>

         <div className={cn(WRAP, 'relative')}>
            <div className="grid items-center gap-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-14">
               <div className="flex flex-col items-start gap-4 md:gap-5">
                  <span
                     className={cn(
                        headline.className,
                        'lab lab-rule text-paper-2'
                     )}
                     style={headline.style}
                  >
                     A fishing log for the South African coast
                  </span>
                  <h1
                     className={cn(
                        headline.className,
                        'g max-w-[19ch] text-[clamp(42px,12.2vw,60px)] text-balance [text-shadow:0_2px_24px_rgba(0,0,0,0.5)] md:max-w-[22ch] md:text-[clamp(44px,5vw,76px)]'
                     )}
                     style={headline.style}
                  >
                     Log the fish before it goes back
                  </h1>
                  <p
                     className={cn(
                        line.className,
                        'max-w-[46ch] text-[16px] text-paper text-pretty [text-shadow:0_1px_14px_rgba(0,0,0,0.6)] md:text-[19px]'
                     )}
                     style={line.style}
                  >
                     One tap stamps where you are, the minute and the weather.
                     Photograph the fish and it names itself. I built it so you
                     can put the phone away and get back to casting. What is
                     beside this is the app itself, running on last September.
                  </p>
                  <div
                     className={cn(action.className, 'flex flex-wrap gap-3')}
                     style={action.style}
                  >
                     <Button
                        size="lg"
                        className="md:h-[52px] md:px-7 md:text-[26px]"
                        asChild
                     >
                        <Link to="/sign-up">Start your log</Link>
                     </Button>
                     <Button
                        size="lg"
                        variant="paper"
                        onClick={demo.play}
                        className="md:h-[52px] md:px-7 md:text-[26px]"
                     >
                        Watch it log
                     </Button>
                  </div>
                  <p
                     className={cn(
                        action.className,
                        'text-[14px] text-paper-2'
                     )}
                     style={action.style}
                  >
                     Free. No setup, no tour, and no plan to sell your catches.
                  </p>
               </div>

               <div
                  className={cn(device.className, 'w-full')}
                  style={device.style}
               >
                  <DeviceDemo
                     demo={demo}
                     phoneRef={phoneRef}
                     stripRef={stripRef}
                  />
               </div>
            </div>

            {/*
             * The steps, across the foot rather than down a page of their own.
             * Each is still the control it was: pressing any of them runs the
             * sequence from the top on the phone above.
             */}
            <ol
               id="how"
               className={cn(
                  ANCHOR,
                  'mt-10 grid gap-x-8 border-t border-paper/20 md:mt-14 md:grid-cols-2 lg:grid-cols-4'
               )}
            >
               {steps.map((s, i) => {
                  const n = i + 1;
                  const state =
                     demo.step === n ? 'on' : demo.step > n ? 'done' : 'idle';
                  return (
                     <li
                        key={s.n}
                        className="rv border-t border-paper/20 first:border-t-0 md:[&:nth-child(2)]:border-t-0 lg:border-t-0"
                        style={stagger(i)}
                     >
                        {/*
                         * Padded out and pulled back by the same amount, so the
                         * words stay on the column and the focus ring has room
                         * round them rather than sitting on the first letter.
                         */}
                        <button
                           type="button"
                           onClick={demo.play}
                           aria-label={`${s.title}. Watch it log.`}
                           data-state={state}
                           data-playing={demo.playing || undefined}
                           style={
                              { '--run': `${RUN_MS[i]}ms` } as CSSProperties
                           }
                           className={cn(
                              'step group relative -mx-3 flex h-full w-[calc(100%+24px)] flex-col items-start gap-1.5 px-3 py-4 text-left transition-opacity duration-[400ms] [transition-timing-function:var(--ease)] md:py-5',
                              state === 'on'
                                 ? 'opacity-100'
                                 : state === 'done'
                                   ? 'opacity-85'
                                   : 'opacity-60 hover:opacity-100 focus-visible:opacity-100'
                           )}
                        >
                           <span aria-hidden="true" className="step-rule" />
                           <span className="flex items-end gap-3">
                              <span
                                 aria-hidden="true"
                                 className="step-num g num text-[38px] leading-[0.9] text-paper-2 md:text-[44px]"
                              >
                                 {[...s.n].map((digit, k) => (
                                    <span
                                       key={k}
                                       className="step-digit"
                                       style={{ '--k': k } as CSSProperties}
                                    >
                                       <span>{digit}</span>
                                       <span className="text-teal">
                                          {digit}
                                       </span>
                                    </span>
                                 ))}
                              </span>
                              <span
                                 aria-hidden="true"
                                 className="step-cue lab mb-[3px] flex items-center gap-1.5 text-teal"
                              >
                                 <span className="step-cue-mark" />
                                 {state === 'on' && demo.playing
                                    ? 'On the phone'
                                    : 'Watch it log'}
                              </span>
                           </span>
                           <b className="step-title g block text-[24px] leading-none font-normal tracking-[0.04em] md:text-[26px]">
                              {s.title}
                           </b>
                           <p className="max-w-[34ch] text-[14px] leading-[1.5] text-paper-2 transition-colors duration-300 group-hover:text-paper group-focus-visible:text-paper">
                              {s.body}
                           </p>
                        </button>
                     </li>
                  );
               })}
            </ol>

            <p className="mt-5 text-[13px] text-paper-2">
               A sample log, one morning at Kalk Bay. Your own photographs take
               these places.
            </p>
         </div>

         <TornEdge fill="black" cut />
      </section>
   );
}
