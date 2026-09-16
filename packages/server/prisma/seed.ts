import { prisma } from '../lib/prisma';
import { seedSpecies } from './species.seed';
import { assertSeedable } from './seed/guard';
import { ANGLERS } from './seed/data/anglers';
import { SPOTS } from './seed/data/spots';
import { GEAR } from './seed/data/gear';
import { buildCatches } from './seed/data/catches';
import { catchPhotos, spotPhotos, PHOTOS } from './seed/data/photos';

/* Cycles through a list that is never empty, and says so to the typechecker. */
const cycle = <T>(items: T[], index: number): T => {
   const picked = items[index % items.length];

   if (!picked) {
      throw new Error('Seed asset list is empty.');
   }

   return picked;
};

/*
 * Idempotent and id-deterministic: every row has a fixed seed_ id, so running
 * this twice updates the same rows rather than making a second set.
 *
 * Order matters. Species before catches, anglers before everything they own.
 */

async function seedAnglers() {
   for (const angler of ANGLERS) {
      await prisma.user.upsert({
         where: { id: angler.id },
         update: {
            username: angler.username,
            displayName: angler.displayName,
            bio: angler.bio,
         },
         create: {
            id: angler.id,
            email: angler.email,
            /* Seeded accounts cannot be signed into: there is no Account row. */
            emailVerified: true,
            storagePrefixId: angler.id,
            username: angler.username,
            displayName: angler.displayName,
            bio: angler.bio,
         },
      });
   }

   return ANGLERS.length;
}

async function seedImages() {
   for (const photo of PHOTOS) {
      await prisma.image.upsert({
         where: { id: photo.id },
         update: { url: photo.path },
         create: {
            id: photo.id,
            url: photo.path,
            /* Local files under public/, not R2 objects. */
            storageKey: `seed${photo.path}`,
            uploadedById: cycle(ANGLERS, 0).id,
         },
      });
   }

   return PHOTOS.length;
}

async function seedSpots() {
   const photos = spotPhotos();

   for (const [index, spot] of SPOTS.entries()) {
      await prisma.fishingSite.upsert({
         where: { id: spot.id },
         update: {
            name: spot.name,
            latitude: spot.latitude,
            longitude: spot.longitude,
            description: spot.description,
            accessNotes: spot.accessNotes,
         },
         create: {
            id: spot.id,
            createdById: spot.ownerId,
            name: spot.name,
            latitude: spot.latitude,
            longitude: spot.longitude,
            waterType: spot.waterType,
            description: spot.description,
            accessNotes: spot.accessNotes,
         },
      });

      const photo = cycle(photos, index);
      await prisma.siteImage.upsert({
         where: { id: `${spot.id}_img` },
         update: {},
         create: {
            id: `${spot.id}_img`,
            siteId: spot.id,
            imageId: photo.id,
            position: 0,
         },
      });
   }

   return SPOTS.length;
}

async function seedGear() {
   for (const item of GEAR) {
      await prisma.gear.upsert({
         where: { id: item.id },
         update: { name: item.name, brand: item.brand },
         create: {
            id: item.id,
            createdById: item.ownerId,
            name: item.name,
            brand: item.brand,
            type: item.type as never,
         },
      });
   }

   return GEAR.length;
}

