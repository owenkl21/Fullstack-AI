import { BoltIcon } from '@heroicons/react/24/outline';
import {
   useLayoutEffect,
   useRef,
   useState,
   type ComponentType,
   type CSSProperties,
   type ReactNode,
   type SVGProps,
} from 'react';
import {
   CloudRainIcon,
   DropIcon,
   PressureIcon,
   SwellIcon,
   ThermometerIcon,
   TideIcon,
   UvIcon,
   DaylightIcon,
   WaveIcon,
   WindArrowIcon,
   WindIcon,
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
import type { NowMark } from './band-geometry';
import {
   thunderRisk,
   type ForecastDay,
   type ForecastHour,
} from './forecast-api';
import { SkyBand } from './SkyArcs';
import { TideBand } from './TideBand';
import { rainTint, skyTone, tempTint, uvTint, windColour } from './tones';

/*
 * The day, hour by hour, as one instrument.
 *
 * It was a table two thousand pixels long, twelve rows stacked under a label
 * column wide enough to swallow four hours. This is the same readings in one
 * screen: a black block, a rail of marks down the left and the hours scrolling
 * past it, every row drawn against the same columns so a glance down any one
 * minute reads wind, water, sky and light together.
 *
 * The block is the point. Coloured bars and curves on the page ground read as
 * a spreadsheet with highlighting; on the product's own black they read as an
 * instrument, which is what a forecast is. It bleeds to the screen edges on a
 * phone so the hours have the whole width to run in, and from md it comes back
 * into the page column with the search and the day strip: a slab wider than
 * everything above it reads as something dropped on the page rather than part
 * of it, and on a desk the column is wide enough that the hours lose nothing.
 *
 * Three decisions carry most of it:
 *
 * - The rail. Under md a reading's name is a mark, forty four pixels wide,
 *   with the word behind it for anyone listening rather than looking. That is
 *   the one place this product allows an icon in place of a word: at 390px a
 *   hundred and ten pixels of label is two and a half hours of forecast.
 * - Readings that answer one question share a row. Sky sits over air because
 *   nobody reads the weather without the temperature; the sun and the moon
 *   share a horizon because a night session is planned on both at once; the
 *   gust sits under the wind speed rather than in a row of its own.
 * - The four an angler checks after deciding, rather than before it, are
 *   behind one control on a phone and simply shown on a desk, where the
 *   height costs nothing.
 */

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

type Row = {
   key: string;
   /* The name, spoken. Under md it is the mark's accessible name. */
   label: string;
   unit?: string;
   /* The mark in the rail, where the word will not fit. */
   icon: ComponentType<IconProps>;
   /* The row's height, so the instrument's geometry is decided here. */
   height: number;
   /*
    * And its height on a desk, where the figures go up two points and the row
    * comes down anyway. A phone is tight for width and a desk is tight for
    * height: nine rows and a head at the phone's spacing came to seven hundred
    * pixels, which is a screen on its own before the day strip above it. The
    * drawn bands keep what they have, because a curve needs its amplitude to
    * be a curve; the rows of figures give back the air they were carrying.
    */
   mdHeight?: number;
   has: (hour: ForecastHour) => boolean;
   /* A reading per hour, in its own column. */
   cell?: (hour: ForecastHour) => ReactNode;
   /* Or one drawing across the whole day, for a reading that is a shape. */
   band?: () => ReactNode;
   /* A tint mixed for this hour's own reading. */
   style?: (hour: ForecastHour) => CSSProperties | undefined;
   /* Behind "More readings" on a phone; shown outright from md. */
   later?: boolean;
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
   const [more, setMore] = useState(false);
   const scroller = useRef<HTMLDivElement>(null);

   const nowIndex = nowLocal
      ? hours.findIndex((h) => h.local === nowLocal)
      : -1;
   const now: NowMark | null =
      nowIndex < 0 ? null : { index: nowIndex, count: hours.length };

   /*
    * Open on the hour the reader is in, one column from the left edge, so the
    * hour just gone is still on screen and the next seven are in front of it.
    * Set rather than animated: this is where the timeline starts, not a move
    * the reader made, and a scroll that slides on load is a scroll that has
    * already moved under anyone reading the first column.
    */
   useLayoutEffect(() => {
      const box = scroller.current;
      if (!box || nowIndex < 1) return;
      const head = box.querySelector<HTMLElement>(`[data-hour="${nowIndex}"]`);
      const rail = box.querySelector<HTMLElement>('[data-rail]');
      if (!head) return;
      box.scrollLeft = Math.max(
         0,
         head.offsetLeft - (rail?.offsetWidth ?? 0) - head.offsetWidth
      );
   }, [nowIndex, hours.length, day.date]);

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
         key: 'wind',
         label: 'Wind',
         unit: unitOf('speed', system),
         icon: WindIcon,
         height: 140,
         mdHeight: 132,
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
                  className="flex flex-col items-center gap-0.5"
               >
                  <span className="flex h-[18px] items-center text-ink-2">
                     {h.windDirectionDegrees === null ? null : (
                        <WindArrowIcon
                           degrees={h.windDirectionDegrees}
                           className="size-[18px]"
                        />
                     )}
                  </span>
                  {/* Square ended, standing on the foot of its track: the
                      height says how hard and the colour says the same thing
                      again, so neither is carrying it alone. */}
                  <span className="flex h-[72px] w-6 items-end md:h-16">
                     <span
                        className="bar-grow block w-full"
                        style={{
                           height: `${Math.max(6, tall)}%`,
                           background: windColour(h.windSpeedKph),
                        }}
                     />
                  </span>
                  <span className="leading-[18px] font-medium md:leading-5">
                     {num(speed)}
                  </span>
                  {/* The gust is the figure that ends a session: a reading at
                      the table's own size, quieter, never a small. */}
                  <span className="leading-[18px] text-ink-2 md:leading-5">
                     {num(gust)}
                  </span>
               </span>
            );
         },
      },
      {
         key: 'tide',
         label: 'Tide',
         icon: TideIcon,
         height: 84,
         /* Four samples make a curve; fewer would be a labelled empty row. */
         has: () =>
            hours.filter((h) => (h.seaLevelM ?? null) !== null).length >= 4,
         band: () => <TideBand hours={hours} now={now} />,
      },
      {
         /*
          * Sky and air, one row. The row is named for the figure it prints,
          * and the mark over each figure says what the sky is doing in that
          * hour; a sentence for both goes to anyone listening.
          */
         key: 'air',
         label: 'Air',
         unit: unitOf('temp', system),
         icon: ThermometerIcon,
         height: 48,
         mdHeight: 46,
         style: (h) => tempTint(h.temperatureC),
         has: (h) => h.temperatureC !== null || h.conditionText !== null,
         cell: (h) => {
            const risk = thunderRisk(h.cape, h.conditionText);
            /* Thunder outranks the sky word: an angler on a point with a
               carbon rod needs that before anything else in the hour. */
            const Sky = risk ? BoltIcon : skyIcon(h.conditionText);
            const degrees = tempIn(h.temperatureC, system);
            return (
               <span className="flex flex-col items-center gap-0.5">
                  <Sky
                     aria-hidden="true"
                     className={cn(
                        'size-5',
                        risk ? 'text-storm-text' : skyTone(h.conditionText)
                     )}
                  />
                  <span
                     aria-hidden="true"
                     className="leading-[18px] md:leading-5"
                  >
                     {num(degrees)}
                  </span>
                  <span className="sr-only">
                     {[
                        risk ? `Thunder ${risk}` : h.conditionText,
                        degrees === null
                           ? null
                           : `${degrees}${unitOf('temp', system)}`,
                     ]
                        .filter(Boolean)
                        .join(', ')}
                  </span>
               </span>
            );
         },
      },
      {
         key: 'sky',
         label: 'Sun and moon',
         icon: DaylightIcon,
         height: 96,
         has: () =>
            day.sunrise !== null ||
            day.moonrise !== null ||
            day.moonset !== null,
         band: () => <SkyBand day={day} next={next} now={now} />,
      },
      {
         key: 'rain',
         label: 'Rain',
         unit: '%',
         icon: CloudRainIcon,
         height: 44,
         style: (h) => rainTint(h.precipitationProbability),
         has: (h) => h.precipitationProbability !== null,
         cell: (h) => (
            <span className="flex flex-col items-center">
               <span className="leading-[18px] md:leading-5">
                  {num(h.precipitationProbability)}
               </span>
               {h.precipitationMm ? (
                  <span className="leading-[18px] text-ink-2 md:leading-5">
                     {h.precipitationMm}
                     <span className="sr-only"> millimetres</span>
                  </span>
               ) : null}
            </span>
         ),
      },
      {
         key: 'swell',
         label: 'Swell',
         unit: unitOf('height', system),
         icon: SwellIcon,
         height: 62,
         mdHeight: 60,
         has: (h) => h.swellHeightM !== null,
         cell: (h) => (
            <span className="flex flex-col items-center">
               <span className="flex h-4 items-center text-ink-2">
                  {h.swellDirectionDegrees === null ? null : (
                     <WindArrowIcon
                        degrees={h.swellDirectionDegrees}
                        className="size-4"
                     />
                  )}
               </span>
               <span className="leading-[18px] md:leading-5">
                  {num(heightIn(h.swellHeightM, system))}
               </span>
               {h.swellPeriodS === null ? null : (
                  <span className="leading-[18px] text-ink-2 md:leading-5">
                     {Math.round(h.swellPeriodS)} s
                  </span>
               )}
            </span>
         ),
      },
      {
         key: 'pressure',
         label: 'Pressure',
         unit: 'hPa',
         icon: PressureIcon,
         height: 40,
         mdHeight: 34,
         later: true,
         has: (h) => h.pressureMsl !== null,
         cell: (h) =>
            h.pressureMsl === null ? '' : String(Math.round(h.pressureMsl)),
      },
      {
         key: 'sea',
         label: 'Sea',
         unit: unitOf('height', system),
         icon: WaveIcon,
         height: 40,
         mdHeight: 34,
         later: true,
         has: (h) => h.waveHeightM !== null,
         cell: (h) => num(heightIn(h.waveHeightM, system)),
      },
      {
         key: 'water',
         label: 'Water',
         unit: unitOf('temp', system),
         icon: DropIcon,
         height: 40,
         mdHeight: 34,
         later: true,
         has: (h) => h.seaSurfaceTemperatureC !== null,
         cell: (h) => num(tempIn(h.seaSurfaceTemperatureC, system)),
      },
      {
         key: 'uv',
         label: 'UV',
         icon: UvIcon,
         height: 40,
         mdHeight: 34,
         later: true,
         style: (h) => uvTint(h.uvIndex),
         has: (h) => h.uvIndex !== null && h.uvIndex > 0,
         cell: (h) =>
            h.uvIndex === null || h.uvIndex <= 0
               ? ''
               : String(Math.round(h.uvIndex)),
      },
   ];

   /* A reading with nothing to say all day is left out, so an inland town has
      no sea in it rather than a row of blanks. */
   const rows = all.filter((row) => hours.some(row.has));
   const hasLater = rows.some((row) => row.later);

   const rail =
      'fc-ground sticky left-0 z-10 w-11 min-w-11 px-0 text-left align-middle md:w-[132px] md:min-w-[132px] md:px-3';

   return (
      <div className="blk blk-plain -mx-4 md:mx-0">
         {/* The rail's edge is drawn down the block rather than as a border
             on a sticky cell, which a collapsed table drops, and it sits
             outside the scroller so it stays where the rail is. */}
         <div className="relative">
            <span
               aria-hidden="true"
               className="pointer-events-none absolute top-0 bottom-0 left-11 z-20 w-px bg-line md:left-[132px]"
            />
            <div ref={scroller} className="overflow-x-auto">
               {/*
                * The readings go up two points on a desk. At 14px in a
                * fourteen hundred pixel block they were a spreadsheet read
                * from across a room; the figures are the instrument, so they
                * get the size the room affords and the rows give back the
                * height.
                */}
               <table className="w-full border-collapse text-[14px] md:text-[16px]">
                  <thead>
                     <tr className="border-b border-line">
                        <th scope="col" data-rail className={cn(rail, 'py-2')}>
                           <span className="lab hidden text-ink-2 md:block">
                              Hour
                           </span>
                           <span className="sr-only md:hidden">Hour</span>
                        </th>
                        {hours.map((h, index) => {
                           const isNow = index === nowIndex;
                           return (
                              <th
                                 key={h.local}
                                 scope="col"
                                 data-hour={index}
                                 className={cn(
                                    /*
                                     * Fifty two pixels an hour on a desk
                                     * rather than fifty six, which is what
                                     * puts all twenty four hours inside the
                                     * page column at 1440 with nothing to
                                     * scroll. A grid that scrolls on a desk
                                     * hides an hour behind the rail and cuts
                                     * the labels of whatever is drawn under
                                     * it.
                                     */
                                    'g num min-w-11 px-0.5 py-2 text-center text-[18px] leading-[18px] md:min-w-[52px] md:text-[22px] md:leading-[22px]',
                                    h.isDaytime === false &&
                                       !isNow &&
                                       'text-ink-2',
                                    isNow && 'bg-teal text-black-block'
                                 )}
                              >
                                 {h.local.slice(11, 13)}
                                 {isNow ? (
                                    <span className="sr-only">, now</span>
                                 ) : null}
                              </th>
                           );
                        })}
                     </tr>
                  </thead>
                  <tbody>
                     {rows.map((row) => {
                        const Mark = row.icon;
                        return (
                           <tr
                              key={row.key}
                              style={
                                 {
                                    '--row-h': `${row.height}px`,
                                    '--row-h-md': `${row.mdHeight ?? row.height}px`,
                                 } as CSSProperties
                              }
                              className={cn(
                                 'h-[var(--row-h)] border-b border-line md:h-[var(--row-h-md)]',
                                 row.later && !more && 'max-md:hidden'
                              )}
                           >
                              <th scope="row" className={cn(rail, 'py-0')}>
                                 <span
                                    className="flex items-center justify-center text-ink-2 md:hidden"
                                    title={row.label}
                                 >
                                    <Mark
                                       aria-hidden="true"
                                       className="size-5"
                                    />
                                    <span className="sr-only">
                                       {row.label}
                                       {row.unit ? `, ${row.unit}` : ''}
                                    </span>
                                 </span>
                                 <span className="hidden md:block">
                                    <span className="lab text-ink-2">
                                       {row.label}
                                    </span>
                                    {row.unit ? (
                                       <span className="num ml-1.5 text-[14px] text-ink-3">
                                          {row.unit}
                                       </span>
                                    ) : null}
                                 </span>
                              </th>
                              {row.band ? (
                                 <td
                                    colSpan={hours.length}
                                    className="p-0 align-top"
                                 >
                                    {row.band()}
                                 </td>
                              ) : (
                                 hours.map((h, column) => (
                                    <td
                                       key={`${h.local}-${row.key}`}
                                       style={
                                          {
                                             '--i': column,
                                             /* The now band outranks a tint; an
                                             inline background would beat the
                                             class that paints it. */
                                             ...(column === nowIndex
                                                ? undefined
                                                : row.style?.(h)),
                                          } as CSSProperties
                                       }
                                       className={cn(
                                          'num px-0.5 py-1 text-center align-middle md:py-0.5',
                                          column === nowIndex && 'fc-now',
                                          h.isDaytime === false && 'text-ink-2'
                                       )}
                                    >
                                       {row.cell?.(h)}
                                    </td>
                                 ))
                              )}
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         </div>

         {/*
          * The readings you check once you have decided to go. On a desk they
          * are four more rows and cost nothing; on a phone they are the
          * difference between one screen and two, so they wait behind a word.
          */}
         {hasLater ? (
            <button
               type="button"
               aria-expanded={more}
               onClick={() => setMore((open) => !open)}
               className="flex h-11 w-full items-center px-3 text-left md:hidden"
            >
               <span className="g-tracked text-[16px] text-ink">
                  {more ? 'Fewer readings' : 'More readings'}
               </span>
            </button>
         ) : null}
      </div>
   );
}
