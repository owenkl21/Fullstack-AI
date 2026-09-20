import { prisma } from '../lib/prisma';
import { RATING_MAX, RATING_MIN } from '../schemas/review.schema';

/*
 * What anglers make of a spot.
 *
 * One rating per person per spot, which the unique constraint on
 * (siteId, userId) already enforces, so leaving a second one edits the first
 * rather than adding to it. That is why the write is a PUT on
 * /reviews/me and not a POST of a new row: there is only ever one row to
 * address, and the caller never has to know whether it exists yet.
 *
 * A removal is a soft delete, like every other removal in this schema, and a
 * later rating of the same spot revives that row rather than colliding with it.
 *
 * Visibility is re-read on every call. A private spot is not found for a
 * stranger, exactly as the spot itself is not, so its ratings cannot be read
 * around the back of the page that hides them.
 */

const reviewSelect = {
   id: true,
   rating: true,
   body: true,
   createdAt: true,
   updatedAt: true,
   user: { select: { id: true, displayName: true, username: true } },
};

type Ratings = { rating: number; count: number }[];

export type ReviewSummary = {
   count: number;
   /* Null rather than zero: nobody has rated it is not the same fact as nought. */
   average: number | null;
   /* One entry per point on the scale, always all five, lowest first. */
   spread: Ratings;
};

/*
 * The figures, counted from the rows.
 *
 * FishingSite.reviewCount is kept in step below, but the figure shown to a
 * reader is counted here rather than read off that column, so a counter that
 * ever drifts is a stale column rather than a wrong average on the page.
 * One group-by carries the count, the average and the spread together.
 */
async function summaryOf(siteId: string): Promise<ReviewSummary> {
   const groups = await prisma.review.groupBy({
      by: ['rating'],
      where: { siteId, deletedAt: null },
      _count: { _all: true },
   });

   const counts = new Map<number, number>(
      groups.map((row) => [row.rating, row._count._all])
   );

   const spread: Ratings = [];
   let count = 0;
   let total = 0;

   for (let rating = RATING_MIN; rating <= RATING_MAX; rating += 1) {
      const at = counts.get(rating) ?? 0;
      spread.push({ rating, count: at });
      count += at;
      total += rating * at;
   }

   return {
      count,
      /* One decimal place. Two would claim a precision six opinions do not have. */
      average: count === 0 ? null : Math.round((total / count) * 10) / 10,
      spread,
   };
}

/*
 * The spot, if this viewer is allowed to see it at all. Deliberately the same
 * rule getFishingSiteById applies, so a spot that is not found on the page is
 * not found here either.
 */
async function visibleSite(siteId: string, viewerId: string | null) {
   const site = await prisma.fishingSite.findFirst({
      where: { id: siteId, deletedAt: null },
      select: { id: true, createdById: true, visibility: true },
   });

   if (!site) {
      return null;
   }

   if (site.visibility !== 'PUBLIC' && site.createdById !== viewerId) {
      return null;
   }

   return site;
}

export const reviewsService = {
   /*
    * A spot's ratings, and whether this reader has left one.
    *
    * `reviews` is everybody else; the reader's own comes back as `yours`,
    * once, so the page can put it under the composer without having to find
    * and remove it from the list first.
    */
   async listForSite(input: {
      siteId: string;
      viewerId: string | null;
      limit: number;
      offset: number;
   }) {
      const site = await visibleSite(input.siteId, input.viewerId);

      if (!site) {
         return null;
      }

      const [summary, others, yours] = await Promise.all([
         summaryOf(input.siteId),
         prisma.review.findMany({
            where: {
               siteId: input.siteId,
               deletedAt: null,
               ...(input.viewerId ? { userId: { not: input.viewerId } } : {}),
            },
            orderBy: { createdAt: 'desc' },
            skip: input.offset,
            take: input.limit,
            select: reviewSelect,
         }),
         input.viewerId
            ? prisma.review.findFirst({
                 where: {
                    siteId: input.siteId,
                    userId: input.viewerId,
                    deletedAt: null,
                 },
                 select: reviewSelect,
              })
            : Promise.resolve(null),
      ]);

      const otherCount = summary.count - (yours ? 1 : 0);

      return {
         summary,
         reviews: others,
         yours,
         viewer: {
            signedIn: input.viewerId !== null,
            /*
             * Rating your own spot is marking your own homework, so the spot's
             * owner gets the figures and no composer. The page needs to know
             * which of the two silences it is looking at.
             */
            isOwner:
               input.viewerId !== null && site.createdById === input.viewerId,
            hasRated: yours !== null,
         },
         offset: input.offset,
         limit: input.limit,
         hasMore: input.offset + others.length < otherCount,
         nextOffset: input.offset + others.length,
      };
   },

   /*
    * Leave a rating, or edit the one already there.
    *
    * Returns a word rather than throwing for the two refusals a caller has to
    * tell apart: a spot that is not there (or not theirs to see) and a spot
    * that is their own.
    */
   async leave(input: {
      siteId: string;
      userId: string;
      rating: number;
      body: string;
   }) {
      const site = await visibleSite(input.siteId, input.userId);

      if (!site) {
         return 'site_not_found' as const;
      }

      if (site.createdById === input.userId) {
         return 'own_site' as const;
      }

      const review = await prisma.$transaction(async (tx) => {
         /*
          * Read by the unique pair rather than by "not deleted": a rating that
          * was removed still holds the row, and creating a second one for the
          * same pair would be refused by the constraint. Reviving it is also
          * the honest reading of leaving a rating again.
          */
         const existing = await tx.review.findUnique({
            where: {
               siteId_userId: { siteId: input.siteId, userId: input.userId },
            },
            select: { id: true, deletedAt: true },
         });

         if (!existing) {
            const created = await tx.review.create({
               data: {
                  siteId: input.siteId,
                  userId: input.userId,
                  rating: input.rating,
                  body: input.body,
               },
               select: reviewSelect,
            });

            /*
             * Incremented rather than recounted. Two anglers rating the same
             * spot at the same moment each see the other's row missing from
             * their own snapshot, and a recount would have them both write the
             * same figure; an increment is settled by the database.
             */
            await tx.fishingSite.update({
               where: { id: input.siteId },
               data: { reviewCount: { increment: 1 } },
            });

            return created;
         }

         const updated = await tx.review.update({
            where: { id: existing.id },
            data: {
               rating: input.rating,
               body: input.body,
               deletedAt: null,
            },
            select: reviewSelect,
         });

         /* Only a revival adds to the count. An edit changes no totals. */
         if (existing.deletedAt) {
            await tx.fishingSite.update({
               where: { id: input.siteId },
               data: { reviewCount: { increment: 1 } },
            });
         }

         return updated;
      });

      return { review, summary: await summaryOf(input.siteId) };
   },

   /* Take your own rating back down. Somebody else's is not yours to remove. */
   async remove(input: { siteId: string; userId: string }) {
      const existing = await prisma.review.findFirst({
         where: {
            siteId: input.siteId,
            userId: input.userId,
            deletedAt: null,
         },
         select: { id: true },
      });

      if (!existing) {
         return null;
      }

      await prisma.$transaction(async (tx) => {
         await tx.review.update({
            where: { id: existing.id },
            data: { deletedAt: new Date() },
         });

         await tx.fishingSite.update({
            where: { id: input.siteId },
            data: { reviewCount: { decrement: 1 } },
         });
      });

      return { removed: true, summary: await summaryOf(input.siteId) };
   },
};
