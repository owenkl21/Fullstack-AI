import { useLoadOnScroll } from '@/lib/load-on-scroll';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useRevealIn } from '@/components/brand/Reveal';
import { Chip } from '@/components/fishing/rows/Chip';
import { RowList } from '@/components/fishing/rows/Row';
import { SpotRow, type SpotRowItem } from '@/components/fishing/rows/SpotRow';
import { plural, timeOf } from '@/components/fishing/rows/format';
import { EmptyState } from '@/components/states/EmptyState';
import { InlineError } from '@/components/states/InlineError';
import { ListSkeleton } from '@/components/states/ListSkeleton';
import { NoMatchState } from '@/components/states/NoMatchState';
import { useShowMore } from '@/components/states/useShowMore';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/title';
import { SpotsMap } from '@/components/map/SpotsMap';
import { SearchField } from '@/components/fishing/rows/SearchField';

/*
 * The places the angler fishes, in the same row grammar as the catches, with the
 * most recently fished at the top. The map is named but not faked: until the pins
 * are real the toggle says so and sends you back to the list.
 */

type SiteSummary = SpotRowItem & {
   images: { image: { id: string; url: string } }[];
};

type LoadStatus = 'loading' | 'ready' | 'error';

const LOAD_FAILED = 'Could not load your spots.';

export function MySitesPage() {
   useDocumentTitle('My spots');

   return (
      <RequireSignIn what="your spots">
         <MySitesList />
      </RequireSignIn>
   );
}

