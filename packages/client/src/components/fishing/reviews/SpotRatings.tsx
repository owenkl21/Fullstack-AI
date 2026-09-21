import { StarIcon } from '@heroicons/react/24/solid';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { formatDayMonth, plural } from '@/components/fishing/record/format';
import { cn } from '@/lib/utils';
import { Stars } from './Stars';
import { StarPicker } from './StarPicker';
import {
   leaveRating,
   removeRating,
   readRatings,
   REVIEW_LIMIT,
   RATING_WORDS,
   type SpotRatings as Ratings,
   type SpotReview,
} from './reviews-api';

/*
 * What anglers make of a spot.
 *
 * One rating each, so the section has three faces: the owner reads what the
 * anglers who fish it made of it and has nothing to leave, a reader who is
 * signed out is asked to sign in, and everybody else gets the block to rate it
 * in. A rating already left opens in that same block, so changing it is
 * picking again rather than a second view to find. The figures come from the
 * server counted rather than read off a counter, so what is printed here is
 * what is actually in the rows.
 *
 * A spot with no ratings does not print a zero. Nought out of five is a
 * verdict, and nobody has been yet is not.
 */

type Store = {
   data: Ratings | null;
   failed: boolean;
   setData: (next: Ratings) => void;
};

/*
 * The rating as the header carries it, under the name on a phone and beside
 * it on a desktop: the stars, the figure and how many, as one link down to the
 * section. It reads the same store as the section, so the two cannot disagree.
 * While it loads it holds its height, so the page does not jump when the
 * figures land.
 */
export function HeaderRating({ store }: { store: Store }) {
   const { data, failed } = store;

   if (failed) {
      return null;
   }

   if (!data) {
      return <div aria-hidden="true" className="mt-2.5 min-h-11 md:mt-0" />;
   }

   const { summary, viewer } = data;
   const average = summary.count > 0 ? summary.average : null;

   if (average === null && viewer.isOwner) {
      return null;
   }

   const count = plural(summary.count, 'rating', 'ratings');

   return (
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 md:mt-0 md:flex-nowrap md:gap-5 md:pb-1.5">
         {average !== null ? (
            <a
               href="#ratings"
               aria-label={`Rated ${average.toFixed(1)} out of 5 from ${count}`}
               className="inline-flex min-h-11 items-center gap-2.5 text-inherit no-underline md:gap-3"
            >
               <Stars
                  value={average}
                  emptyClassName="text-paper/28"
                  className="gap-0.5 [--star:22px] md:gap-[3px] md:[--star:28px]"
               />
               <span className="g num text-[30px] leading-none text-paper md:text-[40px]">
                  {average.toFixed(1)}
               </span>
               <span className="lab num text-paper-2">{count}</span>
            </a>
         ) : (
            <span className="text-[14px] text-paper-2">Not rated yet</span>
         )}

         {viewer.isOwner ? null : (
            <a
               href="#ratings"
               className="g-tracked inline-flex min-h-11 items-center text-[18px] text-teal underline-offset-4 max-md:hover:underline md:h-11 md:border md:border-paper/30 md:px-[18px] md:text-[19px] md:text-paper md:hover:border-paper"
            >
               Rate it
            </a>
         )}
      </div>
   );
}

