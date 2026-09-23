import { prisma } from '../lib/prisma';
import { canSeeSite, siteGateSelect } from '../lib/site-privacy';

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
   /* ---- Posts kept from the feed ------------------------------------- */

   async listPosts(userId: string) {
      const rows = await prisma.savedPost.findMany({
         where: { userId },
         orderBy: { createdAt: 'desc' },
         select: {
            id: true,
            createdAt: true,
            post: {
               select: {
                  id: true,
                  type: true,
                  visibility: true,
                  deletedAt: true,
                  hiddenAt: true,
                  content: true,
                  createdAt: true,
                  author: {
                     select: { id: true, displayName: true, username: true },
                  },
                  catch: {
                     select: {
                        id: true,
                        title: true,
                        caughtAt: true,
                        length: true,
                        weight: true,
                        species: { select: { commonName: true } },
                        site: {
                           select: { id: true, name: true, ...siteGateSelect },
                        },
                     },
                  },
                  site: { select: { id: true, name: true, ...siteGateSelect } },
               },
            },
         },
      });

      /*
       * A kept post names the spot its fish came from, and that spot can go
       * private long after the post was kept. Asked now, like everything
       * else here: the post stays, the spot's name and link do not.
       */
      const named = <T extends { id: string; name: string }>(
         site: (T & Parameters<typeof canSeeSite>[0]) | null
      ) =>
         site && canSeeSite(site, userId)
            ? { id: site.id, name: site.name }
            : null;

      return rows
         .filter(
            (row) =>
               row.post &&
               !row.post.deletedAt &&
               /* Out of sight while the team looks at a report. */
               !row.post.hiddenAt &&
               row.post.visibility !== 'PRIVATE'
         )
         .map((row) => ({
            id: row.id,
            savedAt: row.createdAt,
            post: {
               id: row.post.id,
               type: row.post.type,
               content: row.post.content,
               createdAt: row.post.createdAt,
               author: row.post.author,
               catch: row.post.catch
                  ? { ...row.post.catch, site: named(row.post.catch.site) }
                  : row.post.catch,
               site: named(row.post.site),
            },
         }));
   },

   async savePost(userId: string, postId: string) {
      const post = await prisma.feedPost.findFirst({
         where: {
            id: postId,
            deletedAt: null,
            hiddenAt: null,
            visibility: { not: 'PRIVATE' },
         },
         select: { id: true },
      });
      if (!post) return null;
      await prisma.savedPost.upsert({
         where: { userId_postId: { userId, postId } },
         update: {},
         create: { userId, postId },
      });
      return { saved: true };
   },

   async removePost(userId: string, postId: string) {
      await prisma.savedPost.deleteMany({ where: { userId, postId } });
      return { removed: true };
   },

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
