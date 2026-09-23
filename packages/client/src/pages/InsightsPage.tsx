import { NoData } from '@/components/states/NoData';
import { PageHead } from '@/components/brand/PageHead';
import { SeasonStrip } from '@/components/insights/SeasonStrip';
import axios from 'axios';
import {
   useEffect,
   useMemo,
   useState,
   type CSSProperties,
   type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { Bars, Rose, type Bar } from '@/components/insights/Charts';
import { WindArrowIcon } from '@/components/fishing/home/ConditionIcons';
import { CountIn } from '@/components/fishing/record/CountIn';
import {
   fetchMyCatches,
   type CatchSummary,
} from '@/components/fishing/record/api';
import { formatDay, plural } from '@/components/fishing/record/format';
import {
   fetchMyProgress,
   type Progress,
} from '@/components/social/progress-api';
import { moonPhase } from '@/lib/moon';
import { useDocumentTitle } from '@/lib/title';
import {
   formatLength,
   formatMass,
   readUnitSystem,
   tempIn,
   unitOf,
   type UnitSystem,
} from '@/lib/units';
import { cn } from '@/lib/utils';
import { PersonalBests } from '@/components/fishing/PersonalBests';

/*
 * Everything the log adds up to.
 *
 * The rank first, because that is the one number that moves with all the
 * others. Then when the fish come (hour, month, day of the week, moon), what
 * they came in (wind, pressure, water, sky), and what they were (species,
 * spots, gear). All of it is counted here from the log itself, so a catch
 * logged a minute ago is already in every chart.
 */

const PHASES = [
   'New moon',
   'Waxing crescent',
   'First quarter',
   'Waxing gibbous',
   'Full moon',
   'Waning gibbous',
   'Last quarter',
   'Waning crescent',
];
const PHASE_SHORT: Record<string, string> = {
   'New moon': 'New',
   'Waxing crescent': 'Wax cr',
   'First quarter': '1st qtr',
   'Waxing gibbous': 'Wax gib',
   'Full moon': 'Full',
   'Waning gibbous': 'Wan gib',
   'Last quarter': 'Last qtr',
   'Waning crescent': 'Wan cr',
};
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
   'Jan',
   'Feb',
   'Mar',
   'Apr',
   'May',
   'Jun',
   'Jul',
   'Aug',
   'Sep',
   'Oct',
   'Nov',
   'Dec',
];
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const fishOf = (entry: CatchSummary) => Math.max(1, entry.count ?? 1);

const tally = <K extends string>(
   keys: readonly K[],
   catches: CatchSummary[],
   keyOf: (entry: CatchSummary) => K | null,
   label: (key: K) => string = (k) => k
): Bar[] => {
   const counts = new Map<K, number>(keys.map((k) => [k, 0]));
   for (const entry of catches) {
      const key = keyOf(entry);
      if (key !== null && counts.has(key)) {
         counts.set(key, (counts.get(key) ?? 0) + fishOf(entry));
      }
   }
   return keys.map((key) => ({
      key,
      label: label(key),
      count: counts.get(key) ?? 0,
   }));
};

/*
 * The water buckets are held in Celsius, because that is what the log stores.
 * The label is written in whatever the reader reads in, so the bucket edges
 * move with the unit instead of being stamped °C for everyone.
 */
const waterLabel = (bucket: string, system: UnitSystem) =>
   `${bucket.replace(/\d+/g, (edge) => String(tempIn(Number(edge), system)))} ${unitOf('temp', system)}`;

/* A log carries conditions when anything was stored with it, which is not the
 * same as the log having a position. */
const hasConditions = (e: CatchSummary) =>
   Boolean(e.weatherConditionText) ||
   Boolean(e.weatherWindDirectionCardinal) ||
   typeof e.weatherAirPressureMeanSeaLevelMillibars === 'number' ||
   typeof e.weatherSeaSurfaceTemperatureC === 'number' ||
   typeof e.waterTemp === 'number' ||
   typeof e.weatherIsDaytime === 'boolean' ||
   Boolean(e.weatherMoonPhase);

