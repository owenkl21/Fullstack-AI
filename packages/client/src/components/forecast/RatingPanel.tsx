import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { nowStripe } from './band-geometry';
import type { ForecastRating, RatedDay, RatedHour } from './forecast-api';
import { BANDS, BAND_WORD, bandFill, reasonWord } from './tones';

/*
 * Whether the day is worth the drive, and why.
 *
 * One word, the number behind it, and the three or four lines that produced
 * it. The lines are not decoration: this product never shows a score without
 * saying where it came from, and most of what is said here is read off the
 * angler's own log rather than out of a weather model. A reader who disagrees
 * with the band can see exactly which sentence to argue with. Each line leads
 * with what it is about, so the list can be scanned for the wind or the moon.
 *
 * The figure sits in a ring drawn round to it in its band's colour, and the
 * word stands beside it in ink over the four bands in a row, so the day reads
 * as a place on a scale rather than a colour to decode. The colour never
 * carries the meaning on its own: the word is printed and the figure is in
 * the ring.
 *
 * Then the day hour by hour, one bar to an hour in its band's colour, with the
 * best three hours lit and the hour the reader is standing in marked the way
 * the instrument marks it. A bar says its hour, band and score when it is
 * pointed at or tapped, in the label that otherwise names the best hours.
 *
 * It reads under the day strip, so it is always about the day that is chosen.
 * When some other day of the week is better, that is said in one line at the
 * bottom, and the line takes the reader there rather than leaving seven tabs
 * to click through.
 *
 * Two columns only from lg. At md a 560 pixel column beside the hours would
 * leave the strip about a hundred pixels wide, so up to lg it stacks at the
 * desk sizes in the phone's order: score, hours, reasons, note.
 */

const WEEKDAY = [
   'Sunday',
   'Monday',
   'Tuesday',
   'Wednesday',
   'Thursday',
   'Friday',
   'Saturday',
];

const dayWord = (date: string, today: string) => {
   if (date === today) return 'today';
   const at = new Date(`${date}T12:00Z`);
   return WEEKDAY[at.getUTCDay()] ?? date;
};

/* An hour's bar, on the same 28 to 85 run as the instrument's rating row. The
   floor keeps a bad hour a visible stub rather than nothing. */
const barHeight = (score: number) =>
   `${Math.min(100, Math.max(10, ((score - 28) / 57) * 100))}%`;

const hourOf = (hour: RatedHour) => hour.local.slice(11, 13);

