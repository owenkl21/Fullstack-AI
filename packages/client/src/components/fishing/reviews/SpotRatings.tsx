import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatDayMonth, plural } from '@/components/fishing/record/format';
import { RatingBar, RatingPicker } from './RatingBar';
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
 * One rating each, so the section has three faces: nobody has rated it and the
 * first one is invited, other people have and you have not, or you have and
 * the thing to do is change it or take it down. The figures come from the
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

   const [rating, setRating] = useState<number | null>(null);
   const [body, setBody] = useState('');
   const [editing, setEditing] = useState(false);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState('');
   const bodyId = useId();

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

   /* A different spot is a different draft. */
   useEffect(() => {
      setRating(null);
      setBody('');
      setEditing(false);
      setError('');
   }, [siteId]);

   const yours = data?.yours ?? null;
   const summary = data?.summary ?? null;
   const viewer = data?.viewer ?? null;

   const startEdit = () => {
      if (!yours) return;
      setRating(yours.rating);
      setBody(yours.body);
      setError('');
      setEditing(true);
   };

   const submit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!data) return;

      if (rating === null) {
         setError('Pick a figure from one to five first.');
         return;
      }

      setBusy(true);
      setError('');

      try {
         const result = await leaveRating(siteId, rating, body.trim());
         setData({
            ...data,
            summary: result.summary,
            yours: result.review,
            viewer: { ...data.viewer, hasRated: true },
         });
         setEditing(false);
      } catch {
         setError('Not posted. Check your connection and try again.');
      } finally {
         setBusy(false);
      }
   };

   const takeDown = async () => {
      if (!data) return;

      setBusy(true);
      setError('');

      try {
         const result = await removeRating(siteId);
         setData({
            ...data,
            summary: result.summary,
            yours: null,
            viewer: { ...data.viewer, hasRated: false },
         });
         setRating(null);
         setBody('');
         setEditing(false);
      } catch {
         setError('Not taken down. Check your connection and try again.');
      } finally {
         setBusy(false);
      }
   };

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
   const remaining = REVIEW_LIMIT - body.length;
   const composing = viewer !== null && !viewer.isOwner && viewer.signedIn;

   return (
      <section className="rv mt-12">
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
               className="shimmer mt-6 h-[104px] bg-bg-2"
            />
         ) : null}

         {data && summary && viewer ? (
            <>
               {summary.count > 0 && summary.average !== null ? (
                  <div className="mt-6 flex flex-col gap-7 sm:flex-row sm:items-start sm:gap-12">
                     <div className="w-full shrink-0 sm:w-[240px]">
                        <p className="lab text-ink-3">Average</p>
                        <p className="g num mt-1 flex items-baseline gap-2 text-[56px] leading-none md:text-[64px]">
                           {summary.average.toFixed(1)}
                           <span className="text-[24px] text-ink-3">
                              out of 5
                           </span>
                        </p>
                        <RatingBar
                           value={summary.average}
                           label={`${summary.average.toFixed(1)} out of 5, from ${plural(summary.count, 'rating', 'ratings')}`}
                           className="mt-4"
                        />
                     </div>

                     {/*
                      * The spread, once there is one. Two opinions are not a
                      * distribution, and drawing five bars under a pair of
                      * ratings says more than the numbers know.
                      */}
                     {summary.count >= 3 ? <Spread summary={summary} /> : null}
                  </div>
               ) : (
                  <p className="mt-4 max-w-[60ch] text-base text-ink-2">
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

               {composing && yours && !editing ? (
                  <div className="mt-9 border-t border-line pt-5">
                     <h3 className="lab lab-rule">Your rating</h3>
                     <div className="mt-4 flex items-start gap-4">
                        <span className="g num shrink-0 text-[44px] leading-none">
                           {yours.rating}
                        </span>
                        <div className="min-w-0 flex-1">
                           <p className="text-base text-ink-2">
                              {RATING_WORDS[yours.rating]}
                           </p>
                           {yours.body ? (
                              <p className="mt-2 max-w-[68ch] text-[15px] leading-[1.6] whitespace-pre-line text-ink">
                                 {yours.body}
                              </p>
                           ) : null}
                        </div>
                     </div>

                     {error ? (
                        <p
                           role="alert"
                           className="mt-4 text-[15px] text-destructive"
                        >
                           {error}
                        </p>
                     ) : null}

                     <div className="mt-5 flex flex-wrap items-center gap-3">
                        <Button
                           type="button"
                           variant="outline"
                           onClick={startEdit}
                           disabled={busy}
                        >
                           Change it
                        </Button>
                        <Button
                           type="button"
                           variant="ghost"
                           onClick={() => void takeDown()}
                           disabled={busy}
                        >
                           {busy ? 'Taking it down' : 'Take it down'}
                        </Button>
                     </div>
                  </div>
               ) : null}

               {composing && (!yours || editing) ? (
                  <form
                     onSubmit={submit}
                     className="mt-9 border-t border-line pt-5"
                  >
                     <h3 className="lab lab-rule">
                        {editing ? 'Change your rating' : 'Rate this spot'}
                     </h3>

                     <RatingPicker
                        value={rating}
                        onChange={(next) => {
                           setRating(next);
                           setError('');
                        }}
                        disabled={busy}
                        className="mt-4 max-w-[420px]"
                     />
                     <p
                        aria-live="polite"
                        className="mt-2.5 text-base text-ink-2"
                     >
                        {rating === null
                           ? 'One is water you would not go back to, five is the best you know.'
                           : RATING_WORDS[rating]}
                     </p>

                     <label htmlFor={bodyId} className="lab mt-6">
                        In your own words, if you want to
                     </label>
                     <textarea
                        id={bodyId}
                        value={body}
                        rows={4}
                        maxLength={REVIEW_LIMIT}
                        disabled={busy}
                        onChange={(event) => setBody(event.target.value)}
                        placeholder="How it fishes, how you get on to it, what runs there."
                        className="input-line mt-2 max-w-[68ch] text-base"
                     />
                     {remaining <= 200 ? (
                        <p className="num mt-2 text-[13px] text-ink-3">
                           {remaining} left
                        </p>
                     ) : null}

                     {error ? (
                        <p
                           role="alert"
                           className="mt-3 text-[15px] text-destructive"
                        >
                           {error}
                        </p>
                     ) : null}

                     <div className="mt-5 flex flex-wrap items-center gap-3">
                        <Button type="submit" disabled={busy}>
                           {busy
                              ? 'Posting'
                              : editing
                                ? 'Save the change'
                                : 'Post my rating'}
                        </Button>
                        {editing ? (
                           <Button
                              type="button"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => {
                                 setEditing(false);
                                 setError('');
                              }}
                           >
                              Keep the old one
                           </Button>
                        ) : null}
                     </div>
                  </form>
               ) : null}

               {viewer.signedIn ? null : (
                  <p className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-5 text-base text-ink-2">
                     Sign in to rate this spot.
                     <Link
                        to="/sign-in"
                        className="g-tracked inline-flex h-11 items-center text-[19px] text-teal-text underline-offset-4 hover:underline"
                     >
                        Sign in
                     </Link>
                  </p>
               )}

               {shown.length > 0 ? (
                  <>
                     <ul className="mt-9">
                        {shown.map((review) => (
                           <ReviewRow key={review.id} review={review} />
                        ))}
                     </ul>

                     {hasMore ? (
                        <Button
                           type="button"
                           variant="ghost"
                           className="mt-4"
                           disabled={reading}
                           onClick={() => void loadMore()}
                        >
                           {reading ? 'Reading' : 'Show more ratings'}
                        </Button>
                     ) : null}
                  </>
               ) : null}
            </>
         ) : null}
      </section>
   );
}

