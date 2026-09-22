import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import {
   Link,
   useLocation,
   useNavigationType,
   useSearchParams,
} from 'react-router-dom';
import { Img } from '@/components/Img';
import { PageHead } from '@/components/brand/PageHead';
import { SearchField } from '@/components/fishing/rows/SearchField';
import { VerifiedMark } from '@/components/profile/VerifiedMark';
import {
   initialOf,
   plural,
   type AnglerResult,
} from '@/components/profile/types';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { InlineError } from '@/components/states/InlineError';
import { NoMatchState } from '@/components/states/NoMatchState';
import { PlainState } from '@/components/states/PlainState';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useLoadOnScroll } from '@/lib/load-on-scroll';
import { useDocumentTitle } from '@/lib/title';
import { cn } from '@/lib/utils';

/*
 * Other anglers, found by name or handle, and followed from the list.
 *
 * Before this the only way to reach somebody was to find a post of theirs in
 * the feed. The search asks once the typing stops, and the address carries
 * the search, so a result can be opened and Back lands on the same list.
 * Nothing typed shows the most followed anglers the reader does not follow
 * yet, so the page never opens on an empty box.
 */

type SearchPage = {
   users: AnglerResult[];
   nextCursor: string | null;
   suggested: boolean;
};

type View =
   | { key: string; status: 'ready'; page: SearchPage }
   | { key: string; status: 'error' };

const SEARCH_DEBOUNCE_MS = 300;
/* As far as the server reads. Past this a pasted paragraph would only ride
 * along in the address for nothing. */
const SEARCH_MAX = 60;
const LOAD_FAILED = 'Could not search anglers just now.';

export function AnglersPage() {
   useDocumentTitle('Find anglers');

   /* Behind sign-in like the profiles it links to, which need it too. */
   return (
      <RequireSignIn what="other anglers">
         <AnglerSearch />
      </RequireSignIn>
   );
}

