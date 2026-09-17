import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useRevealIn } from '@/components/brand/Reveal';
import { GearRow, type GearRowItem } from '@/components/fishing/rows/GearRow';
import { RowList } from '@/components/fishing/rows/Row';
import {
   GEAR_TYPE_ORDER,
   gearTypeWords,
   plural,
} from '@/components/fishing/rows/format';
import { EmptyState } from '@/components/states/EmptyState';
import { InlineError } from '@/components/states/InlineError';
import { ListSkeleton } from '@/components/states/ListSkeleton';
import { NoMatchState } from '@/components/states/NoMatchState';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { Button } from '@/components/ui/button';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { useDocumentTitle } from '@/lib/title';
import { SearchField } from '@/components/fishing/rows/SearchField';

/*
 * The tackle box, grouped the way it is stored: rods with rods, reels with reels,
 * each heading carrying its count. Delete stays on the row because gear has no
 * record of its own yet, and the confirmation says what deleting actually costs.
 */

type GearItem = GearRowItem;

type LoadStatus = 'loading' | 'ready' | 'error';

const LOAD_FAILED = 'Could not load your gear.';

export function MyGearPage() {
   useDocumentTitle('My gear');

   return (
      <RequireSignIn what="your gear">
         <MyGearList />
      </RequireSignIn>
   );
}