export function SpotRatings({
   siteId,
   siteName,
   store,
}: {
   siteId: string;
   siteName: string;
   store: Store;
}) {
   const { data, failed, setData } = store;

   /* Pages past the first, kept beside the first rather than folded into it,
      so a rating posted while reading does not reset what has been opened. */
   const [more, setMore] = useState<SpotReview[]>([]);
   const [cursor, setCursor] = useState(0);
   const [hasMore, setHasMore] = useState(false);
   const [reading, setReading] = useState(false);

   useEffect(() => {
      setMore([]);
      setCursor(data?.nextOffset ?? 0);
      setHasMore(data?.hasMore ?? false);
   }, [siteId, data?.nextOffset, data?.hasMore]);

   const summary = data?.summary ?? null;
   const viewer = data?.viewer ?? null;

   const loadMore = async () => {
      setReading(true);
      try {
         const next = await readRatings(siteId, { offset: cursor });
         setMore((was) => [...was, ...next.reviews]);
         setCursor(next.nextOffset);
         setHasMore(next.hasMore);
      } catch {
         setHasMore(false);
      } finally {
         setReading(false);
      }
   };

   const shown = data ? [...data.reviews, ...more] : [];
   /* Anyone but the owner gets the block, signed in or not, and only then
      does the section take a second column on a desktop. */
   const hasBlock = viewer !== null && !viewer.isOwner;
   const blockPlace =
      'mt-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0';

   return (
      /* The anchor sits outside the reveal. Until it is revealed the section
         is drawn 26px low, and a jump measured to it would land the heading
         under the sticky header. */
      <div id="ratings" className="mt-12 scroll-mt-[76px]">
         <section className="rv">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
               <h2 className="g text-[30px] md:text-[36px]">
                  What anglers make of it
               </h2>
               {summary && summary.count > 0 ? (
                  <p className="lab num">
                     {plural(summary.count, 'rating', 'ratings')}
                  </p>
               ) : null}
            </div>

            {failed ? (
               <p className="mt-4 max-w-[60ch] text-base text-ink-2">
                  Could not load the ratings for this spot just now.
               </p>
            ) : null}

            {!data && !failed ? (
               <div
                  role="status"
                  aria-label="Loading the ratings"
                  className="shimmer mt-5 h-[108px] bg-bg-2 md:mt-6 md:h-[140px]"
               />
            ) : null}

            {data && summary && viewer ? (
               <div
                  className={cn(
                     'mt-5 md:mt-6',
                     hasBlock &&
                        'lg:grid lg:grid-cols-[minmax(0,1fr)_520px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-16'
                  )}
               >
                  <div className="lg:col-start-1 lg:row-start-1">
                     {summary.count > 0 && summary.average !== null ? (
                        <div className="flex items-start gap-5 md:gap-10">
                           <div className="shrink-0">
                              <p className="g num text-[64px] leading-[0.9] text-ink md:text-[88px]">
                                 {summary.average.toFixed(1)}
                              </p>
                              <Stars
                                 value={summary.average}
                                 label={`${summary.average.toFixed(1)} out of 5`}
                                 className="mt-1.5 gap-0.5 [--star:22px] md:mt-2 md:gap-[3px] md:[--star:28px]"
                              />
                              <p className="lab num mt-1.5 md:mt-2">
                                 out of 5
                                 <span className="hidden md:inline">
                                    {' '}
                                    ·{' '}
                                    {plural(summary.count, 'rating', 'ratings')}
                                 </span>
                              </p>
                           </div>

                           {/*
                            * The spread, once there is one. Two opinions are not
                            * a distribution, and drawing five bars under a pair
                            * of ratings says more than the numbers know.
                            */}
                           {summary.count >= 3 ? (
                              <Spread summary={summary} />
                           ) : null}
                        </div>
                     ) : (
                        <p className="max-w-[60ch] text-base text-ink-2">
                           {viewer.isOwner
                              ? `Nobody has rated ${siteName} yet. Ratings come from the anglers who fish it, so this one is not yours to leave.`
                              : `Nobody has rated ${siteName} yet. Yours would be the first, and the first is the one every angler reads before driving out.`}
                        </p>
                     )}

                     {viewer.isOwner && summary.count > 0 ? (
                        <p className="mt-6 max-w-[60ch] text-base text-ink-2">
                           This one is yours, so the ratings on it belong to the
                           anglers who fish it rather than to you.
                        </p>
                     ) : null}
                  </div>

                  {hasBlock && viewer.signedIn ? (
                     <Composer
                        key={siteId}
                        siteId={siteId}
                        data={data}
                        setData={setData}
                        className={blockPlace}
                     />
                  ) : null}

                  {hasBlock && !viewer.signedIn ? (
                     <div className={cn('blk p-4 md:p-6', blockPlace)}>
                        <h3 className="lab text-teal-text">Rate this spot</h3>
                        <p className="mt-3 text-base text-ink-2">
                           Sign in to rate this spot.
                        </p>
                        <Link
                           to="/sign-in"
                           className="g-tracked inline-flex h-11 items-center text-[19px] text-teal-text underline-offset-4 hover:underline"
                        >
                           Sign in
                        </Link>
                     </div>
                  ) : null}

                  {shown.length > 0 ? (
                     <div className="lg:col-start-1 lg:row-start-2">
                        <ul className="mt-6 max-w-[68ch] lg:mt-8">
                           {shown.map((review) => (
                              <ReviewRow key={review.id} review={review} />
                           ))}
                        </ul>

                        {hasMore ? (
                           <Button
                              type="button"
                              variant="ghost"
                              className="mt-2"
                              disabled={reading}
                              onClick={() => void loadMore()}
                           >
                              {reading ? 'Reading' : 'Show more ratings'}
                           </Button>
                        ) : null}
                     </div>
                  ) : null}
               </div>
            ) : null}
         </section>
      </div>
   );
}

