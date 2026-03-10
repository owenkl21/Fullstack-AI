import { prisma } from '../lib/prisma';
import { userService } from './user.service';

type FeedScope = 'GLOBAL' | 'NEARBY';
type FeedType = 'CATCH' | 'SITE';

const feedInclude = {
   author: { select: { id: true, username: true, displayName: true } },
   catch: { select: { id: true, title: true } },
   site: { select: { id: true, name: true } },
   comments: {
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' as const },
      take: 5,
      include: {
         user: { select: { id: true, username: true, displayName: true } },
      },
   },
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

      const posts = await prisma.feedPost.findMany({
         where: {
            deletedAt: null,
            scope: input.scope,
            ...(input.type ? { type: input.type } : {}),
            ...nearbyWhere,
         },
         include: feedInclude,
         orderBy: { createdAt: 'desc' },
         take: 50,
      });

      if (!input.userId) {
         return posts.map((post: any) => ({ ...post, likedByMe: false }));
      }

      const likes = await prisma.feedLike.findMany({
         where: {
            userId: input.userId,
            postId: { in: posts.map((p: any) => p.id) },
         },
         select: { postId: true },
      });
      const likedSet = new Set(likes.map((l: any) => l.postId));

      return posts.map((post: any) => ({
         ...post,
         likedByMe: likedSet.has(post.id),
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
