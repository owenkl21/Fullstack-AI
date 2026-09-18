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
import {
   thunderRisk,
   type ForecastDay,
   type ForecastHour,
} from './forecast-api';
import { MoonBand, SunBand } from './SkyArcs';
import { TideBand } from './TideBand';
import {
   rainCell,
   skyCell,
   skyTone,
   tempTint,
   uvTint,
   waterCell,
   windBar,
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
 * a row of arrows in a glance, and a row of "SSW" takes a sentence each. Under
 * the arrow the hour's wind stands as a bar, so the row is read as a shape
 * before a single figure is read: where the day builds, where it drops.
 *
 * Some readings are not figures at all. The tide, the sun and the moon are
 * curves, and a curve cannot be cut into twenty four cells: those rows are one
 * cell spanning the width, drawn against the same columns, so they scroll with
 * the hours on a phone and stay lined up with them on a desk.
 */
type Row = {
   key: string;
   label: string;
   unit?: string;
   has: (hour: ForecastHour) => boolean;
   /* A reading per hour, in its own column. */
   cell?: (hour: ForecastHour) => ReactNode;
   /* Or one drawing across the whole day, for a reading that is a shape. */
   band?: (hours: ForecastHour[]) => ReactNode;
   /* The tint behind the cell, where the figure has a band. */
   tone?: (hour: ForecastHour) => string;
   /* Or a tint mixed for this hour's own reading, where the bands are steps. */
   style?: (hour: ForecastHour) => CSSProperties | undefined;
};

const num = (n: number | null) => (n === null ? '' : String(n));

export function HourGrid({
   hours,
   day,
   next,
   nowLocal,
   system,
}: {
   hours: ForecastHour[];
   /* The day these hours belong to, for the readings that are per day. */
   day: ForecastDay;
   /* The one after it, because a moon that rises today sets tomorrow. */
   next: ForecastDay | null;
   /* The place's current hour, in the same form as an hour's `local`. */
   nowLocal: string | null;
   system: UnitSystem;
}) {
   /*
    * The bars stand against a shore angler's scale: 50 km/h fills the track,
    * which is the wind that ends a session, and a day that blows harder than
    * that stretches the scale rather than clipping. A fixed floor means a
    * calm day reads as calm instead of being blown up to fill the row, and
    * the same bar means the same wind on Tuesday and on Friday.
    */
   const windScale = Math.max(50, ...hours.map((h) => h.windSpeedKph ?? 0));

   const windSentence = (h: ForecastHour) => {
      const speed = speedIn(h.windSpeedKph, system);
      if (speed === null) return 'Wind not forecast for this hour';
      const gust = speedIn(h.windGustKph, system);
      const from = h.windDirectionCardinal ? `${h.windDirectionCardinal} ` : '';
      const gusting = gust === null ? '' : `, gusting ${gust}`;
      return `${from}${speed} ${unitOf('speed', system)}${gusting}`;
   };

   const all: Row[] = [
      {
         key: 'sun',
         label: 'Sun',
         has: () => day.sunrise !== null && day.sunset !== null,
         band: () => <SunBand day={day} />,
      },
      {
         key: 'moon',
         label: 'Moon',
         has: () => day.moonrise !== null || day.moonset !== null,
         band: () => <MoonBand day={day} next={next} />,
      },
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
         style: (h) => tempTint(h.temperatureC),
         has: (h) => h.temperatureC !== null,
         cell: (h) => num(tempIn(h.temperatureC, system)),
      },
      {
         key: 'wind',
         label: 'Wind',
         unit: unitOf('speed', system),
         has: (h) => h.windSpeedKph !== null,
         cell: (h) => {
            const speed = speedIn(h.windSpeedKph, system);
            const gust = speedIn(h.windGustKph, system);
            const tall =
               h.windSpeedKph === null
                  ? 0
                  : Math.min(100, (h.windSpeedKph / windScale) * 100);
            return (
               <span
                  role="img"
                  aria-label={windSentence(h)}
                  className={cn(
                     'flex flex-col items-center gap-1',
                     windTone(h.windSpeedKph)
                  )}
               >
                  <span className="flex h-[18px] items-center">
                     {h.windDirectionDegrees === null ? null : (
                        <WindArrowIcon
                           degrees={h.windDirectionDegrees}
                           className="size-[18px]"
                        />
                     )}
                  </span>
                  <span className="flex h-12 w-5 items-end">
                     <span
                        className={cn(
                           'bar-grow block w-full',
                           windBar(h.windSpeedKph)
                        )}
                        style={{ height: `${Math.max(4, tall)}%` }}
                     />
                  </span>
                  <span className="font-medium">{num(speed)}</span>
                  {/* The gust is the figure that ends a session: a reading,
                      at the table's own size, not a small. */}
                  {gust === null ? null : (
                     <span className="text-ink-2">{gust}</span>
                  )}
               </span>
            );
         },
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
         key: 'tide',
         label: 'Tide',
         /* Four samples make a curve; fewer would be a labelled empty row. */
         has: () =>
            hours.filter((h) => (h.seaLevelM ?? null) !== null).length >= 4,
         band: (dayHours) => <TideBand hours={dayHours} />,
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
         label: 'UV',
         style: (h) => uvTint(h.uvIndex),
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
                     {row.band ? (
                        <td colSpan={hours.length} className="fact px-0 py-2">
                           {row.band(hours)}
                        </td>
                     ) : (
                        hours.map((h, column) => (
                           <td
                              key={`${h.local}-${row.key}`}
                              style={
                                 {
                                    '--i': column,
                                    /* The now column's stripe outranks a
                                       tint; an inline background would
                                       beat the class. */
                                    ...(h.local === nowLocal
                                       ? undefined
                                       : row.style?.(h)),
                                 } as CSSProperties
                              }
                              className={cn(
                                 'fact num px-1 py-2.5 text-center align-middle',
                                 h.local === nowLocal && 'bg-bg-2',
                                 h.isDaytime === false && 'text-ink-2',
                                 row.tone?.(h)
                              )}
                           >
                              {row.cell?.(h)}
                           </td>
                        ))
                     )}
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
   );
}
