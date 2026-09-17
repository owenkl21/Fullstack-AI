import { useLoadOnScroll } from '@/lib/load-on-scroll';
import { PageHead } from '@/components/brand/PageHead';
import { removeDraft, useDrafts } from '@/lib/drafts';
import { formatStamp } from '@/components/fishing/record/format';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useRevealIn } from '@/components/brand/Reveal';
import {
   CatchRow,
   type CatchRowItem,
} from '@/components/fishing/rows/CatchRow';
import { Chip } from '@/components/fishing/rows/Chip';
import { RowList } from '@/components/fishing/rows/Row';
import { plural, timeOf, yearOf } from '@/components/fishing/rows/format';
import { EmptyState } from '@/components/states/EmptyState';
import { InlineError } from '@/components/states/InlineError';
import { ListSkeleton } from '@/components/states/ListSkeleton';
import { NoMatchState } from '@/components/states/NoMatchState';
import { useShowMore } from '@/components/states/useShowMore';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { useDocumentTitle } from '@/lib/title';
import { SearchField } from '@/components/fishing/rows/SearchField';

/*
 * The angler's own log. One column of rows with a hairline between them, the count
 * beside the heading, a search and a year filter that both live in the URL so a
 * filtered log can be sent to somebody or kept in a tab. Edit and delete are not
 * here: they belong to the record, where the fish is.
 */

type CatchSummary = CatchRowItem & {
   /* TODO(api): the row wants the species, which listMyCatches does not select
    * (appendix E, A1). Until then the title the angler typed is the row title. */
   images: { image: { id: string; url: string } }[];
};

type LoadStatus = 'loading' | 'ready' | 'error';

const LOAD_FAILED = 'Could not load your catches.';

export function MyCatchesPage() {
   useDocumentTitle('My catches');

   return (
      <RequireSignIn what="your catches">
         <MyCatchesList />
      </RequireSignIn>
   );
}

