import { cn } from '@/lib/utils';
import { ANCHOR, WRAP, stagger } from './layout';

/*
 * The log, counted.
 *
 * Everything in this band is read off a log somebody was keeping anyway, so it
 * shows the arithmetic rather than describing it: the rank with its ten level
 * track, the table of what each thing is worth, the badges with their rules
 * written out, and the plain totals under a rule.
 *
 * The points and the badges are both longer than a list wants to be, so neither
 * is one. The points are a table, name and reason on the left and the figure on
 * the right, ruled between rows and not under the last. The badges are a card
 * grid: earned ones cut out of black, unearned ones outlined and carrying how
 * far along they are, which is the part that makes a badge worth chasing.
 *
 * No waterline is drawn here. The page composition places every edge, so this
 * section owns its ground and its own rhythm of padding and nothing else.
 */

const points = [
   { name: 'Big fish', note: '9 fish over 60 cm, 2 over 90', score: '345' },
   { name: 'Photographed', note: '38 catches with photos', score: '190' },
   { name: 'Released', note: '31 fish put back', score: '155' },
   { name: 'Competitions', note: '3 entered', score: '150' },
   { name: 'Conditions on record', note: '44 catches', score: '88' },
];

/* A badge with no `progress` is earned; the rest carry how far along they are. */
type Badge = { name: string; rule: string; progress?: number };

const badges: Badge[] = [
   { name: 'Dawn patrol', rule: 'A fish before six in the morning.' },
   { name: 'Spring tide', rule: 'A fish on a spring tide.' },
   { name: 'Ten kinds', rule: 'Ten species on the log.' },
   { name: 'Nomad', rule: 'Spots 300 km apart.', progress: 71 },
   { name: 'Seasoned', rule: 'Fifty days on the water.', progress: 82 },
   { name: 'Century', rule: 'A hundred fish.', progress: 48 },
];

const counts = [
   { label: 'Fish', value: '48' },
   { label: 'Species', value: '10' },
   { label: 'Spots', value: '7' },
   { label: 'Range', value: '214', unit: 'km' },
   { label: 'Days out', value: '41' },
   { label: 'Released', value: '31' },
];

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const REACHED = 5;

