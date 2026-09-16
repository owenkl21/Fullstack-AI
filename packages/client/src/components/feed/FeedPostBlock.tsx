import { Link } from 'react-router-dom';
import { SignInButton } from '@clerk/react';

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
   const images =
      post.type === 'CATCH'
         ? (post.catch?.images ?? [])
         : (post.site?.images ?? []);
   const heading =
      post.type === 'CATCH'
         ? (post.catch?.title ?? null)
         : (post.site?.name ?? null);
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
      <article className="blk" aria-labelledby={`post-${post.id}`}>
         <header className="flex items-center gap-3 px-4 pt-5 pr-12 pb-3">
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
               <span className="block truncate font-semibold text-paper">
                  {post.author.displayName}
               </span>
               <span className="block truncate text-[14px] text-paper-2">
                  @{post.author.username}
               </span>
            </span>
         </header>

         <p className="px-4 pb-4 text-[15px] text-paper-2">
            {contextSentence(post, showDistance)}
         </p>

         {images.length > 0 ? (
            <Carousel label={heading ? `Photos of ${heading}` : 'Photos'}>
               <div className="relative">
                  <CarouselContent>
                     {images.map((entry, index) => (
                        <CarouselItem key={entry.image.id}>
                           <div className="aspect-[4/3] w-full bg-black-block-2">
                              <img
                                 src={entry.image.url}
                                 alt={
                                    heading
                                       ? `${heading}, photo ${index + 1} of ${images.length}`
                                       : `Photo ${index + 1} of ${images.length}`
                                 }
                                 loading="lazy"
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
         ) : null}

         <div className="flex flex-col gap-3 px-4 pt-5 pb-6">
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
                  are units and are never shouted. */
               <p className="num font-display text-[24px] tracking-[0.03em] text-paper">
                  {measurement.value}
                  {measurement.source ? (
                     <span className="ml-2 font-sans text-[14px] tracking-normal text-paper-2">
                        {measurement.source}
                     </span>
                  ) : null}
               </p>
            ) : null}

            {post.content ? (
               <p className="text-[15px] leading-relaxed whitespace-pre-line text-paper">
                  {post.content}
               </p>
            ) : null}

            {recordHref ? (
               <Link
                  to={recordHref}
                  className={`${textControl} self-start text-teal hover:opacity-80`}
               >
                  {recordLabel}
               </Link>
            ) : null}

            <div className="rule-dashed flex flex-wrap items-center gap-x-6 pt-2">
               {isSignedIn ? (
                  <button
                     type="button"
                     aria-pressed={post.likedByMe}
                     onClick={onLike}
                     className={`${textControl} ${post.likedByMe ? 'text-teal' : 'text-paper-2 hover:text-paper'}`}
                  >
                     {post.likedByMe ? 'Liked' : 'Like'}
                  </button>
               ) : (
                  <SignInButton mode="modal">
                     <button
                        type="button"
                        aria-pressed={false}
                        className={`${textControl} text-paper-2 hover:text-paper`}
                     >
                        Like
                     </button>
                  </SignInButton>
               )}

               <button
                  type="button"
                  aria-pressed={commentsOpen}
                  aria-expanded={commentsOpen}
                  aria-controls={threadId}
                  onClick={onToggleComments}
                  className={`${textControl} ${commentsOpen ? 'text-teal' : 'text-paper-2 hover:text-paper'}`}
               >
                  Comment
               </button>

               {canFollow ? (
                  <button
                     type="button"
                     aria-pressed={post.authorFollowedByMe === true}
                     onClick={post.authorFollowedByMe ? onUnfollow : onFollow}
                     className={`${textControl} ml-auto ${post.authorFollowedByMe ? 'text-teal' : 'text-paper-2 hover:text-paper'}`}
                  >
                     {post.authorFollowedByMe ? 'Following' : 'Follow'}
                  </button>
               ) : null}
            </div>

            <p className="num text-[14px] text-paper-2">
               {countSentence(post.likeCount, post.commentCount)}
            </p>

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
