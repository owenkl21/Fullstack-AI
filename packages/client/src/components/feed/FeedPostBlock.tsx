import {
   ArrowRightIcon,
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
import { useState } from 'react';
import { FishMark } from '@/components/brand/FishMark';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

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
   waterWord,
} from '@/components/feed/format';
import type { FeedPostInView } from '@/components/feed/types';

const textControl =
   'g-tracked inline-flex h-12 items-center text-[19px] transition-[color,opacity] duration-150 [transition-timing-function:var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal';

/** `Caught at Kalk Bay · Tue 15 Sep, 06:42 · 4 h ago`, built from what the post carries. */
function contextSentence(post: FeedPostInView, showDistance: boolean) {
   const stamp = formatStamp(post.createdAt);
   const relative = formatRelative(post.createdAt);
   const distance = showDistance ? formatDistance(post.distanceKm) : null;

   if (post.type === 'CATCH') {
      const spot = post.catch?.site?.name ?? null;
      if (spot) {
         return joinMeta([`Caught at ${spot}`, stamp, relative, distance]);
      }
      return joinMeta([
         stamp ? `Caught on ${stamp}` : 'Caught',
         relative,
         distance,
      ]);
   }

   const water = waterWord(post.site?.waterType);
   return joinMeta([
      water ? `Added a ${water} spot` : 'Added a spot',
      stamp,
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
   /* Which photographs came back taller than they are wide. Filled in on
    * load, because the feed payload does not carry image dimensions. */
   const [portrait, setPortrait] = useState<Record<string, boolean>>({});

   const counts = countSentence(post.likeCount, post.commentCount);

   const images =
      post.type === 'CATCH'
         ? (post.catch?.images ?? [])
         : (post.site?.images ?? []);
   /*
    * The fish leads. A card used to be headed by whatever the angler typed
    * as a title, with the species in small type under it, so a row of cards
    * read "Morning session", "Tuesday", "Slangkop" and never said what was
    * caught. The species is the heading; the angler's own title, when it is
    * more than the species again, sits under the figures as what they called
    * it.
    */
   const heading =
      post.type === 'CATCH'
         ? post.catch?.species?.trim() || post.catch?.title || null
         : (post.site?.name ?? null);
   const called =
      post.type === 'CATCH' &&
      post.catch?.title &&
      heading &&
      post.catch.title.trim().toLowerCase() !== heading.trim().toLowerCase()
         ? post.catch.title.trim()
         : null;
   const recordHref = post.catch
      ? `/catches/${post.catch.id}`
      : post.site
        ? `/sites/${post.site.id}`
        : null;
   const recordLabel = post.type === 'CATCH' ? 'See the catch' : 'See the spot';
   const measurement = measurementLine(post);
   const threadId = `comments-${post.id}`;
   const canFollow = isSignedIn && post.authorIsMe !== true;

   return (
      <article
         className="blk flex h-full flex-col"
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
                  <img
                     src={post.author.avatarUrl}
                     alt=""
                     width={40}
                     height={40}
                     loading="lazy"
                     className="size-10 shrink-0 rounded-full object-cover"
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
                  <span className="block truncate font-semibold text-paper underline-offset-4 group-hover:underline">
                     {post.author.displayName}
                  </span>
                  {/*
                   * A username is optional now: better-auth creates an account
                   * before the angler has picked one. Rendering it unconditionally
                   * printed a bare "@" with nothing after it.
                   */}
                  {post.author.username ? (
                     <span className="block truncate text-[14px] text-paper-2">
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
                           <div
                              className={cn(
                                 'w-full bg-black-block-2',
                                 portrait[entry.image.id]
                                    ? 'aspect-[4/5] max-h-[560px]'
                                    : 'aspect-[4/3]'
                              )}
                           >
                              <img
                                 src={entry.image.url}
                                 alt={
                                    heading
                                       ? `${heading}, photo ${index + 1} of ${images.length}`
                                       : `Photo ${index + 1} of ${images.length}`
                                 }
                                 loading="lazy"
                                 onLoad={(event) => {
                                    const img = event.currentTarget;
                                    if (img.naturalHeight > img.naturalWidth) {
                                       setPortrait((was) =>
                                          was[entry.image.id]
                                             ? was
                                             : {
                                                  ...was,
                                                  [entry.image.id]: true,
                                               }
                                       );
                                    }
                                 }}
                                 className="h-full w-full object-cover"
                              />
                           </div>
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
               className="relative flex h-[132px] w-full items-center justify-center overflow-hidden bg-black-block-2"
            >
               <FishMark className="h-9 w-14 text-paper/20" />
               <span className="absolute inset-x-0 bottom-0 h-1 bg-teal/70" />
            </div>
         )}

         <div className="flex flex-1 flex-col gap-3 px-4 pt-5 pb-6">
            {heading ? (
               <h2 id={`post-${post.id}`} className="g text-[30px] text-paper">
                  {heading}
               </h2>
            ) : (
               <span id={`post-${post.id}`} className="sr-only">
                  {post.type === 'CATCH' ? 'A catch' : 'A spot'} from{' '}
                  {post.author.displayName}
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
               <p className="text-[15px] leading-relaxed whitespace-pre-line text-paper">
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
                  {recordLabel}
                  <ArrowRightIcon aria-hidden="true" className="size-4" />
               </Link>
            ) : null}

            <div className="rule-dashed mt-auto flex flex-wrap items-center gap-x-6 pt-2">
               {isSignedIn ? (
                  <button
                     type="button"
                     aria-pressed={post.likedByMe}
                     onClick={onLike}
                     className={`${textControl} gap-2 ${post.likedByMe ? 'text-teal' : 'text-paper-2 hover:text-paper'}`}
                  >
                     {post.likedByMe ? (
                        <HeartSolid aria-hidden="true" className="size-5" />
                     ) : (
                        <HeartIcon aria-hidden="true" className="size-5" />
                     )}
                     {post.likedByMe ? 'Liked' : 'Like'}
                     {post.likeCount > 0 ? (
                        <span className="num">{post.likeCount}</span>
                     ) : null}
                  </button>
               ) : (
                  <Link
                     to="/sign-in"
                     aria-pressed={false}
                     className={`${textControl} gap-2 text-paper-2 hover:text-paper`}
                  >
                     <HeartIcon aria-hidden="true" className="size-5" />
                     Like
                  </Link>
               )}

               <button
                  type="button"
                  aria-pressed={commentsOpen}
                  aria-expanded={commentsOpen}
                  aria-controls={threadId}
                  onClick={onToggleComments}
                  className={`${textControl} gap-2 ${commentsOpen ? 'text-teal' : 'text-paper-2 hover:text-paper'}`}
               >
                  <ChatBubbleOvalLeftIcon
                     aria-hidden="true"
                     className="size-5"
                  />
                  Comment
                  {post.commentCount > 0 ? (
                     <span className="num">{post.commentCount}</span>
                  ) : null}
               </button>

               {isSignedIn ? (
                  <button
                     type="button"
                     aria-pressed={post.savedByMe === true}
                     onClick={onSave}
                     className={`${textControl} gap-2 ${post.savedByMe ? 'text-teal' : 'text-paper-2 hover:text-paper'}`}
                  >
                     {post.savedByMe ? (
                        <BookmarkSolid aria-hidden="true" className="size-5" />
                     ) : (
                        <BookmarkIcon aria-hidden="true" className="size-5" />
                     )}
                     {post.savedByMe ? 'Kept' : 'Keep'}
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
