import { Link } from 'react-router-dom';
import { formatDayMonth, plural } from '@/components/fishing/record/format';
import type { SeasonItem } from './summary';
import { framingStyle } from '@/lib/framing';
import { cn } from '@/lib/utils';

/*
 * The year so far, oldest first: a photo tile per catch whose height is its length,
 * the month where it turns over. Blank trips are not stored yet, so the strip does
 * not pretend to know about the empty mornings.
 */
export function SeasonStrip({
   items,
   count,
}: {
   items: SeasonItem[];
   count: number;
}) {
   return (
      <section aria-labelledby="season-heading" className="pt-5">
         <div className="flex items-baseline justify-between gap-4 px-4 md:px-8">
            <h2 id="season-heading" className="g text-[30px]">
               This season
            </h2>
            <span className="lab">{plural(count, 'catch', 'catches')}</span>
         </div>
         <ul className="flex snap-x items-end gap-2.5 overflow-x-auto px-4 pt-3 pb-2 md:px-8 [scrollbar-width:thin]">
            {items.map((item) =>
               item.kind === 'month' ? (
                  <li
                     key={item.key}
                     aria-hidden="true"
                     className="flex h-[120px] w-8 flex-none items-end justify-center bg-black-block"
                  >
                     <span className="lab [writing-mode:vertical-rl] rotate-180 pb-2 text-paper">
                        {item.label}
                     </span>
                  </li>
               ) : (
                  <li key={item.key} className="w-[88px] flex-none snap-start">
                     <Link
                        to={`/catches/${item.entry.id}`}
                        className="flex flex-col gap-1.5"
                     >
                        {/*
                         * With a photo this is a photo tile. Without one it has
                         * to read as a deliberate bar, because an empty box
                         * sized by the length of the fish looks exactly like an
                         * image that failed to load, and most catches have no
                         * photograph.
                         */}
                        {/*
                         * Every tile the same height. The height used to be
                         * the length of the best fish, which made the row
                         * jump up and down and read as a chart of nothing in
                         * particular. The length is printed under the tile;
                         * the tile is the day.
                         */}
                        <span
                           className={cn(
                              'relative flex h-[120px] w-[88px] overflow-hidden',
                              item.entry.images[0]?.image.url
                                 ? 'bg-bg-2'
                                 : item.measured
                                   ? 'items-end bg-ink/85'
                                   : /*
                                      * No figure was taken, so the tile is
                                      * outlined rather than filled. A solid bar
                                      * at the floor would read as the shortest
                                      * fish of the season instead of as one
                                      * nobody measured.
                                      */
                                     'items-end border border-dashed border-ink/35'
                           )}
                        >
                           {item.entry.images[0]?.image.url ? (
                              <img
                                 src={item.entry.images[0].image.url}
                                 alt=""
                                 loading="lazy"
                                 /* The tile already hides what spills, so the
                                    angler's framing needs no box of its own. */
                                 style={framingStyle(
                                    item.entry.images[0].image
                                 )}
                                 className="h-full w-full object-cover transition-transform duration-[600ms] [transition-timing-function:var(--ease)] hover:scale-[1.04]"
                              />
                           ) : (
                              <span
                                 aria-hidden="true"
                                 className={cn(
                                    'block h-1.5 w-full',
                                    item.measured ? 'bg-teal' : 'bg-ink/25'
                                 )}
                              />
                           )}
                           {/* The day's tally, on the tile, so a three fish
                               morning is legible without opening it. */}
                           {item.count > 1 ? (
                              <span className="absolute top-1 right-1 inline-flex min-w-[22px] items-center justify-center gap-0.5 bg-paper px-1.5 py-0.5 text-[11px] leading-none text-ink num">
                                 {item.count}
                                 <span className="font-sans text-[10px] text-ink-2">
                                    fish
                                 </span>
                              </span>
                           ) : null}
                        </span>
                        {/* The date only. The length and the spot were three
                            lines of small type under every tile, and the
                            row stopped lining up. The tile is the day; the
                            catch page has the rest. */}
                        <span className="lab text-ink-2">
                           {formatDayMonth(item.entry.caughtAt)}
                        </span>
                     </Link>
                  </li>
               )
            )}
         </ul>
      </section>
   );
}
