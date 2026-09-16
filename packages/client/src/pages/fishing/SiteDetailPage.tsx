import axios from 'axios';
import {
   type CSSProperties,
   type ReactNode,
   useCallback,
   useEffect,
   useMemo,
   useRef,
   useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { TornEdge } from '@/components/brand/TornEdge';
import { useRevealIn } from '@/components/brand/Reveal';
import { Button } from '@/components/ui/button';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { useDocumentTitle } from '@/lib/title';
import { NotFoundPage } from '@/pages/NotFoundPage';

/*
 * A spot: the photograph and the name first, then what the place is and how to get
 * on to it, then where it is, then everything caught there. The angler who saved it
 * gets the editor and the delete at the end, behind one dialog that names the
 * consequence.
 */

type SiteCatch = {
   id: string;
   title: string;
   caughtAt: string;
   images: { image: { id: string; url: string } }[];
   species: { commonName: string } | null;
   createdBy: { displayName: string; username: string } | null;
};

type SiteDetail = {
   id: string;
   name: string;
   description: string | null;
   latitude: number | null;
   longitude: number | null;
   waterType: string | null;
   accessNotes: string | null;
   createdBy: { id: string; displayName: string; username: string } | null;
   images: { image: { id: string; url: string } }[];
   catches: SiteCatch[];
};

type LoadState =
   | { status: 'loading'; data: null }
   | { status: 'ready'; data: SiteDetail }
   | { status: 'notfound'; data: null }
   | { status: 'error'; data: null };

const LOADING: LoadState = { status: 'loading', data: null };
const CATCHES_PER_PAGE = 10;
const LOAD_FAILED = 'Could not load this spot.';

const WATER_WORDS: Record<string, string> = {
   FRESHWATER: 'Freshwater',
   SALTWATER: 'Saltwater',
   BRACKISH: 'Brackish',
   OTHER: 'Other water',
};

const plural = (count: number, one: string, many = `${one}s`) =>
   `${count} ${count === 1 ? one : many}`;

/** Tue 15 Sep, 06:42 */
const stamp = (value: string) => {
   const date = new Date(value);

   if (Number.isNaN(date.getTime())) {
      return null;
   }

   const day = new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
   })
      .format(date)
      .replace(',', '');

   const time = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
   }).format(date);

   return `${day}, ${time}`;
};

function useSite(siteId: string | undefined) {
   const [attempt, setAttempt] = useState(0);
   const [result, setResult] = useState<{
      key: string;
      value: LoadState;
   } | null>(null);

   const key = `${siteId ?? ''}:${attempt}`;

   useEffect(() => {
      if (!siteId) {
         return;
      }

      const controller = new AbortController();
      let done = false;

      /* Every skeleton times out into something the angler can act on. */
      const timer = window.setTimeout(() => {
         if (!done) {
            setResult({ key, value: { status: 'error', data: null } });
         }
      }, 5000);

      const load = async () => {
         try {
            const { data } = await axios.get<{ site: SiteDetail }>(
               `/api/sites/${siteId}`,
               { signal: controller.signal }
            );
            done = true;
            setResult({ key, value: { status: 'ready', data: data.site } });
         } catch (error) {
            if (axios.isCancel(error)) {
               return;
            }

            done = true;
            console.error(error);
            const missing =
               axios.isAxiosError(error) && error.response?.status === 404;
            setResult({
               key,
               value: { status: missing ? 'notfound' : 'error', data: null },
            });
         }
      };

      void load();

      return () => {
         window.clearTimeout(timer);
         controller.abort();
      };
   }, [siteId, key]);

   /* Keyed on the spot, so moving between two spots shows the skeleton rather
    * than the spot you have just left. */
   const state = result?.key === key ? result.value : LOADING;

   return { state, retry: () => setAttempt((count) => count + 1) };
}

function useIsOwner(ownerId: string | null | undefined) {
   const { isSignedIn } = useAuth();
   const [profileId, setProfileId] = useState<string | null>(null);

   useEffect(() => {
      if (!isSignedIn) {
         return;
      }

      const controller = new AbortController();

      axios
         .get<{ profile: { id: string } }>('/api/users/me', {
            signal: controller.signal,
         })
         .then(({ data }) => setProfileId(data.profile?.id ?? null))
         .catch(() => setProfileId(null));

      return () => controller.abort();
   }, [isSignedIn]);

   return Boolean(isSignedIn && profileId && ownerId && profileId === ownerId);
}