function MyGearList() {
   const root = useRef<HTMLElement>(null);
   useRevealIn(root);
   const heading = useRef<HTMLHeadingElement>(null);

   const [params, setParams] = useSearchParams();
   const [items, setItems] = useState<GearItem[]>([]);
   const [status, setStatus] = useState<LoadStatus>('loading');
   const [pending, setPending] = useState<GearItem | null>(null);
   const [isDeleting, setIsDeleting] = useState(false);
   const [deleteError, setDeleteError] = useState('');

   const query = params.get('q') ?? '';

   const [attempt, setAttempt] = useState(0);

   useEffect(() => {
      let cancelled = false;

      axios
         .get('/api/gear/me')
         .then(({ data }) => {
            if (cancelled) {
               return;
            }

            setItems(data.gear ?? []);
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

   const setQuery = useCallback(
      (value: string) => {
         setParams(
            (previous) => {
               const next = new URLSearchParams(previous);
               if (value) {
                  next.set('q', value);
               } else {
                  next.delete('q');
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
      if (!needle) {
         return items;
      }

      return items.filter((entry) =>
         [entry.name, entry.brand, gearTypeWords(entry.type).one].some(
            (value) => value.toLowerCase().includes(needle)
         )
      );
   }, [items, query]);

   const groups = useMemo(() => {
      const byType = new Map<string, GearItem[]>();

      filtered.forEach((entry) => {
         const key = (entry.type ?? '').toUpperCase();
         const bucket = byType.get(key);
         if (bucket) {
            bucket.push(entry);
         } else {
            byType.set(key, [entry]);
         }
      });

      return Array.from(byType.entries()).sort((a, b) => {
         const left = GEAR_TYPE_ORDER.indexOf(a[0]);
         const right = GEAR_TYPE_ORDER.indexOf(b[0]);
         return (
            (left === -1 ? GEAR_TYPE_ORDER.length : left) -
            (right === -1 ? GEAR_TYPE_ORDER.length : right)
         );
      });
   }, [filtered]);

   const closeDialog = useCallback(() => {
      setPending(null);
      setDeleteError('');
   }, []);

   const confirmDelete = useCallback(async () => {
      if (!pending) {
         return;
      }

      try {
         setIsDeleting(true);
         setDeleteError('');
         await axios.delete(`/api/gear/${pending.id}`);
         setItems((previous) =>
            previous.filter((entry) => entry.id !== pending.id)
         );
         toast({
            title: `${pending.name} deleted.`,
            description: 'It is off every catch it was used on.',
            variant: 'success',
         });
         closeDialog();
         heading.current?.focus();
      } catch (error) {
         console.error(error);
         setDeleteError('Not deleted. Check your connection and try again.');
      } finally {
         setIsDeleting(false);
      }
   }, [closeDialog, pending]);

   const total = plural(items.length, 'item');
   const countLine = query.trim() ? `${filtered.length} of ${total}` : total;

   return (
      <section
         ref={root}
         className="mx-auto w-[min(820px,100%-32px)] py-10 md:py-14"
      >
         <header className="rv">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
               <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h1
                     ref={heading}
                     tabIndex={-1}
                     className="g text-[44px] md:text-[56px]"
                  >
                     My gear
                  </h1>
                  {status === 'ready' ? (
                     <p className="lab num">{countLine}</p>
                  ) : null}
               </div>
               {status === 'ready' && items.length > 0 ? (
                  <Button asChild>
                     <Link to="/gear/new">Add gear</Link>
                  </Button>
               ) : null}
            </div>

            <div className="mt-8">
               <SearchField
                  id="gear-search"
                  label="Search your gear"
                  placeholder="Rod, reel or line"
                  value={query}
                  onChange={(next) => setQuery(next)}
               />
            </div>
         </header>

         <div className="mt-8">
            {status === 'loading' ? (
               <ListSkeleton
                  key={attempt}
                  label="Loading your gear"
                  errorMessage={LOAD_FAILED}
                  onRetry={retry}
               />
            ) : status === 'error' ? (
               <InlineError message={LOAD_FAILED} onRetry={retry} />
            ) : items.length === 0 ? (
               <EmptyState
                  sentence="No gear logged yet, so no catch can say what it was taken on."
                  actionLabel="Add gear"
                  to="/gear/new"
               />
            ) : filtered.length === 0 ? (
               <NoMatchState
                  sentence="No gear matches that search."
                  onClear={() => setQuery('')}
               />
            ) : (
               <div className="flex flex-col gap-10">
                  {groups.map(([type, gear]) => {
                     const words = gearTypeWords(type);
                     return (
                        <section key={type || 'other'}>
                           <h2 className="g text-[30px]">
                              {gear.length === 1 ? words.one : words.many}{' '}
                              <span className="num text-ink-3">
                                 ({gear.length})
                              </span>
                           </h2>
                           <RowList className="mt-3">
                              {gear.map((entry) => (
                                 <GearRow
                                    key={entry.id}
                                    item={entry}
                                    trailing={
                                       <Button
                                          type="button"
                                          variant="ghost"
                                          className="px-3 text-ink-3 hover:text-ink"
                                          aria-label={`Delete ${entry.name}`}
                                          onClick={() => setPending(entry)}
                                       >
                                          Delete
                                       </Button>
                                    }
                                 />
                              ))}
                           </RowList>
                        </section>
                     );
                  })}
               </div>
            )}
         </div>

         <Dialog
            open={Boolean(pending)}
            onOpenChange={(open) => {
               if (!open) {
                  closeDialog();
               }
            }}
         >
            <DialogContent className="gap-0 sm:max-w-[480px]">
               <DialogTitle className="g text-[30px] font-normal">
                  Delete {pending?.name}?
               </DialogTitle>
               <DialogDescription className="mt-3 text-base">
                  It comes off every catch it was used on, and that cannot be
                  undone.
               </DialogDescription>
               {deleteError ? (
                  <p role="alert" className="mt-4 text-sm text-destructive">
                     {deleteError}
                  </p>
               ) : null}
               <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button
                     type="button"
                     variant="destructive"
                     disabled={isDeleting}
                     onClick={() => void confirmDelete()}
                  >
                     {isDeleting ? 'Deleting' : 'Delete'}
                  </Button>
                  <Button
                     type="button"
                     variant="ghost"
                     className="text-paper-2 hover:bg-paper/10 hover:text-paper"
                     onClick={closeDialog}
                  >
                     Cancel
                  </Button>
               </div>
            </DialogContent>
         </Dialog>
      </section>
   );
}
