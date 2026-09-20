import {
   MoonPhaseIcon,
   WindArrowIcon,
   skyIcon,
} from '@/components/fishing/home/ConditionIcons';
import {
   skyTone,
   tempTint,
   windBar,
   windColour,
} from '@/components/forecast/tones';
import { cn } from '@/lib/utils';
import { ANCHOR, WRAP, stagger } from './layout';

/*
 * The forecast, as the product draws it.
 *
 * A still of the instrument rather than a picture of one: the same day strip,
 * the same black block, the same signal colours off `forecast/tones`, so what
 * the landing page promises is the thing that loads. One spring Tuesday at
 * Kalk Bay, a south wester filling in through the morning and topping out at
 * three, with the rain arriving behind it.
 *
 * Nothing here is interactive. The week is a list and the instrument is a set
 * of rows, because a tab that cannot be chosen and a button that does nothing
 * are worse than the words they are drawn as.
 */

/* Tuesday 15 September, and the six days after it. */
const DAYS = [
   {
      day: 'Today',
      date: 15,
      sky: 'Clear',
      wind: 47,
      hi: 19,
      lo: 11,
      moon: 0.256,
      lit: 52,
   },
   {
      day: 'Wed',
      date: 16,
      sky: 'Clear',
      wind: 17,
      hi: 21,
      lo: 12,
      moon: 0.285,
      lit: 61,
   },
   {
      day: 'Thu',
      date: 17,
      sky: 'Cloudy',
      wind: 9,
      hi: 18,
      lo: 12,
      moon: 0.316,
      lit: 70,
   },
   {
      day: 'Fri',
      date: 18,
      sky: 'Rain',
      wind: 28,
      hi: 16,
      lo: 11,
      moon: 0.348,
      lit: 79,
   },
   {
      day: 'Sat',
      date: 19,
      sky: 'Thunder',
      wind: 41,
      hi: 15,
      lo: 10,
      moon: 0.383,
      lit: 87,
   },
   {
      day: 'Sun',
      date: 20,
      sky: 'Cloudy',
      wind: 50,
      hi: 14,
      lo: 10,
      moon: 0.422,
      lit: 94,
   },
   {
      day: 'Mon',
      date: 21,
      sky: 'Clear',
      wind: 18,
      hi: 20,
      lo: 11,
      moon: 0.468,
      lit: 99,
   },
];

/*
 * The hours the block draws, 04:00 to 21:00. Wind is reported as the bearing
 * it blows FROM, which is what `WindArrowIcon` expects: it turns the mark half
 * a circle so the arrow points where the air is going.
 */
const HOURS = [
   { hour: '04', kph: 7, gust: 12, from: 200, air: 10, sky: 'Clear' },
   { hour: '05', kph: 9, gust: 15, from: 205, air: 10, sky: 'Clear' },
   { hour: '06', kph: 12, gust: 19, from: 210, air: 11, sky: 'Clear' },
   { hour: '07', kph: 16, gust: 24, from: 215, air: 12, sky: 'Clear' },
   { hour: '08', kph: 21, gust: 31, from: 220, air: 14, sky: 'Clear' },
   { hour: '09', kph: 24, gust: 35, from: 225, air: 16, sky: 'Clear' },
   { hour: '10', kph: 27, gust: 39, from: 225, air: 18, sky: 'Clear' },
   { hour: '11', kph: 31, gust: 44, from: 230, air: 19, sky: 'Cloudy' },
   { hour: '12', kph: 35, gust: 49, from: 230, air: 20, sky: 'Cloudy' },
   { hour: '13', kph: 38, gust: 53, from: 235, air: 21, sky: 'Cloudy' },
   { hour: '14', kph: 42, gust: 58, from: 235, air: 21, sky: 'Rain' },
   { hour: '15', kph: 47, gust: 63, from: 240, air: 20, sky: 'Rain' },
   { hour: '16', kph: 44, gust: 60, from: 240, air: 19, sky: 'Rain' },
   { hour: '17', kph: 38, gust: 53, from: 235, air: 17, sky: 'Cloudy' },
   { hour: '18', kph: 33, gust: 46, from: 230, air: 15, sky: 'Clear' },
   { hour: '19', kph: 27, gust: 39, from: 225, air: 13, sky: 'Clear' },
   { hour: '20', kph: 21, gust: 31, from: 220, air: 12, sky: 'Clear' },
   { hour: '21', kph: 16, gust: 24, from: 215, air: 11, sky: 'Clear' },
];