export function SiteDetailPage() {
   const { siteId } = useParams();
   const { state, retry } = useSite(siteId);

   if (state.status === 'notfound' || !siteId) {
      return <NotFoundPage />;
   }

   return <SiteRecord state={state} siteId={siteId} onRetry={retry} />;
}

function SiteRecord({
   state,
   siteId,
   onRetry,
}: {
   state: LoadState;
   siteId: string;
   onRetry: () => void;
}) {
   const data = state.data;
   useDocumentTitle(data?.name);

   const { isSignedIn } = useAuth();
   const isOwner = useIsOwner(data?.createdBy?.id);
   const navigate = useNavigate();

   const [page, setPage] = useState(1);
   const [confirming, setConfirming] = useState(false);
   const [isDeleting, setIsDeleting] = useState(false);
   const [deleteError, setDeleteError] = useState('');

   useEffect(() => {
      setPage(1);
   }, [siteId]);

   const catches = useMemo(() => data?.catches ?? [], [data]);
   const totalPages = Math.max(1, Math.ceil(catches.length / CATCHES_PER_PAGE));
   const shown = useMemo(
      () =>
         catches.slice((page - 1) * CATCHES_PER_PAGE, page * CATCHES_PER_PAGE),
      [catches, page]
   );

   useEffect(() => {
      if (page > totalPages) {
         setPage(totalPages);
      }
   }, [page, totalPages]);

   const remove = useCallback(async () => {
      if (!data) {
         return;
      }

      try {
         setIsDeleting(true);
         setDeleteError('');
         await axios.delete(`/api/sites/${data.id}`);
         setConfirming(false);
         navigate('/sites/me', { replace: true });
         /* The queue is cleared on a route change, so the confirmation is raised
          * once the list has arrived and belongs to the page it is about. */
         window.setTimeout(
            () =>
               toast({
                  title: `${data.name} deleted.`,
                  description: 'Every catch logged there keeps its record.',
                  variant: 'success',
               }),
            0
         );
      } catch (error) {
         console.error(error);
         setDeleteError('Not deleted. Check your connection and try again.');
      } finally {
         setIsDeleting(false);
      }
   }, [data, navigate]);

   if (state.status === 'loading') {
      return <SiteSkeleton />;
   }

   if (state.status === 'error' || !data) {
      return (
         <section className="mx-auto w-[min(820px,100%-32px)] py-16">
            <h1 className="g text-[44px]">This spot</h1>
            <p role="alert" className="mt-4 max-w-[60ch] text-base text-ink-2">
               {LOAD_FAILED}
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
               <Button type="button" variant="outline" onClick={onRetry}>
                  Try again
               </Button>
               <Button asChild variant="ghost">
                  <Link to="/sites/me">Go to my spots</Link>
               </Button>
            </div>
         </section>
      );
   }

   const water = data.waterType ? WATER_WORDS[data.waterType] : null;
   const caughtLine = plural(catches.length, 'catch', 'catches');
   const facts = [water, `${caughtLine} logged here`]
      .filter(Boolean)
      .join(' · ');
   const hasPosition = data.latitude != null && data.longitude != null;
   const mapUrl = hasPosition
      ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}&z=13&output=embed`
      : null;
   const openMapUrl = hasPosition
      ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}`
      : null;
   const rest = data.images.slice(1);

   return (
      <article>
         <SiteHeader
            name={data.name}
            photoUrl={data.images[0]?.image.url ?? null}
         />

         <SiteBody>
            <p className="rv num text-base text-ink-2">{facts}</p>

            <p
               className="rv mt-6 max-w-[68ch] text-base whitespace-pre-line text-ink"
               style={{ '--i': 1 } as CSSProperties}
            >
               {data.description?.trim()
                  ? data.description
                  : 'No description written yet.'}
            </p>

            <section className="rv mt-10" style={{ '--i': 2 } as CSSProperties}>
               <h2 className="lab lab-rule">Getting on to it</h2>
               <p className="mt-3 max-w-[68ch] text-base whitespace-pre-line text-ink-2">
                  {data.accessNotes?.trim()
                     ? data.accessNotes
                     : 'No access notes written yet.'}
               </p>
            </section>

            {rest.length > 0 ? (
               <section className="rv mt-10">
                  <h2 className="g text-[30px] md:text-[36px]">Photographs</h2>
                  <ul className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                     {rest.map((entry) => (
                        <li
                           key={entry.image.id}
                           className="aspect-square overflow-hidden bg-bg-2"
                        >
                           <img
                              src={entry.image.url}
                              alt={`${data.name}, another view`}
                              loading="lazy"
                              className="size-full object-cover"
                           />
                        </li>
                     ))}
                  </ul>
               </section>
            ) : null}

            <section className="rv mt-12">
               <h2 className="g text-[30px] md:text-[36px]">Position</h2>

               {hasPosition ? (
                  <>
                     {/* TODO(api): a coarse position for anglers who did not save
                         the spot, so a pin is never published exactly (appendix E). */}
                     <div className="mt-5 aspect-[3/2] w-full bg-bg-2">
                        <iframe
                           title={`Map of ${data.name}`}
                           src={mapUrl ?? ''}
                           className="size-full border-0"
                           loading="lazy"
                           referrerPolicy="no-referrer-when-downgrade"
                        />
                     </div>
                     <p className="num mt-4 text-base text-ink-2">
                        {data.latitude?.toFixed(5)},{' '}
                        {data.longitude?.toFixed(5)}
                     </p>
                     <a
                        href={openMapUrl ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="g-tracked mt-2 inline-flex h-11 items-center text-[19px] text-teal-text underline-offset-4 hover:underline"
                     >
                        Open in Maps
                     </a>
                  </>
               ) : (
                  <p className="mt-4 max-w-[60ch] text-base text-ink-2">
                     No position recorded. Edit the spot to drop a pin on the
                     map.
                  </p>
               )}
            </section>

            <section className="rv mt-12">
               <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                  <h2 className="g text-[30px] md:text-[36px]">Catches here</h2>
                  {catches.length > 0 ? (
                     <p className="lab num">{caughtLine}</p>
                  ) : null}
               </div>

               {catches.length === 0 ? (
                  <p className="mt-4 max-w-[60ch] text-base text-ink-2">
                     Nothing logged here yet. The first catch at this spot
                     starts its history.
                  </p>
               ) : (
                  <>
                     <ul className="mt-5">
                        {shown.map((entry) => (
                           <CatchRow key={entry.id} item={entry} />
                        ))}
                     </ul>

                     {totalPages > 1 ? (
                        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-line pt-6">
                           <Button
                              type="button"
                              variant="outline"
                              disabled={page === 1}
                              onClick={() => setPage((n) => n - 1)}
                           >
                              Previous
                           </Button>
                           <Button
                              type="button"
                              variant="outline"
                              disabled={page === totalPages}
                              onClick={() => setPage((n) => n + 1)}
                           >
                              Next
                           </Button>
                           <p className="lab num" aria-live="polite">
                              Page {page} of {totalPages}
                           </p>
                        </div>
                     ) : null}
                  </>
               )}
            </section>

            <section className="rv mt-12 border-t border-line pt-8">
               <h2 className="sr-only">What you can do with this spot</h2>
               <div className="flex flex-wrap items-center gap-4">
                  {isSignedIn ? (
                     <Button asChild size="lg">
                        <Link to={`/catches/new?siteId=${data.id}`}>
                           Log a catch here
                        </Link>
                     </Button>
                  ) : null}

                  {isOwner ? (
                     <>
                        <Button asChild variant="outline">
                           <Link to={`/sites/${data.id}/edit`}>Edit</Link>
                        </Button>
                        <Button
                           type="button"
                           variant="destructive"
                           onClick={() => {
                              setDeleteError('');
                              setConfirming(true);
                           }}
                        >
                           Delete
                        </Button>
                     </>
                  ) : null}

                  <Button asChild variant="ghost">
                     <Link to="/sites/me">Back to my spots</Link>
                  </Button>
               </div>
            </section>
         </SiteBody>

         <Dialog
            open={confirming}
            onOpenChange={(open) => {
               if (!open) {
                  setConfirming(false);
               }
            }}
         >
            <DialogContent>
               <DialogHeader>
                  <DialogTitle>Delete {data.name}?</DialogTitle>
                  <DialogDescription>
                     The spot goes off your list and off the map. Every catch
                     logged here keeps its record, but loses the place it was
                     caught, and that cannot be undone.
                  </DialogDescription>
               </DialogHeader>

               {deleteError ? (
                  <p role="alert" className="mt-4 text-sm text-destructive">
                     {deleteError}
                  </p>
               ) : null}

               <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button
                     type="button"
                     variant="outline"
                     className="border-paper text-paper hover:bg-paper/10"
                     disabled={isDeleting}
                     onClick={() => void remove()}
                  >
                     {isDeleting ? 'Deleting' : 'Delete this spot'}
                  </Button>
                  <Button
                     type="button"
                     variant="ghost"
                     className="text-paper-2 hover:bg-paper/10 hover:text-paper"
                     onClick={() => setConfirming(false)}
                  >
                     Keep it
                  </Button>
               </div>
            </DialogContent>
         </Dialog>
      </article>
   );
}

