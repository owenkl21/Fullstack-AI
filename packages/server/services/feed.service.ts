import { prisma } from '../lib/prisma';
import { uploadsService } from './uploads.service';
import { userService } from './user.service';

type FeedScope = 'GLOBAL' | 'NEARBY';
type FeedType = 'CATCH' | 'SITE';

const feedInclude = {
   author: {
      select: { id: true, username: true, displayName: true, avatarUrl: true },
   },
   catch: {
      select: {
         id: true,
         title: true,
         images: {
            orderBy: { position: 'asc' as const },
            select: {
               image: { select: { id: true, url: true, storageKey: true } },
            },
         },
      },
   },
   site: {
      select: {
         id: true,
         name: true,
         images: {
            orderBy: { position: 'asc' as const },
            select: {
               image: { select: { id: true, url: true, storageKey: true } },
            },
         },
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

const withResolvedFeedImageUrls = async <
   T extends {
      catch: {
         images: Array<{
            image: { id: string; url: string; storageKey: string };
         }>;
      } | null;
      site: {
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

               return {
                  ...entry,
                  image: {
                     ...entry.image,
                     url: signed.readUrl,
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

   const [catchImages, siteImages] = await Promise.all([
      post.catch ? resolvePostImages(post.catch.images) : null,
      post.site ? resolvePostImages(post.site.images) : null,
   ]);

   return {
      ...post,
      catch: post.catch ? { ...post.catch, images: catchImages ?? [] } : null,
      site: post.site ? { ...post.site, images: siteImages ?? [] } : null,
   };
};

async function getUserId(clerkId: string) {
   const existing = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
   });

   if (existing) {
      return existing.id;
   }

   await userService.syncAuthenticatedUser(clerkId);

   const user = await prisma.user.findUniqueOrThrow({
      where: { clerkId },
      select: { id: true },
   });

   return user.id;
}

export const feedService = {
   async listFeed(input: {
      userId?: string;
      scope: FeedScope;
      type?: FeedType;
      latitude?: number;
      longitude?: number;
      limit: number;
      offset: number;
   }) {
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
              }
            : {};

      const scopeWhere =
         input.scope === 'GLOBAL'
            ? { scope: 'GLOBAL' as const }
            : { scope: { in: ['GLOBAL', 'NEARBY'] as const } };

      const posts = await prisma.feedPost.findMany({
         where: {
            deletedAt: null,
            ...scopeWhere,
            ...(input.type ? { type: input.type } : {}),
            ...nearbyWhere,
         },
         include: feedInclude,
         orderBy: { createdAt: 'desc' },
         skip: input.offset,
         take: input.limit,
      });

      const postsWithResolvedImageUrls = await Promise.all(
         posts.map((post: any) => withResolvedFeedImageUrls(post))
      );

      if (!input.userId) {
         return postsWithResolvedImageUrls.map((post: any) => ({
            ...post,
            likedByMe: false,
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
         authorFollowedByMe: followingSet.has(post.author.id),
         authorIsMe: post.author.id === viewerUserId,
      }));
   },

   async createFeedPost(
      clerkId: string,
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
      const userId = await getUserId(clerkId);

      return prisma.feedPost.create({
         data: {
            authorId: userId,
            type: input.type,
            scope: input.scope,
            content: input.content,
            catchId: input.catchId,
            siteId: input.siteId,
            latitude: input.latitude,
            longitude: input.longitude,
         },
         include: feedInclude,
      });
   },

   async updateFeedPost(
      clerkId: string,
      postId: string,
      input: { content?: string | null; scope?: FeedScope }
   ) {
      const userId = await getUserId(clerkId);
      const existing = await prisma.feedPost.findFirst({
         where: { id: postId, authorId: userId, deletedAt: null },
         select: { id: true },
      });

      if (!existing) {
         return null;
      }

      return prisma.feedPost.update({
         where: { id: postId },
         data: { content: input.content, scope: input.scope },
         include: feedInclude,
      });
   },

   async deleteFeedPost(clerkId: string, postId: string) {
      const userId = await getUserId(clerkId);
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

   async toggleLike(clerkId: string, postId: string) {
      const userId = await getUserId(clerkId);
      const post = await prisma.feedPost.findFirst({
         where: { id: postId, deletedAt: null },
         select: { id: true },
      });

      if (!post) {
         return null;
      }

      return prisma.$transaction(async (tx: any) => {
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

   async createComment(clerkId: string, postId: string, body: string) {
      const userId = await getUserId(clerkId);
      const post = await prisma.feedPost.findFirst({
         where: { id: postId, deletedAt: null },
         select: { id: true },
      });

      if (!post) {
         return null;
      }

      return prisma.$transaction(async (tx: any) => {
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
   },

   async deleteComment(clerkId: string, commentId: string) {
      const userId = await getUserId(clerkId);
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