/* The hour the reader is standing in, banded down every row. */
const NOW = 2;

/* What the day is summed up as, over the instrument. */
const FACTS = [
   ['Light', '06:18 to 18:42'],
   ['Moon', 'First quarter, 52% lit, up 12:04, down 23:58'],
   ['Wind', 'Up to 47 km/h, gusting 63'],
   ['Rain', '55% chance, 2.4 mm'],
];

/*
 * The bars stand against a shore angler's scale rather than against the week:
 * 50 km/h fills the track, which is the wind that ends a session, so a calm
 * day reads as calm instead of being blown up to fill the row.
 */
const SCALE = Math.max(50, ...DAYS.map((d) => d.wind));

/* The window the drawn rows span: 04:00 to 22:00, in the band's own units. */
const FIRST = 4 * 60;
const SPAN = HOURS.length * 60;
const BAND_W = 1800;

const round = (n: number) => Math.round(n * 1000) / 1000;
const pc = (n: number) => `${round(n)}%`;

const clockMinutes = (clock: string) =>
   Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

/** Where a clock time falls across the window, 0 to 100. */
const across = (clock: string) => ((clockMinutes(clock) - FIRST) / SPAN) * 100;

/** The same point in the band's own units. */
const bandX = (clock: string) => (across(clock) / 100) * BAND_W;

/** Halfway between two times, for the word that names the run between them. */
const midway = (a: string, b: string) => (across(a) + across(b)) / 2;

/*
 * A label sits over its own mark, except at the ends of the band, where a
 * centred label would hang off the block and be cut by the scroller.
 */
const nudge = (x: number) =>
   x < 8 ? 'translateX(0)' : x > 92 ? 'translateX(-100%)' : 'translateX(-50%)';

/*
 * The water, drawn once rather than sampled: high at 04:12, the ebb down to
 * 10:31, the flood back up to 16:44 and away again. The x of every turn is the
 * x its label is pinned at, so the curve and the words agree.
 */
const TIDE =
   'M0 20 C 60 18, 200 24, 330 37 S 560 56, 652 56 S 900 34, 1100 22 S 1220 18, 1273 18 S 1560 30, 1800 45';

const TURNS = [
   { name: 'High', clock: '04:12', y: 18 },
   { name: 'Low', clock: '10:31', y: 56 },
   { name: 'High', clock: '16:44', y: 18 },
];

const RUNS = [
   { name: 'Ebb', at: midway('04:12', '10:31') },
   { name: 'Flood', at: midway('10:31', '16:44') },
   { name: 'Ebb', at: midway('16:44', '22:00') },
];

/** A body over the horizon: up here, over there, down again. */
const arcPath = (rise: string, set: string) => {
   const a = bandX(rise);
   const b = bandX(set);
   return `M${round(a)} 62 Q${round((a + b) / 2)} -26 ${round(b)} 62`;
};

const SUN = { rise: '06:18', set: '18:42', noon: '12:30' };
const MOON = { rise: '12:04', set: '23:58' };
const MOON_HIGH = (across(MOON.rise) + across(MOON.set)) / 2;

/* The rail carries the row names and holds its place while the hours slide. */
const RAIL =
   'fc-ground sticky left-0 z-20 flex items-center border-r border-line px-3';
const ROW =
   'grid grid-cols-[104px_minmax(0,1fr)] md:grid-cols-[132px_minmax(0,1fr)]';
const CELLS = 'grid grid-cols-[repeat(18,minmax(0,1fr))]';
const NOW_BAND = {
   left: pc((NOW / HOURS.length) * 100),
   width: pc(100 / HOURS.length),
};

