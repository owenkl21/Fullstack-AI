import { PageHead } from '@/components/brand/PageHead';
import axios from 'axios';
import { removePost, savePost } from '@/components/saved/saved-api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { useRevealIn } from '@/components/brand/Reveal';
import {
   FeedRadius,
   FeedScopeSegment,
   MAX_RADIUS_KM,
   MIN_RADIUS_KM,
   type LocationState,
} from '@/components/feed/FeedFilters';
import type { ThreadViewer } from '@/components/feed/CommentThread';
import { FeedPostBlock } from '@/components/feed/FeedPostBlock';
import { FeedSkeleton } from '@/components/feed/FeedSkeleton';
import { distanceInKm, plural } from '@/components/feed/format';
import type {
   FeedAuthor,
   FeedPost,
   FeedPostInView,
   ScopeFilter,
} from '@/components/feed/types';
import { useDocumentTitle } from '@/lib/title';
import { useIsSignedIn, useSession } from '@/lib/auth-client';

const PAGE_SIZE = 25;
const SLOW_LOAD_MS = 5000;
const DEFAULT_RADIUS_KM = 50;

/*
 * The feed is catches. There was a Show control here that chose between catches
 * and spots, and it is gone with them: a spot is already named on every catch
 * taken there, so a spot post put the same mark in front of the reader twice.
 */
function readScope(value: string | null): ScopeFilter {
   return value === 'near-me' ? 'near-me' : 'everywhere';
}

function readRadius(value: string | null): number {
   const parsed = Number(value);
   if (!Number.isFinite(parsed)) return DEFAULT_RADIUS_KM;
   const stepped = Math.round(parsed / 5) * 5;
   return Math.min(Math.max(stepped, MIN_RADIUS_KM), MAX_RADIUS_KM);
}

/*
 * The feed embeds the five newest comments newest first; a thread reads oldest
 * first. The replies inside each already come oldest first and stay as sent.
 */
function normalisePost(post: FeedPost): FeedPost {
   return { ...post, comments: [...(post.comments ?? [])].reverse() };
}

const inlineControl =
   'g-tracked inline-flex h-12 items-center text-[19px] text-teal-text transition-[opacity] duration-150 [transition-timing-function:var(--ease)] hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal';