/*
 * How the ratings fall, lowest at the foot, the way a scale is drawn. In ink
 * rather than teal: the average above it is the figure being made, and two
 * accents on one block would leave nothing leading.
 */
function Spread({ summary }: { summary: NonNullable<Ratings['summary']> }) {
   const most = Math.max(...summary.spread.map((row) => row.count), 1);

   return (
      <ul className="min-w-0 flex-1 sm:max-w-[360px]">
         {[...summary.spread].reverse().map((row) => (
            <li key={row.rating} className="flex items-center gap-3 py-[3px]">
               <span className="g num w-3 shrink-0 text-[18px] leading-none text-ink-2">
                  {row.rating}
               </span>
               <span
                  aria-hidden="true"
                  className="relative h-1.5 min-w-0 flex-1 bg-bg-2"
               >
                  <span
                     className="absolute inset-y-0 left-0 bg-ink-2"
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
 * One angler's rating. The figure leads the row, the way a place leads a
 * standing on the boards. With nothing written, the row prints the word for
 * the figure rather than leaving the line empty.
 */
function ReviewRow({ review }: { review: SpotReview }) {
   const when = formatDayMonth(review.createdAt);
   const edited =
      new Date(review.updatedAt).getTime() -
         new Date(review.createdAt).getTime() >
      60 * 1000;

   return (
      <li className="flex gap-4 border-t border-line py-4 first:border-t-0">
         <span className="g num w-7 shrink-0 text-[30px] leading-none">
            {review.rating}
         </span>
         <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-[1.35]">
               <Link
                  to={`/anglers/${review.user.id}`}
                  className="font-semibold hover:text-teal-text"
               >
                  {review.user.displayName}
               </Link>
               {when ? <span className="num text-ink-2"> · {when}</span> : null}
               {edited ? <span className="text-ink-3"> · edited</span> : null}
            </p>
            {review.body ? (
               <p className="mt-1.5 max-w-[68ch] text-[15px] leading-[1.6] whitespace-pre-line text-ink">
                  {review.body}
               </p>
            ) : (
               <p className="mt-1.5 text-[15px] text-ink-3">
                  {RATING_WORDS[review.rating]}
               </p>
            )}
         </div>
      </li>
   );
}