export function LandingForecast() {
   return (
      <section
         id="forecast"
         className={cn(
            'relative bg-background pt-[calc(var(--hang)+var(--trough)+1.25rem)] pb-14 md:pt-[calc(var(--hang)+var(--trough)+2rem)] md:pb-[88px]',
            ANCHOR
         )}
      >
         <div className={WRAP}>
            <div className="grid items-end gap-7 lg:grid-cols-2 lg:gap-14">
               <div className="flex min-w-0 flex-col gap-[22px]">
                  <span className="lab lab-rule rv text-ink-2">
                     01 <span className="text-ink-3">Before you go</span>
                  </span>
                  <h2
                     className="g rv text-[clamp(42px,5.4vw,76px)]"
                     style={stagger(1)}
                  >
                     Read the day before you drive
                  </h2>
               </div>

               <div className="flex min-w-0 flex-col gap-3.5">
                  <p
                     className="rv max-w-[52ch] text-[17px] text-ink-2 text-pretty"
                     style={stagger(2)}
                  >
                     Seven days, hour by hour, as one instrument rather than a
                     table two thousand pixels long: wind and gusts with their
                     direction, the tide, the air, and the sun and the moon over
                     one horizon. Every row is drawn against the same columns,
                     so a glance down any one minute reads all of it together.
                  </p>
                  <p
                     className="rv max-w-[52ch] text-[17px] text-ink-2 text-pretty"
                     style={stagger(3)}
                  >
                     The colour <i className="text-ink not-italic">is</i> the
                     reading. A wind bar runs teal, green, yellow, orange, red
                     as it builds, and the hour you are standing in is banded
                     straight down the block.
                  </p>
               </div>
            </div>

            {/* The week. Sixty four pixels a day on a phone, so the seventh
                showing its edge is the only invitation the strip needs. */}
            <ol
               aria-label="The week"
               className="rv -mx-4 mt-9 flex overflow-x-auto px-4 md:mx-0 md:px-0"
               style={stagger(4)}
            >
               {DAYS.map((day, index) => {
                  const on = index === 0;
                  const Sky = skyIcon(day.sky);
                  const quiet = day.wind < 12;
                  return (
                     <li
                        key={day.date}
                        className={cn(
                           'flex min-w-16 flex-1 flex-col items-center gap-1 border border-line px-1.5 py-2 not-first:-ml-px md:min-w-[96px] md:px-2',
                           on
                              ? 'relative z-10 border-ink bg-ink text-background'
                              : 'text-ink'
                        )}
                     >
                        <span
                           className={cn(
                              'lab',
                              on ? 'text-background/80' : 'text-ink-3'
                           )}
                        >
                           {day.day}
                        </span>
                        <span className="g num text-[28px] leading-none">
                           {day.date}
                        </span>
                        <Sky
                           aria-hidden="true"
                           className={cn('size-5', on ? '' : skyTone(day.sky))}
                        />
                        {/* The day's hardest wind, as a bar on the same ramp
                            the hours are drawn on, so Saturday's tab and
                            Saturday's bars are the same colour. */}
                        <span
                           aria-hidden="true"
                           className={cn(
                              'flex h-1 w-8',
                              on ? 'bg-background/25' : 'bg-line'
                           )}
                        >
                           <span
                              className={cn(
                                 'block h-1',
                                 on && quiet
                                    ? 'bg-background/70'
                                    : windBar(day.wind)
                              )}
                              style={{ width: pc((day.wind / SCALE) * 100) }}
                           />
                        </span>
                        <span className="flex items-center gap-2">
                           <span className="num text-[14px] leading-tight">
                              {day.hi}° / {day.lo}°
                           </span>
                           <span
                              className={cn(
                                 'hidden items-center gap-1 text-[14px] leading-tight md:flex',
                                 on ? 'text-background/80' : 'text-ink-3'
                              )}
                           >
                              <MoonPhaseIcon
                                 fraction={day.moon}
                                 className="size-3.5"
                              />
                              {day.lit}%
                           </span>
                        </span>
                     </li>
                  );
               })}
            </ol>

            <dl
               className="rv mt-4 flex flex-wrap items-baseline gap-x-7 gap-y-1"
               style={stagger(5)}
            >
               {FACTS.map(([name, reading]) => (
                  <div key={name} className="flex items-baseline gap-2">
                     <dt className="lab">{name}</dt>
                     <dd className="text-[14px] leading-tight">{reading}</dd>
                  </div>
               ))}
            </dl>

            {/* The instrument. The hours are wider than a phone, so they get
                their own scroller and the rail stays where it is. */}
            <div
               className="blk blk-plain rv -mx-4 mt-5 md:mx-0"
               style={stagger(6)}
            >
               <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                     <div className={cn(ROW, 'border-b border-line')}>
                        <div className={cn(RAIL, 'py-2')}>
                           <span className="lab text-ink-2">Hour</span>
                        </div>
                        <div className={CELLS}>
                           {HOURS.map((h, index) => (
                              <span
                                 key={h.hour}
                                 className={cn(
                                    'g num flex items-center justify-center px-0.5 py-2 text-[18px] leading-[18px] md:text-[22px] md:leading-[22px]',
                                    index === NOW && 'bg-teal text-black-block'
                                 )}
                              >
                                 {h.hour}
                              </span>
                           ))}
                        </div>
                     </div>

                     <div
                        className={cn(
                           ROW,
                           'h-[140px] border-b border-line md:h-[132px]'
                        )}
                     >
                        <div className={RAIL}>
                           <span>
                              <span className="lab text-ink-2">Wind</span>
                              <span className="num ml-1.5 text-[14px] text-ink-3">
                                 km/h
                              </span>
                           </span>
                        </div>
                        <div className={CELLS}>
                           {HOURS.map((h, index) => (
                              <span
                                 key={h.hour}
                                 className={cn(
                                    'num flex flex-col items-center justify-center gap-0.5 text-[14px] md:text-[16px]',
                                    index === NOW && 'fc-now'
                                 )}
                              >
                                 <span className="flex h-[18px] items-center text-ink-2">
                                    <WindArrowIcon
                                       degrees={h.from}
                                       className="size-[18px]"
                                    />
                                 </span>
                                 {/* Square ended, standing on the foot of its
                                     track: the height says how hard and the
                                     colour says it again, so neither is
                                     carrying the reading alone. */}
                                 <span className="flex h-[72px] w-6 items-end md:h-16">
                                    <span
                                       className="bar-grow block w-full"
                                       style={{
                                          height: pc(
                                             Math.max(6, (h.kph / SCALE) * 100)
                                          ),
                                          background: windColour(h.kph),
                                       }}
                                    />
                                 </span>
                                 <span className="leading-[18px] font-medium md:leading-5">
                                    {h.kph}
                                 </span>
                                 <span className="leading-[18px] text-ink-2 md:leading-5">
                                    {h.gust}
                                 </span>
                              </span>
                           ))}
                        </div>
                     </div>

                     <div className={cn(ROW, 'h-[84px] border-b border-line')}>
                        <div className={RAIL}>
                           <span className="lab text-ink-2">Tide</span>
                        </div>
                        <div className="relative h-[84px]">
                           <span
                              aria-hidden="true"
                              className="fc-now pointer-events-none absolute top-0 bottom-0"
                              style={NOW_BAND}
                           />
                           <svg
                              aria-hidden="true"
                              viewBox="0 0 1800 84"
                              preserveAspectRatio="none"
                              className="absolute inset-0 h-full w-full"
                           >
                              <path
                                 d={`${TIDE} L1800 84 L0 84 Z`}
                                 fill="color-mix(in srgb, var(--teal) 20%, transparent)"
                              />
                              <line
                                 x1="0"
                                 x2="1800"
                                 y1="35"
                                 y2="35"
                                 stroke="var(--teal)"
                                 strokeWidth="1"
                                 strokeDasharray="12 10.5"
                              />
                              <path
                                 className="draw-on"
                                 d={TIDE}
                                 pathLength={1}
                                 fill="none"
                                 stroke="var(--ink)"
                                 strokeWidth="2"
                              />
                           </svg>
                           {TURNS.map((turn) => {
                              const x = across(turn.clock);
                              return (
                                 <span key={turn.clock}>
                                    <span
                                       aria-hidden="true"
                                       className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 bg-ink"
                                       style={{ left: pc(x), top: turn.y }}
                                    />
                                    <span
                                       className="fc-ground lab num absolute px-1 whitespace-nowrap text-ink"
                                       style={{
                                          left: pc(x),
                                          top: turn.y + 5,
                                          transform: nudge(x),
                                       }}
                                    >
                                       {turn.name} {turn.clock}
                                    </span>
                                 </span>
                              );
                           })}
                           {RUNS.map((run) => (
                              <span
                                 key={run.name + run.at}
                                 className="lab absolute bottom-0 whitespace-nowrap text-ink-2"
                                 style={{
                                    left: pc(run.at),
                                    transform: nudge(run.at),
                                 }}
                              >
                                 {run.name}
                              </span>
                           ))}
                        </div>
                     </div>

                     <div className={cn(ROW, 'h-[46px] border-b border-line')}>
                        <div className={RAIL}>
                           <span>
                              <span className="lab text-ink-2">Air</span>
                              <span className="num ml-1.5 text-[14px] text-ink-3">
                                 °C
                              </span>
                           </span>
                        </div>
                        <div className={CELLS}>
                           {HOURS.map((h, index) => {
                              const Sky = skyIcon(h.sky);
                              return (
                                 <span
                                    key={h.hour}
                                    /* The now band outranks a tint: an inline
                                       background would beat the class. */
                                    style={
                                       index === NOW
                                          ? undefined
                                          : tempTint(h.air)
                                    }
                                    className={cn(
                                       'num flex flex-col items-center justify-center gap-px text-[14px] md:text-[16px]',
                                       index === NOW && 'fc-now'
                                    )}
                                 >
                                    <Sky
                                       aria-hidden="true"
                                       className={cn(
                                          'size-[18px]',
                                          skyTone(h.sky)
                                       )}
                                    />
                                    <span className="leading-[18px]">
                                       {h.air}
                                    </span>
                                 </span>
                              );
                           })}
                        </div>
                     </div>

                     <div className={cn(ROW, 'h-[96px]')}>
                        <div className={RAIL}>
                           <span className="lab text-ink-2">Sun and moon</span>
                        </div>
                        <div className="relative h-[96px]">
                           <span
                              aria-hidden="true"
                              className="fc-now pointer-events-none absolute top-0 bottom-0"
                              style={NOW_BAND}
                           />
                           <svg
                              aria-hidden="true"
                              viewBox="0 0 1800 96"
                              preserveAspectRatio="none"
                              className="absolute inset-0 h-full w-full"
                           >
                              {/* The dark either side of the day, so the light
                                  is a shape before it is a pair of times. */}
                              <rect
                                 x="0"
                                 y="0"
                                 width={round(bandX(SUN.rise))}
                                 height="96"
                                 fill="color-mix(in srgb, var(--paper) 4%, transparent)"
                              />
                              <rect
                                 x={round(bandX(SUN.set))}
                                 y="0"
                                 width={round(BAND_W - bandX(SUN.set))}
                                 height="96"
                                 fill="color-mix(in srgb, var(--paper) 4%, transparent)"
                              />
                              <line
                                 x1="0"
                                 x2="1800"
                                 y1="62"
                                 y2="62"
                                 stroke="var(--teal)"
                                 strokeWidth="1"
                                 strokeDasharray="12 10.5"
                              />
                              <path
                                 className="draw-on"
                                 d={arcPath(MOON.rise, MOON.set)}
                                 pathLength={1}
                                 fill="none"
                                 stroke="var(--ink-2)"
                                 strokeWidth="2"
                              />
                              <path
                                 className="draw-on"
                                 d={arcPath(SUN.rise, SUN.set)}
                                 pathLength={1}
                                 fill="none"
                                 stroke="var(--sun)"
                                 strokeWidth="2"
                              />
                           </svg>
                           <span
                              aria-hidden="true"
                              className="absolute top-[18px] size-2.5 -translate-x-1/2 -translate-y-1/2 bg-sun"
                              style={{ left: pc(across(SUN.noon)) }}
                           />
                           <span
                              aria-hidden="true"
                              className="absolute top-[18px] -translate-x-1/2 -translate-y-1/2 text-ink-2"
                              style={{ left: pc(MOON_HIGH) }}
                           >
                              <MoonPhaseIcon
                                 fraction={DAYS[0].moon}
                                 className="size-4"
                              />
                           </span>
                           <span
                              className="fc-ground lab num absolute top-[28px] px-1 whitespace-nowrap text-ink"
                              style={{
                                 left: pc(across(SUN.noon)),
                                 transform: nudge(across(SUN.noon)),
                              }}
                           >
                              High noon {SUN.noon}
                           </span>
                           <span
                              className="fc-ground lab num absolute top-[68px] px-1 whitespace-nowrap text-ink-2"
                              style={{
                                 left: pc(across(MOON.rise)),
                                 transform: nudge(across(MOON.rise)),
                              }}
                           >
                              Moonrise {MOON.rise}
                           </span>
                           <span
                              className="lab num absolute top-[68px] px-1 whitespace-nowrap text-ink-2"
                              style={{
                                 left: pc(across(SUN.rise)),
                                 transform: nudge(across(SUN.rise)),
                                 background:
                                    'color-mix(in srgb, var(--paper) 4%, var(--bg))',
                              }}
                           >
                              Sunrise {SUN.rise}
                           </span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <p className="rv mt-4 text-[14px] text-ink-3" style={stagger(7)}>
               Checked 06:04, hours in Africa/Johannesburg. Weather data by
               Open-Meteo.com. Sea level modelled on an 8 km grid, not a tide
               table.
            </p>
         </div>
      </section>
   );
}
