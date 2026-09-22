import { prisma } from '../lib/prisma';
import {
   siteGateSelect,
   sitesVisibleTo,
   withSiteShownTo,
   type SiteGate,
} from '../lib/site-privacy';
import { badgeRead } from './badges.service';
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

/* Who wrote a comment, as the thread prints it. Never an email address.
   verified carries the tick beside the name; it is one boolean the server
   alone writes, so the thread never has to work out who is who. */
const commentAuthor = {
   select: { id: true, username: true, displayName: true, verified: true },
};

/*
 * A card carries its five newest comments so the thread opens without a round
 * trip, and each of those carries the two replies the thread shows before
 * "View more". Anything past that is read with the whole thread.
 */
const EMBEDDED_COMMENTS = 5;
const EMBEDDED_REPLIES = 2;
/*
 * The most rows one thread read returns. Oldest first, so the cut can only
 * ever lose the newest: a reply is younger than the comment it answers, which
 * means a reply inside the window always has its parent inside it too.
 */
const THREAD_CAP = 1000;

const feedInclude = {
   author: {
      select: {
         id: true,
         username: true,
         displayName: true,
         avatarUrl: true,
         verified: true,
      },
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
         /* What the team has called this fish. On the card it sits with the
            species and the figures, so it comes down with them. */
         badges: badgeRead,
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
                     zoom: true,
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
   /*
    * Top-level comments only. A reply used to be impossible; now that it is
    * not, five newest rows of either kind could be five replies to comments
    * the card does not hold, with nothing to hang them from.
    */
   comments: {
      where: { deletedAt: null, parentId: null },
      orderBy: { createdAt: 'desc' as const },
      take: EMBEDDED_COMMENTS,
      include: {
         user: commentAuthor,
         replies: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' as const },
            take: EMBEDDED_REPLIES,
            include: { user: commentAuthor },
         },
         _count: { select: { replies: { where: { deletedAt: null } } } },
      },
   },
   /*
    * How many top-level comments there are, which commentCount cannot say:
    * that one counts replies as well, because it is the figure beside the
    * bubble and a reply is a comment on the post. The thread needs this one
    * to know how many it has not shown yet.
    */
   _count: {
      select: { comments: { where: { deletedAt: null, parentId: null } } },
   },
};

type CommentRow = {
   id: string;
   postId: string;
   parentId: string | null;
   body: string;
   likeCount: number;
   editedAt: Date | null;
   createdAt: Date;
   user: {
      id: string;
      username: string | null;
      displayName: string;
      verified: boolean;
   };
   replies?: CommentRow[];
   _count?: { replies: number };
};

/*
 * A comment as the thread reads it. Named field by field rather than spread,
 * so a column added to the table later (deletedAt and userId are already
 * there) does not start travelling to every reader by accident.
 */
const shapeComment = (row: CommentRow, likedByViewer: Set<string>) => ({
   id: row.id,
   postId: row.postId,
   parentId: row.parentId,
   body: row.body,
   createdAt: row.createdAt,
   editedAt: row.editedAt,
   likeCount: Math.max(0, row.likeCount),
   likedByMe: likedByViewer.has(row.id),
   user: row.user,
});

/** A top-level comment: itself, the replies in hand, and how many there are. */
const shapeThread = (row: CommentRow, likedByViewer: Set<string>) => {
   const replies = (row.replies ?? []).map((reply) =>
      shapeComment(reply, likedByViewer)
   );
   return {
      ...shapeComment(row, likedByViewer),
      replies,
      replyCount: Math.max(row._count?.replies ?? 0, replies.length),
   };
};

/** Which of these comments the viewer has liked. Nobody signed in, none. */
async function likedAmong(viewerId: string | undefined, commentIds: string[]) {
   if (!viewerId || commentIds.length === 0) return new Set<string>();
   const rows = await prisma.feedCommentLike.findMany({
      where: { userId: viewerId, commentId: { in: commentIds } },
      select: { commentId: true },
   });
   return new Set(rows.map((row) => row.commentId));
}