/*
 * Rating the spot, in the black block. It is keyed on the spot and seeded from
 * your own rating when there is one, so the stars and the words open as you
 * left them, and saving is only offered once something has changed. Posting
 * leaves the block as it is, filled in with what was saved.
 */
function Composer({
   siteId,
   data,
   setData,
   className,
}: {
   siteId: string;
   data: Ratings;
   setData: (next: Ratings) => void;
   className?: string;
}) {
   const yours = data.yours;

   const [pick, setPick] = useState<number | null>(yours?.rating ?? null);
   const [hover, setHover] = useState<number | null>(null);
   const [body, setBody] = useState(yours?.body ?? '');
   /* Which of the two is running, so each button names its own work. */
   const [busy, setBusy] = useState<'post' | 'remove' | null>(null);
   const [error, setError] = useState('');
   const bodyId = useId();

   const shown = hover ?? pick ?? 0;
   const saved = yours !== null;
   const dirty = !saved || pick !== yours.rating || body.trim() !== yours.body;
   const remaining = REVIEW_LIMIT - body.length;

   const submit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (pick === null) {
         setError('Tap a star first.');
         return;
      }

      setBusy('post');
      setError('');

      try {
         const result = await leaveRating(siteId, pick, body.trim());
         setData({
            ...data,
            summary: result.summary,
            yours: result.review,
            viewer: { ...data.viewer, hasRated: true },
         });
         /* The block stays as it is after a post, so this is the only word
            that it went through, for the eye and for a screen reader. */
         toast({
            title: saved ? 'Rating changed.' : 'Rating posted.',
            variant: 'success',
         });
      } catch {
         setError('Not posted. Check your connection and try again.');
      } finally {
         setBusy(null);
      }
   };

   const takeDown = async () => {
      setBusy('remove');
      setError('');

      try {
         const result = await removeRating(siteId);
         setData({
            ...data,
            summary: result.summary,
            yours: null,
            viewer: { ...data.viewer, hasRated: false },
         });
         setPick(null);
         setBody('');
      } catch {
         setError('Not taken down. Check your connection and try again.');
      } finally {
         setBusy(null);
      }
   };

   return (
      <form onSubmit={submit} className={cn('blk p-4 md:p-6', className)}>
         {/* Wrapping, so under 390 the longer hint drops to its own line
             whole rather than both labels breaking mid phrase. */}
         <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="lab text-teal-text">Rate this spot</h3>
            <p className="lab">
               {pick !== null ? 'Tap a star to change it' : 'Tap a star'}
            </p>
         </div>

         <StarPicker
            value={pick}
            hover={hover}
            onHover={setHover}
            onChange={(next) => {
               setPick(next);
               setError('');
            }}
            disabled={busy !== null}
            className="-mx-1.5 mt-3 md:-mx-2 md:mt-3.5 md:max-w-[360px]"
         />
         <p
            aria-live="polite"
            className={cn(
               'g mt-2 min-h-6 leading-none md:min-h-[26px]',
               shown ? 'text-[24px] text-paper' : 'text-[15px] text-paper-2'
            )}
         >
            {shown
               ? RATING_WORDS[shown]
               : 'One is water you would not go back to, five is the best you know.'}
         </p>

         <label htmlFor={bodyId} className="lab mt-4 block md:mt-5">
            In your own words, if you want to
         </label>
         <textarea
            id={bodyId}
            value={body}
            rows={3}
            maxLength={REVIEW_LIMIT}
            disabled={busy !== null}
            onChange={(event) => setBody(event.target.value)}
            placeholder="How it fishes, how you get on to it, what runs there."
            className="input-line mt-2 block min-h-[5.5rem] w-full resize-y md:min-h-[129px]"
         />
         {remaining <= 200 ? (
            <p className="num mt-2 text-[13px] text-ink-3">{remaining} left</p>
         ) : null}

         {error ? (
            <p role="alert" className="mt-3 text-[15px] text-destructive">
               {error}
            </p>
         ) : null}

         <div className="mt-4 flex flex-wrap items-center gap-3 md:mt-5 md:gap-4">
            <Button type="submit" disabled={busy !== null || (saved && !dirty)}>
               {busy === 'post'
                  ? 'Posting'
                  : saved
                    ? 'Save the change'
                    : 'Post my rating'}
            </Button>
            <span className="text-[13px] text-ink-3">
               One rating per angler. Change it any time.
            </span>
            {saved ? (
               <Button
                  type="button"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => void takeDown()}
               >
                  {busy === 'remove' ? 'Taking it down' : 'Take it down'}
               </Button>
            ) : null}
         </div>
      </form>
   );
}

