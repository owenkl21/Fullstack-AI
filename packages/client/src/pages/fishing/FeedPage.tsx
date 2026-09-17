import axios from 'axios';
import {
   useCallback,
   useEffect,
   useMemo,
   useRef,
   useState,
   type CSSProperties,
} from 'react';
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
   FeedFilters,
   MAX_RADIUS_KM,
   MIN_RADIUS_KM,
   type LocationState,
} from '@/components/feed/FeedFilters';
import { FeedPostBlock } from '@/components/feed/FeedPostBlock';
import { FeedSkeleton } from '@/components/feed/FeedSkeleton';
import { distanceInKm, plural } from '@/components/feed/format';
import type {
   FeedAuthor,
   FeedComment,
   FeedPost,
   FeedPostInView,
   ScopeFilter,
   ShowFilter,
} from '@/components/feed/types';
import { useDocumentTitle } from '@/lib/title';
import { SignedIn } from '@/components/shell/Signed';
import { useIsSignedIn, useSession } from '@/lib/auth-client';

const PAGE_SIZE = 25;
const SLOW_LOAD_MS = 5000;
const DEFAULT_RADIUS_KM = 50;

function readScope(value: string | null): ScopeFilter {
   return value === 'near-me' ? 'near-me' : 'everywhere';
}

function readShow(value: string | null): ShowFilter {
   return value === 'catches' || value === 'spots' ? value : 'all';
}

function readRadius(value: string | null): number {
   const parsed = Number(value);
   if (!Number.isFinite(parsed)) return DEFAULT_RADIUS_KM;
   const stepped = Math.round(parsed / 5) * 5;
   return Math.min(Math.max(stepped, MIN_RADIUS_KM), MAX_RADIUS_KM);
}