/* Sixteen compass points folded into eight, for a rose a thumb can read. */
const fold = (cardinal: string | null | undefined) => {
   if (!cardinal) return null;
   const c = cardinal.toUpperCase();
   if (DIRECTIONS.includes(c)) return c;
   const map: Record<string, string> = {
      NNE: 'N',
      ENE: 'NE',
      ESE: 'E',
      SSE: 'SE',
      SSW: 'S',
      WSW: 'SW',
      WNW: 'W',
      NNW: 'NW',
   };
   return map[c] ?? null;
};

export function InsightsPage() {
   useDocumentTitle('Insights');
   return (
      <RequireSignIn what="your insights">
         <Insights />
      </RequireSignIn>
   );
}

function Insights() {
   const [catches, setCatches] = useState<CatchSummary[] | null>(null);
   const [progress, setProgress] = useState<Progress | null>(null);
   const [failed, setFailed] = useState(false);
   const system = readUnitSystem();
   const [grown, setGrown] = useState(false);
   useEffect(() => {
      if (!progress) return;
      const frame = requestAnimationFrame(() =>
         requestAnimationFrame(() => setGrown(true))
      );
      return () => cancelAnimationFrame(frame);
   }, [progress]);

   useEffect(() => {
      const controller = new AbortController();
      Promise.all([
         fetchMyCatches(controller.signal),
         fetchMyProgress(controller.signal),
      ])
         .then(([list, prog]) => {
            setCatches(list);
            setProgress(prog);
         })
         .catch((error) => {
            if (!axios.isCancel(error)) setFailed(true);
         });
      return () => controller.abort();
   }, []);

   const charts = useMemo(() => {
      if (!catches) return null;
      const at = (e: CatchSummary) => new Date(e.caughtAt);
      const now = new Date();
      const lastYear = Array.from({ length: 12 }, (_, i) => {
         const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
         return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      });
      return {
         hour: tally(
            Array.from({ length: 24 }, (_, h) => String(h)),
            catches,
            (e) => String(at(e).getHours()),
            (h) => h.padStart(2, '0')
         ),
         weekday: tally(
            WEEKDAYS,
            catches,
            (e) => WEEKDAYS[(at(e).getDay() + 6) % 7] ?? null
         ),
         month: tally(
            lastYear,
            catches,
            (e) => {
               const d = at(e);
               return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            },
            (key) => MONTHS[Number(key.slice(5)) - 1] ?? key
         ),
         moon: tally(
            PHASES,
            catches,
            (e) => e.weatherMoonPhase ?? moonPhase(at(e)).name,
            (p) => PHASE_SHORT[p] ?? p
         ),
         wind: tally(DIRECTIONS, catches, (e) =>
            fold(e.weatherWindDirectionCardinal)
         ),
         pressure: tally(
            ['Under 1005', '1005 to 1014', '1015 to 1024', '1025 and up'],
            catches,
            (e) => {
               const p = e.weatherAirPressureMeanSeaLevelMillibars;
               if (typeof p !== 'number') return null;
               return p < 1005
                  ? 'Under 1005'
                  : p < 1015
                    ? '1005 to 1014'
                    : p < 1025
                      ? '1015 to 1024'
                      : '1025 and up';
            }
         ),
         water: tally(
            ['Under 12', '12 to 14', '15 to 17', '18 to 20', 'Over 20'],
            catches,
            (e) => {
               const t = e.waterTemp ?? e.weatherSeaSurfaceTemperatureC;
               if (typeof t !== 'number') return null;
               return t < 12
                  ? 'Under 12'
                  : t < 15
                    ? '12 to 14'
                    : t < 18
                      ? '15 to 17'
                      : t <= 20
                        ? '18 to 20'
                        : 'Over 20';
            },
            (k) => waterLabel(k, system)
         ),
         sky: tally(
            ['Clear', 'Cloudy', 'Overcast', 'Rain', 'Fog'],
            catches,
            (e) => {
               const t = (e.weatherConditionText ?? '').toLowerCase();
               if (!t) return null;
               if (/thunder|storm|rain|drizzle|shower/.test(t)) return 'Rain';
               if (/fog|mist/.test(t)) return 'Fog';
               if (/overcast/.test(t)) return 'Overcast';
               if (/cloud/.test(t)) return 'Cloudy';
               return 'Clear';
            }
         ),
         light: tally(['Day', 'Night'], catches, (e) =>
            e.weatherIsDaytime === null || e.weatherIsDaytime === undefined
               ? null
               : e.weatherIsDaytime
                 ? 'Day'
                 : 'Night'
         ),
         /* How many logs these five charts are drawn from, which is not the
          * same as how many fish are in the log. */
         withConditions: catches.filter(hasConditions).length,
      };
   }, [catches, system]);

   const tables = useMemo(() => {
      if (!catches) return null;
      type Row = {
         name: string;
         fish: number;
         catches: number;
         best: number | null;
         heaviest: number | null;
         last: string;
         id?: string;
      };
      const group = (
         keyOf: (e: CatchSummary) => { id: string; name: string } | null
      ) => {
         const rows = new Map<string, Row>();
         for (const e of catches) {
            const k = keyOf(e);
            if (!k) continue;
            const row = rows.get(k.id) ?? {
               id: k.id,
               name: k.name,
               fish: 0,
               catches: 0,
               best: null,
               heaviest: null,
               last: e.caughtAt,
            };
            row.fish += fishOf(e);
            row.catches += 1;
            if (e.length !== null && (row.best === null || e.length > row.best))
               row.best = e.length;
            if (
               e.weight !== null &&
               (row.heaviest === null || e.weight > row.heaviest)
            )
               row.heaviest = e.weight;
            if (e.caughtAt > row.last) row.last = e.caughtAt;
            rows.set(k.id, row);
         }
         return [...rows.values()].sort((a, b) => b.fish - a.fish);
      };
      return {
         species: group((e) =>
            e.species ? { id: e.species.id, name: e.species.commonName } : null
         ),
         spots: group((e) =>
            e.site ? { id: e.site.id, name: e.site.name } : null
         ),
         gear: (() => {
            const rows = new Map<string, Row>();
            for (const e of catches) {
               for (const g of e.gears ?? []) {
                  const row = rows.get(g.id) ?? {
                     id: g.id,
                     name: g.name,
                     fish: 0,
                     catches: 0,
                     best: null,
                     heaviest: null,
                     last: e.caughtAt,
                  };
                  row.fish += fishOf(e);
                  row.catches += 1;
                  if (
                     e.length !== null &&
                     (row.best === null || e.length > row.best)
                  )
                     row.best = e.length;
                  if (
                     e.weight !== null &&
                     (row.heaviest === null || e.weight > row.heaviest)
                  )
                     row.heaviest = e.weight;
                  if (e.caughtAt > row.last) row.last = e.caughtAt;
                  rows.set(g.id, row);
               }
            }
            return [...rows.values()].sort((a, b) => b.fish - a.fish);
         })(),
      };
   }, [catches]);

   if (failed) {
      return (
         <section className="mx-auto w-[min(1680px,100%-32px)] py-8 md:py-12">
            <h1 className="g text-[44px] md:text-[56px]">Insights</h1>
            <p className="mt-3 text-[17px] text-ink-2">
               Could not read your log just now.
            </p>
         </section>
      );
   }

   if (!catches || !progress || !charts || !tables) {
      return (
         <section
            className="mx-auto w-[min(1680px,100%-32px)] py-8 md:py-12"
            role="status"
            aria-label="Reading your log"
         >
            <h1 className="g text-[44px] md:text-[56px]">Insights</h1>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
               {[0, 1, 2, 3].map((i) => (
                  <span
                     key={i}
                     className="shimmer fact h-40 bg-bg-2"
                     style={{ '--i': i } as React.CSSProperties}
                  />
               ))}
            </div>
            <div className="mt-8 grid gap-x-8 gap-y-2 md:grid-cols-2">
               {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span
                     key={i}
                     className="shimmer fact h-8 bg-bg-2"
                     style={{ '--i': i + 4 } as React.CSSProperties}
                  />
               ))}
            </div>
         </section>
      );
   }

   const f = progress.figures;
   const earned = progress.badges.filter((b) => b.earned);
   const bestHour = charts.hour.reduce((a, b) => (b.count > a.count ? b : a));
   const bestWind = charts.wind.reduce((a, b) => (b.count > a.count ? b : a));
   /*
    * The first fish in the log. The catches endpoint is ordered by the day a
    * log was written, not the day it was caught, so the last row of the list
    * is whichever old fish was typed up last, not the oldest fish.
    */
   const firstAt = catches.reduce<string | null>(
      (earliest, entry) =>
         !earliest || entry.caughtAt < earliest ? entry.caughtAt : earliest,
      null
   );
   const firstDay = firstAt ? formatDay(firstAt) : null;

   return (
      <section className="relative mx-auto w-[min(1680px,100%-32px)] pb-8 md:pb-12">
         <PageHead
            kicker="Your log, counted"
            title="Insights"
            aside={
               <span className="num">
                  {plural(f.catches, 'log', 'logs')},{' '}
                  {plural(f.fish, 'fish', 'fish')}
                  {firstDay ? `, since ${firstDay}` : ''}
               </span>
            }
         />

         {/* ---- The rank ---- */}
         <Section title="Your rank" first>
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
               <div className="blk self-start p-6 text-paper">
                  <div className="flex items-baseline gap-3">
                     <span className="lab text-paper-2">Level</span>
                     <span className="g num text-[64px] leading-none">
                        <CountIn
                           value={progress.rank.index + 1}
                           durationMs={900}
                        />
                     </span>
                     <span className="g text-[34px] leading-none">
                        {progress.rank.name}
                     </span>
                  </div>
                  <div className="rank-bar mt-5 bg-paper/15" aria-hidden="true">
                     <span
                        style={{
                           width: `${grown ? Math.round(progress.progress * 100) : 0}%`,
                        }}
                     />
                  </div>
                  <p className="num mt-2 text-[14px] text-paper-2">
                     {progress.points.toLocaleString()} points
                     {progress.next
                        ? `. ${(progress.next.minPoints - progress.points).toLocaleString()} more to level ${progress.next.index + 1}, ${progress.next.name}.`
                        : '. The top of the ledge.'}
                  </p>
                  <ol className="mt-5 grid grid-cols-5 gap-x-3 gap-y-2 text-[12px] text-paper-2 sm:grid-cols-10">
                     {RANK_NAMES.map((name, i) => (
                        <li
                           key={name}
                           className={cn(
                              'flex flex-col gap-1',
                              i <= progress.rank.index
                                 ? 'text-paper'
                                 : 'text-paper-2/60'
                           )}
                        >
                           <span
                              className={cn(
                                 'block h-1',
                                 i <= progress.rank.index
                                    ? 'bg-teal'
                                    : 'bg-paper/20'
                              )}
                           />
                           <span className="num">{i + 1}</span>
                        </li>
                     ))}
                  </ol>
               </div>

               <div>
                  <h3 className="lab text-ink-3">Where the points come from</h3>
                  <dl className="mt-2">
                     {progress.breakdown.map((b) => (
                        <div
                           key={b.key}
                           className="flex items-baseline justify-between gap-4 border-t border-line py-2 first:border-t-0"
                        >
                           <dt className="min-w-0">
                              <span className="g-tracked text-[17px]">
                                 {b.label}
                              </span>
                              <span className="ml-2 text-[14px] text-ink-3">
                                 {b.detail}
                              </span>
                           </dt>
                           <dd className="num shrink-0 text-[15px]">
                              {b.points.toLocaleString()}
                           </dd>
                        </div>
                     ))}
                  </dl>
               </div>
            </div>

            <h3 className="lab mt-10 text-ink-3">
               Badges, {earned.length} of {progress.badges.length}
            </h3>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
               {progress.badges.map((badge, index) => (
                  <li
                     key={badge.key}
                     style={{ '--i': index } as CSSProperties}
                     className={cn(
                        'fact relative flex flex-col gap-1 border p-3',
                        badge.earned
                           ? 'border-ink bg-ink text-background'
                           : 'border-line text-ink'
                     )}
                  >
                     <span className="g-tracked text-[17px] leading-tight">
                        {badge.name}
                     </span>
                     <span
                        className={cn(
                           'text-[13px] leading-snug',
                           badge.earned ? 'text-background/75' : 'text-ink-3'
                        )}
                     >
                        {badge.how}
                     </span>
                     {!badge.earned ? (
                        <span className="mt-auto pt-2" aria-hidden="true">
                           <span className="block h-1 w-full bg-line">
                              <span
                                 className="block h-1 bg-teal transition-[width] duration-700 [transition-timing-function:var(--ease)]"
                                 style={{
                                    width: `${grown ? Math.round(badge.progress * 100) : 0}%`,
                                 }}
                              />
                           </span>
                        </span>
                     ) : null}
                  </li>
               ))}
            </ul>
         </Section>

         <Section title="Personal bests">
            <PersonalBests heading="none" />
         </Section>

         {/* ---- Headline figures ---- */}
         <Section title="In numbers">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 lg:grid-cols-8">
               <Figure label="Fish" value={String(f.fish)} />
               <Figure label="Species" value={String(f.species)} />
               <Figure label="Spots" value={String(f.spots)} />
               <Figure label="Range" value={`${f.rangeKm}`} unit="km" />
               <Figure label="Days out" value={String(f.days)} />
               <Figure label="Released" value={String(f.released)} />
               <Figure label="With a photo" value={String(f.photographed)} />
               <Figure
                  label="Longest"
                  value={
                     f.biggestCm === null
                        ? 'None'
                        : (formatLength(f.biggestCm, system) ?? '')
                  }
               />
            </dl>
         </Section>

         {/* ---- When ---- */}
         <Section title="When the fish come">
            <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
               <Bars
                  title="By hour of day"
                  bars={charts.hour}
                  everyOther
                  sentence={
                     bestHour.count
                        ? `Most between ${bestHour.label}:00 and ${String((Number(bestHour.key) + 1) % 24).padStart(2, '0')}:00.`
                        : null
                  }
               />
               <Bars title="By month, the last twelve" bars={charts.month} />
               <Bars title="By day of the week" bars={charts.weekday} />
               <Bars title="By the moon" bars={charts.moon} />
            </div>
         </Section>

         {/* ---- Conditions ---- */}
         <Section title="What they came in">
            <div className="grid gap-x-10 gap-y-8 lg:grid-cols-3">
               <Rose
                  title="Wind from"
                  bars={charts.wind}
                  sentence={
                     /* Four logs carry a wind and each one blew from a
                        different quarter, so there is no "most" to report.
                        A tie of one is not a finding. */
                     bestWind.count > 1
                        ? `Most fish on a ${bestWind.label} wind, ${bestWind.count} of them.`
                        : null
                  }
                  icon={
                     <WindArrowIcon
                        degrees={DIRECTIONS.indexOf(bestWind.label) * 45}
                        className="size-4"
                     />
                  }
               />
               <div className="flex flex-col gap-8">
                  <Bars title="Pressure, hPa" bars={charts.pressure} />
                  <Bars title="Water" bars={charts.water} />
               </div>
               <div className="flex flex-col gap-8">
                  <Bars title="Sky" bars={charts.sky} />
                  <Bars title="Day or night" bars={charts.light} />
               </div>
            </div>
            <p className="mt-4 text-[14px] text-ink-3">
               {charts.withConditions === 0
                  ? 'No log carries stored conditions yet, so there is nothing to count here.'
                  : `Counted from ${plural(charts.withConditions, 'log', 'logs')} of ${f.catches} that carry stored conditions.`}
            </p>
         </Section>

         {/* ---- What and where ---- */}
         <Section title="What and where">
            <div className="grid gap-x-10 gap-y-10 lg:grid-cols-3">
               {/* No species link: /catches/me reads a text search and a
                   year, and nothing else, so ?species= landed on the whole
                   log. A name that opens the same page it was on is worse
                   than a name that stays put. */}
               <Table
                  title="By species"
                  rows={tables.species}
                  system={system}
               />
               <Table
                  title="By spot"
                  rows={tables.spots}
                  system={system}
                  href={(id) => `/sites/${id}`}
               />
               <Table title="By gear" rows={tables.gear} system={system} />
            </div>
         </Section>

         {/* ---- The season, by month ---- */}
         <Section title="The season">
            <SeasonStrip catches={catches} />
         </Section>
      </section>
   );
}