async function seedCatches() {
   const rows = buildCatches();
   const photos = catchPhotos();

   /* One lookup rather than one per catch. */
   const species = await prisma.species.findMany({
      select: { id: true, commonName: true },
   });
   const byName = new Map(species.map((s) => [s.commonName, s.id]));

   const counts = new Map<string, number>();

   for (const [index, row] of rows.entries()) {
      const speciesId = byName.get(row.speciesName) ?? null;

      await prisma.catch.upsert({
         where: { id: row.id },
         update: {
            title: row.title,
            notes: row.notes,
            length: row.lengthCm,
            caughtAt: row.caughtAt,
            speciesId,
         },
         create: {
            id: row.id,
            createdById: row.anglerId,
            siteId: row.spotId,
            speciesId,
            title: row.title,
            /*
             * Released or kept lives in the notes: the flag itself is appendix
             * E gap B5 and is not in the schema yet.
             */
            notes: `${row.notes} ${row.released ? 'Released.' : 'Kept.'}`,
            length: row.lengthCm,
            caughtAt: row.caughtAt,
            count: 1,
         },
      });

      const photo = cycle(photos, index);
      await prisma.catchImage.upsert({
         where: { id: `${row.id}_img` },
         update: {},
         create: {
            id: `${row.id}_img`,
            catchId: row.id,
            imageId: photo.id,
            position: 0,
         },
      });

      counts.set(row.spotId, (counts.get(row.spotId) ?? 0) + 1);
   }

   /* catchCount is denormalised, so it has to be set rather than inferred. */
   for (const [spotId, total] of counts) {
      await prisma.fishingSite.update({
         where: { id: spotId },
         data: { catchCount: total },
      });
   }

   return rows.length;
}

async function seedFeed() {
   /*
    * One post per catch, which mirrors what a real save does. The research is
    * right that this is the risky part of seeding: listFeed has no author
    * filter, so these become the feed for anyone who signs in. That is what the
    * guard is for, and why it refuses a host nobody has named.
    */
   const rows = await prisma.catch.findMany({
      where: { id: { startsWith: 'seed_catch_' } },
      select: {
         id: true,
         createdById: true,
         title: true,
         createdAt: true,
         site: { select: { id: true, latitude: true, longitude: true } },
      },
   });

   for (const row of rows) {
      await prisma.feedPost.upsert({
         where: { id: `${row.id}_post` },
         update: {},
         create: {
            id: `${row.id}_post`,
            authorId: row.createdById,
            type: 'CATCH',
            scope: 'GLOBAL',
            content: row.title,
            catchId: row.id,
            siteId: row.site?.id ?? null,
            latitude: row.site?.latitude ?? null,
            longitude: row.site?.longitude ?? null,
         },
      });
   }

   return rows.length;
}

async function seedFollows() {
   /* A mutual pair is needed for the rivalry board in queue item 5.5. */
   const pairs: [string, string][] = [
      ['seed_angler_thabo', 'seed_angler_nadia'],
      ['seed_angler_nadia', 'seed_angler_thabo'],
      ['seed_angler_sipho', 'seed_angler_thabo'],
      ['seed_angler_karen', 'seed_angler_thabo'],
      ['seed_angler_amara', 'seed_angler_deon'],
      ['seed_angler_deon', 'seed_angler_amara'],
      ['seed_angler_lerato', 'seed_angler_riaan'],
      ['seed_angler_riaan', 'seed_angler_karen'],
   ];

   for (const [follower, following] of pairs) {
      await prisma.follow.upsert({
         where: { id: `seed_follow_${follower}_${following}` },
         update: {},
         create: {
            id: `seed_follow_${follower}_${following}`,
            followerId: follower,
            followingId: following,
         },
      });
   }

   return pairs.length;
}

async function main() {
   /* Refuses before any write. See seed/guard.ts for why this matters. */
   assertSeedable();

   const species = await seedSpecies();
   const anglers = await seedAnglers();
   const images = await seedImages();
   const spots = await seedSpots();
   const gear = await seedGear();
   const catches = await seedCatches();
   const follows = await seedFollows();
   const posts = await seedFeed();

   console.log(
      `[seed] ${species} species, ${anglers} anglers, ${spots} spots, ${gear} gear, ${catches} catches, ${images} images, ${follows} follows, ${posts} feed posts`
   );
   console.log(
      '[seed] Photographs are Unsplash stand-ins. Not these anglers, not these species, mostly not this coastline.'
   );
}

main()
   .catch((error) => {
      console.error('[seed] failed');
      console.error(error);
      process.exit(1);
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