function AnglerSearch() {
   const [params, setParams] = useSearchParams();
   const query = (params.get('q') ?? '').trim();
   const location = useLocation();
   const arrivedBy = useNavigationType();

   /* Capped here too: a link can carry a longer q than the box lets anyone
    * type, and the box would then shed most of it at the first key. */
   const [input, setInput] = useState(() =>
      (params.get('q') ?? '').slice(0, SEARCH_MAX)
   );
   const [seenKey, setSeenKey] = useState(location.key);

   /*
    * The box writes the address, and now and then the address changes under
    * the box: Find anglers in the account panel while a search is up, or Back
    * to an earlier one. The box used to win, and wrote its old text straight
    * back over the address it had just been sent to. Any arrival that is not
    * one of the box's own writes is followed instead.
    */
   if (seenKey !== location.key) {
      setSeenKey(location.key);

      const own =
         arrivedBy === 'REPLACE' &&
         (location.state as { typed?: boolean } | null)?.typed === true;
      if (!own) setInput(query.slice(0, SEARCH_MAX));
   }
   const [attempt, setAttempt] = useState(0);
   const [view, setView] = useState<View | null>(null);
   const [more, setMore] = useState<{
      key: string;
      state: 'loading' | 'error';
   } | null>(null);
   const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());

   const key = `${query}:${attempt}`;

   const writeQuery = useCallback(
      (next: string) => {
         setParams(
            (previous) => {
               const updated = new URLSearchParams(previous);
               if (next) {
                  updated.set('q', next);
               } else {
                  updated.delete('q');
               }
               return updated;
            },
            /* Replaced, not pushed, so Back leaves the page rather than
             * stepping back through every letter typed. Marked as typed, so
             * the box knows its own writes from an arrival. */
            { replace: true, state: { typed: true } }
         );
      },
      [setParams]
   );

   useEffect(() => {
      const next = input.trim();
      if (next === query) return;

      const timer = window.setTimeout(
         () => writeQuery(next),
         SEARCH_DEBOUNCE_MS
      );
      return () => window.clearTimeout(timer);
   }, [input, query, writeQuery]);

   useEffect(() => {
      const controller = new AbortController();

      axios
         .get<SearchPage>('/api/users/search', {
            params: query ? { q: query } : undefined,
            signal: controller.signal,
         })
         .then(({ data }) => setView({ key, status: 'ready', page: data }))
         .catch((error: unknown) => {
            if (axios.isCancel(error)) return;
            console.error(error);
            setView({ key, status: 'error' });
         });

      return () => controller.abort();
   }, [key, query]);

   /*
    * The answer for what is in the box now. While the next one is on its way
    * the last list stays up, dimmed, rather than flashing a skeleton at every
    * letter; the skeleton is only for the very first read.
    */
   const current = view?.key === key ? view : null;
   const shown = current ?? (view?.status === 'ready' ? view : null);
   const moreState = more?.key === key ? more.state : 'idle';
   const nextCursor =
      current?.status === 'ready' ? current.page.nextCursor : null;

   const loadMore = useCallback(() => {
      if (!nextCursor || moreState === 'loading') return;

      setMore({ key, state: 'loading' });

      axios
         .get<SearchPage>('/api/users/search', {
            params: { q: query, cursor: nextCursor },
         })
         .then(({ data }) => {
            setView((previous) => {
               if (previous?.key !== key || previous.status !== 'ready') {
                  return previous;
               }
               /* The ranks can shift while somebody is gaining followers,
                * so a person already listed is never listed twice. */
               const listed = new Set(previous.page.users.map((u) => u.id));
               return {
                  ...previous,
                  page: {
                     ...data,
                     users: [
                        ...previous.page.users,
                        ...data.users.filter((u) => !listed.has(u.id)),
                     ],
                  },
               };
            });
            setMore((was) => (was?.key === key ? null : was));
         })
         .catch((error: unknown) => {
            console.error(error);
            setMore((was) =>
               was?.key === key ? { key, state: 'error' } : was
            );
         });
   }, [key, moreState, nextCursor, query]);

   const sentinel = useLoadOnScroll(
      loadMore,
      Boolean(nextCursor) && moreState === 'idle'
   );

   const patchPerson = (
      id: string,
      patch: (person: AnglerResult) => AnglerResult
   ) =>
      setView((previous) =>
         previous?.status === 'ready'
            ? {
                 ...previous,
                 page: {
                    ...previous.page,
                    users: previous.page.users.map((person) =>
                       person.id === id ? patch(person) : person
                    ),
                 },
              }
            : previous
      );

   /* Optimistic, as on a profile: the label and the count move at once and
    * go back if the server says no. */
   const toggleFollow = async (person: AnglerResult) => {
      if (busy.has(person.id)) return;

      const was = person.followedByMe;
      const followed = (following: boolean) => (p: AnglerResult) => ({
         ...p,
         followedByMe: following,
         followersCount: Math.max(0, p.followersCount + (following ? 1 : -1)),
      });

      setBusy((ids) => new Set(ids).add(person.id));
      patchPerson(person.id, followed(!was));

      try {
         await axios[was ? 'delete' : 'post'](`/api/users/${person.id}/follow`);
      } catch {
         patchPerson(person.id, followed(was));
         toast({
            title: was
               ? `Could not unfollow ${person.displayName}. Try again.`
               : `Could not follow ${person.displayName}. Try again.`,
            variant: 'error',
         });
      } finally {
         setBusy((ids) => {
            const next = new Set(ids);
            next.delete(person.id);
            return next;
         });
      }
   };

   const clear = () => {
      setInput('');
      writeQuery('');
   };

   return (
      <section className="relative mx-auto w-[min(960px,100%-32px)] pb-10 md:pb-14">
         {/* The same plate and waterline every other list opens on, kept to
             this page's narrower column so the title lines up with the rows. */}
         <PageHead
            column="w-[min(960px,100%-32px)]"
            kicker="Who else is out"
            title="Find anglers"
            lede="Search by name, or start with @ to search by handle."
         />
         <header>
            <div>
               <SearchField
                  id="angler-search"
                  label="Search anglers by name or handle"
                  placeholder="Name or @handle"
                  value={input}
                  onChange={(next) => setInput(next.slice(0, SEARCH_MAX))}
               />
            </div>
         </header>

         {/* The list changes under the box without a word, so a screen reader
             is told how the search came out once the answer is in. Always in
             the page, so the change is what gets read. */}
         <p aria-live="polite" className="sr-only">
            {current?.status === 'ready' && query
               ? current.page.users.length
                  ? `${plural(current.page.users.length, 'angler')} found.${
                       current.page.nextCursor
                          ? ' More load as you scroll.'
                          : ''
                    }`
                  : 'Nobody goes by that.'
               : ''}
         </p>

         <div className="mt-8">
            {!shown ? (
               <AnglerSkeleton />
            ) : shown.status === 'error' ? (
               <InlineError
                  message={LOAD_FAILED}
                  onRetry={() => setAttempt((n) => n + 1)}
               />
            ) : shown.page.users.length === 0 ? (
               query ? (
                  <NoMatchState
                     sentence="Nobody goes by that. Check the spelling, or try their handle with an @ in front."
                     onClear={clear}
                  />
               ) : (
                  <PlainState sentence="Nobody to suggest yet. Type a name or a handle to find somebody." />
               )
            ) : (
               <div
                  aria-busy={!current}
                  className={cn(
                     'transition-opacity duration-150 [transition-timing-function:var(--ease)]',
                     !current && 'opacity-60'
                  )}
               >
                  {shown.page.suggested ? (
                     <h2 className="lab mb-3">Anglers to follow</h2>
                  ) : (
                     <h2 className="sr-only">Anglers matching {query}</h2>
                  )}

                  <ul className="flex flex-col border-b border-line">
                     {shown.page.users.map((person) => (
                        <AnglerRow
                           key={person.id}
                           person={person}
                           busy={busy.has(person.id)}
                           onToggle={() => void toggleFollow(person)}
                        />
                     ))}
                  </ul>

                  <div ref={sentinel} aria-hidden="true" className="h-px" />

                  {moreState === 'loading' ? (
                     <p role="status" className="lab mt-4">
                        Loading more anglers
                     </p>
                  ) : moreState === 'error' ? (
                     <div className="mt-6">
                        <InlineError
                           message="Could not load more anglers."
                           onRetry={loadMore}
                        />
                     </div>
                  ) : null}
               </div>
            )}
         </div>
      </section>
   );
}

