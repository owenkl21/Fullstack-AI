import { BookmarkIcon } from '@heroicons/react/24/outline';
import { NoData } from '@/components/states/NoData';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { SaveButton } from '@/components/saved/SaveButton';
import {
   listSavedGear,
   listSavedPosts,
   listSavedSpots,
   removePost,
   type SavedPostRow,
   type SavedGear,
   type SavedSpot,
} from '@/components/saved/saved-api';
import { formatDay } from '@/components/fishing/record/format';
import { useDocumentTitle } from '@/lib/title';

/*
 * What you have kept of other people's.
 *
 * Two lists, spots and gear, each a reference to something somebody else
 * owns. A spot that its owner has since made private is simply not here any
 * more, which the server decides, not this page.
 */
export function SavedPage() {
   useDocumentTitle('Kept');
   return (
      <RequireSignIn what="what you have kept">
         <Saved />
      </RequireSignIn>
   );
}

type State =
   | { status: 'loading' }
   | { status: 'error' }
   | {
        status: 'ready';
        spots: SavedSpot[];
        gear: SavedGear[];
        posts: SavedPostRow[];
     };

function Saved() {
   const [state, setState] = useState<State>({ status: 'loading' });
   const [attempt, setAttempt] = useState(0);

   useEffect(() => {
      const controller = new AbortController();
      Promise.all([
         listSavedSpots(controller.signal),
         listSavedGear(controller.signal),
         listSavedPosts(controller.signal).catch(() => [] as SavedPostRow[]),
      ])
         .then(([spots, gear, posts]) =>
            setState({ status: 'ready', spots, gear, posts })
         )
         .catch((error) => {
            if (!axios.isCancel(error)) setState({ status: 'error' });
         });
      return () => controller.abort();
   }, [attempt]);

   return (
      <section className="mx-auto w-[min(1680px,100%-32px)] py-8 md:py-12">
         <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h1 className="g text-[44px] md:text-[56px]">Kept</h1>
            {state.status === 'ready' ? (
               <p className="lab num text-ink-3">
                  {state.spots.length} spots, {state.gear.length} gear
               </p>
            ) : null}
         </div>
         <p className="mt-3 max-w-[58ch] text-[17px] text-ink-2">
            Other anglers' spots and gear you have kept. A reference, not a
            copy: if they take it down, it goes from here too.
         </p>

         {state.status === 'loading' ? (
            <div
               role="status"
               aria-label="Loading"
               className="mt-8 flex flex-col gap-px"
            >
               {[0, 1, 2].map((i) => (
                  <span key={i} className="h-16 bg-bg-2" />
               ))}
            </div>
         ) : state.status === 'error' ? (
            <div className="mt-8">
               <p className="text-[17px] text-ink-2">
                  Could not load what you have kept.
               </p>
               <button
                  type="button"
                  onClick={() => setAttempt((n) => n + 1)}
                  className="g-tracked mt-3 text-[17px] text-ink underline-offset-4 hover:underline"
               >
                  Try again
               </button>
            </div>
         ) : (
            <>
               <section className="mt-10">
                  <h2 className="g text-[30px]">Posts</h2>
                  {state.posts.length === 0 ? (
                     <p className="mt-2 max-w-[52ch] text-[15px] text-ink-2">
                        Nothing kept yet. Keep a post from the feed and it waits
                        here.
                     </p>
                  ) : (
                     <ul className="mt-2">
                        {state.posts.map((row) => {
                           const c = row.post.catch;
                           const title = c
                              ? (c.species?.commonName ?? c.title)
                              : (row.post.site?.name ?? 'A spot');
                           const to = c
                              ? `/catches/${c.id}`
                              : row.post.site
                                ? `/sites/${row.post.site.id}`
                                : '/';
                           const meta = [
                              `by ${row.post.author.displayName}`,
                              c?.length ? `${c.length} cm` : null,
                              c?.site?.name ?? null,
                              `kept ${formatDay(row.savedAt)}`,
                           ]
                              .filter(Boolean)
                              .join(' · ');
                           return (
                              <li
                                 key={row.id}
                                 className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line py-3"
                              >
                                 <Link
                                    to={to}
                                    className="flex min-w-0 flex-col underline-offset-4 hover:underline"
                                 >
                                    <span className="g text-[24px]">
                                       {title}
                                    </span>
                                    <span className="text-[14px] text-ink-2">
                                       {meta}
                                    </span>
                                 </Link>
                                 <button
                                    type="button"
                                    onClick={() =>
                                       void removePost(row.post.id).then(() =>
                                          setState((s) =>
                                             s.status === 'ready'
                                                ? {
                                                     ...s,
                                                     posts: s.posts.filter(
                                                        (x) => x.id !== row.id
                                                     ),
                                                  }
                                                : s
                                          )
                                       )
                                    }
                                    className="g-tracked text-[15px] text-ink-3 hover:text-ink"
                                 >
                                    Let go
                                 </button>
                              </li>
                           );
                        })}
                     </ul>
                  )}
               </section>

               <section className="mt-12">
                  <h2 className="g text-[30px]">Spots</h2>
                  {state.spots.length === 0 ? (
                     <NoData
                        icon={BookmarkIcon}
                        className="mt-3"
                        title="No spots kept yet"
                     >
                        Open another angler's spot from the map and keep it from
                        there.
                     </NoData>
                  ) : (
                     <ul className="mt-2">
                        {state.spots.map((row) => (
                           <li
                              key={row.id}
                              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line py-3"
                           >
                              <Link
                                 to={`/sites/${row.site.id}`}
                                 className="flex min-w-0 flex-col hover:underline underline-offset-4"
                              >
                                 <span className="g text-[24px]">
                                    {row.site.name}
                                 </span>
                                 <span className="text-[14px] text-ink-2">
                                    {[
                                       row.site.ownerName
                                          ? `${row.site.ownerName}'s`
                                          : null,
                                       row.site.waterType?.toLowerCase(),
                                       `kept ${formatDay(row.savedAt)}`,
                                    ]
                                       .filter(Boolean)
                                       .join(' · ')}
                                 </span>
                              </Link>
                              <SaveButton
                                 kind="spot"
                                 id={row.site.id}
                                 saved
                                 size="sm"
                                 variant="ghost"
                                 onChange={(kept) =>
                                    kept
                                       ? undefined
                                       : setState((s) =>
                                            s.status === 'ready'
                                               ? {
                                                    ...s,
                                                    spots: s.spots.filter(
                                                       (x) => x.id !== row.id
                                                    ),
                                                 }
                                               : s
                                         )
                                 }
                              />
                           </li>
                        ))}
                     </ul>
                  )}
               </section>

               <section className="mt-12">
                  <h2 className="g text-[30px]">Gear</h2>
                  {state.gear.length === 0 ? (
                     <NoData
                        icon={BookmarkIcon}
                        className="mt-3"
                        title="No gear kept yet"
                     >
                        Gear shows on a catch; keep it from the catch.
                     </NoData>
                  ) : (
                     <ul className="mt-2">
                        {state.gear.map((row) => (
                           <li
                              key={row.id}
                              className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-line py-3"
                           >
                              {row.gear.imageUrl ? (
                                 <img
                                    src={row.gear.imageUrl}
                                    alt=""
                                    loading="lazy"
                                    className="size-[52px] bg-bg-2 object-contain"
                                 />
                              ) : (
                                 <span
                                    className="size-[52px] bg-bg-2"
                                    aria-hidden="true"
                                 />
                              )}
                              <span className="flex min-w-0 flex-col">
                                 <span className="g text-[22px]">
                                    {row.gear.name}
                                 </span>
                                 <span className="text-[14px] text-ink-2">
                                    {[
                                       row.gear.brand,
                                       row.gear.type.toLowerCase(),
                                       row.gear.ownerName
                                          ? `${row.gear.ownerName}'s`
                                          : null,
                                    ]
                                       .filter(Boolean)
                                       .join(' · ')}
                                 </span>
                              </span>
                              <SaveButton
                                 kind="gear"
                                 id={row.gear.id}
                                 saved
                                 size="sm"
                                 variant="ghost"
                                 onChange={(kept) =>
                                    kept
                                       ? undefined
                                       : setState((s) =>
                                            s.status === 'ready'
                                               ? {
                                                    ...s,
                                                    gear: s.gear.filter(
                                                       (x) => x.id !== row.id
                                                    ),
                                                 }
                                               : s
                                         )
                                 }
                              />
                           </li>
                        ))}
                     </ul>
                  )}
               </section>
            </>
         )}
      </section>
   );
}