function MySitesList() {
   const navigate = useNavigate();
   const root = useRef<HTMLElement>(null);
   useRevealIn(root);

   const [params, setParams] = useSearchParams();
   const [items, setItems] = useState<SiteSummary[]>([]);
   const [status, setStatus] = useState<LoadStatus>('loading');

   const query = params.get('q') ?? '';
   const onMap = params.get('view') === 'map';
   const { shown, showMore } = useShowMore(query);

   const [attempt, setAttempt] = useState(0);

   useEffect(() => {
      let cancelled = false;

      axios
         .get('/api/sites/me')
         .then(({ data }) => {
            if (cancelled) {
               return;
            }

            setItems(data.sites ?? []);
            setStatus('ready');
         })
         .catch((error: unknown) => {
            if (cancelled) {
               return;
            }

            console.error(error);
            setStatus('error');
         });

      return () => {
         cancelled = true;
      };
   }, [attempt]);

   /* Try again keeps the skeleton honest: the count moves, so the skeleton remounts
    * and starts its five seconds over rather than staying on the old error. */
   const retry = useCallback(() => {
      setStatus('loading');
      setAttempt((current) => current + 1);
   }, []);

   const setParam = useCallback(
      (key: string, value: string) => {
         setParams(
            (previous) => {
               const next = new URLSearchParams(previous);
               if (value) {
                  next.set(key, value);
               } else {
                  next.delete(key);
               }
               return next;
            },
            { replace: true }
         );
      },
      [setParams]
   );

   const filtered = useMemo(() => {
      const needle = query.trim().toLowerCase();

      /* TODO(api): sorted by the last catch where the endpoint sends one, and by the
       * day the spot was saved where it does not (appendix E, B3). */
      return items
         .filter((entry) =>
            needle ? entry.name.toLowerCase().includes(needle) : true
         )
         .sort(
            (a, b) =>
               timeOf(b.lastCatchAt ?? b.createdAt) -
               timeOf(a.lastCatchAt ?? a.createdAt)
         );
   }, [items, query]);

   const total = plural(items.length, 'spot');
   const countLine = query.trim() ? `${filtered.length} of ${total}` : total;
   const visible = filtered.slice(0, shown);
   const moreSentinel = useLoadOnScroll(
      () => showMore(),
      filtered.length > visible.length
   );
   /* The map shows every saved spot, not just the page of rows on screen. */
   const pins = useMemo(
      () =>
         items.flatMap((entry) =>
            entry.latitude != null && entry.longitude != null
               ? [
                    {
                       id: entry.id,
                       name: entry.name,
                       latitude: entry.latitude,
                       longitude: entry.longitude,
                       catchCount: entry.catchCount,
                    },
                 ]
               : []
         ),
      [items]
   );
   const withoutPosition = items.length - pins.length;

   return (
      <section
         ref={root}
         className="mx-auto w-[min(1680px,100%-32px)] py-10 md:py-14"
      >
         <header className="rv">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
               <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h1 className="g text-[44px] md:text-[56px]">My spots</h1>
                  {status === 'ready' ? (
                     <p className="lab num">{countLine}</p>
                  ) : null}
               </div>
               {status === 'ready' && items.length > 0 ? (
                  <Button asChild>
                     <Link to="/sites/new">Add a spot</Link>
                  </Button>
               ) : null}
            </div>

            {onMap || status !== 'ready' || items.length === 0 ? null : (
               <div className="mt-8">
                  <SearchField
                     id="spot-search"
                     label="Search your spots"
                     placeholder="Spot name or note"
                     value={query}
                     onChange={(next) => setParam('q', next)}
                  />
               </div>
            )}

            {status === 'ready' ? (
               <div
                  className="mt-6 flex flex-wrap gap-2"
                  role="group"
                  aria-label="How to show your spots"
               >
                  <Chip pressed={!onMap} onClick={() => setParam('view', '')}>
                     List
                  </Chip>
                  <Chip pressed={onMap} onClick={() => setParam('view', 'map')}>
                     Map
                  </Chip>
               </div>
            ) : null}
         </header>

         <div className="mt-8">
            {/*
             * Status first, view second. Checking the view first made the map
             * tab unable to show loading or error at all: a slow fetch showed
             * the "nothing to map" sentence for its whole duration, and a
             * failed one showed it instead of the error. An empty log also got
             * told to edit a spot it did not have.
             */}
            {status === 'loading' ? (
               <ListSkeleton
                  key={attempt}
                  label="Loading your spots"
                  errorMessage={LOAD_FAILED}
                  onRetry={retry}
               />
            ) : status === 'error' ? (
               <InlineError message={LOAD_FAILED} onRetry={retry} />
            ) : onMap ? (
               /*
                * The map is drawn whether or not a spot has a position. It
                * carries private marks and the ramps and tackle shops around
                * you now, so it is worth opening on its own, and refusing to
                * draw it until somebody has pinned a spot hid all of that
                * behind a chore.
                */
               <>
                  <SpotsMap
                     spots={pins}
                     onOpen={(id) => navigate(`/sites/${id}`)}
                  />
                  {withoutPosition > 0 ? (
                     <p className="mt-3 text-[15px] text-ink-2">
                        {withoutPosition === 1
                           ? 'One spot has no position saved, so it is not on the map. Edit it to drop a pin.'
                           : `${withoutPosition} spots have no position saved, so they are not on the map. Edit them to drop a pin.`}
                     </p>
                  ) : null}
               </>
            ) : items.length === 0 ? (
               <EmptyState
                  sentence="No spots saved yet, and a spot is what a catch gets logged against."
                  actionLabel="Add a spot"
                  to="/sites/new"
               />
            ) : filtered.length === 0 ? (
               <NoMatchState
                  sentence="No spot matches that search."
                  onClear={() => setParam('q', '')}
               />
            ) : (
               <>
                  <RowList>
                     {visible.map((entry) => (
                        <SpotRow
                           key={entry.id}
                           item={entry}
                           photoUrl={entry.images[0]?.image.url ?? null}
                        />
                     ))}
                  </RowList>

                  <div ref={moreSentinel} aria-hidden="true" className="h-px" />
                  {filtered.length > visible.length ? (
                     <p className="lab num mt-4 border-t border-line pt-4">
                        Showing {visible.length} of {filtered.length} spots
                     </p>
                  ) : null}
               </>
            )}
         </div>
      </section>
   );
}
