import type { ForecastRating, RatedDay } from './forecast-api';
import { BAND_WORD, bandFill } from './tones';

/*
 * Whether the day is worth the drive, and why.
 *
 * One word, the number behind it, and the three or four lines that produced
 * it. The lines are not decoration: this product never shows a score without
 * saying where it came from, and most of what is said here is read off the
 * angler's own log rather than out of a weather model. A reader who disagrees
 * with the band can see exactly which sentence to argue with.
 *
 * The word sits in a solid slab of its band's colour with near black on it,
 * which is the same idiom as the chosen tab in the strip above and the black
 * block below. The colour never carries the meaning on its own: the word is
 * printed in it and the figure stands beside the word.
 *
 * It reads under the day strip, so it is always about the day that is chosen.
 * When some other day of the week is better, that is said in one line at the
 * bottom rather than left for the reader to click through seven tabs to find.
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

export function RatingPanel({
   day,
   rating,
   today,
}: {
   day: RatedDay;
   rating: ForecastRating;
   today: string;
}) {
   const word = BAND_WORD[day.band];
   const window =
      day.bestFrom && day.bestTo ? `${day.bestFrom} to ${day.bestTo}` : null;

   /*
    * The pointer to a better day. Only when there is one, only when it is
    * clearly better rather than a point away, and never when the reader is
    * already looking at it.
    */
   const best = rating.best;
   const elsewhere =
      best && best.date !== day.date
         ? rating.days.find((d) => d.date === best.date)
         : null;
   const pointer =
      elsewhere && elsewhere.score >= day.score + 4
         ? `Best this week is ${dayWord(elsewhere.date, today)}${
              elsewhere.bestFrom && elsewhere.bestTo
                 ? `, ${elsewhere.bestFrom} to ${elsewhere.bestTo}`
                 : ''
           }.`
         : null;

   return (
      <section aria-label="Rating" className="border-t border-line pt-3">
         <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="lab text-teal-text">Worth going</h2>
            {window ? (
               <p className="lab num text-ink-3">Best hours {window}</p>
            ) : null}
         </div>

         <div className="mt-2 flex flex-wrap items-start gap-x-5 gap-y-3">
            <p
               className="g flex items-baseline gap-2.5 px-3 py-1.5 text-black-block"
               style={{ background: bandFill(day.band) }}
            >
               <span className="text-[38px] leading-none md:text-[44px]">
                  {word}
               </span>
               <span className="num text-[18px] leading-none opacity-65">
                  {day.score}
                  <span className="sr-only"> out of 100</span>
               </span>
            </p>

            {day.reasons.length > 0 ? (
               <ul className="min-w-[min(100%,20rem)] flex-1 space-y-1">
                  {day.reasons.map((reason) => (
                     <li
                        key={reason.topic}
                        className="text-[15px] leading-snug text-ink-2"
                     >
                        {reason.text}
                     </li>
                  ))}
               </ul>
            ) : null}
         </div>

         <p className="mt-2.5 text-[14px] leading-snug text-ink-3">
            {pointer ? `${pointer} ` : ''}
            {rating.basis.note}
         </p>
      </section>
   );
}
