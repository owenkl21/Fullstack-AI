import { prisma } from '../lib/prisma';
import { namePlace } from '../clients/geocoding.client';

/*
 * Two pins on the same water, made one.
 *
 * A log picks up duplicates honestly: you fish a mark, the phone puts you a
 * few hundred metres off, and next time you save a new spot rather than find
 * the old one. The result is "Millers Point" twice, 264 m apart, with the
 * catches split between them, so neither one tells you the truth about the
 * place.
 *
 * Merging is the one operation here that cannot undo itself, so it is written
 * to lose nothing. Six tables point at a site and four of them carry a unique
 * constraint that two rows would collide on, so each is moved deliberately
 * rather than with one blanket update:
 *
 *   Catch        moved outright (nullable, no constraint)
 *   FeedPost     moved outright (nullable, no constraint)
 *   Review       one per person per spot, so a person who reviewed both keeps
 *                the one on the spot being kept and the other is dropped
 *   SiteLike     same shape, same rule
 *   SavedSpot    same shape, same rule
 *   SiteImage    unique per image, so a photograph already on the keeper is
 *                not added twice
 *
 * The counts are recounted from the rows afterwards rather than added up,
 * because adding them up carries any drift that was already there.
 */

/** How far apart two pins can be and still be the same place. */
const NEAR_METRES = 800;

const EARTH = 6371000;

export function metresBetween(
   a: { latitude: number; longitude: number },
   b: { latitude: number; longitude: number }
): number {
   const rad = Math.PI / 180;
   const dLat = (b.latitude - a.latitude) * rad;
   const dLon = (b.longitude - a.longitude) * rad;
   const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.latitude * rad) *
         Math.cos(b.latitude * rad) *
         Math.sin(dLon / 2) ** 2;
   return 2 * EARTH * Math.asin(Math.sqrt(h));
}

export type MergeGroup = {
   /** Metres between the two furthest pins in the group. */
   spread: number;
   /** What the map calls the water they sit on, when it knows. */
   suggestedName: string | null;
   sites: {
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      catchCount: number;
      createdAt: Date;
   }[];
};

