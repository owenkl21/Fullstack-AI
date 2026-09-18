import {
   ChatBubbleOvalLeftIcon,
   HeartIcon,
   UserMinusIcon,
   UserPlusIcon,
   BookmarkIcon,
} from '@heroicons/react/24/outline';
import {
   HeartIcon as HeartSolid,
   BookmarkIcon as BookmarkSolid,
} from '@heroicons/react/24/solid';
import { FishMark } from '@/components/brand/FishMark';
import { Img } from '@/components/Img';
import { Link } from 'react-router-dom';

import {
   Carousel,
   CarouselContent,
   CarouselCounter,
   CarouselItem,
   CarouselNext,
   CarouselPrevious,
} from '@/components/ui/carousel';
import { CommentThread } from '@/components/feed/CommentThread';
import {
   countSentence,
   formatDistance,
   formatLength,
   formatRelative,
   formatStamp,
   formatWeight,
   joinMeta,
} from '@/components/feed/format';
import type { FeedPostInView } from '@/components/feed/types';

const textControl =
   'g-tracked inline-flex h-12 items-center text-[19px] transition-[color,opacity] duration-150 [transition-timing-function:var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal';

/** `Caught at Kalk Bay · Tue 15 Sep, 06:42 · 4 h ago`, built from what the post carries. */
function contextSentence(post: FeedPostInView, showDistance: boolean) {
   const stamp = formatStamp(post.createdAt);
   const relative = formatRelative(post.createdAt);
   const distance = showDistance ? formatDistance(post.distanceKm) : null;
   /*
    * The spot rides on the post as well as on the catch, and the post's copy is
    * the one that honours a withheld mark. Either way it is named here, which is
    * why a spot has no card of its own any more.
    */
   const spot = post.catch?.site?.name ?? post.site?.name ?? null;

   if (spot) {
      return joinMeta([`Caught at ${spot}`, stamp, relative, distance]);
   }

   return joinMeta([
      stamp ? `Caught on ${stamp}` : 'Caught',
      relative,
      distance,
   ]);
}

function measurementLine(post: FeedPostInView) {
   const length = formatLength(post.catch?.lengthCm);
   const weight = formatWeight(post.catch?.weightKg);
   if (!length && !weight) return null;

   const source = post.catch?.lengthSource ?? post.catch?.weightSource ?? null;
   return { value: joinMeta([length, weight]), source };
}

