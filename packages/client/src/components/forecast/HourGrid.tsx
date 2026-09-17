import { BoltIcon } from '@heroicons/react/24/outline';
import type { CSSProperties, ReactNode } from 'react';
import {
   WindArrowIcon,
   skyIcon,
} from '@/components/fishing/home/ConditionIcons';
import {
   heightIn,
   speedIn,
   tempIn,
   unitOf,
   type UnitSystem,
} from '@/lib/units';
import { cn } from '@/lib/utils';
import { thunderRisk, type ForecastHour } from './forecast-api';
import {
   rainCell,
   skyCell,
   skyTone,
   uvCell,
   waterCell,
   windCell,
   windTone,
} from './tones';

/*
 * The day, hour by hour, laid out like a tide table.
 *
 * Hours run across and the readings run down, with the reading's name pinned
 * to the left so it stays in view while the hours scroll. A row that has
 * nothing to say for the whole day is left out, so an inland town has no sea
 * in it rather than a row of blanks.
 *
 * The wind cell is an arrow first and a number second. Anyone who fishes reads
 * a row of arrows in a glance, and a row of "SSW" takes a sentence each.
 */
type Row = {
   key: string;
   label: string;
   unit?: string;
   cell: (hour: ForecastHour) => ReactNode;
   has: (hour: ForecastHour) => boolean;
   /* The tint behind the cell, where the figure has a band. */
   tone?: (hour: ForecastHour) => string;
};

const num = (n: number | null) => (n === null ? '' : String(n));

