import { prisma } from '../lib/prisma';
import {
   siteGateSelect,
   sitesVisibleTo,
   withSiteShownTo,
   type SiteGate,
} from '../lib/site-privacy';
import { notificationsService } from './notifications.service';
import { uploadsService } from './uploads.service';
import { resolveAvatarReadUrls, userService } from './user.service';

type FeedScope = 'GLOBAL' | 'NEARBY';
/*
 * The feed is catches. Spots used to post themselves too, which put the same
 * mark in front of everyone twice: once when it was added and again under every
 * fish caught there. `SITE` stays in the column's vocabulary because the rows
 * written before this are still in the table, but nothing writes another one
 * and the read path below hands none of them back.
 */
type FeedType = 'CATCH';

const feedInclude = {
   author: {
      select: { id: true, username: true, displayName: true, avatarUrl: true },
   },
   catch: {
      select: {
         id: true,
         title: true,
         /*
          * The facts about the fish. Without these the feed sent a title and a
          * photograph and nothing else, so the card's measurement line could
          * never render: most catches carry no photograph, and those posts were
          * a headline over a link with nothing in between.
          */
         length: true,
         weight: true,
         weightSource: true,
         species: { select: { commonName: true } },
         images: {
            orderBy: { position: 'asc' as const },
            select: {
               image: {
                  select: {
                     id: true,
                     url: true,
                     storageKey: true,
                     focusX: true,
                     focusY: true,
                  },
               },
            },
         },
      },
   },
   /*
    * The spot the fish was taken at, named on the card. Its photographs are not
    * selected any more: the card shows the fish, and signing read URLs for a
    * gallery nothing renders cost a round trip per post.
    *
    * The gate columns ride along so withSpotShownTo can ask whether this
    * reader may be told about the spot at all. They never leave the file.
    */
   site: {
      select: {
         id: true,
         name: true,
         ...siteGateSelect,
      },
   },
   comments: {
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' as const },
      take: 5,
      include: {
         user: { select: { id: true, username: true, displayName: true } },
      },
   },
};

/*
 * The spot on a card, as one reader may see it.
 *
 * A post is a snapshot, and the spot under it can be kept private long after
 * the post was written. So the question is asked on the way out, every time:
 * when the spot is not this reader's to see, its name and its link come off
 * the card, and so does the post's position unless the post is their own,
 * because a pin dropped on a private mark is the mark (lib/site-privacy).
 * What is left of the spot is the two fields a card prints.
 */
const withSpotShownTo = <
   T extends {
      authorId: string;
      site: ({ id: string; name: string } & SiteGate) | null;
   },
>(
   post: T,
   viewerId: string | null | undefined
) => {
   /* The gate reads the record's owner as createdById; a post calls its
      owner the author. Lent for the question, then taken back off. */
   const { createdById: _author, ...shown } = withSiteShownTo(
      { ...post, createdById: post.authorId },
      viewerId
   );

   return {
      ...shown,
      site: shown.site ? { id: shown.site.id, name: shown.site.name } : null,
   };
};

const withResolvedFeedImageUrls = async <
   T extends {
      catch: {
         images: Array<{
            image: { id: string; url: string; storageKey: string };
         }>;
      } | null;
   },
>(
   post: T
): Promise<T> => {
   const resolvePostImages = async (
      images: Array<{ image: { id: string; url: string; storageKey: string } }>
   ) => {
      return Promise.all(
         images.map(async (entry) => {
            try {
               const signed = await uploadsService.getReadUrl(
                  entry.image.storageKey
               );

               /* All three sizes. The card draws the 900px one and the browser
                * never asks for the original, which is what turned a feed page
                * from twenty eight megabytes into something a phone can hold. */
               return {
                  ...entry,
                  image: {
                     ...entry.image,
                     url: signed.readUrl,
                     cardUrl: signed.cardReadUrl,
                     thumbUrl: signed.thumbReadUrl,
                  },
               };
            } catch (error) {
               console.warn(
                  '[feed:list] Falling back to persisted image URL because generating read URL failed.',
                  {
                     storageKey: entry.image.storageKey,
                     error,
                  }
               );

               return entry;
            }
         })
      );
   };

   const catchImages = post.catch
      ? await resolvePostImages(post.catch.images)
      : null;

   /* The screen names these lengthCm and weightKg, so the units travel with
    * the numbers rather than living only in a comment. */
   const fish = post.catch as
      | (T['catch'] & {
           length?: number | null;
           weight?: number | null;
           weightSource?: string | null;
           species?: { commonName: string } | null;
        })
      | null;

   return {
      ...post,
      catch: fish
         ? {
              ...fish,
              images: catchImages ?? [],
              species: fish.species?.commonName ?? null,
              lengthCm: fish.length ?? null,
              weightKg: fish.weight ?? null,
              weightSource: fish.weightSource ?? null,
           }
         : null,
   };
};