const idsInThreads = (threads: CommentRow[]) =>
   threads.flatMap((row) => [
      row.id,
      ...(row.replies ?? []).map((reply) => reply.id),
   ]);

/*
 * The embedded comments of a post, in the shape the thread route returns, and
 * the count of top-level ones lifted off Prisma's `_count` under a name that
 * says what it is.
 */
const withShapedThread = <
   T extends { comments: CommentRow[]; _count?: { comments: number } },
>(
   post: T,
   likedByViewer: Set<string>
) => {
   const { _count, ...rest } = post;
   return {
      ...rest,
      comments: post.comments.map((row) => shapeThread(row, likedByViewer)),
      threadCount: _count?.comments ?? post.comments.length,
   };
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

/*
 * The post a comment route is acting under. Gone, or private, and the thread
 * is not there for anybody: the same two rules the feed itself reads by.
 */
const readablePost = (postId: string) =>
   prisma.feedPost.findFirst({
      where: { id: postId, deletedAt: null, visibility: { not: 'PRIVATE' } },
      select: { id: true, authorId: true },
   });

/* Thrown inside the reply transaction to roll it back; never leaves the file. */
class ParentGone extends Error {}

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
      /*
       * One post, by id: where a notification about a comment lands, since a
       * post has no page of its own. It is read through the same rules as the
       * rest (live, not private, a catch) and leaves the scope out, because
       * the reader asked for that post and not for a place.
       */
      postId?: string;
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
            ...(input.postId
               ? { id: input.postId }
               : { ...scopeWhere, ...nearbyWhere }),
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
         const nobody = new Set<string>();
         return postsWithResolvedImageUrls.map((post: any) => ({
            ...withShapedThread(post, nobody),
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

      /* One read for every comment on the page, not one per card. */
      const likedComments = await likedAmong(
         viewerUserId,
         postsWithResolvedImageUrls.flatMap((post: any) =>
            idsInThreads(post.comments)
         )
      );

      return postsWithResolvedImageUrls.map((post: any) => ({
         ...withShapedThread(post, likedComments),
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
      /* New, so nobody has commented, let alone liked one. */
      return withShapedThread(withSpotShownTo(post, userId), new Set<string>());
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
      return withShapedThread(
         withSpotShownTo(post, userId),
         await likedAmong(userId, idsInThreads(post.comments))
      );
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

      const result: { liked: boolean } = await prisma
         .$transaction(async (tx: any) => {
            /*
             * The post's row is taken before the like table is touched, the
             * way a comment's heart takes its comment (toggleCommentLike), so
             * every heart pressed on one post waits its turn. Without it, a
             * like's insert only read the post for its key: two people liking
             * at once each held that read and then waited on the other to
             * raise the figure, and MySQL threw one of them out as a 500.
             * Two unlikes at once both found the row and both lowered the
             * figure, so it drifted below the likes actually held. Nothing
             * changes here; the figure moves below.
             */
            await tx.feedPost.update({
               where: { id: postId },
               data: { likeCount: { increment: 0 } },
               select: { id: true },
            });

            const existing = await tx.feedLike.findUnique({
               where: { postId_userId: { postId, userId } },
               select: { id: true },
            });

            if (existing) {
               /* deleteMany, so the figure only drops by a row that went. */
               const gone = await tx.feedLike.deleteMany({
                  where: { id: existing.id },
               });
               await tx.feedPost.update({
                  where: { id: postId },
                  data: { likeCount: { decrement: gone.count } },
               });
               return { liked: false };
            }

            await tx.feedLike.create({ data: { postId, userId } });
            await tx.feedPost.update({
               where: { id: postId },
               data: { likeCount: { increment: 1 } },
            });

            return { liked: true };
         })
         .catch((error: unknown) => {
            /*
             * The unique key on (postId, userId) still stands behind this: a
             * like that trips it is a like already held, which is what was
             * asked for, so it is answered as liked rather than as a failure.
             */
            if ((error as { code?: string })?.code !== 'P2002') throw error;
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

   /*
    * The whole thread, oldest first: every top-level comment with its replies
    * under it. Anyone may read it; `viewerId` only decides which hearts come
    * back filled. Null when the post is not there to be read.
    */
   async listComments(postId: string, viewerId?: string) {
      const post = await readablePost(postId);
      if (!post) return null;

      const rows: CommentRow[] = await prisma.feedComment.findMany({
         where: { postId, deletedAt: null },
         include: { user: commentAuthor },
         orderBy: { createdAt: 'asc' },
         take: THREAD_CAP,
      });

      /*
       * Nested here rather than in the query, so the thread is one read and
       * the order inside each group is the order of the list. A reply whose
       * parent is not among the live rows has nothing to hang from and is
       * left out: a removal takes its replies with it, so that is only ever
       * a reply that slipped in while its parent was being removed.
       */
      const threads = new Map<string, CommentRow>();
      for (const row of rows) {
         if (!row.parentId) threads.set(row.id, { ...row, replies: [] });
      }
      for (const row of rows) {
         if (row.parentId) threads.get(row.parentId)?.replies?.push(row);
      }

      const ordered = [...threads.values()];
      const liked = await likedAmong(viewerId, idsInThreads(ordered));
      return ordered.map((row) => shapeThread(row, liked));
   },

   /*
    * A comment, or a reply when `parentId` names the comment being answered.
    *
    * The thread is one level deep. Answering a reply is allowed, and lands
    * under the same top-level comment as the reply it answers; the person
    * told about it is whoever wrote the comment that was actually answered,
    * not whoever started the group.
    */
   async createComment(
      userId: string,
      postId: string,
      body: string,
      parentId?: string | null
   ) {
      await getUserId(userId); // throws if the user is gone
      const post = await readablePost(postId);

      if (!post) {
         return { error: 'post_not_found' as const };
      }

      let answered: { id: string; userId: string } | null = null;
      let topLevelId: string | null = null;
      if (parentId) {
         const target = await prisma.feedComment.findFirst({
            where: { id: parentId, deletedAt: null },
            select: {
               id: true,
               postId: true,
               userId: true,
               parentId: true,
               parent: { select: { deletedAt: true } },
            },
         });

         /* Removed, or never there. Nothing is said to a comment that is gone. */
         if (!target || (target.parentId && target.parent?.deletedAt)) {
            return { error: 'parent_not_found' as const };
         }
         /* A real comment, under some other post: not this thread's to answer. */
         if (target.postId !== postId) {
            return { error: 'parent_not_in_post' as const };
         }

         answered = { id: target.id, userId: target.userId };
         topLevelId = target.parentId ?? target.id;
      }

      let comment: CommentRow;
      try {
         comment = await prisma.$transaction(async (tx: any) => {
            /*
             * A reply is a comment on the post, so it is counted as one. The
             * figure is raised first, before the row is written, which takes
             * the post's row for this transaction alone. The other way round,
             * each insert took a shared hold on the post (its key is checked)
             * and then waited to raise the figure, so two people writing at
             * the same moment waited on each other and MySQL threw one of
             * them out: the second of two comments sent at once failed.
             */
            await tx.feedPost.update({
               where: { id: postId },
               data: { commentCount: { increment: 1 } },
            });

            const created = await tx.feedComment.create({
               data: {
                  postId,
                  userId,
                  body,
                  parentId: topLevelId,
               },
               include: { user: commentAuthor },
            });

            if (topLevelId) {
               /*
                * Looked at again now that the reply exists. A removal that
                * ran between the check above and this write has already
                * swept the parent's replies and would have missed this one,
                * leaving it counted and never shown. Rolled back instead.
                */
               const parent = await tx.feedComment.findUnique({
                  where: { id: topLevelId },
                  select: { deletedAt: true },
               });
               if (!parent || parent.deletedAt) throw new ParentGone();
            }

            return created;
         });
      } catch (error) {
         if (error instanceof ParentGone) {
            return { error: 'parent_not_found' as const };
         }
         throw error;
      }

      /*
       * Who hears about it. The person answered is told they were answered.
       * The post's author is told of every comment under their post, unless
       * they are the person answered, who has just been told once already.
       * `notify` drops anything addressed to the person who wrote it. Both
       * rows carry the new comment's id, so removing it removes them.
       */
      if (answered) {
         await notificationsService.notify({
            userId: answered.userId,
            actorId: userId,
            kind: 'COMMENT_REPLY',
            postId,
            commentId: comment.id,
            body,
         });
      }
      if (!answered || answered.userId !== post.authorId) {
         await notificationsService.notify({
            userId: post.authorId,
            actorId: userId,
            kind: 'COMMENT',
            postId,
            commentId: comment.id,
            body,
         });
      }

      const nobody = new Set<string>();
      return {
         comment: topLevelId
            ? shapeComment(comment, nobody)
            : shapeThread(comment, nobody),
      };
   },

   /*
    * The author changes the words. Only the author: the owner of the post may
    * remove a comment under it, never rewrite one. Nobody is told again; the
    * inbox rows that quote the comment are brought up to date in place.
    */
   async updateComment(userId: string, commentId: string, body: string) {
      await getUserId(userId); // throws if the user is gone
      const existing = await prisma.feedComment.findFirst({
         where: {
            id: commentId,
            userId,
            deletedAt: null,
            post: { deletedAt: null },
         },
         select: { id: true, body: true },
      });

      if (!existing) {
         return null;
      }

      const include = {
         user: commentAuthor,
         _count: { select: { replies: { where: { deletedAt: null } } } },
      };
      /* Saved as it stood: not an edit, so it is not marked as one. */
      const changed = existing.body !== body;
      const row: CommentRow = changed
         ? await prisma.feedComment.update({
              where: { id: commentId },
              data: { body, editedAt: new Date() },
              include,
           })
         : await prisma.feedComment.findUniqueOrThrow({
              where: { id: commentId },
              include,
           });

      if (changed) {
         await notificationsService.rewordComment(commentId, body);
      }

      const liked = await likedAmong(userId, [commentId]);
      /* The client keeps the replies it holds; only the comment comes back. */
      return {
         ...shapeComment(row, liked),
         ...(row.parentId ? {} : { replyCount: row._count?.replies ?? 0 }),
      };
   },

   /*
    * Remove a comment, and with a top-level one every reply under it, which
    * is what a reader expects from anywhere else they have commented: a reply
    * left hanging under "Comment removed" answers nothing.
    *
    * Yours to remove if you wrote it, or if it sits under your post. One
    * transaction: the rows are marked, the post's count drops by exactly the
    * number marked, and the inbox rows about any of them go. Marked, not
    * deleted, like everything else here; the likes stay in their table and
    * stop counting because nothing reads a removed comment again.
    */
   async deleteComment(userId: string, commentId: string) {
      await getUserId(userId); // throws if the user is gone
      const existing = await prisma.feedComment.findFirst({
         where: { id: commentId, deletedAt: null },
         select: {
            id: true,
            postId: true,
            userId: true,
            post: { select: { authorId: true } },
         },
      });

      /* Not found and not yours read the same from outside. */
      if (
         !existing ||
         (existing.userId !== userId && existing.post.authorId !== userId)
      ) {
         return null;
      }

      return prisma.$transaction(async (tx: any) => {
         /*
          * The post's row is taken first, the way a new comment takes it
          * first (createComment), so every write to a thread queues on the
          * same row in the same order. A removal that marked the rows first
          * and a reply to the comment being removed could otherwise each hold
          * what the other was waiting for. Nothing changes here; the figure
          * is lowered below once the number removed is known.
          */
         await tx.feedPost.update({
            where: { id: existing.postId },
            data: { commentCount: { increment: 0 } },
            select: { id: true },
         });

         const replies: Array<{ id: string }> = await tx.feedComment.findMany({
            where: { parentId: commentId, deletedAt: null },
            select: { id: true },
         });
         const ids = [commentId, ...replies.map((reply) => reply.id)];

         /*
          * Counted by the write, not by the read above: two removals of the
          * same comment at once both get here, and only the rows this one
          * really marked may come off the post's figure.
          */
         const marked = await tx.feedComment.updateMany({
            where: { id: { in: ids }, deletedAt: null },
            data: { deletedAt: new Date() },
         });

         if (marked.count > 0) {
            await tx.feedPost.update({
               where: { id: existing.postId },
               data: { commentCount: { decrement: marked.count } },
            });
            /* A figure that had already drifted low is not sent below zero. */
            await tx.feedPost.updateMany({
               where: { id: existing.postId, commentCount: { lt: 0 } },
               data: { commentCount: 0 },
            });
         }

         await notificationsService.forgetComments(tx, ids);

         const post = await tx.feedPost.findUnique({
            where: { id: existing.postId },
            select: { commentCount: true },
         });

         return {
            id: commentId,
            postId: existing.postId,
            removedIds: ids,
            removed: marked.count,
            commentCount: post?.commentCount ?? 0,
         };
      });
   },

   /*
    * Like a comment, or take the like back. The same toggle a post has, and
    * it answers with the figure as well as the state, so a heart pressed on
    * two devices settles on what the table says rather than on arithmetic.
    */
   async toggleCommentLike(userId: string, commentId: string) {
      await getUserId(userId); // throws if the user is gone
      const comment = await prisma.feedComment.findFirst({
         where: {
            id: commentId,
            deletedAt: null,
            post: { deletedAt: null, visibility: { not: 'PRIVATE' } },
         },
         select: { id: true, userId: true, postId: true, body: true },
      });

      if (!comment) {
         return null;
      }

      const result: { liked: boolean; likeCount: number } = await prisma
         .$transaction(async (tx: any) => {
            /*
             * The comment's row is taken before the like table is touched,
             * so every heart pressed on one comment waits its turn. Without
             * it, a like's insert only read the comment for its key: two
             * people liking at once each held that read and then waited on
             * the other to raise the figure, and a like and an unlike of the
             * same heart waited on each other the same way. MySQL threw one
             * of each pair out. Nothing changes here; the figure moves below.
             */
            await tx.feedComment.update({
               where: { id: commentId },
               data: { likeCount: { increment: 0 } },
               select: { id: true },
            });

            const existing = await tx.feedCommentLike.findUnique({
               where: { commentId_userId: { commentId, userId } },
               select: { id: true },
            });

            if (existing) {
               /* deleteMany, so a second unlike racing this one removes
                  nothing and counts nothing, rather than throwing on a row
                  that has already gone. */
               const gone = await tx.feedCommentLike.deleteMany({
                  where: { id: existing.id },
               });
               const row = await tx.feedComment.update({
                  where: { id: commentId },
                  data: { likeCount: { decrement: gone.count } },
                  select: { likeCount: true },
               });
               return { liked: false, likeCount: Math.max(0, row.likeCount) };
            }

            await tx.feedCommentLike.create({ data: { commentId, userId } });
            const row = await tx.feedComment.update({
               where: { id: commentId },
               data: { likeCount: { increment: 1 } },
               select: { likeCount: true },
            });

            return { liked: true, likeCount: row.likeCount };
         })
         .catch(async (error: unknown) => {
            /*
             * Two likes at once: the second trips the unique key on
             * (commentId, userId). The like is there, which is what was asked
             * for, so it is answered as liked rather than as a failure.
             */
            if ((error as { code?: string })?.code !== 'P2002') throw error;
            const row = await prisma.feedComment.findUnique({
               where: { id: commentId },
               select: { likeCount: true },
            });
            return { liked: true, likeCount: row?.likeCount ?? 1 };
         });

      if (result.liked) {
         await notificationsService.notify({
            userId: comment.userId,
            actorId: userId,
            kind: 'COMMENT_LIKE',
            postId: comment.postId,
            commentId,
            /* Their own words back to them, so the line says which comment. */
            body: comment.body,
         });
      }
      return result;
   },
};