export function HourGrid({
   hours,
   nowLocal,
   system,
}: {
   hours: ForecastHour[];
   /* The place's current hour, in the same form as an hour's `local`. */
   nowLocal: string | null;
   system: UnitSystem;
}) {
   const all: Row[] = [
      {
         key: 'sky',
         tone: (h) => skyCell(h.conditionText),
         label: 'Sky',
         has: (h) => h.conditionText !== null,
         cell: (h) => {
            const Sky = skyIcon(h.conditionText);
            return (
               <Sky
                  aria-hidden="true"
                  className={cn('mx-auto size-5', skyTone(h.conditionText))}
                  {...({ title: h.conditionText ?? undefined } as object)}
               />
            );
         },
      },
      {
         key: 'air',
         label: 'Air',
         unit: unitOf('temp', system),
         has: (h) => h.temperatureC !== null,
         cell: (h) => num(tempIn(h.temperatureC, system)),
      },
      {
         key: 'wind',
         tone: (h) => windCell(h.windSpeedKph),
         label: 'Wind',
         unit: unitOf('speed', system),
         has: (h) => h.windSpeedKph !== null,
         cell: (h) => (
            <span
               className={cn(
                  'flex flex-col items-center gap-0.5',
                  windTone(h.windSpeedKph)
               )}
            >
               {h.windDirectionDegrees === null ? null : (
                  <WindArrowIcon
                     degrees={h.windDirectionDegrees}
                     className="size-[18px]"
                     aria-label={h.windDirectionCardinal ?? undefined}
                  />
               )}
               <span className="font-medium">
                  {num(speedIn(h.windSpeedKph, system))}
               </span>
            </span>
         ),
      },
      {
         key: 'gust',
         tone: (h) => windCell(h.windGustKph),
         label: 'Gust',
         unit: unitOf('speed', system),
         has: (h) => h.windGustKph !== null,
         cell: (h) => (
            <span className={windTone(h.windGustKph)}>
               {num(speedIn(h.windGustKph, system))}
            </span>
         ),
      },
      {
         key: 'rain',
         tone: (h) => rainCell(h.precipitationProbability),
         label: 'Rain',
         unit: '%',
         has: (h) => h.precipitationProbability !== null,
         cell: (h) => (
            <span className="flex flex-col items-center">
               <span>{num(h.precipitationProbability)}</span>
               {h.precipitationMm ? (
                  <span className="text-[11px] text-ink-3">
                     {h.precipitationMm} mm
                  </span>
               ) : null}
            </span>
         ),
      },
      {
         key: 'thunder',
         label: 'Thunder',
         has: (h) => thunderRisk(h.cape, h.conditionText) !== null,
         cell: (h) => {
            const risk = thunderRisk(h.cape, h.conditionText);
            if (!risk) return '';
            return (
               <BoltIcon
                  aria-label={risk}
                  className={cn(
                     'mx-auto size-5',
                     risk === 'possible' ? 'text-ink-3' : 'text-ink'
                  )}
               />
            );
         },
      },
      {
         key: 'pressure',
         label: 'Pressure',
         unit: 'hPa',
         has: (h) => h.pressureMsl !== null,
         cell: (h) =>
            h.pressureMsl === null ? '' : String(Math.round(h.pressureMsl)),
      },
      {
         key: 'swell',
         label: 'Swell',
         unit: unitOf('height', system),
         has: (h) => h.swellHeightM !== null,
         cell: (h) => (
            <span className="flex flex-col items-center gap-0.5">
               {h.swellDirectionDegrees === null ? null : (
                  <WindArrowIcon
                     degrees={h.swellDirectionDegrees}
                     className="size-[18px] text-ink-3"
                  />
               )}
               <span>{num(heightIn(h.swellHeightM, system))}</span>
               {h.swellPeriodS === null ? null : (
                  <span className="text-[11px] text-ink-3">
                     {Math.round(h.swellPeriodS)} s
                  </span>
               )}
            </span>
         ),
      },
      {
         key: 'sea',
         label: 'Sea',
         unit: unitOf('height', system),
         has: (h) => h.waveHeightM !== null,
         cell: (h) => num(heightIn(h.waveHeightM, system)),
      },
      {
         key: 'water',
         tone: (h) => waterCell(h.seaSurfaceTemperatureC),
         label: 'Water',
         unit: unitOf('temp', system),
         has: (h) => h.seaSurfaceTemperatureC !== null,
         cell: (h) => num(tempIn(h.seaSurfaceTemperatureC, system)),
      },
      {
         key: 'uv',
         tone: (h) => uvCell(h.uvIndex),
         label: 'UV',
         has: (h) => h.uvIndex !== null && h.uvIndex > 0,
         cell: (h) =>
            h.uvIndex === null || h.uvIndex <= 0
               ? ''
               : String(Math.round(h.uvIndex)),
      },
   ];
   const rows = all.filter((row) => hours.some(row.has));

   const head =
      'sticky left-0 z-10 bg-background pr-3 text-left whitespace-nowrap shadow-[inset_-1px_0_0_var(--line)]';

   return (
      <div className="overflow-x-auto">
         <table className="w-full border-collapse text-[14px]">
            <thead>
               <tr className="border-b border-ink">
                  <th scope="col" className={cn(head, 'py-2')}>
                     <span className="lab text-ink-3">Hour</span>
                  </th>
                  {hours.map((h) => {
                     const now = h.local === nowLocal;
                     return (
                        <th
                           key={h.local}
                           scope="col"
                           className={cn(
                              'g num min-w-[56px] py-2 text-center text-[18px] leading-none',
                              h.isDaytime === false && !now && 'text-ink-3',
                              now &&
                                 'bg-teal text-black-block shadow-[inset_0_3px_0_var(--ink)]'
                           )}
                        >
                           {h.local.slice(11, 13)}
                           {now ? (
                              <span className="lab mt-1 block text-[10px] text-black-block">
                                 now
                              </span>
                           ) : null}
                        </th>
                     );
                  })}
               </tr>
            </thead>
            <tbody>
               {rows.map((row) => (
                  <tr key={row.key} className="border-b border-line">
                     <th scope="row" className={cn(head, 'py-2.5')}>
                        <span className="lab text-ink-3">{row.label}</span>
                        {row.unit ? (
                           <span className="ml-1.5 text-[12px] text-ink-3">
                              {row.unit}
                           </span>
                        ) : null}
                     </th>
                     {hours.map((h, column) => (
                        <td
                           key={`${h.local}-${row.key}`}
                           style={{ '--i': column } as CSSProperties}
                           className={cn(
                              'fact num px-1 py-2.5 text-center align-middle',
                              h.local === nowLocal && 'bg-bg-2',
                              h.isDaytime === false && 'text-ink-2',
                              row.tone?.(h)
                           )}
                        >
                           {row.cell(h)}
                        </td>
                     ))}
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
   );
}
