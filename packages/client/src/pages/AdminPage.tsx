import { useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { PageHead } from '@/components/brand/PageHead';
import { Backups } from '@/components/admin/Backups';
import { StartFresh } from '@/components/admin/StartFresh';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { CountIn } from '@/components/fishing/record/CountIn';
import { AdminTable, type Column } from '@/components/admin/AdminTable';
import { Area, Bars, HeatGrid, Spread } from '@/components/insights/Charts';
import {
   fetchSection,
   setVerified,
   NotForYou,
   type Fish,
   type Growth,
   type Health,
   type Overview,
   type People,
   type Reading,
   type Section,
   type SpeciesRow,
   type SpotRow,
   type ActiveAngler,
   type JoinedAngler,
   type Water,
} from '@/components/admin/api';
import { VerifiedMark } from '@/components/profile/VerifiedMark';
import { useDocumentTitle } from '@/lib/title';
import { formatLength, formatMass, readUnitSystem } from '@/lib/units';
import { cn } from '@/lib/utils';

/*
 * The whole app in one page, for whoever runs it.
 *
 * Six sections, six requests, each fetched on its own so the headline lands
 * while the heavy ones are still counting. Nothing here asks "am I an admin":
 * the server answers 404 to everybody who is not, exactly as it would for a
 * path that was never registered, and this page renders the ordinary
 * not-found page when it hears that. A page that decided for itself would be
 * a second opinion on the one question that must only have one.
 *
 * It reads on a phone. The figures wrap two to a row, every table drops its
 * quieter columns under 640px, and the year grid scrolls sideways on its own
 * rather than making the page do it.
 */

export function AdminPage() {
   useDocumentTitle('Admin');
   const [refused, setRefused] = useState(false);

   if (refused) return <NotFoundPage />;

   return (
      <section className="relative mx-auto w-[min(1680px,100%-32px)] pb-8 md:pb-12">
         <PageHead
            kicker="Fisherfeed, counted"
            title="Admin"
            lede="Everything the app has logged, as the database reads it right now. Nothing on this page is cached."
         />
         <Panels onRefused={() => setRefused(true)} />
      </section>
   );
}

function Panels({ onRefused }: { onRefused: () => void }) {
   return (
      <>
         <OverviewPanel onRefused={onRefused} />
         <GrowthPanel />
         <FishPanel />
         <WaterPanel />
         <PeoplePanel />
         <HealthPanel />
         <Backups />
         {/* Last on the page on purpose: the one thing here that destroys. */}
         <StartFresh />
      </>
   );
}

/* ---- One section, fetched ------------------------------------------------ */

type State<T> =
   | { status: 'reading' }
   | { status: 'read'; reading: Reading<T> }
   | { status: 'failed' };

/*
 * Every panel wants the same three things: fetch on mount, abort on unmount,
 * and tell a refusal apart from a failure. The refusal is handed up so the
 * whole page can become the not-found page rather than six panels each saying
 * it separately.
 */
function useSection<T>(section: Section, onRefused?: () => void): State<T> {
   const [state, setState] = useState<State<T>>({ status: 'reading' });

   useEffect(() => {
      const controller = new AbortController();
      fetchSection<T>(section, controller.signal)
         .then((reading) => setState({ status: 'read', reading }))
         .catch((error) => {
            if (axios.isCancel(error)) return;
            if (error instanceof NotForYou) {
               onRefused?.();
               return;
            }
            setState({ status: 'failed' });
         });
      return () => controller.abort();
      /* onRefused is a fresh closure every render and nothing here depends on
         which one it is, so the fetch keys on the section alone. */
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [section]);

   return state;
}

/*
 * A section of the page, with its heading, and the shimmer it shows while the
 * server counts. The timing sits on the right of the heading: an admin page
 * that quietly gets slow is one nobody notices until it times out, so what it
 * cost is printed where it was spent.
 */
function Panel({
   title,
   ms,
   note,
   status,
   first = false,
   children,
}: {
   title: string;
   ms?: number;
   note?: ReactNode;
   status: State<unknown>['status'];
   first?: boolean;
   children: ReactNode;
}) {
   return (
      <section
         className={cn(first ? 'mt-8' : 'mt-14 border-t border-line pt-10')}
      >
         <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 className="g text-[30px] md:text-[36px]">{title}</h2>
            {typeof ms === 'number' ? (
               <span className="lab num text-ink-3">{ms} ms</span>
            ) : null}
         </div>
         {note ? (
            <p className="mt-2 max-w-[70ch] text-[14px] text-ink-3">{note}</p>
         ) : null}
         <div className="mt-6">
            {status === 'reading' ? (
               <div
                  role="status"
                  aria-label={`Counting ${title.toLowerCase()}`}
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
               >
                  {[0, 1, 2, 3].map((i) => (
                     <span
                        key={i}
                        className="shimmer fact h-28 bg-bg-2"
                        style={{ '--i': i } as React.CSSProperties}
                     />
                  ))}
               </div>
            ) : status === 'failed' ? (
               <p className="text-[15px] text-ink-2">
                  Could not count that just now.
               </p>
            ) : (
               children
            )}
         </div>
      </section>
   );
}

/*
 * A chart, or a line saying there is nothing to chart yet.
 *
 * Bars given an empty list draws its baseline and its labels and nothing else,
 * which on a panel reads as a chart that failed rather than as a count of
 * zero. A sentence is the honest version, and it is shorter.
 */
function BarsOrNone({
   title,
   bars,
   empty,
   everyOther = false,
}: {
   title: string;
   bars: { key: string; label: string; count: number }[];
   empty: string;
   everyOther?: boolean;
}) {
   if (!bars.length || bars.every((bar) => !bar.count)) {
      return (
         <figure className="min-w-0">
            <figcaption className="lab">{title}</figcaption>
            <p className="mt-2 text-[15px] text-ink-3">{empty}</p>
         </figure>
      );
   }
   return <Bars title={title} bars={bars} everyOther={everyOther} />;
}

/* ---- 1. The headline ----------------------------------------------------- */

/*
 * A figure in the record card's language: the label above, the number big in
 * League Gothic, and what it did lately under it. The two windows are written
 * as words rather than as arrows, because "+4 this week" says which way and
 * how much, and a green triangle says neither.
 */
function FigureCard({
   label,
   total,
   d7,
   d30,
   index,
}: {
   label: string;
   total: number;
   d7: number;
   d30: number;
   index: number;
}) {
   /* dt and dd rather than spans: this sits in a description list, and a list
      of plain divs is a list a screen reader reads as nothing in particular. */
   return (
      <div
         className="fact flex flex-col border-t border-ink pt-2"
         style={{ '--i': index } as React.CSSProperties}
      >
         <dt className="lab text-ink-3">{label}</dt>
         <dd className="g num mt-1 text-[38px] leading-none md:text-[44px]">
            <CountIn value={total} durationMs={900} />
         </dd>
         <dd className="num mt-1.5 text-[13px] text-ink-2">
            {d7 ? (
               <span className="text-teal-text">+{d7} this week</span>
            ) : (
               <span className="text-ink-3">None this week</span>
            )}
            <span className="text-ink-3">, +{d30} in thirty days</span>
         </dd>
      </div>
   );
}

function OverviewPanel({ onRefused }: { onRefused: () => void }) {
   const state = useSection<Overview>('overview', onRefused);
   const figures = state.status === 'read' ? state.reading.data.figures : [];

   return (
      <Panel
         title="Where it stands"
         first
         status={state.status}
         ms={state.status === 'read' ? state.reading.ms : undefined}
      >
         <dl className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
            {figures.map((figure, i) => (
               <FigureCard
                  key={figure.key}
                  label={figure.label}
                  total={figure.total}
                  d7={figure.d7}
                  d30={figure.d30}
                  index={i}
               />
            ))}
         </dl>
      </Panel>
   );
}

/* ---- 2. Growth ----------------------------------------------------------- */

function GrowthPanel() {
   const state = useSection<Growth>('growth');
   const [grain, setGrain] = useState<'day' | 'week'>('day');
   const data = state.status === 'read' ? state.reading.data : null;

   /* Sixty days reads as a curve; three hundred and sixty five reads as a
      smear. The week view is the one that shows a year. */
   const series = data
      ? grain === 'day'
         ? {
              signUps: data.daily.signUps.slice(-60),
              catches: data.daily.catches.slice(-60),
              photos: data.daily.photos.slice(-60),
           }
         : data.weekly
      : null;

   return (
      <Panel
         title="Growth"
         status={state.status}
         ms={state.status === 'read' ? state.reading.ms : undefined}
         note="Sign-ups, logs and photos by the day they were written. The year grid below counts by the day the fish was caught, which is a different question."
      >
         {series && data ? (
            <>
               <div
                  role="radiogroup"
                  aria-label="Show growth by"
                  className="mb-6 flex flex-wrap gap-2"
               >
                  {(['day', 'week'] as const).map((option) => (
                     <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={grain === option}
                        onClick={() => setGrain(option)}
                        className={cn(
                           'g-tracked inline-flex h-11 items-center border px-4 text-[15px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
                           grain === option
                              ? 'border-ink bg-ink text-background'
                              : 'border-line text-ink-2 hover:border-ink hover:text-ink'
                        )}
                     >
                        {option === 'day' ? 'By day' : 'By week'}
                     </button>
                  ))}
               </div>

               <div className="grid gap-x-10 gap-y-8 lg:grid-cols-3">
                  {/* The spoken label counts points, so it has to be told
                      whether a point is a day or a week. */}
                  <Area
                     title="Anglers joining"
                     points={series.signUps}
                     unit={grain === 'day' ? 'days' : 'weeks'}
                  />
                  <Area
                     title="Catches logged"
                     points={series.catches}
                     unit={grain === 'day' ? 'days' : 'weeks'}
                  />
                  <Area
                     title="Photos added"
                     points={series.photos}
                     unit={grain === 'day' ? 'days' : 'weeks'}
                  />
               </div>

               <div className="mt-10">
                  <HeatGrid
                     title="A year of fishing, by the day it was caught"
                     points={data.caughtByDay}
                  />
               </div>
            </>
         ) : null}
      </Panel>
   );
}

/* ---- 3. The fish --------------------------------------------------------- */

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

function FishPanel() {
   const state = useSection<Fish>('fish');
   const system = readUnitSystem();
   const data = state.status === 'read' ? state.reading.data : null;

   const columns: Column<SpeciesRow>[] = [
      {
         key: 'name',
         head: 'Species',
         value: (row) => row.name,
         cell: (row) => (
            <span className="g-tracked text-[16px]">{row.name}</span>
         ),
      },
      { key: 'fish', head: 'Fish', value: (row) => row.fish, align: 'right' },
      { key: 'logs', head: 'Logs', value: (row) => row.logs, align: 'right' },
      {
         key: 'longest',
         head: 'Longest',
         value: (row) => row.longestCm,
         align: 'right',
         cell: (row) =>
            row.longestCm === null
               ? ''
               : (formatLength(row.longestCm, system) ?? ''),
      },
      {
         /* Not "Held by" twice: two heads with the same word run into their
            neighbour on the page and name nothing on their own to a reader
            who hears the column and not the one beside it. */
         key: 'longestBy',
         head: 'Longest by',
         value: (row) => row.longestBy,
         small: true,
      },
      {
         key: 'heaviest',
         head: 'Heaviest',
         value: (row) => row.heaviestKg,
         align: 'right',
         small: true,
         cell: (row) =>
            row.heaviestKg === null
               ? ''
               : (formatMass(row.heaviestKg, system) ?? ''),
      },
      {
         key: 'heaviestBy',
         head: 'Heaviest by',
         value: (row) => row.heaviestBy,
         small: true,
      },
   ];

   return (
      <Panel
         title="The fish"
         status={state.status}
         ms={state.status === 'read' ? state.reading.ms : undefined}
      >
         {data ? (
            <>
               <div className="grid gap-x-10 gap-y-8 lg:grid-cols-3">
                  {/* Through BarsOrNone like its neighbours: on a database
                      with nothing in it yet a bare baseline reads as a chart
                      that broke, and the two charts beside this one already
                      say so in a sentence. */}
                  <BarsOrNone
                     title="Catches by month, two years"
                     everyOther
                     empty="Nothing logged in the last two years."
                     bars={data.months.map((row) => ({
                        key: row.month,
                        label: MONTHS[Number(row.month.slice(5)) - 1] ?? '',
                        count: row.count,
                     }))}
                  />
                  <Spread
                     title="Length"
                     unit="cm"
                     bars={data.lengths}
                     sentence={
                        data.lengths.length
                           ? null
                           : 'Nothing measured on a tape yet.'
                     }
                  />
                  <Spread
                     title="Weight"
                     unit="kg"
                     bars={data.weights}
                     sentence={
                        data.weights.length ? null : 'Nothing weighed yet.'
                     }
                  />
               </div>

               <div className="mt-10 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                  <div className="blk self-start p-6 text-paper">
                     <span className="lab text-paper-2">Released or kept</span>
                     <p className="g num mt-2 text-[44px] leading-none">
                        {data.keep.released + data.keep.kept === 0
                           ? '0'
                           : `${Math.round(
                                (data.keep.released /
                                   (data.keep.released + data.keep.kept)) *
                                   100
                             )}%`}
                     </p>
                     <p className="mt-1 text-[15px] text-paper-2">
                        put back, of{' '}
                        <span className="num">
                           {data.keep.released + data.keep.kept}
                        </span>{' '}
                        logs that said either way.
                     </p>
                     <div
                        aria-hidden="true"
                        className="mt-5 flex h-2 w-full overflow-hidden bg-paper/15"
                     >
                        <span
                           className="block bg-teal"
                           style={{
                              width: `${
                                 data.keep.released + data.keep.kept === 0
                                    ? 0
                                    : (data.keep.released /
                                         (data.keep.released +
                                            data.keep.kept)) *
                                      100
                              }%`,
                           }}
                        />
                     </div>
                     <dl className="num mt-3 flex justify-between text-[13px] text-paper-2">
                        <div>
                           <dt className="lab text-paper-2">Released</dt>
                           <dd>{data.keep.released}</dd>
                        </div>
                        <div className="text-right">
                           <dt className="lab text-paper-2">Kept</dt>
                           <dd>{data.keep.kept}</dd>
                        </div>
                     </dl>
                  </div>

                  <AdminTable
                     caption="Species"
                     rows={data.species}
                     columns={columns}
                     rowKey={(row) => row.id}
                     searchLabel="Search the species board"
                     searchPlaceholder="A species, or who holds it"
                     csvName="species"
                     initialSort={{ key: 'fish', direction: 'desc' }}
                     empty="No fish logged against a species yet."
                  />
               </div>
            </>
         ) : null}
      </Panel>
   );
}

/* ---- 4. The water -------------------------------------------------------- */

const WATER_WORDS: Record<string, string> = {
   FRESHWATER: 'Fresh',
   SALTWATER: 'Salt',
   BRACKISH: 'Brackish',
   OTHER: 'Other',
   UNKNOWN: 'Not said',
};

function WaterPanel() {
   const state = useSection<Water>('water');
   const data = state.status === 'read' ? state.reading.data : null;

   const columns: Column<SpotRow>[] = [
      {
         key: 'name',
         head: 'Spot',
         value: (row) => row.name,
         cell: (row) => (
            <Link
               to={`/sites/${row.id}`}
               className="g-tracked flex min-h-11 items-center text-[16px] underline-offset-4 hover:underline"
            >
               {row.name}
            </Link>
         ),
      },
      {
         key: 'catches',
         head: 'Catches',
         value: (row) => row.catches,
         align: 'right',
      },
      {
         key: 'water',
         head: 'Water',
         value: (row) => WATER_WORDS[row.waterType ?? 'UNKNOWN'] ?? 'Not said',
         small: true,
      },
      {
         key: 'private',
         head: 'Private',
         value: (row) => (row.visibility === 'PUBLIC' ? 'No' : 'Yes'),
         small: true,
      },
      {
         key: 'owner',
         head: 'Logged by',
         value: (row) => row.owner,
         small: true,
      },
      {
         key: 'likes',
         head: 'Likes',
         value: (row) => row.likes,
         align: 'right',
         small: true,
      },
   ];

   const privateSpots =
      data?.visibility
         .filter((row) => row.key !== 'PUBLIC')
         .reduce((sum, row) => sum + row.count, 0) ?? 0;

   return (
      <Panel
         title="The water"
         status={state.status}
         ms={state.status === 'read' ? state.reading.ms : undefined}
         note="Provinces are read off the map as rectangles, so they are roughly right and no more. No spot's position is sent to this page, private or public."
      >
         {data ? (
            <>
               <div className="grid gap-x-10 gap-y-8 lg:grid-cols-3">
                  <BarsOrNone
                     title="Catches by province, roughly"
                     empty="No catch carries a position yet."
                     bars={data.provinces.map((row) => ({
                        key: row.name,
                        label: row.name
                           .replace('KwaZulu-Natal', 'KZN')
                           .replace('Northern Cape', 'N Cape')
                           .replace('Western Cape', 'W Cape')
                           .replace('Eastern Cape', 'E Cape')
                           .replace('North West', 'NW')
                           .replace('Free State', 'Free St'),
                        count: row.count,
                     }))}
                  />
                  <BarsOrNone
                     title="Spots by water"
                     empty="No spot says what water it is yet."
                     bars={data.waterTypes.map((row) => ({
                        key: row.key,
                        label: WATER_WORDS[row.key] ?? row.key,
                        count: row.count,
                     }))}
                  />
                  <div className="flex flex-col justify-center gap-2">
                     <span className="lab text-ink-3">Kept private</span>
                     <span className="g num text-[44px] leading-none">
                        <CountIn value={privateSpots} durationMs={900} />
                     </span>
                     <span className="text-[15px] text-ink-2">
                        of{' '}
                        <span className="num">
                           {data.visibility.reduce(
                              (sum, row) => sum + row.count,
                              0
                           )}
                        </span>{' '}
                        spots. A private spot is never shown to anyone else.
                     </span>
                  </div>
               </div>

               <div className="mt-10">
                  <AdminTable
                     caption="Busiest spots"
                     rows={data.spots}
                     columns={columns}
                     rowKey={(row) => row.id}
                     searchLabel="Search the spots"
                     searchPlaceholder="A spot, or who logged it"
                     csvName="spots"
                     initialSort={{ key: 'catches', direction: 'desc' }}
                     empty="No spots logged yet."
                  />
               </div>
            </>
         ) : null}
      </Panel>
   );
}

/* ---- 5. The people ------------------------------------------------------- */

const day = (iso: string) =>
   new Date(iso).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
   });