export function FeedPage() {
   useDocumentTitle('Feed');
   const { isSignedIn } = useIsSignedIn();
   const { data: session } = useSession();
   const user = session?.user ?? null;
   const pageRef = useRef<HTMLDivElement>(null);
   useRevealIn(pageRef);

   const [searchParams, setSearchParams] = useSearchParams();
   const scope = readScope(searchParams.get('scope'));
   const committedRadius = readRadius(searchParams.get('radius'));
   const [radiusKm, setRadiusKm] = useState(committedRadius);

   /*
    * A link to one post, and to one comment under it: where a notification
    * about a reply or a like lands, and where a reader who was sent to sign in
    * comes back to. A post has no page of its own, so the feed opens with that
    * post first and its thread open.
    */
   const linkedPostId = searchParams.get('post');
   const linkedCommentId = searchParams.get('comment');
   const [linked, setLinked] = useState<FeedPost | null>(null);
   const [linkedMissing, setLinkedMissing] = useState(false);

   /* As much of the reader as one of their own comments prints. */
   const viewer = useMemo<ThreadViewer | null>(
      () =>
         user
            ? {
                 id: user.id,
                 displayName: user.name || user.username || 'You',
                 username: user.username ?? null,
                 verified: Boolean(user.verified),
              }
            : null,
      [user]
   );

   const [posts, setPosts] = useState<FeedPost[]>([]);
   const [offset, setOffset] = useState(0);
   const [hasMore, setHasMore] = useState(true);
   const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
      'loading'
   );
   const [isSlow, setIsSlow] = useState(false);
   const [isLoadingMore, setIsLoadingMore] = useState(false);
   const [moreFailed, setMoreFailed] = useState(false);

   const [position, setPosition] = useState<{
      latitude: number;
      longitude: number;
   } | null>(null);
   const [locationState, setLocationState] = useState<LocationState>('idle');

   const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});
   const [drafts, setDrafts] = useState<Record<string, string>>({});
   const [actionErrors, setActionErrors] = useState<
      Record<string, string | null>
   >({});
   const [pendingUnfollow, setPendingUnfollow] = useState<FeedAuthor | null>(
      null
   );

   const requestToken = useRef(0);
   const sentinelRef = useRef<HTMLDivElement>(null);
   const knownSignedIn = useRef<boolean | null>(null);

   useEffect(() => {
      setRadiusKm(committedRadius);
   }, [committedRadius]);

   const setFilter = useCallback(
      (
         patch: Partial<{
            scope: ScopeFilter;
            radius: number;
         }>,
         options?: { replace?: boolean }
      ) => {
         setSearchParams(
            (previous) => {
               const next = new URLSearchParams(previous);
               /* A link saved while the old Show control existed still works:
                  the parameter is simply not read any more. */
               next.delete('show');
               if (patch.scope) {
                  if (patch.scope === 'everywhere') next.delete('scope');
                  else next.set('scope', patch.scope);
               }
               if (typeof patch.radius === 'number') {
                  if (patch.radius === DEFAULT_RADIUS_KM) next.delete('radius');
                  else next.set('radius', String(patch.radius));
               }
               return next;
            },
            /* Chips push, so Back undoes a filter. A slider drag replaces, so it
               does not fill the history with every step it passed through. */
            { replace: options?.replace === true }
         );
      },
      [setSearchParams]
   );

   const requestPosition = useCallback(() => {
      if (!('geolocation' in navigator)) {
         setLocationState('unsupported');
         return;
      }

      setLocationState('asking');
      navigator.geolocation.getCurrentPosition(
         (result) => {
            setPosition({
               latitude: result.coords.latitude,
               longitude: result.coords.longitude,
            });
            setLocationState('ready');
         },
         () => {
            setPosition(null);
            setLocationState('denied');
         },
         /* A radius of kilometres does not need a high accuracy fix, and a cached
            one keeps the feed from asking the hardware on every page. */
         { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 }
      );
   }, []);

   useEffect(() => {
      if (scope !== 'near-me' || locationState !== 'idle') return;
      requestPosition();
   }, [locationState, requestPosition, scope]);

   const load = useCallback(
      async (reset: boolean, from: number) => {
         const token = requestToken.current + 1;
         requestToken.current = token;

         if (reset) {
            setStatus('loading');
            setIsSlow(false);
         } else {
            setIsLoadingMore(true);
            setMoreFailed(false);
         }

         const params: Record<string, string | number> = {
            scope: scope === 'near-me' ? 'NEARBY' : 'GLOBAL',
            limit: PAGE_SIZE,
            offset: from,
         };
         if (scope === 'near-me' && position) {
            params.latitude = position.latitude;
            params.longitude = position.longitude;
         }

         try {
            const { data } = await axios.get('/api/feed', { params });
            if (token !== requestToken.current) return;

            const incoming: FeedPost[] = (data.posts ?? []).map(normalisePost);
            setPosts((previous) =>
               reset ? incoming : [...previous, ...incoming]
            );
            setOffset(
               typeof data.nextOffset === 'number'
                  ? data.nextOffset
                  : from + incoming.length
            );
            setHasMore(Boolean(data.hasMore));
            setStatus('ready');
         } catch {
            if (token !== requestToken.current) return;
            if (reset) {
               setStatus('error');
            } else {
               setMoreFailed(true);
            }
         } finally {
            if (token === requestToken.current) {
               setIsLoadingMore(false);
               setIsSlow(false);
            }
         }
      },
      [position, scope]
   );

   const awaitingPosition = scope === 'near-me' && !position;
   /* Null once there is something to fetch, so a location answer we no longer
      care about cannot trigger a reload of the whole feed. */
   const awaitingStatus: 'loading' | 'ready' | null = awaitingPosition
      ? locationState === 'asking' || locationState === 'idle'
         ? 'loading'
         : 'ready'
      : null;

   useEffect(() => {
      setPosts([]);
      setOffset(0);

      if (awaitingStatus) {
         setHasMore(false);
         setStatus(awaitingStatus);
         return;
      }

      setHasMore(true);
      void load(true, 0);
   }, [awaitingStatus, load]);

   /* Signing in changes what every post says about itself: whether you liked it,
      whether it is yours, whether you already follow the angler. */
   useEffect(() => {
      if (isSignedIn === undefined) return;
      if (knownSignedIn.current === null) {
         knownSignedIn.current = isSignedIn;
         return;
      }
      if (knownSignedIn.current === isSignedIn) return;

      knownSignedIn.current = isSignedIn;
      if (awaitingPosition) return;
      setOffset(0);
      setHasMore(true);
      void load(true, 0);
   }, [awaitingPosition, isSignedIn, load]);

   useEffect(() => {
      if (status !== 'loading') {
         setIsSlow(false);
         return;
      }
      const timer = window.setTimeout(() => setIsSlow(true), SLOW_LOAD_MS);
      return () => window.clearTimeout(timer);
   }, [status]);

   /* An observer rather than a scroll listener, so a page that filters down
      shorter than the viewport still reaches for the next one. */
   useEffect(() => {
      const target = sentinelRef.current;
      if (!target) return;
      if (!hasMore || status !== 'ready' || isLoadingMore || moreFailed) return;

      const observer = new IntersectionObserver(
         (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
               void load(false, offset);
            }
         },
         { rootMargin: '400px 0px' }
      );
      observer.observe(target);
      return () => observer.disconnect();
   }, [hasMore, isLoadingMore, load, moreFailed, offset, status]);

   const visiblePosts = useMemo<FeedPostInView[]>(() => {
      /* The linked post leads and is not drawn a second time further down. It
         was asked for by name, so the radius does not get a say in it. */
      const rest = linked
         ? posts.filter((post) => post.id !== linked.id)
         : posts;
      const lead: FeedPostInView[] = linked
         ? [
              {
                 ...linked,
                 distanceKm:
                    scope === 'near-me' &&
                    position &&
                    typeof linked.latitude === 'number' &&
                    typeof linked.longitude === 'number'
                       ? distanceInKm(position, {
                            latitude: linked.latitude,
                            longitude: linked.longitude,
                         })
                       : null,
              },
           ]
         : [];

      if (scope !== 'near-me' || !position) {
         return [
            ...lead,
            ...rest.map((post) => ({ ...post, distanceKm: null })),
         ];
      }

      return [
         ...lead,
         ...rest.flatMap((post) => {
            if (
               typeof post.latitude !== 'number' ||
               typeof post.longitude !== 'number'
            ) {
               return [];
            }
            const km = distanceInKm(position, {
               latitude: post.latitude,
               longitude: post.longitude,
            });
            return km <= radiusKm ? [{ ...post, distanceKm: km }] : [];
         }),
      ];
   }, [linked, position, posts, radiusKm, scope]);

   /* The linked post is held beside the list, so a change reaches both. */
   const patchPost = useCallback(
      (postId: string, update: (post: FeedPost) => FeedPost) => {
         setPosts((previous) =>
            previous.map((post) => (post.id === postId ? update(post) : post))
         );
         setLinked((current) =>
            current && current.id === postId ? update(current) : current
         );
      },
      []
   );

   const patchAuthor = useCallback(
      (authorId: string, update: (post: FeedPost) => FeedPost) => {
         setPosts((previous) =>
            previous.map((post) =>
               post.author.id === authorId ? update(post) : post
            )
         );
         setLinked((current) =>
            current && current.author.id === authorId
               ? update(current)
               : current
         );
      },
      []
   );

   /*
    * Read the linked post on its own: it may be weeks down the feed. Read
    * again when the reader signs in or out, like the list, because whose
    * likes are filled in changes with who is asking.
    */
   useEffect(() => {
      if (!linkedPostId) {
         setLinked(null);
         setLinkedMissing(false);
         return;
      }
      const controller = new AbortController();
      setLinkedMissing(false);
      axios
         .get('/api/feed', {
            params: { postId: linkedPostId, limit: 1 },
            signal: controller.signal,
         })
         .then(({ data }) => {
            const found: FeedPost | undefined = (data.posts ?? [])[0];
            if (!found) {
               setLinked(null);
               setLinkedMissing(true);
               return;
            }
            setLinked(normalisePost(found));
            setOpenThreads((previous) => ({ ...previous, [found.id]: true }));
         })
         .catch(() => {
            if (!controller.signal.aborted) setLinkedMissing(true);
         });
      return () => controller.abort();
   }, [isSignedIn, linkedPostId]);

   /* Brought to the top of the window once, when it lands. A comment the link
      names is scrolled to by the thread itself, which knows where it is. */
   const linkedShownFor = useRef<string | null>(null);
   useEffect(() => {
      if (!linked || status !== 'ready' || linkedCommentId) return;
      if (linkedShownFor.current === linked.id) return;
      linkedShownFor.current = linked.id;
      const calm = window.matchMedia(
         '(prefers-reduced-motion: reduce)'
      ).matches;
      document.getElementById(`post-card-${linked.id}`)?.scrollIntoView({
         block: 'start',
         behavior: calm ? 'auto' : 'smooth',
      });
   }, [linked, linkedCommentId, status]);

   const toggleSave = async (post: FeedPostInView) => {
      const keeping = !post.savedByMe;
      setActionErrors((previous) => ({ ...previous, [post.id]: null }));
      patchPost(post.id, (current) => ({ ...current, savedByMe: keeping }));
      try {
         await (keeping ? savePost(post.id) : removePost(post.id));
      } catch {
         patchPost(post.id, (current) => ({ ...current, savedByMe: !keeping }));
         setActionErrors((previous) => ({
            ...previous,
            [post.id]: 'Could not keep that post. Try again.',
         }));
      }
   };

   const toggleLike = async (post: FeedPostInView) => {
      const liking = !post.likedByMe;
      setActionErrors((previous) => ({ ...previous, [post.id]: null }));
      patchPost(post.id, (current) => ({
         ...current,
         likedByMe: liking,
         likeCount: Math.max(0, current.likeCount + (liking ? 1 : -1)),
      }));

      try {
         const { data } = await axios.post(`/api/feed/${post.id}/likes`);
         if (typeof data?.liked === 'boolean' && data.liked !== liking) {
            patchPost(post.id, (current) => ({
               ...current,
               likedByMe: data.liked,
               likeCount: Math.max(
                  0,
                  current.likeCount + (data.liked ? 1 : -1)
               ),
            }));
         }
      } catch {
         patchPost(post.id, (current) => ({
            ...current,
            likedByMe: !liking,
            likeCount: Math.max(0, current.likeCount + (liking ? -1 : 1)),
         }));
         setActionErrors((previous) => ({
            ...previous,
            [post.id]: 'That did not save. Try again.',
         }));
      }
   };

   const follow = async (post: FeedPostInView) => {
      setActionErrors((previous) => ({ ...previous, [post.id]: null }));
      patchAuthor(post.author.id, (current) => ({
         ...current,
         authorFollowedByMe: true,
      }));

      try {
         await axios.post(`/api/users/${post.author.id}/follow`);
      } catch {
         patchAuthor(post.author.id, (current) => ({
            ...current,
            authorFollowedByMe: false,
         }));
         setActionErrors((previous) => ({
            ...previous,
            [post.id]: `Could not follow @${post.author.username}. Try again.`,
         }));
      }
   };

   const unfollow = async (author: FeedAuthor) => {
      patchAuthor(author.id, (current) => ({
         ...current,
         authorFollowedByMe: false,
      }));

      try {
         await axios.delete(`/api/users/${author.id}/follow`);
         toast({
            title: `You no longer follow @${author.username}.`,
            variant: 'success',
         });
      } catch {
         patchAuthor(author.id, (current) => ({
            ...current,
            authorFollowedByMe: true,
         }));
         toast({
            title: `Could not unfollow @${author.username}.`,
            description: 'Try again in a moment.',
            variant: 'error',
         });
      }
   };

   const emptyState = () => {
      if (scope === 'near-me') {
         return (
            <div className="flex flex-col gap-3 py-6">
               <p className="text-[17px] text-ink-2">
                  {`No catches within ${radiusKm} km.`}
               </p>
               <div className="flex flex-wrap gap-6">
                  {radiusKm < MAX_RADIUS_KM ? (
                     <button
                        type="button"
                        className={inlineControl}
                        onClick={() => {
                           const wider = Math.min(radiusKm * 2, MAX_RADIUS_KM);
                           setRadiusKm(wider);
                           setFilter({ radius: wider }, { replace: true });
                        }}
                     >
                        Widen the radius
                     </button>
                  ) : null}
                  <button
                     type="button"
                     className={inlineControl}
                     onClick={() => setFilter({ scope: 'everywhere' })}
                  >
                     Show global
                  </button>
               </div>
            </div>
         );
      }

      return (
         <div className="flex flex-col gap-3 py-6">
            <p className="text-[17px] text-ink-2">
               No one has logged a catch yet.
            </p>
            <Link to="/catches/new" className={inlineControl}>
               Log a catch
            </Link>
         </div>
      );
   };

   const showList = !awaitingPosition || locationState === 'ready';

   return (
      <div
         ref={pageRef}
         className="relative mx-auto w-[min(960px,100%-32px)] pb-8 md:pb-12"
      >
         <PageHead
            column="w-[min(960px,100%-32px)]"
            kicker="Newest first"
            title="Feed"
         >
            {/*
             * The switch rides on the plate, so the black band carries
             * something and the first card starts sooner. PageHead holds its
             * children 24px under the title and its column is the positioned
             * one, so the margin is trimmed to the 18px the phone wants and
             * dropped entirely once the plate is wide enough to set the switch
             * beside the title, bottom aligned with it.
             */}
            <div className="-mt-1.5 lg:-mt-6">
               <FeedScopeSegment
                  scope={scope}
                  onScopeChange={(next) => setFilter({ scope: next })}
                  className="lg:absolute lg:right-0 lg:bottom-7"
               />
            </div>
         </PageHead>

         {/* No reveal on it: it is mounted by the switch above rather than
             scrolled to, and the reveal pass only ever sees what was on the
             page when the feed opened. */}
         {scope === 'near-me' ? (
            <div className="mb-8">
               <FeedRadius
                  radiusKm={radiusKm}
                  onRadiusChange={setRadiusKm}
                  onRadiusCommit={(next) =>
                     setFilter({ radius: next }, { replace: true })
                  }
                  matchCount={
                     status === 'ready' && position ? visiblePosts.length : null
                  }
                  locationState={locationState}
                  onRetryLocation={requestPosition}
                  onScopeChange={(next) => setFilter({ scope: next })}
               />
            </div>
         ) : null}

         <section aria-label="Posts" className="flex flex-col gap-6">
            {status === 'loading' ? (
               <>
                  <FeedSkeleton />
                  <p className="sr-only" role="status">
                     Loading the feed.
                  </p>
                  {isSlow ? (
                     <div className="flex flex-col gap-2">
                        <p className="text-[17px] text-ink-2">
                           The feed is taking a while.
                        </p>
                        <button
                           type="button"
                           className={`${inlineControl} self-start`}
                           onClick={() => void load(true, 0)}
                        >
                           Try again
                        </button>
                     </div>
                  ) : null}
               </>
            ) : null}

            {status === 'error' ? (
               <div className="flex flex-col gap-2 py-6">
                  <p className="text-[17px] text-ink-2">
                     Could not load the feed. Check your connection.
                  </p>
                  <button
                     type="button"
                     className={`${inlineControl} self-start`}
                     onClick={() => void load(true, 0)}
                  >
                     Try again
                  </button>
               </div>
            ) : null}

            {linkedMissing && status === 'ready' ? (
               <p className="text-[15px] text-ink-2" role="status">
                  That post is no longer here. The rest of the feed is below.
               </p>
            ) : null}

            {status === 'ready' && showList && visiblePosts.length === 0
               ? emptyState()
               : null}

            {status === 'ready' && showList && visiblePosts.length > 0 ? (
               <div className="grid gap-6 lg:gap-8">
                  {visiblePosts.map((post) => (
                     <FeedPostBlock
                        key={post.id}
                        post={post}
                        isSignedIn={isSignedIn === true}
                        showDistance={scope === 'near-me'}
                        commentsOpen={Boolean(openThreads[post.id])}
                        onToggleComments={() =>
                           setOpenThreads((previous) => ({
                              ...previous,
                              [post.id]: !previous[post.id],
                           }))
                        }
                        onLike={() => void toggleLike(post)}
                        onSave={() => void toggleSave(post)}
                        onFollow={() => void follow(post)}
                        onUnfollow={() => setPendingUnfollow(post.author)}
                        actionError={actionErrors[post.id] ?? null}
                        draft={drafts[post.id] ?? ''}
                        onDraftChange={(next) =>
                           setDrafts((previous) => ({
                              ...previous,
                              [post.id]: next,
                           }))
                        }
                        viewer={viewer}
                        onPatch={(update) => patchPost(post.id, update)}
                        focusCommentId={
                           linked && post.id === linked.id
                              ? linkedCommentId
                              : null
                        }
                     />
                  ))}
               </div>
            ) : null}

            {isLoadingMore ? <FeedSkeleton count={1} /> : null}

            {moreFailed ? (
               <div className="flex flex-col gap-2">
                  <p className="text-[17px] text-ink-2">
                     The next posts did not load.
                  </p>
                  <button
                     type="button"
                     className={`${inlineControl} self-start`}
                     onClick={() => void load(false, offset)}
                  >
                     Try again
                  </button>
               </div>
            ) : null}

            {status === 'ready' && !hasMore && visiblePosts.length > 0 ? (
               <p className="rule-dashed pt-4 text-[15px] text-ink-3">
                  That is the end of the feed.{' '}
                  {plural(visiblePosts.length, 'post', 'posts')} in all.
               </p>
            ) : null}

            <div ref={sentinelRef} aria-hidden="true" className="h-px" />
         </section>

         <Dialog
            open={Boolean(pendingUnfollow)}
            onOpenChange={(open) => {
               if (!open) setPendingUnfollow(null);
            }}
         >
            <DialogContent className="gap-0 sm:max-w-[480px]">
               <DialogHeader className="text-left">
                  <DialogTitle className="g pr-10 text-[32px] font-normal text-paper">
                     Unfollow {pendingUnfollow?.displayName}
                  </DialogTitle>
                  <DialogDescription className="text-[15px] text-paper-2">
                     {pendingUnfollow?.username
                        ? `@${pendingUnfollow.username}`
                        : pendingUnfollow?.displayName}{' '}
                     stays in the feed. You just stop following.
                  </DialogDescription>
               </DialogHeader>
               <DialogFooter className="mt-6 flex-col gap-3 sm:flex-row">
                  <Button
                     type="button"
                     size="lg"
                     variant="ghost"
                     className="text-paper-2 hover:bg-paper/10 hover:text-paper"
                     onClick={() => setPendingUnfollow(null)}
                  >
                     Cancel
                  </Button>
                  <Button
                     type="button"
                     size="lg"
                     variant="outline"
                     className="border-paper text-paper hover:bg-paper/10"
                     onClick={() => {
                        if (!pendingUnfollow) return;
                        void unfollow(pendingUnfollow);
                        setPendingUnfollow(null);
                     }}
                  >
                     Unfollow
                  </Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>
      </div>
   );
}
