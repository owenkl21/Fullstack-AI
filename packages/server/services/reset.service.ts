import {
   DeleteObjectsCommand,
   S3Client,
   type ObjectIdentifier,
} from '@aws-sdk/client-s3';
import { prisma } from '../lib/prisma';
import { KEEP_EMAILS } from '../lib/admin';

/*
 * Emptying the log for a fresh start.
 *
 * Fisherfeed was open while it was being built, so the live database carries
 * the anglers, fish and spots of the building rather than of the fishing. This
 * takes all of it away and leaves the app as a new one: the people who run it,
 * the species table so a fish can still be named, and nothing else.
 *
 * It is the most dangerous thing in the codebase, so it is written to be read.
 * Nothing here decides who may run it: that is the admin guard on the route.
 * What is here is the order, which the foreign keys dictate, and the promise
 * that a photograph the database has forgotten is not left paid for in the
 * bucket.
 *
 * The order is children before parents, all the way down. Prisma does cascade
 * some of these for us, but not all, and a half-finished delete on somebody's
 * live log is worse than none: so every table is named, in order, rather than
 * left to a relation somebody may edit later without thinking about this file.
 */

export type ResetCounts = Record<string, number>;

export type ResetReport = {
   /* What went, by table, in the order it went. */
   removed: ResetCounts;
   /* The accounts still standing, by address. */
   kept: string[];
   /* Photographs: what the bucket was asked to forget, and what it refused. */
   photos: { keys: number; deleted: number; failed: number; note?: string };
   ms: number;
};

const variantsOf = (storageKey: string) => [
   storageKey,
   `${storageKey}.card.jpg`,
   `${storageKey}.thumb.jpg`,
];

/*
 * The bucket, forgotten in batches of a thousand, which is the most the API
 * takes at once. Best effort on purpose: a bucket that will not answer is a
 * bill to tidy up later, while a database left half emptied is a broken app,
 * so the rows go either way and the failure is reported rather than thrown.
 */