function PeoplePanel() {
   const state = useSection<People>('people');
   const data = state.status === 'read' ? state.reading.data : null;
   const [list, setList] = useState<
      'active' | 'lately' | 'noHandle' | 'noCatch'
   >('active');

   /*
    * The handle is a link, and a handle is a short word, so the link was only
    * as tall as the type in it: twenty two pixels to hit with a thumb. It
    * takes the row's height to be pressed in instead, the way the insights
    * tables already do it, so the target is the full forty four whatever the
    * name happens to be.
    */
   const handleCell = (row: { username: string | null; id: string }) =>
      row.username ? (
         <Link
            to={`/anglers/${row.id}`}
            className="num flex min-h-11 items-center underline-offset-4 hover:underline"
         >
            @{row.username}
         </Link>
      ) : (
         <span className="text-ink-3">None yet</span>
      );

   /*
    * The tick, from here. Optimistic, because the answer is one boolean and
    * the row is in front of the reader: a refusal puts it straight back.
    */
   const [ticks, setTicks] = useState<Record<string, boolean>>({});
   const [ticking, setTicking] = useState<string | null>(null);
   const tickOf = (row: { id: string; verified: boolean }) =>
      ticks[row.id] ?? row.verified;
   const toggleTick = async (row: { id: string; verified: boolean }) => {
      const next = !tickOf(row);
      setTicks((was) => ({ ...was, [row.id]: next }));
      setTicking(row.id);
      try {
         const answer = await setVerified(row.id, next);
         setTicks((was) => ({ ...was, [row.id]: answer.verified }));
      } catch {
         setTicks((was) => ({ ...was, [row.id]: !next }));
      } finally {
         setTicking(null);
      }
   };
   const verifiedColumn: Column<ActiveAngler> = {
      key: 'verified',
      head: 'Verified',
      value: (row) => (tickOf(row) ? 1 : 0),
      cell: (row) => (
         <button
            type="button"
            onClick={() => void toggleTick(row)}
            disabled={ticking === row.id}
            aria-pressed={tickOf(row)}
            className={cn(
               'g-tracked inline-flex min-h-11 items-center gap-2 text-[15px] transition-colors disabled:opacity-50',
               tickOf(row) ? 'text-teal-text' : 'text-ink-3 hover:text-ink'
            )}
         >
            {tickOf(row) ? (
               <VerifiedMark label="Verified" />
            ) : (
               <span
                  aria-hidden="true"
                  className="size-4 rounded-full border border-current"
               />
            )}
            {tickOf(row) ? 'Verified' : 'Verify'}
         </button>
      ),
   };

   const activeColumns: Column<ActiveAngler>[] = [
      {
         key: 'name',
         head: 'Angler',
         value: (row) => row.displayName,
         cell: (row) => (
            <span className="g-tracked text-[16px]">{row.displayName}</span>
         ),
      },
      {
         key: 'handle',
         head: 'Handle',
         value: (row) => row.username,
         cell: handleCell,
      },
      {
         key: 'email',
         head: 'Email',
         value: (row) => row.email,
         small: true,
         cell: (row) => <span className="text-[14px]">{row.email}</span>,
      },
      {
         key: 'catches',
         head: 'Catches',
         value: (row) => row.catches,
         align: 'right',
      },
      {
         key: 'spots',
         head: 'Spots',
         value: (row) => row.spots,
         align: 'right',
         small: true,
      },
      {
         key: 'comments',
         head: 'Comments',
         value: (row) => row.comments,
         align: 'right',
         small: true,
      },
      {
         key: 'followers',
         head: 'Followers',
         value: (row) => row.followers,
         align: 'right',
         small: true,
      },
      verifiedColumn,
   ];

   const joinedColumns: Column<JoinedAngler>[] = [
      {
         key: 'name',
         head: 'Angler',
         value: (row) => row.displayName,
         cell: (row) => (
            <span className="g-tracked text-[16px]">{row.displayName}</span>
         ),
      },
      {
         key: 'handle',
         head: 'Handle',
         value: (row) => row.username,
         cell: handleCell,
      },
      {
         key: 'email',
         head: 'Email',
         value: (row) => row.email,
         cell: (row) => <span className="text-[14px]">{row.email}</span>,
      },
      {
         key: 'joined',
         head: 'Joined',
         value: (row) => row.joinedAt,
         align: 'right',
         small: true,
         cell: (row) => day(row.joinedAt),
      },
   ];

   const LISTS = [
      { key: 'active' as const, label: 'Most active' },
      { key: 'lately' as const, label: 'Joined lately' },
      { key: 'noHandle' as const, label: 'No handle yet' },
      { key: 'noCatch' as const, label: 'No catch yet' },
   ];

   return (
      <Panel
         title="The people"
         status={state.status}
         ms={state.status === 'read' ? state.reading.ms : undefined}
         note="This is the only page in Fisherfeed that shows one person's email address to another, and it shows it to the admin alone."
      >
         {data ? (
            <>
               <dl className="grid grid-cols-3 gap-x-6 gap-y-6">
                  <div className="flex flex-col border-t border-ink pt-2">
                     <dt className="lab text-ink-3">No handle yet</dt>
                     <dd className="g num mt-1 text-[34px] leading-none">
                        {data.counts.noHandle}
                     </dd>
                  </div>
                  <div className="flex flex-col border-t border-ink pt-2">
                     <dt className="lab text-ink-3">No catch yet</dt>
                     <dd className="g num mt-1 text-[34px] leading-none">
                        {data.counts.noCatch}
                     </dd>
                  </div>
                  <div className="flex flex-col border-t border-ink pt-2">
                     <dt className="lab text-ink-3">Unconfirmed</dt>
                     <dd className="g num mt-1 text-[34px] leading-none">
                        {data.counts.unverified}
                     </dd>
                  </div>
               </dl>

               <div
                  role="radiogroup"
                  aria-label="Which anglers to list"
                  className="mt-8 mb-4 flex flex-wrap gap-2"
               >
                  {LISTS.map((option) => (
                     <button
                        key={option.key}
                        type="button"
                        role="radio"
                        aria-checked={list === option.key}
                        onClick={() => setList(option.key)}
                        className={cn(
                           'g-tracked inline-flex h-11 items-center border px-4 text-[15px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
                           list === option.key
                              ? 'border-ink bg-ink text-background'
                              : 'border-line text-ink-2 hover:border-ink hover:text-ink'
                        )}
                     >
                        {option.label}
                     </button>
                  ))}
               </div>

               {/* Keyed on the list, so picking another one starts it fresh.
                   Without the key React keeps the one table and its state, and
                   the next list opened carrying the last one's search box and
                   a sort on a column it does not have, which left it in no
                   order at all rather than newest first. */}
               {list === 'active' ? (
                  <AdminTable
                     key="active"
                     caption="Most active anglers"
                     rows={data.active}
                     columns={activeColumns}
                     rowKey={(row) => row.id}
                     searchLabel="Search the anglers"
                     searchPlaceholder="A name, a handle or an address"
                     csvName="anglers"
                     initialSort={{ key: 'catches', direction: 'desc' }}
                     empty="Nobody has logged anything yet."
                  />
               ) : (
                  <AdminTable
                     key={list}
                     caption={
                        LISTS.find((option) => option.key === list)?.label ??
                        'Anglers'
                     }
                     rows={
                        list === 'lately'
                           ? data.lately
                           : list === 'noHandle'
                             ? data.noHandle
                             : data.noCatch
                     }
                     columns={joinedColumns}
                     rowKey={(row) => row.id}
                     searchLabel="Search the anglers"
                     searchPlaceholder="A name or an address"
                     csvName="anglers"
                     initialSort={{ key: 'joined', direction: 'desc' }}
                     empty="Nobody here."
                  />
               )}
            </>
         ) : null}
      </Panel>
   );
}