/*
 * The id on the request is this app's own User.id now, so this is an existence
 * check rather than the lookup-and-sync-from-Clerk it used to be.
 */
async function getUserId(userId: string) {
   const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true },
   });

   return user.id;
}

export const feedService = {
   async listFeed(input: {
      userId?: string;
      scope: FeedScope;
      latitude?: number;
      longitude?: number;
      limit: number;
      offset: number;
   }) {
      /*
       * Only a position this reader may be told can put a post in the box.
       * A post written while its spot was public still has the spot's pin on
       * the row, and withSpotShownTo takes it off the card, but a box drawn
       * around a point is a question about the pin all the same: slide the
       * box a little at a time and the edge where the post drops out is the
       * mark. So a post on a spot the reader may not see is not nearby
       * anything, unless it is their own.
       */
      const nearbyWhere =
         input.scope === 'NEARBY' &&
         typeof input.latitude === 'number' &&
         typeof input.longitude === 'number'
            ? {
                 latitude: { gte: input.latitude - 1, lte: input.latitude + 1 },
                 longitude: {
                    gte: input.longitude - 1,
                    lte: input.longitude + 1,
                 },
                 OR: [
                    { siteId: null },
                    { site: { is: sitesVisibleTo(input.userId) } },
                    ...(input.userId ? [{ authorId: input.userId }] : []),
                 ],
              }
            : {};

      const scopeWhere =
         input.scope === 'GLOBAL'
            ? { scope: 'GLOBAL' as const }
            : { scope: { in: ['GLOBAL', 'NEARBY'] as FeedScope[] } };

      const posts = await prisma.feedPost.findMany({
         where: {
            deletedAt: null,
            /* Belt and braces: a private post should never have been created. */
            visibility: { not: 'PRIVATE' },
            /*
             * Catches only, filtered here rather than at the write path alone,
             * because the spot posts written before this rule are still in the
             * table and a filter on the way in cannot reach them. Nothing is
             * deleted; they simply stop being read.
             */
            type: 'CATCH' satisfies FeedType,
            ...scopeWhere,
            ...nearbyWhere,
         },
         include: feedInclude,
         orderBy: { createdAt: 'desc' },
         skip: input.offset,
         take: input.limit,
      });

      const postsWithResolvedImageUrls = await Promise.all(
         posts.map(async (post: any) => {
            /* Before anything else reads the post: a spot this reader may
               not see never reaches the card (withSpotShownTo). */
            const shown: any = withSpotShownTo(post, input.userId);
            const resolved = await withResolvedFeedImageUrls(shown);
            /* The author's photograph is a storage key too; unsigned it is
             * a broken image on every card. It is drawn at 40px, so the card
             * is handed the thumb as well and reads that instead: this one
             * line is the difference between a four megabyte avatar and a
             * few kilobytes of it, twenty five times down a page. */
            const avatar = await resolveAvatarReadUrls(
               resolved.author?.avatarUrl ?? null
            );

            return {
               ...resolved,
               author: {
                  ...resolved.author,
                  avatarUrl: avatar.url,
                  avatarCardUrl: avatar.cardUrl,
                  avatarThumbUrl: avatar.thumbUrl,
               },
            };
         })
      );

      if (!input.userId) {
         return postsWithResolvedImageUrls.map((post: any) => ({
            ...post,
            likedByMe: false,
            savedByMe: false,
            authorFollowedByMe: false,
            authorIsMe: false,
         }));
      }

      const viewerUserId = await getUserId(input.userId);

      const likes = await prisma.feedLike.findMany({
         where: {
            userId: viewerUserId,
            postId: { in: postsWithResolvedImageUrls.map((p: any) => p.id) },
         },
         select: { postId: true },
      });
      const likedSet = new Set(likes.map((l: any) => l.postId));

      const saves = await prisma.savedPost.findMany({
         where: {
            userId: viewerUserId,
            postId: { in: postsWithResolvedImageUrls.map((p: any) => p.id) },
         },
         select: { postId: true },
      });
      const savedSet = new Set(saves.map((row: any) => row.postId));

      const follows = await prisma.follow.findMany({
         where: {
            followerId: viewerUserId,
            followingId: {
               in: postsWithResolvedImageUrls.map(
                  (post: any) => post.author.id
               ),
            },
         },
         select: { followingId: true },
      });
      const followingSet = new Set(
         follows.map((entry: any) => entry.followingId)
      );

      return postsWithResolvedImageUrls.map((post: any) => ({
         ...post,
         likedByMe: likedSet.has(post.id),
         savedByMe: savedSet.has(post.id),
         authorFollowedByMe: followingSet.has(post.author.id),
         authorIsMe: post.author.id === viewerUserId,
      }));
   },

   async createFeedPost(
      userId: string,
      input: {
         type: FeedType;
         scope: FeedScope;
         content?: string | null;
         catchId?: string | null;
         siteId?: string | null;
         latitude?: number | null;
         longitude?: number | null;
      }
   ) {
      await getUserId(userId); // throws if the user is gone

      /*
       * A post can only stand on a spot its author may see. Any id used to
       * do, and the answer came back with that spot's name on it, so the id
       * of a private spot could be traded for what it is called.
       */
      const site = input.siteId
         ? await prisma.fishingSite.findFirst({
              where: {
                 id: input.siteId,
                 deletedAt: null,
                 ...sitesVisibleTo(userId),
              },
              select: { id: true },
           })
         : null;

      const post = await prisma.feedPost.create({
         data: {
            authorId: userId,
            type: input.type,
            scope: input.scope,
            content: input.content,
            catchId: input.catchId,
            siteId: site?.id ?? null,
            latitude: input.latitude,
            longitude: input.longitude,
         },
         include: feedInclude,
      });
      return withSpotShownTo(post, userId);
   },

   async updateFeedPost(
      userId: string,
      postId: string,
      input: { content?: string | null; scope?: FeedScope }
   ) {
      await getUserId(userId); // throws if the user is gone
      const existing = await prisma.feedPost.findFirst({
         where: { id: postId, authorId: userId, deletedAt: null },
         select: { id: true },
      });

      if (!existing) {
         return null;
      }

      const post = await prisma.feedPost.update({
         where: { id: postId },
         data: { content: input.content, scope: input.scope },
         include: feedInclude,
      });
      /* Their own post, but the spot under it may be somebody else's and
         kept private since: asked here like everywhere else. */
      return withSpotShownTo(post, userId);
   },

   async deleteFeedPost(userId: string, postId: string) {
      await getUserId(userId); // throws if the user is gone
      const existing = await prisma.feedPost.findFirst({
         where: { id: postId, authorId: userId, deletedAt: null },
         select: { id: true },
      });

      if (!existing) {
         return null;
      }

      await prisma.feedPost.update({
         where: { id: postId },
         data: { deletedAt: new Date() },
      });

      return { id: postId };
   },

   async toggleLike(userId: string, postId: string) {
      await getUserId(userId); // throws if the user is gone
      const post = await prisma.feedPost.findFirst({
         where: { id: postId, deletedAt: null },
         select: { id: true, authorId: true },
      });

      if (!post) {
         return null;
      }

      const result = await prisma.$transaction(async (tx: any) => {
         const existing = await tx.feedLike.findUnique({
            where: { postId_userId: { postId, userId } },
            select: { id: true },
         });

         if (existing) {
            await tx.feedLike.delete({ where: { id: existing.id } });
            await tx.feedPost.update({
               where: { id: postId },
               data: { likeCount: { decrement: 1 } },
            });
            return { liked: false };
         }

         await tx.feedLike.create({ data: { postId, userId } });
         await tx.feedPost.update({
            where: { id: postId },
            data: { likeCount: { increment: 1 } },
         });

         return { liked: true };
      });

      if (result.liked) {
         await notificationsService.notify({
            userId: post.authorId,
            actorId: userId,
            kind: 'LIKE',
            postId,
         });
      }
      return result;
   },

   async listComments(postId: string) {
      return prisma.feedComment.findMany({
         where: { postId, deletedAt: null },
         include: {
            user: { select: { id: true, username: true, displayName: true } },
         },
         orderBy: { createdAt: 'asc' },
      });
   },

   async createComment(userId: string, postId: string, body: string) {
      await getUserId(userId); // throws if the user is gone
      const post = await prisma.feedPost.findFirst({
         where: { id: postId, deletedAt: null },
         select: { id: true, authorId: true },
      });

      if (!post) {
         return null;
      }

      const comment = await prisma.$transaction(async (tx: any) => {
         const comment = await tx.feedComment.create({
            data: {
               postId,
               userId,
               body,
            },
            include: {
               user: {
                  select: { id: true, username: true, displayName: true },
               },
            },
         });

         await tx.feedPost.update({
            where: { id: postId },
            data: { commentCount: { increment: 1 } },
         });

         return comment;
      });

      await notificationsService.notify({
         userId: post.authorId,
         actorId: userId,
         kind: 'COMMENT',
         postId,
         body,
      });
      return comment;
   },

   async deleteComment(userId: string, commentId: string) {
      await getUserId(userId); // throws if the user is gone
      const existing = await prisma.feedComment.findFirst({
         where: { id: commentId, userId, deletedAt: null },
         select: { id: true, postId: true },
      });

      if (!existing) {
         return null;
      }

      await prisma.$transaction(async (tx: any) => {
         await tx.feedComment.update({
            where: { id: commentId },
            data: { deletedAt: new Date() },
         });

         await tx.feedPost.update({
            where: { id: existing.postId },
            data: { commentCount: { decrement: 1 } },
         });
      });

      return { id: commentId };
   },
};