const RANK_NAMES = [
   'Greenhorn',
   'Bait runner',
   'Rock hopper',
   'Gully reader',
   'Surf caster',
   'Ledge regular',
   'Coast runner',
   'Salt veteran',
   'Grand angler',
   'Legend of the ledges',
];

function Section({
   title,
   first = false,
   children,
}: {
   title: string;
   first?: boolean;
   children: ReactNode;
}) {
   return (
      <section
         className={cn(first ? 'mt-8' : 'mt-14 border-t border-line pt-10')}
      >
         <h2 className="g text-[30px] md:text-[36px]">{title}</h2>
         <div className="mt-6">{children}</div>
      </section>
   );
}

function Figure({
   label,
   value,
   unit,
}: {
   label: string;
   value: string;
   unit?: string;
}) {
   const numeric = /^\d+$/.test(value) ? Number(value) : null;
   return (
      <div className="flex flex-col">
         <dt className="lab text-ink-3">{label}</dt>
         <dd className="g num mt-1 text-[34px] leading-none">
            {numeric !== null ? (
               <CountIn value={numeric} durationMs={900} />
            ) : (
               value
            )}
            {unit ? (
               <small className="ml-1 font-sans text-[14px] tracking-normal text-ink-2">
                  {unit}
               </small>
            ) : null}
         </dd>
      </div>
   );
}