function SiteBody({ children }: { children: ReactNode }) {
   const root = useRef<HTMLDivElement>(null);
   useRevealIn(root);

   return (
      <div
         ref={root}
         className="mx-auto w-[min(820px,100%-32px)] py-8 md:py-12"
      >
         {children}
      </div>
   );
}

function SiteHeader({
   name,
   photoUrl,
}: {
   name: string;
   photoUrl: string | null;
}) {
   const [settled, setSettled] = useState(false);

   /* The one slow move in the product: the spot photograph drifts from 106% to
    * its own size over twelve seconds, once, on arrival. */
   useEffect(() => {
      const timer = window.setTimeout(() => setSettled(true), 60);
      return () => window.clearTimeout(timer);
   }, [photoUrl]);

   return (
      <header className="relative h-[300px] overflow-hidden bg-black-block text-paper md:h-[420px]">
         {photoUrl ? (
            <img
               src={photoUrl}
               alt={name}
               fetchPriority="high"
               className={`absolute inset-0 size-full object-cover transition-transform duration-[12000ms] ease-linear ${
                  settled ? 'scale-100' : 'scale-[1.06]'
               }`}
            />
         ) : null}
         <div aria-hidden="true" className="scrim-photo absolute inset-0" />
         <div className="absolute right-0 bottom-[60px] left-0 z-[4] mx-auto w-[min(820px,100%-32px)] md:bottom-[84px]">
            <h1 className="g text-[44px] text-paper md:text-[72px]">{name}</h1>
         </div>
         <TornEdge fill="bg" />
      </header>
   );
}

