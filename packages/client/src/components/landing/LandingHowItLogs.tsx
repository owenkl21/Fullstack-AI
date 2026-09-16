import { Thread } from '@/components/brand/Thread';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DeviceDemo } from './demo/DeviceDemo';
import { steps } from './demo/data';
import { useDemo } from './demo/useDemo';
import { ANCHOR, WRAP, stagger } from './layout';
import { LandingMedia } from './LandingMedia';

/*
 * The dashed line draws down the margin while the four steps light up beside the
 * phone. `Watch it log` runs the whole sequence hands free; the phone stays live
 * either way.
 */
export function LandingHowItLogs() {
   const { demo, phoneRef, stripRef } = useDemo();

   return (
      <section id="how" className={cn('relative py-14 md:py-[88px]', ANCHOR)}>
         <Thread className="left-[2px] w-[28px] lg:left-[max(12px,calc((100%-1200px)/2-56px))] lg:w-[60px]" />

         <div className={WRAP}>
            <div className="grid items-start gap-9 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
               <div className="flex flex-col gap-[26px] pl-5 md:pl-6 lg:sticky lg:top-[84px] lg:pt-4 lg:pl-0">
                  <span className="lab lab-rule rv text-ink-2">
                     How it logs
                  </span>
                  <h2
                     className="g rv text-[clamp(44px,6vw,84px)]"
                     style={stagger(1)}
                  >
                     The record builds itself
                  </h2>
                  <p
                     className="rv max-w-[46ch] text-[17px] text-ink-2 text-pretty"
                     style={stagger(2)}
                  >
                     One tap fires the position fix, stamps the clock and pulls
                     the conditions before the sheet has finished opening. The
                     fish goes back. The record stays.
                  </p>

                  <ol
                     className="rule-dashed-left rv mt-2 flex flex-col"
                     style={stagger(3)}
                  >
                     {steps.map((s, i) => {
                        const n = i + 1;
                        const on = demo.step === n;
                        const done = demo.step > n;
                        return (
                           <li
                              key={s.n}
                              className={cn(
                                 'relative grid grid-cols-[52px_minmax(0,1fr)] items-start gap-[18px] py-3.5 pl-[18px] transition-opacity duration-[400ms] [transition-timing-function:var(--ease)] lg:grid-cols-[64px_minmax(0,1fr)] lg:py-[18px] lg:pl-[22px]',
                                 on
                                    ? 'opacity-100'
                                    : done
                                      ? 'opacity-80'
                                      : 'opacity-45'
                              )}
                           >
                              <span
                                 aria-hidden="true"
                                 className={cn(
                                    'absolute top-[30px] -left-[7px] size-3 rounded-full border-2 border-teal transition-[background-color,transform] duration-300 [transition-timing-function:var(--ease)]',
                                    on || done ? 'bg-teal' : 'bg-background',
                                    on && 'scale-125'
                                 )}
                              />
                              <span
                                 className={cn(
                                    'g num text-[44px] leading-[0.9] transition-colors duration-300 lg:text-[56px]',
                                    on || done ? 'text-teal-text' : 'text-ink-3'
                                 )}
                              >
                                 {s.n}
                              </span>
                              <div>
                                 <b className="g mb-1.5 block text-[28px] leading-none font-normal tracking-[0.04em]">
                                    {s.title}
                                 </b>
                                 <p className="max-w-[40ch] text-[15px] leading-[1.5] text-ink-2">
                                    {s.body}
                                 </p>
                              </div>
                           </li>
                        );
                     })}
                  </ol>

                  <Button
                     size="lg"
                     onClick={demo.play}
                     className="rv self-start"
                     style={stagger(4)}
                  >
                     Watch it log
                  </Button>
               </div>

               <div className="rv" style={stagger(1)}>
                  <DeviceDemo
                     demo={demo}
                     phoneRef={phoneRef}
                     stripRef={stripRef}
                  />
               </div>
            </div>

            <p className="rv mt-2.5 text-center text-[13px] text-ink-3">
               Sample data. Unsplash photographs stand in for the angler&apos;s
               own.
            </p>

            <LandingMedia />
         </div>
      </section>
   );
}
