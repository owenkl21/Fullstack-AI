import { prisma } from '../lib/prisma';

/*
 * Keeping somebody else's spot or piece of gear.
 *
 * A reference, never a copy. Copying would freeze a name and a position their
 * owner can still change, and it would quietly leave you holding a spot that was
 * later made private. Holding the id means that the moment somebody withdraws
 * something, it stops resolving for everyone who kept it, which is what anyone
 * would expect and the only version that respects the original decision.
 *
 * So every read here re-checks visibility rather than trusting that it was
 * public when it was saved.
 */

export const savedService = {
   async listSpots(userId: string) {
      const rows = await prisma.savedSpot.findMany({
         where: { userId },
         orderBy: { createdAt: 'desc' },
         select: {
            id: true,
            note: true,
            createdAt: true,
            site: {
               select: {
                  id: true,
                  name: true,
                  latitude: true,
                  longitude: true,
                  waterType: true,
                  visibility: true,
                  deletedAt: true,
                  createdBy: { select: { id: true, displayName: true } },
               },
            },
         },
      });

      /*
       * Checked now, not when it was saved. A spot its owner has since made
       * private or deleted simply is not in the list any more.
       */
      return rows
         .filter(
            (row) =>
               row.site &&
               !row.site.deletedAt &&
               row.site.visibility === 'PUBLIC'
         )
         .map((row) => ({
            id: row.id,
            note: row.note,
            savedAt: row.createdAt,
            site: {
               id: row.site.id,
               name: row.site.name,
               latitude: row.site.latitude,
               longitude: row.site.longitude,
               waterType: row.site.waterType,
               ownerId: row.site.createdBy?.id ?? null,
               ownerName: row.site.createdBy?.displayName ?? null,
            },
         }));
   },

   async saveSpot(userId: string, siteId: string, note?: string | null) {
      const site = await prisma.fishingSite.findFirst({
         where: { id: siteId, deletedAt: null, visibility: 'PUBLIC' },
         select: { id: true, createdById: true },
      });

      /* Not public, gone, or already yours: nothing to keep. */
      if (!site || site.createdById === userId) {
         return null;
      }

      await prisma.savedSpot.upsert({
         where: { userId_siteId: { userId, siteId } },
         update: { note: note ?? null },
         create: { userId, siteId, note: note ?? null },
      });

      return { saved: true };
   },

   async removeSpot(userId: string, siteId: string) {
      await prisma.savedSpot.deleteMany({ where: { userId, siteId } });
      return { removed: true };
   },

   async listGear(userId: string) {
      const rows = await prisma.savedGear.findMany({
         where: { userId },
         orderBy: { createdAt: 'desc' },
         select: {
            id: true,
            createdAt: true,
            gear: {
               select: {
                  id: true,
                  name: true,
                  brand: true,
                  type: true,
                  imageUrl: true,
                  createdBy: { select: { id: true, displayName: true } },
               },
            },
         },
      });

      return rows
         .filter((row) => row.gear)
         .map((row) => ({
            id: row.id,
            savedAt: row.createdAt,
            gear: {
               id: row.gear.id,
               name: row.gear.name,
               brand: row.gear.brand,
               type: row.gear.type,
               imageUrl: row.gear.imageUrl,
               ownerName: row.gear.createdBy?.displayName ?? null,
            },
         }));
   },

   async saveGear(userId: string, gearId: string) {
      const gear = await prisma.gear.findFirst({
         where: { id: gearId },
         select: { id: true, createdById: true },
      });

      if (!gear || gear.createdById === userId) {
         return null;
      }

      await prisma.savedGear.upsert({
         where: { userId_gearId: { userId, gearId } },
         update: {},
         create: { userId, gearId },
      });

      return { saved: true };
   },

   async removeGear(userId: string, gearId: string) {
      await prisma.savedGear.deleteMany({ where: { userId, gearId } });
      return { removed: true };
   },
};