/* ---- 6. The health of the thing ------------------------------------------ */

/*
 * What the mailer's own check at boot found out about the sending address,
 * said in words. The raw states read as jargon on the page: "as unknown" was
 * the sentence before this, which tells a reader nothing at all.
 */
const MAIL_DOMAIN_WORDS: Record<string, string> = {
   verified: 'The address it sends from is confirmed.',
   unverified:
      'The address it sends from has not finished verifying, so mail may bounce.',
   missing: 'The address it sends from is not on the account.',
   unknown:
      'The key may not list domains, so the sending address was not checked.',
};

/* The judge's own words for why it did not run, written out for a reader. */
const JUDGE_WORDS: Record<string, string> = {
   no_key: 'No key set',
   no_photo: 'No photograph',
   timeout: 'Claude did not answer in time',
   malformed: 'Claude answered something unreadable',
   refused: 'Claude refused',
   failed: 'The call failed',
   unknown: 'Not recorded',
};

function HealthPanel() {
   const state = useSection<Health>('health');
   const data = state.status === 'read' ? state.reading.data : null;
   const unreachable =
      data?.entries.unchecked
         .filter((row) => row.reason === 'timeout' || row.reason === 'failed')
         .reduce((sum, row) => sum + row.count, 0) ?? 0;

   return (
      <Panel
         title="The health of it"
         status={state.status}
         ms={state.status === 'read' ? state.reading.ms : undefined}
      >
         {data ? (
            <>
               <dl className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="flex flex-col border-t border-ink pt-2">
                     <dt className="lab text-ink-3">Photos</dt>
                     <dd className="g num mt-1 text-[34px] leading-none">
                        {data.photos.total}
                     </dd>
                     <dd className="num mt-1.5 text-[13px] text-ink-2">
                        +{data.photos.d7} this week
                     </dd>
                  </div>
                  <div className="flex flex-col border-t border-ink pt-2">
                     <dt className="lab text-ink-3">On catches</dt>
                     <dd className="g num mt-1 text-[34px] leading-none">
                        {data.photos.onCatches}
                     </dd>
                  </div>
                  <div className="flex flex-col border-t border-ink pt-2">
                     <dt className="lab text-ink-3">On spots</dt>
                     <dd className="g num mt-1 text-[34px] leading-none">
                        {data.photos.onSpots}
                     </dd>
                  </div>
                  <div className="flex flex-col border-t border-ink pt-2">
                     <dt className="lab text-ink-3">Entries</dt>
                     <dd className="g num mt-1 text-[34px] leading-none">
                        {data.entries.total}
                     </dd>
                     <dd className="num mt-1.5 text-[13px] text-ink-2">
                        {data.entries.judged} looked at
                     </dd>
                  </div>
                  <div className="flex flex-col border-t border-ink pt-2">
                     <dt className="lab text-ink-3">Species on file</dt>
                     <dd className="g num mt-1 text-[34px] leading-none">
                        {data.reference.species}
                     </dd>
                  </div>
                  <div className="flex flex-col border-t border-ink pt-2">
                     <dt className="lab text-ink-3">Feed posts</dt>
                     <dd className="g num mt-1 text-[34px] leading-none">
                        {data.reference.feedPosts}
                     </dd>
                  </div>
               </dl>

               <p className="mt-3 text-[14px] text-ink-3">
                  No byte size is stored against a photograph, so how much room
                  they take is not a figure this page can honestly give.
               </p>

               <div className="mt-10 grid gap-x-10 gap-y-8 lg:grid-cols-3">
                  <BarsOrNone
                     title="Competitions"
                     empty="Nobody has run a competition yet."
                     bars={data.competitions.map((row) => ({
                        key: row.key,
                        label:
                           row.key.charAt(0) + row.key.slice(1).toLowerCase(),
                        count: row.count,
                     }))}
                  />
                  <BarsOrNone
                     title="Entries, by what became of them"
                     empty="No catch has been entered in a competition yet."
                     bars={data.entries.byState.map((row) => ({
                        key: row.key,
                        label:
                           row.key.charAt(0) + row.key.slice(1).toLowerCase(),
                        count: row.count,
                     }))}
                  />
                  <BarsOrNone
                     title="Browsers signed up for a nudge"
                     empty="No browser has turned notifications on yet."
                     bars={data.push.map((row) => ({
                        key: row.kind,
                        label: row.kind,
                        count: row.count,
                     }))}
                  />
               </div>

               <div className="mt-10 grid gap-x-10 gap-y-8 lg:grid-cols-2">
                  <div>
                     <h3 className="lab text-ink-3">The judge</h3>
                     <p className="mt-2 text-[15px] text-ink-2">
                        Claude is{' '}
                        <span
                           className={cn(
                              data.build.claude === 'ready'
                                 ? 'text-teal-text'
                                 : 'text-ink'
                           )}
                        >
                           {data.build.claude === 'ready'
                              ? 'reachable'
                              : 'not set up on this server'}
                        </span>
                        .{' '}
                        {unreachable
                           ? `${unreachable} ${
                                unreachable === 1 ? 'entry' : 'entries'
                             } went unjudged because the call did not come back.`
                           : 'No entry has gone unjudged for want of an answer.'}
                     </p>
                     {data.entries.unchecked.length ? (
                        <dl className="mt-3">
                           {data.entries.unchecked.map((row) => (
                              <div
                                 key={row.reason}
                                 className="flex items-baseline justify-between gap-4 border-t border-line py-2"
                              >
                                 <dt className="text-[15px]">
                                    {JUDGE_WORDS[row.reason] ?? row.reason}
                                 </dt>
                                 <dd className="num text-[15px]">
                                    {row.count}
                                 </dd>
                              </div>
                           ))}
                        </dl>
                     ) : null}
                  </div>

                  <div>
                     <h3 className="lab text-ink-3">Mail</h3>
                     <p className="mt-2 text-[15px] text-ink-2">
                        {data.mail.transport === 'resend'
                           ? `Going out through Resend. ${
                                MAIL_DOMAIN_WORDS[
                                   data.mail.domain ?? 'unknown'
                                ] ?? MAIL_DOMAIN_WORDS.unknown
                             }`
                           : 'Nothing is being sent from here: this build writes mail to its own log instead.'}{' '}
                        The list below is only what this server has sent since
                        it last started, so an empty list is not a quiet week.
                     </p>
                     {data.mail.recent.length ? (
                        <dl className="mt-3">
                           {data.mail.recent.slice(0, 8).map((sent, i) => (
                              <div
                                 key={`${sent.sentAt}-${i}`}
                                 className="flex items-baseline justify-between gap-4 border-t border-line py-2"
                              >
                                 <dt className="min-w-0 truncate text-[15px]">
                                    <span className="g-tracked">
                                       {sent.kind}
                                    </span>
                                    <span className="num ml-2 text-[13px] text-ink-3">
                                       {sent.to}
                                    </span>
                                 </dt>
                                 <dd
                                    className={cn(
                                       'shrink-0 text-[13px]',
                                       sent.state === 'failed'
                                          ? 'text-destructive'
                                          : 'text-ink-3'
                                    )}
                                 >
                                    {sent.state}
                                 </dd>
                              </div>
                           ))}
                        </dl>
                     ) : (
                        <p className="mt-3 text-[15px] text-ink-3">
                           Nothing sent since this server started.
                        </p>
                     )}
                  </div>
               </div>
            </>
         ) : null}
      </Panel>
   );
}
