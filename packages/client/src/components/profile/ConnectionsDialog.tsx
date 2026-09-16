import axios from 'axios';
import { useEffect, useId, useState } from 'react';
import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
   type ConnectionUser,
   initialOf,
   plural,
} from '@/components/profile/types';

/*
 * Who follows the angler, and who the angler follows. A sheet on a phone and the
 * same black block centred on a desktop. The search waits for the typing to stop
 * before it asks the server, so the list stops flickering under the hands, and the
 * list is mounted fresh for each of the two so one never shows the other's people.
 */

export type ConnectionsKind = 'followers' | 'following';

type Result =
   | { status: 'ready'; people: ConnectionUser[] }
   | { status: 'error' };

const SEARCH_DEBOUNCE_MS = 300;

const titleOf = (kind: ConnectionsKind) =>
   kind === 'followers' ? 'Followers' : 'Following';

const countLineOf = (kind: ConnectionsKind, count: number) =>
   kind === 'followers'
      ? plural(count, 'angler follows you', 'anglers follow you')
      : `You follow ${plural(count, 'angler')}`;

const emptyLineOf = (kind: ConnectionsKind) =>
   kind === 'followers'
      ? 'Nobody follows you yet.'
      : 'You are not following anyone yet.';

export function ConnectionsDialog({
   kind,
   count,
   open,
   onClose,
}: {
   kind: ConnectionsKind;
   count: number;
   open: boolean;
   onClose: () => void;
}) {
   return (
      <Dialog
         open={open}
         onOpenChange={(next) => {
            if (!next) {
               onClose();
            }
         }}
      >
         <DialogContent>
            <Connections key={kind} kind={kind} count={count} />
         </DialogContent>
      </Dialog>
   );
}

function Connections({
   kind,
   count,
}: {
   kind: ConnectionsKind;
   count: number;
}) {
   const searchId = useId();
   const [search, setSearch] = useState('');
   const [query, setQuery] = useState('');
   const [attempt, setAttempt] = useState(0);
   const [result, setResult] = useState<{ key: string; value: Result } | null>(
      null
   );

   const key = `${kind}:${query}:${attempt}`;

   useEffect(() => {
      const timer = window.setTimeout(
         () => setQuery(search.trim()),
         SEARCH_DEBOUNCE_MS
      );

      return () => window.clearTimeout(timer);
   }, [search]);

   useEffect(() => {
      const controller = new AbortController();

      axios
         .get<{ users: ConnectionUser[] }>('/api/users/me/connections', {
            params: { type: kind, search: query },
            signal: controller.signal,
         })
         .then(({ data }) => {
            setResult({
               key,
               value: { status: 'ready', people: data.users ?? [] },
            });
         })
         .catch((error: unknown) => {
            if (axios.isCancel(error)) {
               return;
            }

            console.error(error);
            setResult({ key, value: { status: 'error' } });
         });

      return () => controller.abort();
   }, [kind, query, attempt, key]);

   const view = result?.key === key ? result.value : null;
   const people = view?.status === 'ready' ? view.people : [];

   return (
      <>
         <DialogHeader>
            <DialogTitle>{titleOf(kind)}</DialogTitle>
            <p className="lab num text-paper-2">{countLineOf(kind, count)}</p>
         </DialogHeader>

         <div className="mt-6">
            <label htmlFor={searchId} className="lab text-paper-2">
               Search by name or handle
            </label>
            <input
               id={searchId}
               type="search"
               value={search}
               onChange={(event) => setSearch(event.target.value)}
               className="input-line mt-1 h-11 text-base text-paper"
            />
         </div>

         <div className="mt-4 max-h-[46dvh] overflow-y-auto">
            {!view ? (
               <ConnectionsSkeleton />
            ) : view.status === 'error' ? (
               <div className="py-8">
                  <p role="alert" className="text-[15px] text-paper-2">
                     Could not load this list.
                  </p>
                  <Button
                     type="button"
                     variant="outline"
                     className="mt-4 border-paper text-paper hover:bg-paper/10"
                     onClick={() => setAttempt((n) => n + 1)}
                  >
                     Try again
                  </Button>
               </div>
            ) : people.length === 0 ? (
               <p className="py-8 text-[15px] text-paper-2">
                  {query
                     ? 'Nobody here matches that search.'
                     : emptyLineOf(kind)}
               </p>
            ) : (
               <ul>
                  {people.map((person) => (
                     <li
                        key={person.id}
                        className="flex min-h-11 items-center gap-3 border-t border-paper/15 py-2 first:border-t-0"
                     >
                        {person.avatarUrl ? (
                           <img
                              src={person.avatarUrl}
                              alt=""
                              width={40}
                              height={40}
                              loading="lazy"
                              className="size-10 shrink-0 rounded-full object-cover"
                           />
                        ) : (
                           <span
                              aria-hidden="true"
                              className="g flex size-10 shrink-0 items-center justify-center rounded-full bg-paper/15 text-[20px] text-paper"
                           >
                              {initialOf(person.displayName)}
                           </span>
                        )}
                        <span className="min-w-0">
                           <span className="block truncate text-[15px] text-paper">
                              {person.displayName}
                           </span>
                           <span className="block truncate text-sm text-paper-2">
                              @{person.username}
                           </span>
                        </span>
                     </li>
                  ))}
               </ul>
            )}
         </div>
      </>
   );
}

function ConnectionsSkeleton() {
   return (
      <div role="status" aria-label="Loading the list">
         {[0, 1, 2, 3].map((row) => (
            <div
               key={row}
               className="flex items-center gap-3 border-t border-paper/15 py-2 first:border-t-0"
            >
               <span className="size-10 shrink-0 rounded-full bg-paper/10" />
               <span className="flex flex-1 flex-col gap-2">
                  <span className="h-4 w-2/5 bg-paper/10" />
                  <span className="h-3 w-1/4 bg-paper/10" />
               </span>
            </div>
         ))}
         <span className="sr-only">Loading the list</span>
      </div>
   );
}
