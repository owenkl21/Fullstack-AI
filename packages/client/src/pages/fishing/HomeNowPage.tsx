import {
   useCallback,
   useEffect,
   useRef,
   useState,
   type CSSProperties,
} from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useRevealIn } from '@/components/brand/Reveal';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/title';
import {
   fetchConditions,
   fetchMyCatches,
   toReadouts,
   type CatchSummary,
   type WeatherSnapshot,
} from '@/components/fishing/record/api';
import { formatClock, formatDay } from '@/components/fishing/record/format';
import { HomeSkeleton } from '@/components/fishing/home/HomeSkeleton';
import { LogSays } from '@/components/fishing/home/LogSays';
import {
   Readouts,
   type ConditionsStatus,
} from '@/components/fishing/home/Readouts';
import { RecentRows } from '@/components/fishing/home/RecentRows';
import { SeasonStrip } from '@/components/fishing/home/SeasonStrip';
import { SpotHeader } from '@/components/fishing/home/SpotHeader';
import {
   logSentence,
   seasonCount,
   seasonItems,
   sortByNewest,
} from '@/components/fishing/home/summary';
import { usePosition } from '@/lib/position';
import { namePlace } from '@/components/forecast/forecast-api';

const FALLBACK_PHOTO = '/photos/spot-rock-ocean.jpg';

export function HomeNowPage() {
   useDocumentTitle('Your log');
   return (
      <RequireSignIn what="your log">
         <HomeNow />
      </RequireSignIn>
   );
}

type LogState =
   | { status: 'loading'; catches: CatchSummary[] }
   | { status: 'ready'; catches: CatchSummary[] }
   | { status: 'error'; catches: CatchSummary[] };

const LOADING: LogState = { status: 'loading', catches: [] };

function useMyCatches() {
   const [attempt, setAttempt] = useState(0);
   const [result, setResult] = useState<{
      attempt: number;
      value: LogState;
   } | null>(null);

   useEffect(() => {
      const controller = new AbortController();
      let done = false;

      // The skeleton times out into a sentence with a way forward.
      const timer = window.setTimeout(() => {
         if (!done) {
            setResult({ attempt, value: { status: 'error', catches: [] } });
         }
      }, 5000);

      const load = async () => {
         try {
            const list = await fetchMyCatches(controller.signal);
            done = true;
            setResult({ attempt, value: { status: 'ready', catches: list } });
         } catch (error) {
            if (axios.isCancel(error)) {
               return;
            }
            done = true;
            setResult({ attempt, value: { status: 'error', catches: [] } });
         } finally {
            window.clearTimeout(timer);
         }
      };

      void load();
      return () => {
         window.clearTimeout(timer);
         controller.abort();
      };
   }, [attempt]);

   const state = result?.attempt === attempt ? result.value : LOADING;

   return { ...state, retry: () => setAttempt((count) => count + 1) };
}

/*
 * The conditions where the angler is.
 *
 * The prompt is still only ever raised by a tap, but the answer is remembered:
 * once the browser has been told yes, arriving here loads the conditions
 * straight away instead of asking again. Being asked for a position on every
 * visit to your own home page is the thing this fixes.
 */