export function LandingInsights() {
   return (
      <section
         id="insights"
         className={cn('relative bg-background py-14 md:py-[88px]', ANCHOR)}
      >
         <div className={WRAP}>
            <div className="grid items-end gap-7 lg:grid-cols-2 lg:gap-14">
               <div className="flex min-w-0 flex-col gap-[22px]">
                  <span className="lab lab-rule rv text-ink-2">
                     04 <span className="text-ink-3">Your log, counted</span>
                  </span>
                  <h2
                     className="g rv max-w-[16ch] text-[clamp(40px,5.4vw,76px)]"
                     style={stagger(1)}
                  >
                     Every fish is worth something
                  </h2>
               </div>

               <div className="flex min-w-0 flex-col gap-3.5">
                  <p
                     className="rv max-w-[52ch] text-[17px] text-ink-2 text-pretty"
                     style={stagger(2)}
                  >
                     Ten levels, from Greenhorn to Legend of the ledges, and
                     fourteen badges, and they are all earned off the log you
                     were keeping anyway. A species you had never caught, a spot
                     you had never fished, three hundred kilometres between your
                     furthest two marks, a fish before six in the morning.
                  </p>
                  <p
                     className="rv max-w-[52ch] text-[17px] text-ink-2 text-pretty"
                     style={stagger(3)}
                  >
                     The rules are written down rather than buried in the
                     arithmetic, so you can read exactly what each thing is
                     worth. And under the rank, your log counted every way it
                     can be: when the fish came, what they came in, what they
                     were and where.
                  </p>
               </div>
            </div>

            <div className="mt-9 grid items-start gap-8 md:mt-11 lg:grid-cols-2 lg:gap-14">
               {/* The rank, as the log shows it: where you stand and what is left. */}
               <div
                  className="blk rv min-w-0 self-start p-5 md:p-7"
                  style={stagger(1)}
               >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pr-[22px]">
                     <span className="lab text-paper-2">Level</span>
                     <span className="g num text-[64px] leading-none">5</span>
                     <span className="g text-[34px] leading-none">
                        Surf caster
                     </span>
                  </div>

                  <div
                     aria-hidden="true"
                     className="relative mt-5 h-1.5 bg-paper/15"
                  >
                     <span
                        className="absolute inset-y-0 left-0 bg-teal"
                        style={{ width: '73%' }}
                     />
                  </div>
                  <p className="num mt-2 text-[14px] text-paper-2">
                     3,047 points. 453 more to level 6, Ledge regular.
                  </p>

                  <ol className="mt-5 grid grid-cols-10 gap-x-2 gap-y-1.5 text-[11px] md:gap-x-3 md:text-[12px]">
                     {LEVELS.map((level) => (
                        <li
                           key={level}
                           className={cn(
                              'flex flex-col gap-1',
                              level <= REACHED ? 'text-paper' : 'text-ink-3'
                           )}
                        >
                           <span
                              className={cn(
                                 'block h-1',
                                 level <= REACHED ? 'bg-teal' : 'bg-paper/20'
                              )}
                           />
                           <span className="num">{level}</span>
                        </li>
                     ))}
                  </ol>
               </div>

               <div className="min-w-0">
                  <h3 className="lab rv" style={stagger(2)}>
                     Where the points come from
                  </h3>
                  <dl className="rv mt-2" style={stagger(2)}>
                     {points.map((row) => (
                        <div
                           key={row.name}
                           className="flex items-baseline justify-between gap-4 border-t border-line py-2 first:border-t-0"
                        >
                           <dt className="min-w-0">
                              <span className="g-tracked text-[17px]">
                                 {row.name}
                              </span>
                              <span className="ml-2 text-[14px] text-ink-3">
                                 {row.note}
                              </span>
                           </dt>
                           <dd className="num flex-none text-[15px]">
                              {row.score}
                           </dd>
                        </div>
                     ))}
                  </dl>

                  <h3 className="lab rv mt-7" style={stagger(3)}>
                     Badges, 9 of 14 earned · six of them
                  </h3>
                  <ul
                     className="rv mt-2.5 grid grid-cols-2 gap-2.5 md:grid-cols-3"
                     style={stagger(3)}
                  >
                     {badges.map((badge) => (
                        <li
                           key={badge.name}
                           className={cn(
                              'flex min-w-0 flex-col gap-1 p-3',
                              badge.progress === undefined
                                 ? 'blk blk-plain'
                                 : 'border border-line'
                           )}
                        >
                           <span className="g-tracked text-[17px] leading-[1.1]">
                              {badge.name}
                           </span>
                           <span
                              className={cn(
                                 'text-[13px] leading-[1.35]',
                                 badge.progress === undefined
                                    ? 'text-paper-2'
                                    : 'text-ink-3'
                              )}
                           >
                              {badge.rule}
                           </span>
                           {badge.progress !== undefined && (
                              <span
                                 aria-hidden="true"
                                 className="mt-auto block pt-2"
                              >
                                 <span className="block h-1 w-full bg-line">
                                    <span
                                       className="block h-1 bg-teal"
                                       style={{ width: `${badge.progress}%` }}
                                    />
                                 </span>
                              </span>
                           )}
                        </li>
                     ))}
                  </ul>
               </div>
            </div>

            <div
               className="rv mt-11 border-t border-line pt-7"
               style={stagger(1)}
            >
               <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
                  {counts.map((count) => (
                     <div key={count.label} className="flex flex-col">
                        <dt className="lab">{count.label}</dt>
                        <dd className="g num mt-1 text-[34px] leading-none">
                           {count.value}
                           {count.unit && (
                              <small className="ml-1 font-sans text-[14px] tracking-normal text-ink-2">
                                 {count.unit}
                              </small>
                           )}
                        </dd>
                     </div>
                  ))}
               </dl>
            </div>
         </div>
      </section>
   );
}