/** The feed embeds the five newest comments newest first; a thread reads oldest first. */
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
   const show = readShow(searchParams.get('show'));
   const committedRadius = readRadius(searchParams.get('radius'));
   const [radiusKm, setRadiusKm] = useState(committedRadius);

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
   const [sendingComment, setSendingComment] = useState<
      Record<string, boolean>
   >({});
   const [commentErrors, setCommentErrors] = useState<
      Record<string, string | null>
   >({});
   const [actionErrors, setActionErrors] = useState<
      Record<string, string | null>
   >({});
   const [readingThread, setReadingThread] = useState<Record<string, boolean>>(
      {}
   );
   const [wholeThread, setWholeThread] = useState<Record<string, boolean>>({});
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
            show: ShowFilter;
            radius: number;
         }>,
         options?: { replace?: boolean }
      ) => {
         setSearchParams(
            (previous) => {
               const next = new URLSearchParams(previous);
               if (patch.scope) {
                  if (patch.scope === 'everywhere') next.delete('scope');
                  else next.set('scope', patch.scope);
               }
               if (patch.show) {
                  if (patch.show === 'all') next.delete('show');
                  else next.set('show', patch.show);
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
         if (show !== 'all') {
            params.type = show === 'catches' ? 'CATCH' : 'SITE';
         }
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
      [position, scope, show]
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
      if (scope !== 'near-me' || !position) {
         return posts.map((post) => ({ ...post, distanceKm: null }));
      }

      return posts.flatMap((post) => {
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
      });
   }, [position, posts, radiusKm, scope]);

   const patchPost = useCallback(
      (postId: string, update: (post: FeedPost) => FeedPost) => {
         setPosts((previous) =>
            previous.map((post) => (post.id === postId ? update(post) : post))
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
      },
      []
   );

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

   const submitComment = async (post: FeedPostInView) => {
      const body = (drafts[post.id] ?? '').trim();
      if (!body) return;

      const pendingId = `pending-${post.id}-${Date.now()}`;
      const optimistic: FeedComment = {
         id: pendingId,
         body,
         createdAt: new Date().toISOString(),
         user: {
            displayName: user?.name ?? user?.username ?? 'You',
            username: user?.username ?? '',
         },
      };

      setSendingComment((previous) => ({ ...previous, [post.id]: true }));
      setCommentErrors((previous) => ({ ...previous, [post.id]: null }));
      setDrafts((previous) => ({ ...previous, [post.id]: '' }));
      patchPost(post.id, (current) => ({
         ...current,
         comments: [...current.comments, optimistic],
         commentCount: current.commentCount + 1,
      }));

      try {
         const { data } = await axios.post(`/api/feed/${post.id}/comments`, {
            body,
         });
         const saved: FeedComment | undefined = data?.comment;
         if (saved) {
            patchPost(post.id, (current) => ({
               ...current,
               comments: current.comments.map((entry) =>
                  entry.id === pendingId ? saved : entry
               ),
            }));
         }
      } catch {
         patchPost(post.id, (current) => ({
            ...current,
            comments: current.comments.filter(
               (entry) => entry.id !== pendingId
            ),
            commentCount: Math.max(0, current.commentCount - 1),
         }));
         setDrafts((previous) => ({ ...previous, [post.id]: body }));
         setCommentErrors((previous) => ({
            ...previous,
            [post.id]: 'That comment did not send. Try again.',
         }));
      } finally {
         setSendingComment((previous) => ({ ...previous, [post.id]: false }));
      }
   };

   const readWholeThread = async (post: FeedPostInView) => {
      setReadingThread((previous) => ({ ...previous, [post.id]: true }));
      setCommentErrors((previous) => ({ ...previous, [post.id]: null }));

      try {
         const { data } = await axios.get(`/api/feed/${post.id}/comments`);
         const all: FeedComment[] = data.comments ?? [];
         patchPost(post.id, (current) => ({
            ...current,
            comments: all,
            commentCount: Math.max(current.commentCount, all.length),
         }));
         setWholeThread((previous) => ({ ...previous, [post.id]: true }));
      } catch {
         setCommentErrors((previous) => ({
            ...previous,
            [post.id]: 'The rest of the thread did not load. Try again.',
         }));
      } finally {
         setReadingThread((previous) => ({ ...previous, [post.id]: false }));
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
                  {show === 'catches'
                     ? `No catches within ${radiusKm} km.`
                     : show === 'spots'
                       ? `No spots within ${radiusKm} km.`
                       : `Nothing logged within ${radiusKm} km.`}
               </p>
               {show !== 'spots' ? (
                  /* TODO(api): appendix E A2.1. A catch is saved without coordinates,
                     so it can never appear in a nearby list until the write path keeps them. */
                  <p className="text-[15px] text-ink-3">
                     A catch does not carry a position yet, so Near me finds
                     spots only.
                  </p>
               ) : null}
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
                     Show everywhere
                  </button>
               </div>
            </div>
         );
      }

      return (
         <div className="flex flex-col gap-3 py-6">
            <p className="text-[17px] text-ink-2">
               {show === 'catches'
                  ? 'No one has logged a catch yet.'
                  : show === 'spots'
                    ? 'No one has added a spot yet.'
                    : 'No one has logged a catch or added a spot yet.'}
            </p>
            <Link
               to={show === 'spots' ? '/sites/new' : '/catches/new'}
               className={inlineControl}
            >
               {show === 'spots' ? 'Add a spot' : 'Log a catch'}
            </Link>
         </div>
      );
   };

   const showList = !awaitingPosition || locationState === 'ready';

   return (
      <div
         ref={pageRef}
         className="mx-auto w-[min(720px,100%-32px)] py-8 md:py-12"
      >
         <header className="rv flex flex-col gap-3">
            <h1 className="g text-[44px] md:text-[56px]">Feed</h1>
            <p className="max-w-[46ch] text-[17px] text-ink-2">
               What other anglers logged, newest first.
            </p>
            <SignedIn>
               <p className="text-[15px] text-ink-3">
                  Your own posts appear here when you log a catch or add a spot.
               </p>
            </SignedIn>
         </header>

         <div className="rv mt-8" style={{ '--i': 1 } as CSSProperties}>
            <FeedFilters
               scope={scope}
               onScopeChange={(next) => setFilter({ scope: next })}
               show={show}
               onShowChange={(next) => setFilter({ show: next })}
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
            />
         </div>

         <section aria-label="Posts" className="mt-10 flex flex-col gap-6">
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

            {status === 'ready' && showList && visiblePosts.length === 0
               ? emptyState()
               : null}

            {status === 'ready' && showList && visiblePosts.length > 0
               ? visiblePosts.map((post) => (
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
                       onSubmitComment={() => void submitComment(post)}
                       isSubmittingComment={Boolean(sendingComment[post.id])}
                       commentError={commentErrors[post.id] ?? null}
                       onReadAllComments={() => void readWholeThread(post)}
                       isReadingAllComments={Boolean(readingThread[post.id])}
                       hasReadAllComments={Boolean(wholeThread[post.id])}
                    />
                 ))
               : null}

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