export const siteMergeService = {
   /**
    * Pins of yours that sit close enough together to be one place.
    *
    * Only your own spots, because merging somebody else's is not yours to do,
    * and only ones carrying a position.
    */
   async suggestions(userId: string): Promise<MergeGroup[]> {
      const sites = await prisma.fishingSite.findMany({
         where: {
            createdById: userId,
            latitude: { not: null },
            longitude: { not: null },
         },
         select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            catchCount: true,
            createdAt: true,
         },
         orderBy: { createdAt: 'asc' },
      });

      const points = sites.filter(
         (s): s is typeof s & { latitude: number; longitude: number } =>
            s.latitude !== null && s.longitude !== null
      );

      /* Simple agglomeration: walk the list, and put a site in the first
         group it is near. Enough for the handful of spots one angler keeps. */
      const groups: (typeof points)[] = [];
      for (const site of points) {
         const found = groups.find((group) =>
            group.some((other) => metresBetween(other, site) <= NEAR_METRES)
         );
         if (found) found.push(site);
         else groups.push([site]);
      }

      const out: MergeGroup[] = [];
      for (const group of groups) {
         if (group.length < 2) continue;
         let spread = 0;
         for (const a of group)
            for (const b of group)
               spread = Math.max(spread, metresBetween(a, b));

         /* The name the map gives the water, offered as the default. It is a
            better answer than either pin's name when the pins disagree. */
         let suggestedName: string | null = null;
         try {
            const middle = {
               lat:
                  group.reduce((sum, s) => sum + s.latitude, 0) / group.length,
               lng:
                  group.reduce((sum, s) => sum + s.longitude, 0) / group.length,
            };
            const place = await namePlace(middle.lat, middle.lng);
            suggestedName = place?.name ?? null;
         } catch {
            suggestedName = null;
         }

         out.push({
            spread: Math.round(spread),
            suggestedName,
            sites: group.map((s) => ({
               id: s.id,
               name: s.name,
               latitude: s.latitude,
               longitude: s.longitude,
               catchCount: s.catchCount,
               createdAt: s.createdAt,
            })),
         });
      }
      return out.sort((a, b) => a.spread - b.spread);
   },

   /**
    * Fold every `fromIds` spot into `keepId`, optionally renaming the keeper.
    *
    * Everything moves or is dropped as a duplicate; nothing is left pointing
    * at a spot that no longer exists.
    */
   async merge(input: {
      userId: string;
      keepId: string;
      fromIds: string[];
      name?: string;
   }): Promise<{ keptId: string; movedCatches: number; removed: number }> {
      const { userId, keepId, name } = input;
      const fromIds = input.fromIds.filter((id) => id !== keepId);
      if (fromIds.length === 0) {
         throw new Error('Nothing to merge in.');
      }

      const all = await prisma.fishingSite.findMany({
         where: { id: { in: [keepId, ...fromIds] } },
         select: { id: true, createdById: true },
      });
      if (all.length !== fromIds.length + 1) {
         throw new Error('One of those spots no longer exists.');
      }
      if (all.some((s) => s.createdById !== userId)) {
         throw new Error('You can only merge spots you made.');
      }

      return prisma.$transaction(async (tx) => {
         /* Rows that simply point at a site and carry no constraint. */
         const moved = await tx.catch.updateMany({
            where: { siteId: { in: fromIds } },
            data: { siteId: keepId },
         });
         await tx.feedPost.updateMany({
            where: { siteId: { in: fromIds } },
            data: { siteId: keepId },
         });

         /* One per person per spot. Whoever already has one on the keeper
            keeps it; the duplicate goes. */
         for (const table of ['review', 'siteLike', 'savedSpot'] as const) {
            const rows = await (
               tx[table] as unknown as {
                  findMany: (
                     args: unknown
                  ) => Promise<{ id: string; userId: string }[]>;
               }
            ).findMany({
               where: { siteId: { in: fromIds } },
               select: { id: true, userId: true },
            });
            const already = await (
               tx[table] as unknown as {
                  findMany: (args: unknown) => Promise<{ userId: string }[]>;
               }
            ).findMany({
               where: { siteId: keepId },
               select: { userId: true },
            });
            const held = new Set(already.map((r) => r.userId));
            const move = rows
               .filter((r) => !held.has(r.userId))
               .map((r) => r.id);
            const drop = rows
               .filter((r) => held.has(r.userId))
               .map((r) => r.id);
            if (move.length)
               await (
                  tx[table] as unknown as {
                     updateMany: (args: unknown) => Promise<unknown>;
                  }
               ).updateMany({
                  where: { id: { in: move } },
                  data: { siteId: keepId },
               });
            if (drop.length)
               await (
                  tx[table] as unknown as {
                     deleteMany: (args: unknown) => Promise<unknown>;
                  }
               ).deleteMany({ where: { id: { in: drop } } });
         }

         /* A photograph already on the keeper is not added to it twice. */
         const images = await tx.siteImage.findMany({
            where: { siteId: { in: fromIds } },
            select: { id: true, imageId: true },
         });
         const onKeeper = new Set(
            (
               await tx.siteImage.findMany({
                  where: { siteId: keepId },
                  select: { imageId: true },
               })
            ).map((r) => r.imageId)
         );
         const moveImages = images
            .filter((r) => !onKeeper.has(r.imageId))
            .map((r) => r.id);
         const dropImages = images
            .filter((r) => onKeeper.has(r.imageId))
            .map((r) => r.id);
         if (moveImages.length)
            await tx.siteImage.updateMany({
               where: { id: { in: moveImages } },
               data: { siteId: keepId },
            });
         if (dropImages.length)
            await tx.siteImage.deleteMany({
               where: { id: { in: dropImages } },
            });

         /* Nothing points at them now. */
         await tx.fishingSite.deleteMany({ where: { id: { in: fromIds } } });

         /* Recounted from the rows rather than added up, so any drift that was
            already in the counters is corrected rather than carried. */
         const [catchCount, reviewCount, likeCount] = await Promise.all([
            tx.catch.count({ where: { siteId: keepId, deletedAt: null } }),
            tx.review.count({ where: { siteId: keepId, deletedAt: null } }),
            tx.siteLike.count({ where: { siteId: keepId } }),
         ]);

         await tx.fishingSite.update({
            where: { id: keepId },
            data: {
               catchCount,
               reviewCount,
               likeCount,
               ...(name && name.trim() ? { name: name.trim() } : {}),
            },
         });

         return {
            keptId: keepId,
            movedCatches: moved.count,
            removed: fromIds.length,
         };
      });
   },
};