export function FeedPostBlock({
   post,
   isSignedIn,
   showDistance,
   commentsOpen,
   onToggleComments,
   onLike,
   onSave,
   onFollow,
   onUnfollow,
   actionError,
   draft,
   onDraftChange,
   onSubmitComment,
   isSubmittingComment,
   commentError,
   onReadAllComments,
   isReadingAllComments,
   hasReadAllComments,
}: {
   post: FeedPostInView;
   isSignedIn: boolean;
   showDistance: boolean;
   commentsOpen: boolean;
   onToggleComments: () => void;
   onLike: () => void;
   onSave: () => void;
   onFollow: () => void;
   onUnfollow: () => void;
   actionError: string | null;
   draft: string;
   onDraftChange: (next: string) => void;
   onSubmitComment: () => void;
   isSubmittingComment: boolean;
   commentError: string | null;
   onReadAllComments: () => void;
   isReadingAllComments: boolean;
   hasReadAllComments: boolean;
}) {
   const counts = countSentence(post.likeCount, post.commentCount);

   const images = post.catch?.images ?? [];
   /*
    * The fish leads. A card used to be headed by whatever the angler typed
    * as a title, with the species in small type under it, so a row of cards
    * read "Morning session", "Tuesday", "Slangkop" and never said what was
    * caught. The species is the heading; the angler's own title, when it is
    * more than the species again, sits under the figures as what they called
    * it.
    */
   const heading = post.catch?.species?.trim() || post.catch?.title || null;
   const called =
      post.catch?.title &&
      heading &&
      post.catch.title.trim().toLowerCase() !== heading.trim().toLowerCase()
         ? post.catch.title.trim()
         : null;
   const recordHref = post.catch ? `/catches/${post.catch.id}` : null;
   const measurement = measurementLine(post);
   const threadId = `comments-${post.id}`;
   const canFollow = isSignedIn && post.authorIsMe !== true;

   return (
      <article
         /*
          * A card the reader has scrolled past stops costing anything to keep
          * on the page. Twenty five of these laid out seventeen thousand
          * pixels at once, every time anything changed, which is the other
          * half of why the feed dragged. The intrinsic size is roughly what a
          * card really measures at each width, so the scrollbar stays honest
          * and the page does not jump as cards come back into view. `auto`
          * means the browser keeps the real height once it has seen it.
          */
         className="blk flex h-full flex-col [content-visibility:auto] [contain-intrinsic-size:auto_660px] md:[contain-intrinsic-size:auto_1100px]"
         aria-labelledby={`post-${post.id}`}
      >
         <header className="flex items-center gap-3 px-4 pt-5 pr-12 pb-4">
            {/*
             * The photograph and the name are one link. Making only the name
             * clickable left a 26px target, which is under the minimum and
             * fiddly next to a 40px photograph that looked just as pressable.
             */}
            <Link
               to={`/anglers/${post.author.id}`}
               className="group flex min-h-11 min-w-0 items-center gap-3"
            >
               {post.author.avatarUrl ? (
                  /*
                   * Forty pixels, so it is handed the 160px thumb and the two
                   * larger copies only as something to fall back on. The
                   * original stays out of the ladder entirely: one feed page
                   * used to pull the same four megabyte avatar twenty five
                   * times over, which is most of why scrolling felt like tar.
                   */
                  <Img
                     src={post.author.avatarUrl}
                     cardSrc={post.author.avatarCardUrl}
                     thumbSrc={post.author.avatarThumbUrl}
                     alt=""
                     ratio="1 / 1"
                     sizes="40px"
                     className="size-10 shrink-0 rounded-full bg-black-block-2"
                  />
               ) : (
                  <span
                     aria-hidden="true"
                     className="g flex size-10 shrink-0 items-center justify-center rounded-full bg-black-block-2 text-[20px] text-paper-2"
                  >
                     {post.author.displayName.slice(0, 1)}
                  </span>
               )}
               <span className="min-w-0">
                  <span className="line-clamp-2 block leading-tight font-semibold text-paper underline-offset-4 group-hover:underline">
                     {post.author.displayName}
                  </span>
                  {/*
                   * A username is optional now: better-auth creates an account
                   * before the angler has picked one. Rendering it unconditionally
                   * printed a bare "@" with nothing after it.
                   */}
                  {post.author.username ? (
                     <span className="block truncate text-[13px] text-paper-2">
                        @{post.author.username}
                     </span>
                  ) : null}
               </span>
            </Link>
         </header>

         {images.length > 0 ? (
            <Carousel label={heading ? `Photos of ${heading}` : 'Photos'}>
               <div className="relative">
                  <CarouselContent>
                     {images.map((entry, index) => (
                        <CarouselItem key={entry.image.id}>
                           {/*
                            * The window follows the photograph. Catch photos are
                            * mostly held up to the camera and come out portrait,
                            * and a 4:3 centre crop kept only the middle half of
                            * those, which is reliably the half without the tail
                            * or the angler's face in it.
                            */}
                           <Img
                              src={entry.image.url}
                              cardSrc={entry.image.cardUrl}
                              thumbSrc={entry.image.thumbUrl}
                              alt={
                                 heading
                                    ? `${heading}, photo ${index + 1} of ${images.length}`
                                    : `Photo ${index + 1} of ${images.length}`
                              }
                              ratio="4 / 3"
                              /* The column is 960px at its widest and the whole
                                 width of a phone below that. */
                              sizes="(min-width: 992px) 960px, 100vw"
                              objectPosition={`${Math.round((entry.image.focusX ?? 0.5) * 100)}% ${Math.round((entry.image.focusY ?? 0.5) * 100)}%`}
                              className="w-full bg-black-block-2"
                           />
                        </CarouselItem>
                     ))}
                  </CarouselContent>
                  <CarouselPrevious />
                  <CarouselNext />
               </div>
               <CarouselCounter className="px-4 pt-3 text-paper-2" />
            </Carousel>
         ) : (
            /*
             * No photograph. A card that simply skips the picture collapses to a
             * headline over a link and reads as though something failed to load,
             * so the space is kept and given the house fish. Most catches are
             * never photographed, so this is the common card, not the odd one.
             */
            <div
               aria-hidden="true"
               className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-black-block-2"
            >
               <FishMark className="h-9 w-14 text-paper/20" />
               <span className="absolute inset-x-0 bottom-0 h-1 bg-teal/70" />
            </div>
         )}

         {/*
          * No fixed height. It used to hold the body at 292px and clip what
          * did not fit, which cut the like and comment line in half at the
          * foot of the card. The height was there to line stacked cards up,
          * and there is nothing to line up with: the feed is one column at
          * every width. A card is as tall as what is in it.
          */}
         <div className="flex flex-1 flex-col gap-3 px-4 pt-5 pb-6">
            {heading ? (
               <h2 id={`post-${post.id}`} className="g text-[30px] text-paper">
                  {heading}
               </h2>
            ) : (
               <span id={`post-${post.id}`} className="sr-only">
                  A catch from {post.author.displayName}
               </span>
            )}

            {measurement ? (
               /* League Gothic for the figures, but not uppercased: `cm` and `lb`
                  are units and are never shouted. Straight under the species,
                  because the fish and its size are one fact. */
               <p className="num -mt-1 font-display text-[26px] tracking-[0.03em] text-paper">
                  {measurement.value}
                  {measurement.source ? (
                     <span className="ml-2 font-sans text-[14px] tracking-normal text-paper-2">
                        {measurement.source}
                     </span>
                  ) : null}
               </p>
            ) : null}

            {/* Where and when, after what: the meta line reads as a caption
                to the fish rather than as a preamble to the photograph. */}
            <p className="text-[14px] text-paper-2">
               {contextSentence(post, showDistance)}
            </p>

            {called ? <p className="text-[15px] text-paper">{called}</p> : null}

            {post.content ? (
               <p className="line-clamp-3 text-[15px] leading-relaxed whitespace-pre-line text-paper">
                  {post.content}
               </p>
            ) : null}

            {recordHref ? (
               /*
                * The card's primary action, drawn as one. It was a bare teal
                * link on a row of its own, which spent a whole line on the one
                * thing the card is for and still looked like body text.
                */
               <Link
                  to={recordHref}
                  className="g-tracked inline-flex min-h-11 items-center gap-2 self-start border border-paper/30 px-4 text-[15px] text-paper transition-colors duration-150 [transition-timing-function:var(--ease)] hover:border-paper hover:bg-paper/10"
               >
                  See the catch
               </Link>
            ) : null}

            <div className="rule-dashed mt-auto flex flex-wrap items-center gap-x-6 pt-2">
               {isSignedIn ? (
                  <button
                     type="button"
                     aria-pressed={post.likedByMe}
                     aria-label={post.likedByMe ? 'Liked' : 'Like'}
                     onClick={onLike}
                     className={`${textControl} gap-2 ${post.likedByMe ? 'text-teal' : 'text-paper-2 hover:text-paper'}`}
                  >
                     {post.likedByMe ? (
                        <HeartSolid aria-hidden="true" className="size-5" />
                     ) : (
                        <HeartIcon aria-hidden="true" className="size-5" />
                     )}
                     <span className="num">{post.likeCount}</span>
                  </button>
               ) : (
                  <Link
                     to="/sign-in"
                     aria-label="Sign in to like"
                     aria-pressed={false}
                     className={`${textControl} gap-2 text-paper-2 hover:text-paper`}
                  >
                     <HeartIcon aria-hidden="true" className="size-5" />
                  </Link>
               )}

               <button
                  type="button"
                  aria-pressed={commentsOpen}
                  aria-expanded={commentsOpen}
                  aria-controls={threadId}
                  aria-label="Comments"
                  onClick={onToggleComments}
                  className={`${textControl} gap-2 ${commentsOpen ? 'text-teal' : 'text-paper-2 hover:text-paper'}`}
               >
                  <ChatBubbleOvalLeftIcon
                     aria-hidden="true"
                     className="size-5"
                  />
                  <span className="num">{post.commentCount}</span>
               </button>

               {isSignedIn ? (
                  <button
                     type="button"
                     aria-pressed={post.savedByMe === true}
                     aria-label={post.savedByMe ? 'Kept' : 'Keep'}
                     onClick={onSave}
                     className={`${textControl} gap-2 ${post.savedByMe ? 'text-teal' : 'text-paper-2 hover:text-paper'}`}
                  >
                     {post.savedByMe ? (
                        <BookmarkSolid aria-hidden="true" className="size-5" />
                     ) : (
                        <BookmarkIcon aria-hidden="true" className="size-5" />
                     )}
                  </button>
               ) : null}

               {canFollow ? (
                  <button
                     type="button"
                     aria-pressed={post.authorFollowedByMe === true}
                     onClick={post.authorFollowedByMe ? onUnfollow : onFollow}
                     className={`${textControl} ml-auto gap-2 ${post.authorFollowedByMe ? 'text-teal' : 'text-paper-2 hover:text-paper'}`}
                  >
                     {post.authorFollowedByMe ? (
                        <UserMinusIcon aria-hidden="true" className="size-5" />
                     ) : (
                        <UserPlusIcon aria-hidden="true" className="size-5" />
                     )}
                     {post.authorFollowedByMe ? 'Following' : 'Follow'}
                  </button>
               ) : null}
            </div>

            {counts ? (
               <p className="num text-[14px] text-paper-2">{counts}</p>
            ) : null}

            {actionError ? (
               <p className="text-[15px] text-paper">{actionError}</p>
            ) : null}

            {commentsOpen ? (
               <CommentThread
                  id={threadId}
                  comments={post.comments}
                  commentCount={post.commentCount}
                  isSignedIn={isSignedIn}
                  draft={draft}
                  onDraftChange={onDraftChange}
                  onSubmit={onSubmitComment}
                  isSubmitting={isSubmittingComment}
                  error={commentError}
                  onReadAll={onReadAllComments}
                  isReadingAll={isReadingAllComments}
                  hasReadAll={hasReadAllComments}
               />
            ) : (
               <div id={threadId} hidden />
            )}
         </div>
      </article>
   );
}
