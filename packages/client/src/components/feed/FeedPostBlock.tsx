import {
   ChatBubbleOvalLeftIcon,
   HeartIcon,
   BookmarkIcon,
   FlagIcon,
   TrashIcon,
} from '@heroicons/react/24/outline';
import {
   HeartIcon as HeartSolid,
   BookmarkIcon as BookmarkSolid,
} from '@heroicons/react/24/solid';
import { useState } from 'react';
import { BadgeStrip } from '@/components/badges/Badge';
import { BadgeControl } from '@/components/badges/BadgePicker';
import type { BadgeKind } from '@/components/badges/kinds';
import { FishMark } from '@/components/brand/FishMark';
import { Img } from '@/components/Img';
import { VerifiedMark } from '@/components/profile/VerifiedMark';
import { TeamBadge } from '@/components/profile/TeamBadge';
import { Link } from 'react-router-dom';
import { isAdminSession, useSession } from '@/lib/auth-client';
import { RemoveDialog, ReportSheet } from '@/components/feed/moderation';
import { removeAsTeam } from '@/components/feed/moderation-api';
import { toast } from '@/components/ui/use-toast';

import {
   Carousel,
   CarouselContent,
   CarouselCounter,
   CarouselItem,
   CarouselNext,
   CarouselPrevious,
} from '@/components/ui/carousel';
import {
   CommentThread,
   type ThreadViewer,
} from '@/components/feed/CommentThread';
import {
   formatDistance,
   formatLength,
   formatRelative,
   formatStamp,
   formatWeight,
   joinMeta,
   sourceWord,
} from '@/components/feed/format';
import type { FeedPost, FeedPostInView } from '@/components/feed/types';

/*
 * A word, not a button drawn around a word. Follow, See the catch, Post and
 * Read the other five are all the same object: League Gothic, tracked, at the
 * height a thumb needs, and nothing else. The card has one teal corner and one
 * dashed rule in it, and a row of outlined boxes on top of that made every
 * card look like a form.
 */
const word =
   'g-tracked inline-flex items-center tracking-[0.07em] transition-[color,opacity] duration-150 [transition-timing-function:var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal';

/** One action in the row: a 44px target holding a 22px icon and its count. */
const action = `${word} h-11 gap-1.5`;

/*
 * `Caught at Kalk Bay, Tue 15 Sep, 06:42 · Posted 4 h ago`, built from what the
 * post carries. Two times, each named: when the fish came out, as the angler
 * logged it, and when it went on the feed. A fish logged that evening was not
 * caught at supper, and the card used to say it was.
 */
function contextSentence(post: FeedPostInView, showDistance: boolean) {
   const stamp = formatStamp(post.catch?.caughtAt ?? post.createdAt);
   /* Recent posts say how long ago; older ones give the day. */
   const postedWhen =
      formatRelative(post.createdAt) ?? formatStamp(post.createdAt);
   const relative = postedWhen ? `Posted ${postedWhen}` : null;
   const distance = showDistance ? formatDistance(post.distanceKm) : null;
   /*
    * The spot rides on the post as well as on the catch, and the post's copy is
    * the one that honours a withheld mark. Either way it is named here, which is
    * why a spot has no card of its own any more.
    */
   const spot = post.catch?.site?.name ?? post.site?.name ?? null;

   /* One dot a line: the place and time are one fact, the rest is another. */
   const since = [relative, distance].filter(Boolean).join(', ');
   if (spot) {
      return joinMeta([
         [`Caught at ${spot}`, stamp].filter(Boolean).join(', '),
         since,
      ]);
   }

   return joinMeta([stamp ? `Caught on ${stamp}` : 'Caught', since]);
}

/*
 * The size, or nothing at all.
 *
 * A catch that was never measured has no line here and never had a line saying
 * so: "Not measured" printed under half the feed, in the same place the figures
 * go, and said less than the empty space does.
 */
