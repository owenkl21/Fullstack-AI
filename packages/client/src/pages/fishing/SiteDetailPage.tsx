import { useLoadOnScroll } from '@/lib/load-on-scroll';
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
import { SaveButton } from '@/components/saved/SaveButton';
import { useKept } from '@/components/saved/saved-api';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { StaticMap } from '@/components/map/StaticMap';
import { useIsSignedIn } from '@/lib/auth-client';
import { NoPhoto } from '@/components/brand/FishMark';
import { FramedPhoto } from '@/components/FramedPhoto';
import { OnlyYou } from '@/components/fishing/rows/SpotRow';
import {
   HeaderRating,
   SpotRatings,
} from '@/components/fishing/reviews/SpotRatings';
import { useSpotRatings } from '@/components/fishing/reviews/reviews-api';

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
   images: {
      image: {
         id: string;
         url: string;
         /* How the angler framed it (lib/framing.ts). */
         focusX?: number | null;
         focusY?: number | null;
         zoom?: number | null;
      };
   }[];
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
   /* Kept on the row and returned with it, so the pin can carry it. */
   catchCount?: number | null;
   /* Only ever read by the owner: nobody else is handed a private spot. */
   visibility?: string | null;
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
   const { isSignedIn } = useIsSignedIn();
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

   const { isSignedIn } = useIsSignedIn();
   const isOwner = useIsOwner(data?.createdBy?.id);
   const kept = useKept(isSignedIn && !isOwner);
   const ratings = useSpotRatings(siteId);
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
      () => catches.slice(0, page * CATCHES_PER_PAGE),
      [catches, page]
   );
   const moreSentinel = useLoadOnScroll(
      () => setPage((n) => n + 1),
      page < totalPages
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
         <section className="mx-auto w-[min(1320px,100%-32px)] py-16">
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
   /* The rating is not repeated here: the header carries it beside the name. */
   const facts = [water, `${caughtLine} logged here`]
      .filter(Boolean)
      .join(' · ');
   const position =
      data.latitude != null && data.longitude != null
         ? { lat: data.latitude, lng: data.longitude }
         : null;
   const hasPosition = position !== null;
   const openMapUrl = hasPosition
      ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}`
      : null;
   const rest = data.images.slice(1);

   return (
      <article>
         <SiteHeader
            name={data.name}
            photoUrl={data.images[0]?.image.url ?? null}
            rating={<HeaderRating store={ratings} />}
         />

         <SiteBody>
            <p className="rv num text-base text-ink-2">
               {/* The same quiet mark the row in My spots wears, so the owner
                   can tell on the page itself that this one is theirs alone. */}
               {isOwner && data.visibility === 'PRIVATE' ? (
                  <>
                     <OnlyYou /> ·{' '}
                  </>
               ) : null}
               {facts}
            </p>

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

               {position ? (
                  <>
                     {/* TODO(api): a coarse position for anglers who did not save
                         the spot, so a pin is never published exactly (appendix E). */}
                     <StaticMap
                        latitude={position.lat}
                        longitude={position.lng}
                        label={`Map of ${data.name}`}
                        zoom={14}
                        count={data.catchCount ?? null}
                        className="mt-5"
                     />
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

                     <div
                        ref={moreSentinel}
                        aria-hidden="true"
                        className="h-px"
                     />
                     {shown.length < catches.length ? (
                        <p className="lab num mt-4" aria-live="polite">
                           {shown.length} of {catches.length}
                        </p>
                     ) : null}
                  </>
               )}
            </section>

            <SpotRatings
               siteId={data.id}
               siteName={data.name}
               store={ratings}
            />

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

                  {isSignedIn && !isOwner ? (
                     <SaveButton
                        kind="spot"
                        id={data.id}
                        saved={kept.spots.has(data.id)}
                     />
                  ) : null}

                  <Button asChild variant="ghost">
                     <Link to={isOwner ? '/sites/me' : '/map'}>
                        {isOwner ? 'Back to my spots' : 'Back to the map'}
                     </Link>
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
         className="mx-auto w-[min(1320px,100%-32px)] pt-[132px] pb-8 md:pt-[180px] md:pb-12"
      >
         {children}
      </div>
   );
}

function SiteHeader({
   name,
   photoUrl,
   rating,
}: {
   name: string;
   photoUrl: string | null;
   /* What anglers rate it, under the name on a phone and at its right on a
      desktop, sitting on the name's last line. */
   rating: ReactNode;
}) {
   const [settled, setSettled] = useState(false);

   /* The one slow move in the product: the spot photograph drifts from 106% to
    * its own size over twelve seconds, once, on arrival. */
   useEffect(() => {
      const timer = window.setTimeout(() => setSettled(true), 60);
      return () => window.clearTimeout(timer);
   }, [photoUrl]);

   /*
    * The name sits on a plate under the photograph rather than on top of it,
    * for the same reason the home hero does: paper white over a bright sky
    * measures near 1:1, and the scrim that would fix it would paint the
    * photograph out. See SpotHeader.
    */
   return (
      <header className="relative bg-black-block text-paper">
         {/* Without a photograph there is nothing to look at up here, so
             the block shrinks to a band above the name rather than
             standing 360 pixels of empty black on a desktop. */}
         <div
            className={
               photoUrl
                  ? 'relative h-[210px] overflow-hidden md:h-[360px]'
                  : 'relative h-6 md:h-8'
            }
         >
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
         </div>

         <div className="relative z-[4] pt-5 pb-11 md:pt-7 md:pb-16">
            <div className="mx-auto flex w-[min(1320px,100%-32px)] flex-col md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-x-10 md:gap-y-4">
               <h1 className="g text-[44px] text-paper md:text-[72px]">
                  {name}
               </h1>
               {rating}
            </div>
         </div>

         <TornEdge fill="black" cut />
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
               <FramedPhoto
                  src={photo}
                  alt=""
                  width={52}
                  height={52}
                  loading="lazy"
                  framing={item.images[0]?.image}
                  className="size-[52px] shrink-0"
               />
            ) : (
               <NoPhoto className="size-[52px]" />
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
         <div className="mx-auto w-[min(1320px,100%-32px)] pt-[132px] pb-8 md:pt-[180px] md:pb-12">
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
