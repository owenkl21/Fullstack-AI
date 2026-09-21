import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Contours } from '@/components/brand/Contours';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FixAccuracy } from './demo/Counter';
import { ANCHOR, WRAP, stagger } from './layout';

/*
 * The one full-bleed teal moment on the page, and the last thing before the
 * footer.
 *
 * It used to end on an email box, which asked for an address and then threw
 * it away: the button beside it was a plain link to the sign-up. So the ask
 * here is the log itself. Page one of it, blank, with the parts the app does
 * for you already running: the minute is this minute, and the fix tightens
 * on a loop the way it does on the rocks. What is left blank is the part only
 * the angler can fill in, which is the fish.
 *
 * It speaks as the person who built it rather than as a product, because that
 * is what it is: one angler's log for one coast.
 */

const blanks = [
   ['Species', 'named off the photo'],
   ['Length', 'by eye or on a tape'],
   ['Weight', 'by eye or on a scale'],
   ['Conditions', 'taken for you'],
] as const;

/* The fix runs, holds on its answer long enough to be read, and starts again. */
const FIX_RUN_MS = 2600;
const FIX_HOLD_MS = 4400;

const reduced = () =>
   window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* This minute, in the visitor's own clock, the way Log would stamp it. */
function useMinute() {
   const [now, setNow] = useState(() => new Date());
   useEffect(() => {
      const id = window.setInterval(() => setNow(new Date()), 1000);
      return () => window.clearInterval(id);
   }, []);
   return {
      hours: String(now.getHours()).padStart(2, '0'),
      minutes: String(now.getMinutes()).padStart(2, '0'),
   };
}

/*
 * The fix, on a loop, but only once the page is seen: `running` while the
 * line draws and the metres fall, `held` once it has its answer.
 */
function useFixLoop(target: React.RefObject<HTMLElement | null>) {
   const [running, setRunning] = useState(false);
   const [held, setHeld] = useState(false);

   useEffect(() => {
      const el = target.current;
      if (!el) return;
      const timers: number[] = [];
      let seen = false;

      const cycle = () => {
         setRunning(true);
         setHeld(false);
         if (reduced()) {
            setHeld(true);
            return;
         }
         timers.push(window.setTimeout(() => setHeld(true), FIX_RUN_MS));
         timers.push(
            window.setTimeout(() => {
               setRunning(false);
               timers.push(window.setTimeout(cycle, 60));
            }, FIX_RUN_MS + FIX_HOLD_MS)
         );
      };

      const io = new IntersectionObserver(
         (entries) => {
            if (seen || !entries[0].isIntersecting) return;
            seen = true;
            io.disconnect();
            timers.push(window.setTimeout(cycle, 500));
         },
         { threshold: 0.4 }
      );
      io.observe(el);

      return () => {
         io.disconnect();
         timers.forEach(window.clearTimeout);
      };
   }, [target]);

   return { running, held };
}