/*
 * How the ratings fall, lowest at the foot, the way a scale is drawn. The bars
 * take the star tone, so the spread reads as the stars beside it counted out
 * rather than as a second measure next to them.
 */
function Spread({ summary }: { summary: NonNullable<Ratings['summary']> }) {
   const most = Math.max(...summary.spread.map((row) => row.count), 1);

   return (
      <ul className="mt-0.5 min-w-0 flex-1 md:mt-1.5 md:max-w-[360px]">
         {[...summary.spread].reverse().map((row) => (
            <li
               key={row.rating}
               className="flex items-center gap-2.5 py-[3px] md:gap-3 md:py-1"
            >
               <span className="num inline-flex w-[26px] shrink-0 items-center gap-[3px] text-[13px] text-ink-2 md:w-7">
                  {row.rating}
                  <StarIcon className="size-[11px]" />
               </span>
               <span
                  aria-hidden="true"
                  className="relative h-1.5 min-w-0 flex-1 bg-bg-2"
               >
                  <span
                     className="absolute inset-y-0 left-0 bg-teal"
                     style={{ width: `${(row.count / most) * 100}%` }}
                  />
               </span>
               <span className="num w-5 shrink-0 text-right text-[13px] text-ink-3">
                  {row.count}
               </span>
               <span className="sr-only">
                  {plural(row.count, 'angler', 'anglers')} rated it {row.rating}
               </span>
            </li>
         ))}
      </ul>
   );
}

/*
 * One angler's rating. The stars lead the row on the line with the name, so
 * the list reads down its left edge the way the summary above it does. With
 * nothing written, the row prints the word for the rating rather than leaving
 * the line empty.
 */
function ReviewRow({ review }: { review: SpotReview }) {
   const when = formatDayMonth(review.createdAt);
   const edited =
      new Date(review.updatedAt).getTime() -
         new Date(review.createdAt).getTime() >
      60 * 1000;

   return (
      <li className="border-t border-line py-4">
         <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Stars
               value={review.rating}
               label={`${review.rating} out of 5`}
               className="gap-px [--star:15px]"
            />
            <p className="text-[15px] leading-[1.35]">
               <Link
                  to={`/anglers/${review.user.id}`}
                  className="font-semibold text-ink hover:text-teal-text"
               >
                  {review.user.displayName}
               </Link>
               {when ? <span className="num text-ink-2"> · {when}</span> : null}
               {edited ? <span className="text-ink-3"> · edited</span> : null}
            </p>
         </div>
         {review.body ? (
            <p className="mt-1.5 text-[15px] leading-[1.6] whitespace-pre-line text-ink">
               {review.body}
            </p>
         ) : (
            <p className="mt-1.5 text-[15px] leading-[1.6] text-ink-3">
               {RATING_WORDS[review.rating]}
            </p>
         )}
      </li>
   );
}