/*
 * The row grammar of the catch and spot lists, with a round face instead of a
 * square photograph: the whole row opens the angler, and Follow sits above
 * the link so it is still its own control.
 */
function AnglerRow({
   person,
   busy,
   onToggle,
}: {
   person: AnglerResult;
   busy: boolean;
   onToggle: () => void;
}) {
   const subline = [
      person.username ? `@${person.username}` : null,
      plural(person.followersCount, 'follower'),
   ]
      .filter(Boolean)
      .join(' · ');

   return (
      <li className="relative -mx-2 grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-line px-2 py-3 transition-colors duration-150 [transition-timing-function:var(--ease)] hover:bg-bg-2 has-[a:focus-visible]:bg-bg-2">
         {person.avatarUrl || person.avatarThumbUrl ? (
            <Img
               src={person.avatarUrl}
               thumbSrc={person.avatarThumbUrl}
               alt=""
               ratio="1 / 1"
               sizes="44px"
               className="size-11 shrink-0 rounded-full"
            />
         ) : (
            <span
               aria-hidden="true"
               className="g flex size-11 shrink-0 items-center justify-center rounded-full bg-bg-2 text-[18px] text-ink-2"
            >
               {initialOf(person.displayName)}
            </span>
         )}

         <div className="min-w-0">
            <Link
               to={`/anglers/${person.id}`}
               className="g block text-[22px] tracking-[0.04em] text-ink after:absolute after:inset-0"
            >
               <span className="block truncate">
                  {person.displayName}
                  {person.verified ? (
                     <VerifiedMark className="size-[15px] align-[-0.05em]" />
                  ) : null}
               </span>
            </Link>
            <p className="num truncate text-sm text-ink-2">{subline}</p>
         </div>

         {/*
          * Not disabled while the request is out. A disabled button drops
          * the keyboard focus onto the page, so somebody walking the list
          * with Tab lost their place at every press. The label has already
          * turned, and a second press while it is out is ignored above.
          */}
         <Button
            type="button"
            variant={person.followedByMe ? 'secondary' : 'outline'}
            onClick={onToggle}
            aria-busy={busy || undefined}
            aria-pressed={person.followedByMe}
            className="relative z-10"
         >
            {person.followedByMe ? 'Following' : 'Follow'}
            <span className="sr-only"> {person.displayName}</span>
         </Button>
      </li>
   );
}

/* The rows before they arrive, at the rows' own geometry, and still. */
function AnglerSkeleton() {
   const names = ['w-2/5', 'w-1/3', 'w-1/2', 'w-2/5', 'w-1/4'];
   const lines = ['w-1/4', 'w-1/3', 'w-1/5', 'w-1/4', 'w-1/3'];

   return (
      <div role="status" className="flex flex-col">
         {names.map((name, index) => (
            <div
               key={index}
               className="-mx-2 grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-line px-2 py-3"
            >
               <span className="size-11 shrink-0 rounded-full bg-bg-2" />
               <span className="flex min-w-0 flex-col gap-2">
                  <span className={cn('block h-[21px] bg-bg-2', name)} />
                  <span
                     className={cn('block h-[14px] bg-bg-2', lines[index])}
                  />
               </span>
               <span className="block h-11 w-[92px] bg-bg-2" />
            </div>
         ))}
         <span className="sr-only">Loading anglers</span>
      </div>
   );
}