export function RatingPanel({
   day,
   rating,
   today,
   nowLocal,
   onPick,
}: {
   day: RatedDay;
   rating: ForecastRating;
   today: string;
   /* The place's clock this hour, and null unless the day is today. */
   nowLocal: string | null;
   onPick: (date: string) => void;
}) {
   const word = BAND_WORD[day.band];
   const named = dayWord(day.date, today);
   const heading = named.charAt(0).toUpperCase() + named.slice(1);

   const hours = useMemo(
      () => rating.hours.filter((h) => h.local.startsWith(day.date)),
      [rating.hours, day.date]
   );
   /* The hour being read in the label, by hover or a tap. Null shows the
      best hours. The panel is keyed on the day, so a new day starts clear. */
   const [peek, setPeek] = useState<number | null>(null);

   const lit = (hour: RatedHour) => {
      const clock = hour.local.slice(11, 16);
      return (
         day.bestFrom !== null &&
         day.bestTo !== null &&
         clock >= day.bestFrom &&
         clock <= day.bestTo
      );
   };
   const nowIndex = nowLocal
      ? hours.findIndex((h) => h.local === nowLocal)
      : -1;
   const nowClock = nowLocal?.slice(11, 16);

   const peeked = peek === null ? null : (hours[peek] ?? null);
   /* An answer the browser kept from before the window had a word of its
      own has no bestBand, so the label simply goes without it. */
   const label = peeked
      ? `${hourOf(peeked)}:00 · ${BAND_WORD[peeked.band]} · ${peeked.score}`
      : day.bestFrom && day.bestTo
        ? `Best ${day.bestFrom} to ${day.bestTo}${
             day.bestBand ? ` · ${BAND_WORD[day.bestBand]}` : ''
          }`
        : '';

   /*
    * The pointer to a better day. Only when there is one, only when it is
    * clearly better rather than a point away, and never when the reader is
    * already looking at it.
    */
   const best = rating.best;
   const found =
      best && best.date !== day.date
         ? rating.days.find((d) => d.date === best.date)
         : null;
   const elsewhere = found && found.score >= day.score + 4 ? found : null;
   const pointer = elsewhere
      ? `Best this week is ${dayWord(elsewhere.date, today)}${
           elsewhere.bestFrom && elsewhere.bestTo
              ? `, ${elsewhere.bestFrom} to ${elsewhere.bestTo}`
              : ''
        }.`
      : null;

   return (
      <section aria-label="Worth going" className="border-t border-line pt-3">
         <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="lab text-teal-text">Worth going</h2>
            <p className="lab num text-ink-3">{heading} · score out of 100</p>
         </div>

         <div className="mt-3.5 flex flex-col lg:grid lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start lg:gap-x-16">
            <div className="contents lg:block">
               <div className="order-1 flex items-center gap-[18px] md:gap-[22px]">
                  <div
                     role="img"
                     aria-label={`${day.score} out of 100, ${word}`}
                     className="relative size-[104px] shrink-0 md:size-32"
                  >
                     <svg
                        viewBox="0 0 100 100"
                        className="absolute inset-0 size-full -rotate-90"
                     >
                        <circle
                           cx={50}
                           cy={50}
                           r={44}
                           fill="none"
                           strokeWidth={7}
                           className="stroke-line"
                        />
                        <circle
                           cx={50}
                           cy={50}
                           r={44}
                           fill="none"
                           strokeWidth={7}
                           pathLength={100}
                           className="ring-fill"
                           style={{
                              stroke: bandFill(day.band),
                              strokeDasharray: `${day.score} 100`,
                           }}
                        />
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                        <span className="g num text-[44px] leading-[0.9] text-ink md:text-[54px]">
                           {day.score}
                        </span>
                        <span className="lab text-ink-3">of 100</span>
                     </div>
                  </div>

                  <div className="min-w-0 flex-1">
                     <p className="g text-[48px] leading-[0.9] text-ink md:text-[60px]">
                        {word}
                     </p>
                     <div
                        aria-hidden="true"
                        className="mt-2.5 grid grid-cols-[1fr_1fr_1fr_1.8fr] gap-[3px] md:mt-3"
                     >
                        {BANDS.map((band) => (
                           <span
                              key={band}
                              className={cn(
                                 'block h-[5px]',
                                 band !== day.band && 'bg-line'
                              )}
                              style={
                                 band === day.band
                                    ? { background: bandFill(band) }
                                    : undefined
                              }
                           />
                        ))}
                     </div>
                     <div className="lab mt-1.5 grid grid-cols-[1fr_1fr_1fr_1.8fr] gap-[3px] text-[11px] leading-[14px] tracking-[0.12em] whitespace-nowrap">
                        {BANDS.map((band) => (
                           <span
                              key={band}
                              className={cn(band === day.band && 'text-ink')}
                           >
                              {BAND_WORD[band]}
                           </span>
                        ))}
                     </div>
                  </div>
               </div>

               {/* One grid down the list, so a long word such as Pressure
                   moves every sentence along with it rather than running
                   into its own. */}
               {day.reasons.length > 0 ? (
                  <ul className="order-3 mt-[18px] grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 md:gap-x-3">
                     {day.reasons.map((reason) => (
                        <li
                           key={reason.topic}
                           className="col-span-full grid grid-cols-subgrid items-baseline"
                        >
                           <span className="lab min-w-12 whitespace-nowrap text-ink-3 md:min-w-[52px]">
                              {reasonWord(reason)}
                           </span>
                           <span className="text-[15px] leading-snug text-ink">
                              {reason.text}
                           </span>
                        </li>
                     ))}
                  </ul>
               ) : null}
            </div>

            <div className="contents lg:block">
               {hours.length > 0 ? (
                  <div className="order-2 mt-[18px] lg:mt-0">
                     {/* Free to wrap, so a long label such as Exceptional
                         drops to its own line on a narrow phone rather than
                         running off the page. */}
                     <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="lab num whitespace-nowrap text-ink-3">
                           Hour by hour
                           {nowClock ? (
                              <span className="hidden md:inline">
                                 {` · now ${nowClock}`}
                              </span>
                           ) : null}
                        </p>
                        <p
                           aria-live="polite"
                           className="lab num whitespace-nowrap text-teal-text"
                        >
                           {label}
                        </p>
                     </div>

                     <div className="relative mt-2 md:mt-2.5">
                        {nowIndex >= 0 ? (
                           <span
                              aria-hidden="true"
                              className="pointer-events-none absolute -top-1 -bottom-1 border-t-2 border-teal bg-teal/16"
                              style={nowStripe({
                                 index: nowIndex,
                                 count: hours.length,
                              })}
                           />
                        ) : null}
                        <div
                           onMouseLeave={() => setPeek(null)}
                           className="relative flex h-12 items-end gap-0.5 md:h-[72px] md:gap-[3px]"
                        >
                           {hours.map((hour, i) => (
                              <button
                                 key={hour.local}
                                 type="button"
                                 aria-label={`${hourOf(hour)}:00, ${BAND_WORD[hour.band]}, ${hour.score} out of 100`}
                                 onMouseEnter={() => setPeek(i)}
                                 onClick={() => setPeek(i)}
                                 className="min-w-0 flex-1 cursor-pointer p-0 focus-visible:outline-offset-2"
                                 style={{
                                    height: barHeight(hour.score),
                                    background: bandFill(hour.band),
                                    opacity:
                                       peek === i
                                          ? 1
                                          : peek === null && lit(hour)
                                            ? 1
                                            : 0.32,
                                 }}
                              />
                           ))}
                        </div>
                     </div>

                     {/* Every bar names its own hour, so the axis is for the
                         eye only. */}
                     <div
                        aria-hidden="true"
                        className="lab num relative mt-1.5 h-[18px] text-ink-3"
                     >
                        <span className="absolute top-0.5 left-0">00</span>
                        <span className="absolute top-0.5 left-1/4">06</span>
                        <span className="absolute top-0.5 left-1/2">12</span>
                        <span className="absolute top-0.5 left-3/4">18</span>
                        <span className="absolute top-0.5 right-0">24</span>
                     </div>
                  </div>
               ) : null}

               <p className="order-4 mt-3 text-[14px] leading-snug text-ink-3 lg:mt-3.5">
                  {elsewhere ? (
                     <>
                        {/* A button, not a link: the chosen day is not in the
                            address. */}
                        <button
                           type="button"
                           onClick={() => onPick(elsewhere.date)}
                           className="text-left text-teal-text hover:opacity-80"
                        >
                           {pointer}
                        </button>{' '}
                     </>
                  ) : null}
                  {rating.basis.note}
               </p>
            </div>
         </div>
      </section>
   );
}
