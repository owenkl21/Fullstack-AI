import { BoltIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import {
   useEffect,
   useId,
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
   RatingIcon,
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
   type RatedHour,
} from './forecast-api';
import { SkyBand } from './SkyArcs';
import { TideBand } from './TideBand';
import {
   BAND_WORD,
   bandFill,
   rainTint,
   skyTone,
   tempTint,
   uvTint,
   windColour,
} from './tones';

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
 *   hundred and ten pixels of label is two and a half hours of forecast. The
 *   word is one tap away rather than gone: each mark opens a note with the
 *   row's name, its unit and what the row draws, and the mark in the corner
 *   says so.
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
   /*
    * What the mark's note says under the name: the unit as the note puts it,
    * where that is not the rail's own, and one sentence on what the row draws.
    */
   noteUnit?: string;
   note?: string;
};

/* A note from the rail, which is a row's or the corner mark's own. */
type Note = Pick<Row, 'key' | 'label' | 'unit' | 'noteUnit' | 'note'>;

/* The corner mark's note, which says what the others are for. */
const HELP: Note = {
   key: 'help',
   label: 'The marks',
   note: 'Tap any mark down this rail for its name and unit.',
};

const num = (n: number | null) => (n === null ? '' : String(n));

export function HourGrid({
   hours,
   day,
   next,
   nowLocal,
   system,
   rated,
}: {
   hours: ForecastHour[];
   /* The day these hours belong to, for the readings that are per day. */
   day: ForecastDay;
   /* The one after it, because a moon that rises today sets tomorrow. */
   next: ForecastDay | null;
   /* The place's current hour, in the same form as an hour's `local`. */
   nowLocal: string | null;
   system: UnitSystem;
   /*
    * The band for each hour, keyed by its local stamp. Absent only when the
    * week has no rating, and then the row simply is not there: a reading with
    * nothing behind it is worse than no row at all.
    */
   rated?: Map<string, RatedHour>;
}) {
   const [more, setMore] = useState(false);
   const scroller = useRef<HTMLDivElement>(null);

   /*
    * The note a mark opens, one at a time, by the key of its row. Where it
    * sits is measured off the mark when it is tapped rather than tracked: a
    * phone's rows are fixed heights, and the later rows only ever open below
    * the ones already drawn.
    */
   const [tip, setTip] = useState<string | null>(null);
   const [tipTop, setTipTop] = useState(0);
   const wrap = useRef<HTMLDivElement>(null);
   const tipBox = useRef<HTMLDivElement>(null);
   const tipId = useId();

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
         /*
          * The rating, hour by hour. One block per hour, as tall as the score
          * and coloured by its band, so the shape of the day reads before any
          * figure does: the block that stands up in the morning is the morning
          * worth driving out for.
          *
          * No number printed. A score out of a hundred against a single hour
          * is more precision than the thing deserves, and the panel above the
          * instrument prints the day's word and its figure. The band is on the
          * cell for a screen reader and the line that moved the hour most is
          * on the title for a pointer.
          */
         key: 'rating',
         label: 'Rating',
         noteUnit: 'out of 100',
         note: 'How good the hour looks for fishing, as a bar. Taller is better; the colour is the band.',
         icon: RatingIcon,
         height: 44,
         mdHeight: 38,
         has: (h) => rated?.has(h.local) ?? false,
         cell: (h) => {
            const mark = rated?.get(h.local);
            if (!mark) return null;
            return (
               <span
                  role="img"
                  aria-label={`${BAND_WORD[mark.band]}, ${mark.score} out of 100`}
                  title={mark.why ?? undefined}
                  className="flex h-7 w-full items-end px-0.5 md:h-6"
               >
                  <span
                     className="bar-grow block w-full"
                     style={{
                        /*
                         * Drawn against the range the scores actually live in
                         * rather than against nought. A week of hours runs
                         * from the high twenties to the middle eighties, and
                         * at full scale that is four pixels of difference
                         * between a bad hour and the best one, which is a row
                         * of identical blocks. Stretched across the real range
                         * the shape of the day comes back.
                         */
                        height: `${Math.min(100, Math.max(14, ((mark.score - 28) / 57) * 100))}%`,
                        background: bandFill(mark.band),
                     }}
                  />
               </span>
            );
         },
      },
      {
         key: 'wind',
         label: 'Wind',
         unit: unitOf('speed', system),
         note: 'The arrow is where it blows to, the bar how hard. Speed, then the gust under it.',
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
         noteUnit: 'rise and fall',
         note: 'The water rising and falling through the day. High and low are marked with their times.',
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
         note: 'The sky that hour and the air temperature under it. Cold and hot hours are tinted.',
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
         note: 'First light to last, and where the moon is. A night session is planned on both.',
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
         noteUnit: '% chance',
         note: 'The chance of rain, and how much in millimetres when there is any.',
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
         /* Runs rather than comes from: the arrow is turned to where the
            swell goes, the same way the wind's is. */
         note: 'Swell height, which way it runs, and its period in seconds.',
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

   /*
    * The note that is open, if its row is still drawn. A later row folded
    * away by "Fewer readings" stays mounted, so its note has to go with it
    * here. The later four have no sentence of their own yet; their note is
    * the name and unit the corner mark promises.
    */
   const tipRow: Note | null =
      tip === 'help'
         ? HELP
         : (rows.find((row) => row.key === tip && (!row.later || more)) ??
           null);
   const open = tipRow !== null;
   const tipUnit = tipRow ? (tipRow.noteUnit ?? tipRow.unit ?? '') : '';

   const toggle = (key: string, mark: HTMLElement) => {
      if (tip === key) {
         setTip(null);
         return;
      }
      const box = wrap.current;
      if (!box) return;
      const b = mark.getBoundingClientRect();
      const w = box.getBoundingClientRect();
      setTipTop(b.top + b.height / 2 - w.top);
      setTip(key);
   };

   /*
    * A tap anywhere else, or Escape, puts the note away. The marks toggle
    * themselves, so a tap on one is left to it, and a swipe along the hours
    * starts with a tap like any other. Focus never leaves the mark, so there
    * is nothing to hand back.
    */
   useEffect(() => {
      if (!open) return;
      const away = (event: PointerEvent) => {
         const target = event.target;
         if (target instanceof Node && tipBox.current?.contains(target)) return;
         if (target instanceof Element && target.closest('[data-mark]')) return;
         setTip(null);
      };
      const escape = (event: KeyboardEvent) => {
         if (event.key === 'Escape') setTip(null);
      };
      document.addEventListener('pointerdown', away);
      document.addEventListener('keydown', escape);
      return () => {
         document.removeEventListener('pointerdown', away);
         document.removeEventListener('keydown', escape);
      };
   }, [open]);

   const rail =
      'fc-ground sticky left-0 z-10 w-11 min-w-11 px-0 text-left align-middle md:w-[132px] md:min-w-[132px] md:px-3';

   return (
      <div className="blk blk-plain -mx-4 md:mx-0">
         {/* The rail's edge is drawn down the block rather than as a border
             on a sticky cell, which a collapsed table drops, and it sits
             outside the scroller so it stays where the rail is. */}
         <div ref={wrap} className="relative">
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
                        <th
                           scope="col"
                           data-rail
                           className={cn(rail, 'py-0 md:py-2')}
                        >
                           {/* As tall as the hour heads beside it, so the
                               head row stays the height it was. */}
                           <button
                              type="button"
                              data-mark
                              aria-label="What the marks mean"
                              aria-expanded={tipRow === HELP}
                              aria-describedby={
                                 tipRow === HELP ? tipId : undefined
                              }
                              onClick={(event) =>
                                 toggle('help', event.currentTarget)
                              }
                              className={cn(
                                 'flex h-[34px] w-11 cursor-pointer items-center justify-center focus-visible:-outline-offset-2 md:hidden',
                                 tipRow === HELP ? 'text-teal' : 'text-ink-3'
                              )}
                           >
                              <QuestionMarkCircleIcon
                                 aria-hidden="true"
                                 className="size-5"
                              />
                           </button>
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
                        const shown = tipRow?.key === row.key;
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
                                 {/* The later rows are drawn forty pixels
                                     tall and their marks a pixel shorter,
                                     because a collapsed border adds that
                                     pixel to a row its content fills. The
                                     inset ring keeps the focus inside the
                                     scroller's clip. */}
                                 <button
                                    type="button"
                                    data-mark
                                    aria-label={
                                       row.unit
                                          ? `${row.label}, ${row.unit}`
                                          : row.label
                                    }
                                    aria-expanded={shown}
                                    aria-describedby={shown ? tipId : undefined}
                                    onClick={(event) =>
                                       toggle(row.key, event.currentTarget)
                                    }
                                    className={cn(
                                       'flex cursor-pointer items-center justify-center focus-visible:-outline-offset-2 md:hidden',
                                       row.later ? 'h-[39px] w-11' : 'size-11',
                                       shown ? 'text-teal' : 'text-ink-2'
                                    )}
                                 >
                                    <Mark
                                       aria-hidden="true"
                                       className="size-5"
                                    />
                                 </button>
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

            {/*
             * The note sits out here rather than in the rail's cell, because
             * the scroller clips up and down as well as across. It sits under
             * the sticky header and the bar at the foot, as the page does.
             */}
            {tipRow ? (
               <div
                  id={tipId}
                  ref={tipBox}
                  role="tooltip"
                  style={{ top: tipTop }}
                  className="fc-tip absolute left-14 z-[25] max-w-[281px] -translate-y-1/2 border-l-[3px] border-teal pt-2.5 pr-3.5 pb-[11px] pl-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)] md:hidden"
               >
                  <span
                     aria-hidden="true"
                     className="absolute top-1/2 -left-[9px] size-3 -translate-y-1/2 rotate-45 bg-teal"
                  />
                  <p className="flex items-baseline gap-2">
                     <span className="g-tracked text-[20px]">
                        {tipRow.label}
                     </span>
                     {tipUnit ? (
                        <span className="num text-[13px] text-ink-2">
                           {tipUnit}
                        </span>
                     ) : null}
                  </p>
                  {tipRow.note ? (
                     <p className="mt-1 text-[14px] leading-[1.4] text-ink-2">
                        {tipRow.note}
                     </p>
                  ) : null}
               </div>
            ) : null}
            {/* A described-by is read when focus arrives, and the note opens
                after it has, so the note is said here as well. */}
            <span className="sr-only" aria-live="polite">
               {tipRow
                  ? `${tipRow.label}${tipUnit ? `, ${tipUnit}` : ''}.${tipRow.note ? ` ${tipRow.note}` : ''}`
                  : ''}
            </span>
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