function CatchRow({ item }: { item: SiteCatch }) {
   const photo = item.images[0]?.image.url ?? null;
   const when = stamp(item.caughtAt);
   const who = item.createdBy?.displayName;
   const meta = [when, who ? `by ${who}` : null].filter(Boolean).join(' · ');

   return (
      <li className="border-t border-line first:border-t-0">
         <Link
            to={`/catches/${item.id}`}
            className="flex items-center gap-4 py-3 transition-colors duration-150 [transition-timing-function:var(--ease)] hover:bg-bg-2"
         >
            {photo ? (
               <img
                  src={photo}
                  alt=""
                  width={52}
                  height={52}
                  loading="lazy"
                  className="size-[52px] shrink-0 object-cover"
               />
            ) : (
               <span
                  aria-hidden="true"
                  className="size-[52px] shrink-0 bg-bg-2"
               />
            )}
            <span className="min-w-0 flex-1">
               <span className="g block truncate text-[22px] text-ink">
                  {item.species?.commonName ?? item.title}
               </span>
               <span className="num block truncate text-sm text-ink-2">
                  {meta || 'Not reported'}
               </span>
            </span>
         </Link>
      </li>
   );
}

function SiteSkeleton() {
   return (
      <div role="status" aria-label="Loading this spot">
         <div className="h-[300px] bg-bg-2 md:h-[420px]" />
         <div className="mx-auto w-[min(820px,100%-32px)] py-8 md:py-12">
            <span className="block h-4 w-2/5 bg-bg-2" />
            <span className="mt-6 block h-4 w-full bg-bg-2" />
            <span className="mt-2 block h-4 w-4/5 bg-bg-2" />
            <span className="mt-10 block aspect-[3/2] w-full bg-bg-2" />
            {[0, 1, 2].map((row) => (
               <div key={row} className="mt-6 flex items-center gap-4">
                  <span className="size-[52px] shrink-0 bg-bg-2" />
                  <span className="flex flex-1 flex-col gap-2">
                     <span className="h-5 w-2/5 bg-bg-2" />
                     <span className="h-4 w-3/5 bg-bg-2" />
                  </span>
               </div>
            ))}
         </div>
         <span className="sr-only">Loading this spot</span>
      </div>
   );
}
