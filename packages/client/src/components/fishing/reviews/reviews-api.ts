import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

/*
 * What anglers make of a spot, as the client sees it. The shapes mirror the
 * server exactly.
 *
 * One rating per person per spot, so leaving one is a PUT on your own: there
 * is only ever the one row to address and the page never has to know whether
 * it exists yet.
 */

export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const REVIEW_LIMIT = 2000;

export type SpotReview = {
   id: string;
   rating: number;
   body: string;
   createdAt: string;
   updatedAt: string;
   user: { id: string; displayName: string; username: string | null };
};

export type RatingSummary = {
   count: number;
   /* Null, never zero: nobody has rated it is a different fact from nought. */
   average: number | null;
   spread: { rating: number; count: number }[];
};

export type SpotRatings = {
   summary: RatingSummary;
   /* Everybody else. Your own arrives once, as `yours`. */
   reviews: SpotReview[];
   yours: SpotReview | null;
   viewer: { signedIn: boolean; isOwner: boolean; hasRated: boolean };
   offset: number;
   limit: number;
   hasMore: boolean;
   nextOffset: number;
};

/*
 * The word for each point on the scale, in the product's voice rather than the
 * hotel one. A figure alone leaves the reader to guess whether three is a
 * compliment.
 */
export const RATING_WORDS: Record<number, string> = {
   1: 'Not worth the trip',
   2: 'Has its days',
   3: 'Worth a go',
   4: 'Really good water',
   5: 'One of the best',
};

export async function readRatings(
   siteId: string,
   options: { offset?: number; limit?: number; signal?: AbortSignal } = {}
) {
   const { data } = await axios.get<SpotRatings>(
      `/api/sites/${siteId}/reviews`,
      {
         params: {
            offset: options.offset ?? 0,
            limit: options.limit ?? 20,
         },
         signal: options.signal,
      }
   );
   return data;
}

export async function leaveRating(
   siteId: string,
   rating: number,
   body: string
) {
   const { data } = await axios.put<{
      review: SpotReview;
      summary: RatingSummary;
   }>(`/api/sites/${siteId}/reviews/me`, { rating, body });
   return data;
}

export async function removeRating(siteId: string) {
   const { data } = await axios.delete<{
      removed: boolean;
      summary: RatingSummary;
   }>(`/api/sites/${siteId}/reviews/me`);
   return data;
}

/*
 * A spot's ratings, read once per spot.
 *
 * Held at the page rather than inside the section, because the line of facts
 * under the name prints the average as well, and the two must not be two
 * requests that can disagree with one another.
 *
 * A failure here is quiet. The ratings not loading is not a reason for the
 * spot, its position and everything caught there to disappear.
 *
 * The answer is stamped with the spot it is about, the way the spot's own
 * loader does it, so moving from one spot to the next shows nothing rather
 * than the ratings of the spot just left. Stamping it is also what keeps the
 * clearing out of the effect body: there is no state to reset, only an answer
 * that stops matching.
 */
export function useSpotRatings(siteId: string | undefined) {
   const [result, setResult] = useState<{
      key: string;
      data: SpotRatings | null;
      failed: boolean;
   } | null>(null);

   useEffect(() => {
      if (!siteId) {
         return;
      }

      const controller = new AbortController();

      readRatings(siteId, { signal: controller.signal })
         .then((data) => setResult({ key: siteId, data, failed: false }))
         .catch((error: unknown) => {
            if (axios.isCancel(error)) {
               return;
            }
            setResult({ key: siteId, data: null, failed: true });
         });

      return () => controller.abort();
   }, [siteId]);

   const setData = useCallback(
      (next: SpotRatings) =>
         setResult({ key: siteId ?? '', data: next, failed: false }),
      [siteId]
   );

   const current = result?.key === siteId ? result : null;

   return {
      data: current?.data ?? null,
      failed: current?.failed ?? false,
      setData,
   };
}