export function LandingJoin() {
   const card = useRef<HTMLDivElement>(null);
   const { hours, minutes } = useMinute();
   const { running: fixing, held } = useFixLoop(card);

   return (
      <section
         id="join"
         className={cn(
            'relative overflow-hidden bg-teal py-14 text-teal-ink md:py-[96px]',
            ANCHOR
         )}
      >
         <Contours
            seed={31}
            className="top-[-20%] right-[-10%] h-[140%] w-[80%] [--contour:rgba(6,42,47,0.16)]"
         />

         <div
            className={cn(
               WRAP,
               'relative grid items-center gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)] md:gap-14'
            )}
         >
            <div className="flex flex-col items-start gap-5">
               <span className="lab lab-rule rv text-teal-ink/75 after:bg-teal-ink/60">
                  From the builder
               </span>
               <h2
                  className="g rv text-[clamp(56px,9vw,120px)] leading-[0.86]"
                  style={stagger(1)}
               >
                  Stay on the water
               </h2>
               <p
                  className="rv max-w-[46ch] text-[17px] text-teal-ink/85 text-pretty"
                  style={stagger(2)}
               >
                  I fish this coast, and I kept losing the details: which tide,
                  which wind, how big, exactly where. So I built the log I
                  wanted. One tap on the rocks, and the rest of it filled in by
                  the time the fish went back.
               </p>
               <p
                  className="rv max-w-[46ch] text-[17px] text-teal-ink/85 text-pretty"
                  style={stagger(3)}
               >
                  It is free. There is no plan to sell it or your catches, and
                  there is no setup and no tour. Log one fish and you have seen
                  the whole of it.
               </p>
               <div
                  className="rv mt-1 flex flex-wrap items-center gap-x-6 gap-y-3"
                  style={stagger(4)}
               >
                  <Button
                     size="lg"
                     asChild
                     className="join-go bg-black-block text-paper hover:brightness-125 md:h-[52px] md:px-7 md:text-[26px]"
                  >
                     <Link to="/sign-up">
                        Start your log
                        <span aria-hidden="true" className="join-go-arrow">
                           &rarr;
                        </span>
                     </Link>
                  </Button>
                  <Link
                     to="/sign-in"
                     className="g-tracked inline-flex min-h-11 items-center text-[20px] underline decoration-teal-ink/40 decoration-2 underline-offset-[6px] transition-[text-decoration-color] duration-200 hover:decoration-teal-ink"
                  >
                     I have a log
                  </Link>
               </div>
            </div>

            {/*
             * Page one, blank. The page under it is the rest of the log, and
             * it fans out a little further when a pointer comes near, as if
             * the book were being opened.
             */}
            <div className="join-page rv relative" style={stagger(2)}>
               <div aria-hidden="true" className="join-under" />
               <div
                  ref={card}
                  className="join-card blk relative flex flex-col gap-4 px-[22px] pt-6 pb-6 md:px-7 md:pt-7"
               >
                  <div className="flex items-baseline justify-between gap-4 pr-6">
                     <span className="lab text-paper-2">
                        Your log, page one
                     </span>
                     <span className="lab text-teal-text">Waiting</span>
                  </div>

                  <div className="flex flex-col gap-1.5 border-l-[3px] border-dashed border-teal bg-bg-2 px-3.5 py-3">
                     <span className="g num text-[56px] leading-none tracking-[0.03em] md:text-[64px]">
                        {hours}
                        <span className="join-colon">:</span>
                        {minutes}
                     </span>
                     <div
                        className={cn('fixline', fixing && 'go')}
                        style={fixing ? undefined : { transition: 'none' }}
                     />
                     <span className="num flex justify-between text-[14px]">
                        <span className="text-ink-3">
                           {held
                              ? 'Fixed. Now the fish'
                              : fixing
                                ? 'Getting a fix'
                                : 'Stamped when you tap Log'}
                        </span>
                        <span className="min-w-[56px] text-right font-medium text-teal-text">
                           <FixAccuracy running={fixing} />
                        </span>
                     </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                     {blanks.map(([key, source], i) => (
                        <div
                           key={key}
                           className="flex flex-col border-t border-dashed border-teal/70 pt-2"
                        >
                           <dt className="lab text-paper-2">{key}</dt>
                           <dd className="flex flex-col gap-1.5">
                              {/* The blank: a line to write on, and on the
                                  first one the cursor, waiting. */}
                              <span
                                 aria-hidden="true"
                                 className="mt-2 flex h-[22px] items-end gap-1"
                              >
                                 {i === 0 ? (
                                    <span className="join-caret" />
                                 ) : null}
                                 <span className="h-0 w-full max-w-[96px] border-b-2 border-dashed border-paper/25" />
                              </span>
                              <span className="text-[13px] text-paper-2">
                                 {source}
                              </span>
                           </dd>
                        </div>
                     ))}
                  </dl>

                  <p className="border-t border-paper/10 pt-3 text-[14px] text-paper-2">
                     Blank until your first fish. Everything else is already
                     running.
                  </p>
               </div>
            </div>
         </div>
      </section>
   );
}