function useConditions() {
   const { fix, state: positionState, ask } = usePosition();
   const [status, setStatus] = useState<ConditionsStatus>('idle');
   const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
   const [takenAt, setTakenAt] = useState<string | null>(null);
   const [place, setPlace] = useState<string | null>(null);

   /* The name of where that is. Separate from the reading, and never in its
    * way: the figures show whether or not the name comes back. */
   useEffect(() => {
      if (!fix) return;
      const controller = new AbortController();
      namePlace(fix.latitude, fix.longitude, controller.signal)
         .then((found) => setPlace(found?.name ?? null))
         .catch(() => undefined);
      return () => controller.abort();
   }, [fix?.latitude, fix?.longitude]);

   /* Whenever a position is known, fetch for it. A newer fix replaces the
    * reading rather than leaving a stale one on screen. */
   useEffect(() => {
      if (!fix) {
         return;
      }

      let cancelled = false;
      setStatus((was) => (was === 'ready' ? was : 'loading'));

      const load = async () => {
         try {
            const weather = await fetchConditions(fix.latitude, fix.longitude);
            if (cancelled) return;
            if (!weather) {
               setStatus('error');
               return;
            }
            setSnapshot(weather);
            setTakenAt(formatClock(new Date()));
            setStatus('ready');
         } catch {
            if (!cancelled) setStatus('error');
         }
      };

      void load();
      return () => {
         cancelled = true;
      };
   }, [fix?.latitude, fix?.longitude, fix?.at]);

   useEffect(() => {
      if (positionState === 'denied' || positionState === 'unsupported') {
         setStatus('denied');
      } else if (positionState === 'asking' && !fix) {
         setStatus('locating');
      }
   }, [positionState, fix]);

   const request = useCallback(() => {
      void ask();
   }, [ask]);

   return {
      status,
      readouts: snapshot ? toReadouts(snapshot) : null,
      snapshot,
      takenAt,
      place,
      request,
   };
}

function HomeNow() {
   const log = useMyCatches();
   const conditions = useConditions();
   const sorted = sortByNewest(log.catches);
   const recent = sorted[0];
   const today = formatDay(new Date()) ?? '';

   if (log.status === 'loading') {
      return <HomeSkeleton />;
   }

   return (
      <>
         {/*
          * The plate names where you are, because that is the question the
          * conditions under it answer. Under the name: when you last fished
          * and where, the latest catch the reader is allowed to see.
          */}
         <SpotHeader
            photoUrl={recent?.images[0]?.image.url ?? FALLBACK_PHOTO}
            spotName={
               conditions.place ??
               (conditions.status === 'ready' ? 'Where you are' : 'Your log')
            }
            today={today}
            lastFished={
               recent ? `Last fished ${formatDay(recent.caughtAt)}` : null
            }
            /* The latest catch that was at a spot; a pin-only catch has no name to give. */
            lastSpot={sorted.find((entry) => entry.site)?.site?.name ?? null}
         />
         <div className="mx-auto w-full max-w-[1400px]">
            <Readouts
               status={conditions.status}
               readouts={conditions.readouts}
               takenAt={conditions.takenAt}
               place={conditions.place}
               snapshot={conditions.snapshot}
               onRequest={conditions.request}
            />
            {log.status === 'error' ? (
               <section className="px-4 pt-6 pb-10 md:px-8">
                  <p className="max-w-[46ch] text-[15px] text-ink-2">
                     Could not load your catches. The log is safe, the
                     connection was not.
                  </p>
                  <Button
                     type="button"
                     variant="outline"
                     className="mt-4"
                     onClick={log.retry}
                  >
                     Try again
                  </Button>
               </section>
            ) : sorted.length === 0 ? (
               <section className="px-4 pt-6 pb-10 md:px-8">
                  <h2 className="g text-[30px]">Nothing logged yet</h2>
                  <p className="mt-2 max-w-[46ch] text-[15px] text-ink-2">
                     The first catch you log is the whole tour. The clock, the
                     place and the conditions are stamped for you.
                  </p>
                  <Button asChild size="lg" className="mt-4">
                     <Link to="/log">Log a catch</Link>
                  </Button>
               </section>
            ) : (
               <LoadedHome catches={sorted} />
            )}
         </div>
      </>
   );
}

function LoadedHome({ catches }: { catches: CatchSummary[] }) {
   const root = useRef<HTMLDivElement>(null);
   useRevealIn(root);

   const sentence = logSentence(catches);
   const season = seasonItems(catches);
   const recent = catches.slice(0, 5);

   return (
      <div ref={root} className="pb-10">
         {sentence ? (
            <div className="rv">
               <LogSays sentence={sentence} />
            </div>
         ) : null}
         {season.length > 0 ? (
            <div className="rv" style={{ '--i': 1 } as CSSProperties}>
               <SeasonStrip items={season} count={seasonCount(catches)} />
            </div>
         ) : null}
         <div className="rv" style={{ '--i': 2 } as CSSProperties}>
            <RecentRows catches={recent} total={catches.length} />
         </div>
      </div>
   );
}
