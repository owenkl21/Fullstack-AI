import { cn } from '@/lib/utils';
import { ANCHOR, WRAP, stagger } from './layout';

/*
 * The boards: the log, read against everybody else's.
 *
 * Two plates rather than a leaderboard component, because the point is that
 * both run off the same log. A competition as it stands on its last two days,
 * and one species board with the reader on it, which is the only row that gets
 * a teal edge.
 *
 * The plates are white cards on the off white ground rather than black ones.
 * The record above already spends the page's black, and a second black plate a
 * screen later reads as the same card twice.
 *
 * No waterline is drawn here. The page composition places every edge.
 */

const board = [
   { rank: '1', who: 'R. Adams · Cape Point', figure: '61 cm', you: false },
   { rank: '2', who: 'T. Naidoo · Rooi-Els', figure: '58 cm', you: false },
   { rank: '3', who: 'You · Kalk Bay', figure: '54 cm', you: true },
];

/* The leader's numeral is the one teal figure on the plate. */
const LEADER = '1';

export function LandingBoards() {
   return (
      <section
         id="boards"
         className={cn('relative bg-bg-2 py-14 md:py-[88px]', ANCHOR)}
      >
         <div
            className={cn(
               WRAP,
               'relative grid items-start gap-9 lg:grid-cols-2 lg:gap-14'
            )}
         >
            <div className="flex min-w-0 flex-col gap-[22px]">
               <span className="lab lab-rule rv text-ink-2">
                  05 <span className="text-ink-3">The boards</span>
               </span>
               <h2
                  className="g rv max-w-[15ch] text-[clamp(40px,5.4vw,76px)]"
                  style={stagger(1)}
               >
                  Then see where it stands
               </h2>
               <p
                  className="rv max-w-[48ch] text-[17px] text-ink-2 text-pretty"
                  style={stagger(2)}
               >
                  Boards are by species, because &quot;who has the best
                  kob&quot; is the question a shore angler actually asks. A
                  galjoen specialist and a kob specialist were never really
                  comparable on one combined table.
               </p>
               <p
                  className="rv max-w-[48ch] text-[17px] text-ink-2 text-pretty"
                  style={stagger(3)}
               >
                  Competitions run off the same log. Enter from the competition
                  or straight from a catch: two photographs go up, one of the
                  fish and one of it on the tape, and the figure is read off the
                  second. Clean entries land on the board. Anything that does
                  not add up is held for a person to look at rather than
                  counted.
               </p>
            </div>

            <div className="flex min-w-0 flex-col gap-[22px]">
               {/* A competition as the app shows it, two days from closing. */}
               <article
                  className="rv flex flex-col gap-1.5 border border-line bg-background p-[22px] md:px-6"
                  style={stagger(2)}
               >
                  <div className="flex items-center justify-between gap-3">
                     <span className="lab text-ink">Running · Public</span>
                     <span className="lab num flex-none">2 days left</span>
                  </div>

                  <h3 className="g mt-1.5 text-[32px] leading-none">
                     False Bay Spring Kob
                  </h3>
                  <p className="text-[15px] leading-[1.5] text-ink-2">
                     Longest single kob, measured on a tape
                     <br />
                     False Bay · <span className="num">1 to 21 Sep</span>
                  </p>

                  <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                     <span className="lab">Leading</span>
                     <span className="g num text-[20px] tracking-[0.03em]">
                        Kob 94 cm
                     </span>
                     <span className="text-[14px] text-ink-2">D. Mostert</span>
                  </p>

                  <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-line pt-3">
                     <span className="num text-[14px] text-ink-3">
                        31 anglers entered
                     </span>
                     <span className="g-tracked inline-flex h-10 flex-none items-center justify-center border border-ink px-4 text-[17px]">
                        Enter
                     </span>
                  </div>
               </article>

               {/* One species board, with the reader's own row marked. */}
               <article
                  className="rv border border-line bg-background p-[22px] md:px-6"
                  style={stagger(3)}
               >
                  <div className="flex items-baseline justify-between gap-4">
                     <h3 className="g text-[28px] leading-none">Galjoen</h3>
                     <span className="lab flex-none">By length</span>
                  </div>

                  <ol className="mt-3.5 flex flex-col">
                     {board.map((row) => (
                        <li
                           key={row.rank}
                           className={cn(
                              'grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-t-line py-2.5',
                              row.you && 'border-l-[3px] border-l-teal pl-3'
                           )}
                        >
                           <span
                              className={cn(
                                 'g num text-[22px]',
                                 row.rank === LEADER
                                    ? 'text-teal-text'
                                    : 'text-ink-3'
                              )}
                           >
                              {row.rank}
                           </span>
                           <span className="text-[15px]">{row.who}</span>
                           <span className="g num flex-none text-[22px] tracking-[0.03em]">
                              {row.figure}
                           </span>
                        </li>
                     ))}
                  </ol>
               </article>
            </div>
         </div>
      </section>
   );
}
