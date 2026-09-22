import { NoData } from '@/components/states/NoData';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDayMonth, plural } from '@/components/fishing/record/format';
import { seasonMonths, seasonYears } from '@/components/fishing/home/summary';
import type { CatchSummary } from '@/components/fishing/record/api';
import { framingStyle } from '@/lib/framing';
import { cn } from '@/lib/utils';

/*
 * A year of the log, month by month, oldest first: a tile per day fished,
 * its face the best fish of the day. Each month has its own heading over
 * its days rather than a bar standing between them, and the year is chosen
 * at the top, so an old season is as easy to read as this one.
 */
export function SeasonStrip({ catches }: { catches: CatchSummary[] }) {
   const years = useMemo(() => seasonYears(catches), [catches]);
   const [year, setYear] = useState<number>(
      () => years[0] ?? new Date().getFullYear()
   );
   const months = useMemo(() => seasonMonths(catches, year), [catches, year]);
   const fish = months.reduce((n, m) => n + m.fish, 0);
   const days = months.reduce((n, m) => n + m.days.length, 0);

   if (years.length === 0) return null;

   return (
      <div className="min-w-0">
         <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div
               role="radiogroup"
               aria-label="Year"
               className="flex flex-wrap border border-ink"
            >
               {years.map((y) => {
                  const on = y === year;
                  return (
                     <button
                        key={y}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setYear(y)}
                        className={cn(
                           'g num h-10 px-4 text-[19px] transition-colors duration-150 [transition-timing-function:var(--ease)]',
                           on
                              ? 'bg-ink text-background'
                              : 'text-ink-2 hover:text-ink'
                        )}
                     >
                        {y}
                     </button>
                  );
               })}
            </div>
            <p className="num text-[15px] text-ink-2">
               {plural(days, 'day', 'days')} on the water,{' '}
               {plural(fish, 'fish', 'fish')} in {year}
            </p>
         </div>

         {months.length === 0 ? (
            <NoData className="mt-6" title="No data yet">
               Nothing logged in {year}.
            </NoData>
         ) : (
            <ul
               key={year}
               className="mt-6 flex snap-x gap-8 overflow-x-auto pb-3 [scrollbar-width:thin]"
            >
               {months.map((month, mi) => (
                  <li
                     key={month.key}
                     className="fact flex flex-none snap-start flex-col"
                     style={{ '--i': mi } as React.CSSProperties}
                  >
                     <div className="flex items-baseline justify-between gap-6 border-b-2 border-ink pb-1.5">
                        <h3 className="g text-[24px] leading-none">
                           {month.label}
                        </h3>
                        <span className="lab num text-ink-3">
                           {plural(month.fish, 'fish', 'fish')}
                        </span>
                     </div>
                     <ul className="mt-3 flex items-end gap-2.5">
                        {month.days.map((day) => {
                           const photo = day.entry.images[0]?.image.url;
                           return (
                              <li key={day.key} className="w-[88px] flex-none">
                                 <Link
                                    to={`/catches/${day.entry.id}`}
                                    className="flex flex-col gap-1.5"
                                 >
                                    <span
                                       className={cn(
                                          'relative flex h-[120px] w-[88px] overflow-hidden',
                                          photo
                                             ? 'bg-bg-2'
                                             : day.measured
                                               ? 'items-end bg-ink/85'
                                               : 'items-end border border-dashed border-ink/35'
                                       )}
                                    >
                                       {photo ? (
                                          <img
                                             src={photo}
                                             alt=""
                                             loading="lazy"
                                             style={framingStyle(
                                                day.entry.images[0]?.image
                                             )}
                                             className="h-full w-full object-cover transition-transform duration-[600ms] [transition-timing-function:var(--ease)] hover:scale-[1.04]"
                                          />
                                       ) : (
                                          <span
                                             aria-hidden="true"
                                             className={cn(
                                                'block h-1.5 w-full',
                                                day.measured
                                                   ? 'bg-teal'
                                                   : 'bg-ink/25'
                                             )}
                                          />
                                       )}
                                       {day.count > 1 ? (
                                          <span className="num absolute top-1 right-1 inline-flex min-w-[22px] items-center justify-center gap-0.5 bg-paper px-1.5 py-0.5 text-[11px] leading-none text-ink">
                                             {day.count}
                                             <span className="font-sans text-[10px] text-ink-2">
                                                fish
                                             </span>
                                          </span>
                                       ) : null}
                                    </span>
                                    <span className="lab text-ink-2">
                                       {formatDayMonth(day.entry.caughtAt)}
                                    </span>
                                 </Link>
                              </li>
                           );
                        })}
                     </ul>
                  </li>
               ))}
            </ul>
         )}
      </div>
   );
}