function measurementLine(post: FeedPostInView) {
   const length = formatLength(post.catch?.lengthCm);
   const weight = formatWeight(post.catch?.weightKg);
   if (!length && !weight) return null;

   /*
    * A source only describes the fact it was taken for. The API sends no
    * `lengthSource` at all today, and a length-only catch carries
    * `weightSource: 'LENGTH'`, which describes a weight that is not on the card:
    * `sourceWord` gives that one no word, so nothing is claimed about a figure
    * nobody took.
    */
   const source = weight
      ? (post.catch?.weightSource ?? null)
      : (post.catch?.lengthSource ?? null);
   return { value: joinMeta([length, weight]), source: sourceWord(source) };
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
   viewer,
   draft,
   onDraftChange,
   onPatch,
   focusCommentId,
   onRemoved,
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
   /* Who is reading, for the thread. Null when nobody is signed in. */
   viewer: ThreadViewer | null;
   /* The new comment being written. Held by the page, so closing the thread
      and opening it again does not lose a sentence half typed. */
   draft: string;
   onDraftChange: (next: string) => void;
   /* Everything the thread does to the post goes through this one door. */
   onPatch: (update: (post: FeedPost) => FeedPost) => void;
   /* A comment a link pointed at, for the thread to open to. */
   focusCommentId?: string | null;
   /* The team took the post down: the page drops the card. */
   onRemoved?: () => void;
}) {
   const images = post.catch?.images ?? [];
   /*
    * The fish leads. A card used to be headed by whatever the angler typed
    * as a title, with the species in small type under it, so a row of cards
    * read "Morning session", "Tuesday", "Slangkop" and never said what was
    * caught. The species is the heading; the angler's own title, when it is
    * more than the species again, sits above the notes as what they called it.
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

   /*
    * Reporting is for a post that is somebody else's; the team takes posts
    * down instead of reporting them. The author has neither: their own post
    * is deleted from the catch.
    */
   const { data: session } = useSession();
   const isTeam = isAdminSession(session?.user);
   const canReport = isSignedIn && post.authorIsMe !== true && !isTeam;
   const [reporting, setReporting] = useState(false);
   const [takingDown, setTakingDown] = useState(false);
   const takeDown = async () => {
      setTakingDown(false);
      try {
         await removeAsTeam('post', post.id);
         toast({ title: 'Post taken down.', variant: 'success' });
         onRemoved?.();
      } catch {
         toast({
            title: 'That did not go through.',
            description: 'The post is still up. Try again.',
            variant: 'error',
         });
      }
   };

   /*
    * The badges live on the post the page holds, so a badge pinned here is
    * still there when the card is redrawn. Which one just landed is the card's
    * own business and is forgotten on the next render of the feed.
    */
   const badges = post.catch?.badges ?? [];
   const [landed, setLanded] = useState<BadgeKind | null>(null);
   const setBadges = (next: typeof badges, justLanded: BadgeKind | null) => {
      setLanded(justLanded);
      onPatch((current) => ({
         ...current,
         catch: current.catch ? { ...current.catch, badges: next } : null,
      }));
   };

   /*
    * The photograph's box, at both shapes the card takes. On a phone it is the
    * full width of the card at 4:3; at desktop the card turns sideways and this
    * is the left column, 600 wide and spanning both rows, so the header and the
    * fish sit beside it rather than under it.
    *
    * It fills the column's height, but only up to a portrait photograph's
    * (3:4, 800 at this width) and never past the window. An open thread can
    * make the column two thousand pixels tall, and a photograph stretched to
    * that is a thin strip from the middle of the fish; instead it stops, and
    * holds under the bar while the thread is read beside it.
    */
   const frame =
      'relative aspect-[4/3] w-full overflow-hidden bg-black-block-2 lg:sticky lg:top-[60px] lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:min-h-[min(100%,800px,calc(100svh_-_60px))] lg:w-[600px] lg:self-start';

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
          *
          * Height only. The shorthand takes one length for BOTH axes, so
          * `contain-intrinsic-size: auto 660px` told the browser every card
          * it had not drawn yet was also 660 pixels WIDE, and on a 390 pixel
          * phone the photograph came out at 660 across: overflowing, zoomed
          * in and soft. The width of a card is not a guess to be made, it is
          * the column it sits in.
          *
          * A sideways card is about 470 pixels tall, not 1100, so the desktop
          * guess is the sideways one from `lg` up and the tall stacked one
          * only in the band between where the column stops growing and where
          * the card turns.
          */
         className="blk blk-flat grid h-full grid-cols-1 [content-visibility:auto] [contain-intrinsic-height:auto_660px] md:[contain-intrinsic-height:auto_1000px] lg:grid-cols-[600px_1fr] lg:grid-rows-[auto_1fr] lg:[contain-intrinsic-height:auto_470px]"
         aria-labelledby={`post-${post.id}`}
         /* What a link to this post scrolls to, clear of the bar above. */
         id={`post-card-${post.id}`}
         style={{ scrollMarginTop: 88 }}
      >
         <header className="flex items-center gap-3 px-4 pt-4 pr-10 pb-3.5 lg:col-start-2 lg:row-start-1 lg:px-6 lg:pr-9 lg:pt-5 lg:pb-0">
            {/*
             * The photograph and the name are one link. Making only the name
             * clickable left a 26px target, which is under the minimum and
             * fiddly next to a 40px photograph that looked just as pressable.
             */}
            <Link
               to={`/anglers/${post.author.id}`}
               /* A 44px target inside a 40px row: it overlaps the header's
                  own padding rather than making the header taller. */
               className="group -my-0.5 flex min-h-11 min-w-0 items-center gap-3"
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
                     className="size-10 shrink-0 rounded-full bg-paper/30"
                  />
               ) : (
                  <span
                     aria-hidden="true"
                     className="g grid size-10 shrink-0 place-items-center rounded-full bg-paper/30 text-[20px] text-paper"
                  >
                     {post.author.displayName.slice(0, 1)}
                  </span>
               )}
               <span className="min-w-0 leading-tight">
                  {/* The name is its own truncating box and the marks come
                      after it, so a long name gives way and the seal and the
                      team label never do. */}
                  <span className="flex min-w-0 items-baseline text-[16px] font-semibold text-paper">
                     <span className="truncate underline-offset-4 group-hover:underline">
                        {post.author.displayName}
                     </span>
                     {post.author.verified ? (
                        <VerifiedMark className="relative top-[0.16em]" />
                     ) : null}
                     {post.author.team ? <TeamBadge /> : null}
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

            {/*
             * Follow sits beside the angler it concerns rather than down in the
             * row of things you do to the fish. One word, and the word is the
             * state: teal while you follow, quiet while you do not.
             */}
            {canFollow ? (
               <button
                  type="button"
                  aria-pressed={post.authorFollowedByMe === true}
                  onClick={post.authorFollowedByMe ? onUnfollow : onFollow}
                  /* Same 44px target, same 40px row: the word keeps the
                     header the height the avatar sets. */
                  className={`${word} -my-0.5 ml-auto h-11 shrink-0 text-[15px] ${
                     post.authorFollowedByMe
                        ? 'text-teal-text hover:opacity-80'
                        : 'text-paper-2 hover:text-paper'
                  }`}
               >
                  {post.authorFollowedByMe ? 'Following' : 'Follow'}
               </button>
            ) : null}
         </header>

         {images.length > 0 ? (
            <div className={frame}>
               {/* The carousel fills the frame rather than setting it, so the
                   photograph is the same shape whether the card is stacked or
                   sideways and whatever the words beside it come to. */}
               <Carousel
                  label={heading ? `Photos of ${heading}` : 'Photos'}
                  className="absolute inset-0 [&>div]:h-full"
               >
                  <CarouselContent className="h-full">
                     {images.map((entry, index) => (
                        <CarouselItem
                           key={entry.image.id}
                           className="relative h-full"
                        >
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
                              fill
                              /* The whole width of a phone, and the card's own
                                 left column once the card turns sideways. */
                              sizes="(min-width: 1024px) 600px, 100vw"
                              /* Held where the angler framed it, or on
                                 the catch default when they never did. */
                              framing={entry.image}
                           />
                        </CarouselItem>
                     ))}
                  </CarouselContent>
                  <CarouselPrevious />
                  <CarouselNext />
                  {/*
                   * Where you are in the set, on the picture itself. It used to
                   * be a line of type under the photograph, which spent a whole
                   * row of the card saying "2 of 5".
                   */}
                  <CarouselCounter
                     separator="/"
                     className="num absolute top-3 right-3 bg-black-block/72 px-2 py-[5px] text-[12px] leading-none tracking-[0.14em] text-paper"
                  />
               </Carousel>
            </div>
         ) : (
            /*
             * No photograph. A card that simply skips the picture collapses to a
             * headline over a link and reads as though something failed to load,
             * so the space is kept and given the house fish. Most catches are
             * never photographed, so this is the common card, not the odd one,
             * and a column of them keeps its rhythm.
             */
            <div
               aria-hidden="true"
               className={`${frame} grid place-items-center`}
            >
               <FishMark className="size-[120px] text-paper/22 lg:size-[140px]" />
               <span className="absolute inset-x-0 bottom-0 h-1 bg-teal/70" />
            </div>
         )}

         {/*
          * No fixed height. It used to hold the body at 292px and clip what
          * did not fit, which cut the like and comment line in half at the
          * foot of the card. A card is as tall as what is in it, except
          * sideways, where the photograph sets the height and the action row
          * falls to the bottom of the column beside it.
          */}
         <div className="flex flex-col px-4 py-[18px] lg:col-start-2 lg:row-start-2 lg:px-6 lg:pt-7 lg:pb-5">
            <div className="flex flex-col gap-2">
               {heading ? (
                  <h2
                     id={`post-${post.id}`}
                     className="g text-[30px] text-paper lg:text-[36px]"
                  >
                     {heading}
                  </h2>
               ) : (
                  <span id={`post-${post.id}`} className="sr-only">
                     A catch from {post.author.displayName}
                  </span>
               )}

               {measurement ? (
                  /* League Gothic for the figures, but not uppercased: `cm` and
                     `kg` are units and are never shouted. Straight under the
                     species, because the fish and its size are one fact. */
                  <p className="flex items-baseline gap-2.5 leading-none">
                     <span className="num font-display text-[26px] leading-none tracking-[0.03em] text-paper lg:text-[28px]">
                        {measurement.value}
                     </span>
                     {measurement.source ? (
                        <span className="text-[14px] text-paper-2">
                           {measurement.source}
                        </span>
                     ) : null}
                  </p>
               ) : null}

               {/*
                * What the team called the fish, with the fish: under the
                * species and the figures, above where and when. Never over the
                * photograph, which is the angler's and holds the fish and
                * often the angler as well.
                */}
               <BadgeStrip
                  badges={badges}
                  justLanded={landed}
                  className="mt-0.5 text-paper"
               />

               {/* Where and when, after what: the meta line reads as a caption
                   to the fish rather than as a preamble to the photograph. */}
               <p className="text-[14px] text-paper-2">
                  {contextSentence(post, showDistance)}
               </p>

               {called ? (
                  <p className="text-[15px] font-semibold text-paper">
                     {called}
                  </p>
               ) : null}

               {post.content ? (
                  <p className="line-clamp-3 text-[15px] leading-relaxed whitespace-pre-line text-paper">
                     {post.content}
                  </p>
               ) : null}
            </div>

            {/*
             * One row, under one dashed rule, and it is the whole foot of the
             * card: what you can do to the fish on the left, where the fish
             * lives on the right. The sentence that used to sit under it
             * counting the likes said again, in words, what the figures beside
             * the hearts already say.
             */}
            {/* The team has two more controls in the row (badges, take down), so
                the row closes up for them rather than folding See the catch
                onto two lines. */}
            <div
               className={`mt-4 flex items-center border-t border-dashed border-line-2 pt-3 lg:mt-auto ${isTeam ? 'gap-[14px]' : 'gap-[22px]'}`}
            >
               {isSignedIn ? (
                  <button
                     type="button"
                     aria-pressed={post.likedByMe}
                     aria-label={post.likedByMe ? 'Liked' : 'Like'}
                     onClick={onLike}
                     className={`${action} ${post.likedByMe ? 'text-teal-text' : 'text-paper-2 hover:text-paper'}`}
                  >
                     {post.likedByMe ? (
                        <HeartSolid
                           aria-hidden="true"
                           className="size-[22px]"
                        />
                     ) : (
                        <HeartIcon
                           aria-hidden="true"
                           className="size-[22px]"
                           strokeWidth={1.5}
                        />
                     )}
                     <span className="num text-[19px] tracking-[0.04em]">
                        {post.likeCount}
                     </span>
                  </button>
               ) : (
                  <Link
                     to="/sign-in"
                     aria-label="Sign in to like"
                     className={`${action} text-paper-2 hover:text-paper`}
                  >
                     <HeartIcon
                        aria-hidden="true"
                        className="size-[22px]"
                        strokeWidth={1.5}
                     />
                     <span className="num text-[19px] tracking-[0.04em]">
                        {post.likeCount}
                     </span>
                  </Link>
               )}

               <button
                  type="button"
                  aria-pressed={commentsOpen}
                  aria-expanded={commentsOpen}
                  aria-controls={threadId}
                  aria-label="Comments"
                  onClick={onToggleComments}
                  className={`${action} ${commentsOpen ? 'text-teal-text' : 'text-paper-2 hover:text-paper'}`}
               >
                  <ChatBubbleOvalLeftIcon
                     aria-hidden="true"
                     className="size-[22px]"
                     strokeWidth={1.5}
                  />
                  <span className="num text-[19px] tracking-[0.04em]">
                     {post.commentCount}
                  </span>
               </button>

               {isSignedIn ? (
                  <button
                     type="button"
                     aria-pressed={post.savedByMe === true}
                     aria-label={post.savedByMe ? 'Kept' : 'Keep'}
                     onClick={onSave}
                     className={`${action} ${post.savedByMe ? 'text-teal-text' : 'text-paper-2 hover:text-paper'}`}
                  >
                     {post.savedByMe ? (
                        <BookmarkSolid
                           aria-hidden="true"
                           className="size-[22px]"
                        />
                     ) : (
                        <BookmarkIcon
                           aria-hidden="true"
                           className="size-[22px]"
                           strokeWidth={1.5}
                        />
                     )}
                  </button>
               ) : null}

               {/*
                * The team's own control, and nobody else's: it draws nothing
                * at all unless the session says admin, and the routes behind
                * it answer 404 to everyone else whatever is on the screen.
                */}
               {post.catch ? (
                  <BadgeControl
                     catchId={post.catch.id}
                     fishName={heading ?? 'this catch'}
                     badges={badges}
                     onChange={setBadges}
                     compact
                  />
               ) : null}

               {canReport ? (
                  <button
                     type="button"
                     aria-label="Report this post"
                     onClick={() => setReporting(true)}
                     className={`${action} text-paper-2 hover:text-paper`}
                  >
                     <FlagIcon
                        aria-hidden="true"
                        className="size-[22px]"
                        strokeWidth={1.5}
                     />
                  </button>
               ) : isTeam ? (
                  <button
                     type="button"
                     aria-label="Take this post down"
                     onClick={() => setTakingDown(true)}
                     className={`${action} text-paper-2 hover:text-[#f0716a]`}
                  >
                     <TrashIcon
                        aria-hidden="true"
                        className="size-[22px]"
                        strokeWidth={1.5}
                     />
                  </button>
               ) : null}

               {recordHref ? (
                  /* The card's one primary action, and the only thing on the
                     right of the row. */
                  <Link
                     to={recordHref}
                     className={`${word} ml-auto h-11 shrink-0 text-[16px] whitespace-nowrap text-paper hover:opacity-80`}
                  >
                     See the catch
                  </Link>
               ) : null}
            </div>

            {actionError ? (
               <p className="mt-2 text-[14px] text-paper">{actionError}</p>
            ) : null}

            {commentsOpen ? (
               <CommentThread
                  id={threadId}
                  postId={post.id}
                  comments={post.comments}
                  threadCount={post.threadCount ?? post.comments.length}
                  viewer={isSignedIn ? viewer : null}
                  canModerate={post.authorIsMe === true}
                  draft={draft}
                  onDraftChange={onDraftChange}
                  onPatch={onPatch}
                  focusCommentId={focusCommentId}
               />
            ) : (
               <div id={threadId} hidden />
            )}
         </div>

         {canReport ? (
            <ReportSheet
               open={reporting}
               onOpenChange={setReporting}
               kind="post"
               id={post.id}
               author={post.author.displayName}
            />
         ) : null}
         {isTeam ? (
            <RemoveDialog
               open={takingDown}
               onOpenChange={setTakingDown}
               kind="post"
               author={post.author.displayName}
               excerpt={heading}
               onConfirm={() => void takeDown()}
            />
         ) : null}
      </article>
   );
}