async function forgetPhotos(keys: string[]): Promise<ResetReport['photos']> {
   if (keys.length === 0) return { keys: 0, deleted: 0, failed: 0 };

   const account = process.env.CLOUDFLARE_ACCOUNT_ID;
   const id = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
   const secret = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
   const bucket =
      process.env.CLOUDFLARE_R2_BUCKET?.trim() ||
      process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim();

   if (!account || !id || !secret || !bucket) {
      return {
         keys: keys.length,
         deleted: 0,
         failed: keys.length,
         note: 'No storage keys are set here, so the photographs were left where they are.',
      };
   }

   const client = new S3Client({
      region: 'auto',
      endpoint: `https://${account}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: id, secretAccessKey: secret },
   });

   let deleted = 0;
   let failed = 0;
   const objects: ObjectIdentifier[] = keys.flatMap((key) =>
      variantsOf(key).map((Key) => ({ Key }))
   );

   for (let at = 0; at < objects.length; at += 1000) {
      const batch = objects.slice(at, at + 1000);
      try {
         const answer = await client.send(
            new DeleteObjectsCommand({
               Bucket: bucket,
               Delete: { Objects: batch, Quiet: true },
            })
         );
         /*
          * R2 answers a key that was never there as deleted, which is what we
          * want: the two resized copies may not exist for an older photograph,
          * and that is not a failure.
          */
         failed += answer.Errors?.length ?? 0;
         deleted += batch.length - (answer.Errors?.length ?? 0);
      } catch {
         failed += batch.length;
      }
   }

   return { keys: keys.length, deleted, failed };
}

export const resetService = {
   /** What a reset would take away, so it can be said out loud first. */
   async preview(): Promise<{ removing: ResetCounts; kept: string[] }> {
      const [users, catches, sites, photos, posts, competitions] =
         await Promise.all([
            prisma.user.count({
               where: { email: { notIn: [...KEEP_EMAILS] } },
            }),
            prisma.catch.count(),
            prisma.fishingSite.count(),
            prisma.image.count(),
            prisma.feedPost.count(),
            prisma.competition.count(),
         ]);
      const kept = await prisma.user.findMany({
         where: { email: { in: [...KEEP_EMAILS] } },
         select: { email: true },
      });
      return {
         removing: {
            anglers: users,
            catches,
            spots: sites,
            photographs: photos,
            posts,
            competitions,
         },
         kept: kept.map((row) => row.email),
      };
   },

   /**
    * Empty the log. Keeps the accounts in KEEP_EMAILS, their sign-ins and
    * their profiles, and the species table. Everything else that belongs to
    * anybody goes, the kept accounts' own fish included.
    */
   async startFresh(byUserId: string): Promise<ResetReport> {
      const started = Date.now();
      const removed: ResetCounts = {};
      const count = (table: string, result: { count: number }) => {
         removed[table] = result.count;
      };
      /*
       * Which table was being emptied when it went wrong. A reset that fails
       * says so plainly, because the person reading it cannot open the server
       * log and "it did not work" is not something anybody can act on.
       */
      let at = 'reading the photographs';
      const step = async (
         table: string,
         run: () => Promise<{ count: number }>
      ) => {
         at = table;
         count(table, await run());
      };

      /* Read the keys before the rows go, or the bucket can never be told. */
      const images = await prisma.image.findMany({
         select: { storageKey: true },
      });
      const keys = images
         .map((image) => image.storageKey)
         .filter((key) => key && !key.startsWith('/'));

      /*
       * One transaction, so the log is never half gone. The photographs are
       * forgotten after it commits: a bucket is not part of a transaction, and
       * deleting a file for a row that then survived would be the one mistake
       * with nothing to undo it.
       */
      try {
         await prisma.$transaction(
            async (tx) => {
               /* Competitions, from the entries up. */
               await step('catchBadges', () => tx.catchBadge.deleteMany({}));
               await step('competitionEntries', () =>
                  tx.competitionEntry.deleteMany({})
               );
               await step('competitionInvites', () =>
                  tx.competitionInvite.deleteMany({})
               );
               await step('competitionEntrants', () =>
                  tx.competitionEntrant.deleteMany({})
               );
               await step('competitionSpecies', () =>
                  tx.competitionSpecies.deleteMany({})
               );
               await step('competitions', () => tx.competition.deleteMany({}));

               /* The feed and everything said on it. */
               await step('feedCommentLikes', () =>
                  tx.feedCommentLike.deleteMany({})
               );
               /*
                * Replies before the comments they answer. A comment points at
                * its parent, and MySQL checks that key row by row, so asking for
                * the lot in one statement trips over an answer whose question
                * has just gone.
                */
               await step('feedReplies', () =>
                  tx.feedComment.deleteMany({
                     where: { NOT: { parentId: null } },
                  })
               );
               await step('feedComments', () => tx.feedComment.deleteMany({}));
               await step('feedLikes', () => tx.feedLike.deleteMany({}));
               await step('savedPosts', () => tx.savedPost.deleteMany({}));
               await step('feedPosts', () => tx.feedPost.deleteMany({}));

               /* What was said and kept about fish and spots. */
               /* Catch comments have no replies of their own, so one pass. */
               await step('comments', () => tx.comment.deleteMany({}));
               await step('catchLikes', () => tx.catchLike.deleteMany({}));
               await step('siteLikes', () => tx.siteLike.deleteMany({}));
               await step('reviews', () => tx.review.deleteMany({}));
               await step('savedSpots', () => tx.savedSpot.deleteMany({}));
               await step('savedGear', () => tx.savedGear.deleteMany({}));

               /* The photographs' rows, then the fish they were of. */
               await step('catchImages', () => tx.catchImage.deleteMany({}));
               await step('siteImages', () => tx.siteImage.deleteMany({}));
               await step('images', () => tx.image.deleteMany({}));
               await step('catches', () => tx.catch.deleteMany({}));

               /* Places and tackle. */
               await step('waypoints', () => tx.waypoint.deleteMany({}));
               await step('gear', () => tx.gear.deleteMany({}));
               await step('sites', () => tx.fishingSite.deleteMany({}));

               /* Groups, then who followed whom, then the inbox. */
               await step('groupMembers', () => tx.groupMember.deleteMany({}));
               await step('groups', () => tx.group.deleteMany({}));
               await step('follows', () => tx.follow.deleteMany({}));
               await step('notifications', () =>
                  tx.notification.deleteMany({})
               );

               /*
                * The accounts. Sessions, sign-ins, push subscriptions and
                * anything else hanging off a user cascade with the row, so the
                * kept accounts stay signed in on their phones and nobody else
                * holds a session to a user that is gone.
                */
               await step('anglers', () =>
                  tx.user.deleteMany({
                     where: { email: { notIn: [...KEEP_EMAILS] } },
                  })
               );

               /* Half-finished sign-ups and password resets belong to nobody now. */
               await step('verifications', () =>
                  tx.verification.deleteMany({})
               );
            },
            { timeout: 120_000, maxWait: 30_000 }
         );
      } catch (error) {
         const why = error instanceof Error ? error.message : String(error);
         const short = why.split(/\r?\n/).slice(0, 4).join(' ').trim();
         throw new Error(`while emptying ${at}: ${short}`);
      }

      const photos = await forgetPhotos(keys);
      const kept = await prisma.user.findMany({
         where: { email: { in: [...KEEP_EMAILS] } },
         select: { email: true },
      });

      console.warn('[reset] The log was emptied.', {
         by: byUserId,
         removed,
         photos,
      });

      return {
         removed,
         kept: kept.map((row) => row.email),
         photos,
         ms: Date.now() - started,
      };
   },
};
