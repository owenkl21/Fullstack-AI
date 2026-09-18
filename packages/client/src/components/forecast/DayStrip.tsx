import {
   MoonPhaseIcon,
   skyIcon,
} from '@/components/fishing/home/ConditionIcons';
import { tempIn, type UnitSystem } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { ForecastDay } from './forecast-api';
import { skyTone, windBar } from './tones';

/*
 * Seven days in a row, one chosen.
 *
 * Each cell says the little a day can be summed up in: the sky, the high and
 * the low, and the moon, because the moon is what a shore angler looks at
 * first when picking a day. Tabs rather than buttons: choosing one changes the
 * grid under it and nothing else.
 */
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dayLabel = (date: string, today: string) => {
   if (date === today) return 'Today';
   const at = new Date(`${date}T12:00Z`);
   return WEEKDAY[at.getUTCDay()] ?? date;
};

export function DayStrip({
   days,
   selected,
   today,
   system,
   onSelect,
}: {
   days: ForecastDay[];
   selected: string;
   today: string;
   system: UnitSystem;
   onSelect: (date: string) => void;
}) {
   /*
    * The bar under each day is as long as that day's wind against the
    * hardest wind of the week, so the strip is read the way the hour rows
    * are: a shape first, and the figures after it.
    */
   /* The same floor as the hour rows, so a calm week reads calm. */
   const weekMax = Math.max(50, ...days.map((d) => d.windMaxKph ?? 0));

   return (
      <div
         role="tablist"
         aria-label="Day"
         className="-mx-4 flex snap-x overflow-x-auto px-4 md:mx-0 md:px-0"
      >
         {days.map((day) => {
            const on = day.date === selected;
            const Sky = skyIcon(day.conditionText);
            const hi = tempIn(day.temperatureMaxC, system);
            const lo = tempIn(day.temperatureMinC, system);
            /*
             * A light wind has no colour of its own, so its bar is the rule
             * colour, which on the chosen day would vanish into the ink the
             * tab is filled with. There it is drawn in the page ground.
             */
            const quiet = (day.windMaxKph ?? 0) < 15;
            const barFill =
               on && quiet ? 'bg-background/70' : windBar(day.windMaxKph);
            return (
               <button
                  key={day.date}
                  type="button"
                  role="tab"
                  id={`day-${day.date}`}
                  aria-selected={on}
                  aria-controls="forecast-day"
                  tabIndex={on ? 0 : -1}
                  onClick={() => onSelect(day.date)}
                  className={cn(
                     'flex min-w-[96px] flex-1 snap-start flex-col items-center gap-1.5 border border-line px-2 py-3 transition-colors duration-150 [transition-timing-function:var(--ease)] not-first:-ml-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
                     on
                        ? 'relative z-10 border-ink bg-ink text-background'
                        : 'text-ink hover:border-ink'
                  )}
               >
                  <span
                     className={cn(
                        'lab',
                        on ? 'text-background/80' : 'text-ink-3'
                     )}
                  >
                     {dayLabel(day.date, today)}
                  </span>
                  <span className="g num text-[28px] leading-none">
                     {Number(day.date.slice(8, 10))}
                  </span>
                  <Sky
                     aria-hidden="true"
                     className={cn(
                        'size-5',
                        on ? '' : skyTone(day.conditionText)
                     )}
                  />
                  <span
                     aria-hidden="true"
                     className={cn(
                        'flex h-1 w-8',
                        on ? 'bg-background/25' : 'bg-line'
                     )}
                     title={
                        day.windMaxKph === null
                           ? undefined
                           : `Wind up to ${Math.round(day.windMaxKph)} km/h`
                     }
                  >
                     <span
                        className={cn('block h-1', barFill)}
                        style={{
                           width: `${
                              day.windMaxKph === null
                                 ? 0
                                 : Math.max(4, (day.windMaxKph / weekMax) * 100)
                           }%`,
                        }}
                     />
                  </span>
                  <span className="num text-[14px]">
                     {hi === null || lo === null ? '' : `${hi}° / ${lo}°`}
                  </span>
                  <span
                     className={cn(
                        'flex items-center gap-1 text-[12px]',
                        on ? 'text-background/80' : 'text-ink-3'
                     )}
                     title={day.moon.name}
                  >
                     <MoonPhaseIcon
                        fraction={day.moon.fraction}
                        className="size-3.5"
                     />
                     {Math.round(day.moon.illumination * 100)}%
                  </span>
               </button>
            );
         })}
      </div>
   );
}