function Table({
   title,
   rows,
   system,
   href,
}: {
   title: string;
   rows: {
      id?: string;
      name: string;
      fish: number;
      catches: number;
      best: number | null;
      heaviest: number | null;
      last: string;
   }[];
   system: ReturnType<typeof readUnitSystem>;
   href?: (id: string) => string;
}) {
   /*
    * The layout is fixed, so the name column is what is left after the three
    * small ones rather than whatever the browser felt like. At three columns
    * on a desktop the names were being cut to twelve characters, WHITE
    * STEENI, while the figures beside them kept all the room they wanted.
    */
   return (
      <div className="min-w-0">
         <h3 className="lab text-ink-3">{title}</h3>
         {rows.length === 0 ? (
            <NoData compact className="mt-2" title="No data yet">
               Nothing recorded under this yet.
            </NoData>
         ) : (
            <table className="mt-2 w-full table-fixed border-collapse text-[14px]">
               <thead>
                  <tr className="border-b border-ink text-left">
                     <th
                        scope="col"
                        className="lab py-1.5 font-normal text-ink-3"
                     >
                        Name
                     </th>
                     <th
                        scope="col"
                        className="lab w-14 py-1.5 text-right font-normal text-ink-3"
                     >
                        Fish
                     </th>
                     <th
                        scope="col"
                        className="lab w-24 py-1.5 text-right font-normal text-ink-3"
                     >
                        Best
                     </th>
                     <th
                        scope="col"
                        className="lab hidden w-32 py-1.5 text-right font-normal text-ink-3 sm:table-cell"
                     >
                        Last
                     </th>
                  </tr>
               </thead>
               <tbody>
                  {rows.slice(0, 12).map((row, i) => (
                     <tr
                        key={row.id ?? row.name}
                        className="fact border-b border-line"
                        style={{ '--i': i } as React.CSSProperties}
                     >
                        {/* The name is a link, so the cell gives it the whole
                            row's height to be hit in rather than the nineteen
                            pixels the word itself occupies. The padding moves
                            off the cell and onto the link for the same reason;
                            a row without a link keeps it. */}
                        <td
                           className={cn(
                              'truncate pr-2',
                              href && row.id ? 'py-0' : 'py-2'
                           )}
                        >
                           {href && row.id ? (
                              <Link
                                 to={href(row.id)}
                                 className="g-tracked flex min-h-11 items-center truncate text-[16px] underline-offset-4 hover:underline"
                              >
                                 {row.name}
                              </Link>
                           ) : (
                              <span className="g-tracked text-[16px]">
                                 {row.name}
                              </span>
                           )}
                        </td>
                        <td className="num py-2 text-right">{row.fish}</td>
                        <td className="num py-2 text-right whitespace-nowrap">
                           {row.best !== null
                              ? formatLength(row.best, system)
                              : row.heaviest !== null
                                ? formatMass(row.heaviest, system)
                                : ''}
                        </td>
                        <td className="num hidden py-2 text-right whitespace-nowrap text-ink-2 sm:table-cell">
                           {formatDay(row.last)}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         )}
      </div>
   );
}