function MyCatchesList() {
   const root = useRef<HTMLElement>(null);
   useRevealIn(root);

   const [params, setParams] = useSearchParams();
   const [items, setItems] = useState<CatchSummary[]>([]);
   const [status, setStatus] = useState<LoadStatus>('loading');

   const query = params.get('q') ?? '';
   const year = params.get('year') ?? '';
   const justSaved = params.get('new') ?? '';
   const { shown, showMore } = useShowMore(`${query}|${year}`);

   /* The row that just landed keeps its teal rule for four seconds, then lets go. */
   const [faded, setFaded] = useState('');
   const marked = justSaved && faded !== justSaved ? justSaved : '';

   useEffect(() => {
      if (!justSaved) {
         return;
      }

      const timer = window.setTimeout(() => setFaded(justSaved), 4000);
      return () => window.clearTimeout(timer);
   }, [justSaved]);

   const [attempt, setAttempt] = useState(0);

   useEffect(() => {
      let cancelled = false;

      axios
         .get('/api/catches/me')
         .then(({ data }) => {
            if (cancelled) {
               return;
            }

            setItems(data.catches ?? []);
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
               next.delete('new');
               return next;
            },
            { replace: true }
         );
      },
      [setParams]
   );

   const clearFilters = useCallback(() => {
      setParams(new URLSearchParams(), { replace: true });
   }, [setParams]);

   const years = useMemo(() => {
      const counts = new Map<string, number>();
      items.forEach((entry) => {
         const value = yearOf(entry.caughtAt);
         if (value) {
            counts.set(value, (counts.get(value) ?? 0) + 1);
         }
      });

      return Array.from(counts.entries()).sort(
         (a, b) => Number(b[0]) - Number(a[0])
      );
   }, [items]);

   const filtered = useMemo(() => {
      const needle = query.trim().toLowerCase();

      return items
         .filter((entry) => (year ? yearOf(entry.caughtAt) === year : true))
         .filter((entry) => {
            if (!needle) {
               return true;
            }

            return [entry.title, entry.site?.name ?? ''].some((value) =>
               value.toLowerCase().includes(needle)
            );
         })
         .sort((a, b) => timeOf(b.caughtAt) - timeOf(a.caughtAt));
   }, [items, query, year]);

   const narrowed = Boolean(query.trim() || year);
   const total = plural(items.length, 'catch', 'catches');
   const countLine = narrowed ? `${filtered.length} of ${total}` : total;
   const visible = filtered.slice(0, shown);
   const moreSentinel = useLoadOnScroll(
      () => showMore(),
      filtered.length > visible.length
   );

   return (
      <section
         ref={root}
         className="relative mx-auto w-[min(1680px,100%-32px)] pb-10 md:pb-14"
      >
         <PageHead
            kicker="Your log"
            title="My catches"
            aside={
               status === 'ready' ? (
                  <span className="lab num text-paper-2">{countLine}</span>
               ) : null
            }
         />
         <header className="rv">
            <Drafts />

            {status === 'ready' && items.length > 0 ? (
               <div className="mt-8">
                  <SearchField
                     id="catch-search"
                     label="Search your catches"
                     placeholder="Species, spot or note"
                     value={query}
                     onChange={(next) => setParam('q', next)}
                  />
               </div>
            ) : null}

            {years.length > 1 ? (
               <div
                  className="mt-6 flex flex-wrap gap-2"
                  role="group"
                  aria-label="Filter by year"
               >
                  <Chip
                     pressed={!year}
                     count={items.length}
                     onClick={() => setParam('year', '')}
                  >
                     All
                  </Chip>
                  {years.map(([value, count]) => (
                     <Chip
                        key={value}
                        pressed={year === value}
                        count={count}
                        onClick={() =>
                           setParam('year', year === value ? '' : value)
                        }
                     >
                        {value}
                     </Chip>
                  ))}
               </div>
            ) : null}
         </header>

         <div className="mt-8">
            {status === 'loading' ? (
               <ListSkeleton
                  key={attempt}
                  label="Loading your catches"
                  errorMessage={LOAD_FAILED}
                  onRetry={retry}
               />
            ) : status === 'error' ? (
               <InlineError message={LOAD_FAILED} onRetry={retry} />
            ) : items.length === 0 ? (
               <EmptyState
                  sentence="Nothing in your log yet."
                  actionLabel="Log a catch"
                  to="/log"
               />
            ) : filtered.length === 0 ? (
               <NoMatchState
                  sentence={
                     query.trim()
                        ? 'No catch matches that search.'
                        : `Nothing logged in ${year}.`
                  }
                  clearLabel={query.trim() ? 'Clear search' : 'Show every year'}
                  onClear={clearFilters}
               />
            ) : (
               <>
                  <RowList>
                     {visible.map((entry) => (
                        <CatchRow
                           key={entry.id}
                           item={entry}
                           photoUrl={entry.images[0]?.image.url ?? null}
                           marked={marked === entry.id}
                        />
                     ))}
                  </RowList>

                  <div ref={moreSentinel} aria-hidden="true" className="h-px" />
                  {filtered.length > visible.length ? (
                     <p className="lab num mt-4 border-t border-line pt-4">
                        Showing {visible.length} of {filtered.length} catches
                     </p>
                  ) : null}
               </>
            )}
         </div>
      </section>
   );
}

/*
 * Catches half written, kept in this browser. Each opens the form it was
 * started in with everything still filled.
 */
function Drafts() {
   const drafts = useDrafts();
   if (drafts.length === 0) return null;
   return (
      <section
         aria-labelledby="drafts-heading"
         className="mt-8 border-l-[3px] border-teal bg-bg-2 px-4 py-3"
      >
         <div className="flex items-baseline justify-between gap-4">
            <h2 id="drafts-heading" className="lab">
               Drafts
            </h2>
            <span className="lab num text-ink-3">{drafts.length}</span>
         </div>
         <ul className="mt-2 flex flex-col">
            {drafts.map((draft) => (
               <li
                  key={draft.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line/60 py-2 first:border-t-0"
               >
                  <span className="flex min-w-0 flex-col">
                     <span className="g-tracked text-[19px]">
                        {draft.title}
                     </span>
                     <span className="text-[13px] text-ink-3">
                        {draft.kind === 'quick' ? 'Quick log' : 'Full form'} ·
                        saved {formatStamp(draft.savedAt)}
                     </span>
                  </span>
                  <span className="flex items-center gap-4">
                     <Link
                        to={`${draft.kind === 'quick' ? '/log' : '/catches/new'}?draft=${draft.id}`}
                        className="g-tracked text-[17px] text-teal-text hover:opacity-80"
                     >
                        Continue
                     </Link>
                     <button
                        type="button"
                        onClick={() => removeDraft(draft.id)}
                        className="g-tracked text-[15px] text-ink-3 hover:text-ink"
                     >
                        Discard
                     </button>
                  </span>
               </li>
            ))}
         </ul>
      </section>
   );
}
