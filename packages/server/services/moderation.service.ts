import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { feedService } from './feed.service';
import { notificationsService } from './notifications.service';

/*
 * Reports, and what the team does about them.
 *
 * Anyone signed in can report a post or a comment once. When enough different
 * people have reported the same thing it is taken out of sight at once, rather
 * than left up until somebody on the team happens to look: a post that three
 * strangers each found worth reporting is not one to leave on the feed
 * overnight. It is hidden, not removed, because three people can be wrong,
 * and the team decides in the panel: take it down, or put it back.
 *
 * The team can also take any post or comment down directly, from the feed.
 * Either way it is the same soft delete the author's own button does, so a
 * removed comment takes its replies and the counts stay true.
 */

export type ReportReason = 'SPAM' | 'ABUSE' | 'LANGUAGE' | 'IMAGE' | 'OTHER';

/* How many different people it takes to hide something before the team looks. */
export const HIDE_AFTER = 3;

type Target = { kind: 'post'; id: string } | { kind: 'comment'; id: string };

const keyOf = (target: Target) => `${target.kind}:${target.id}`;

const parseKey = (key: string): Target | null => {
   const [kind, id] = key.split(':');
   if (!id) return null;
   if (kind === 'post' || kind === 'comment') return { kind, id };
   return null;
};

/* Who wrote the thing, so nobody reports their own words. */
async function authorOf(target: Target) {
   if (target.kind === 'post') {
      const post = await prisma.feedPost.findFirst({
         where: { id: target.id, deletedAt: null },
         select: { authorId: true },
      });
      return post?.authorId ?? null;
   }
   const comment = await prisma.feedComment.findFirst({
      where: { id: target.id, deletedAt: null },
      select: { userId: true },
   });
   return comment?.userId ?? null;
}

async function hide(target: Target) {
   const now = new Date();
   if (target.kind === 'post') {
      await prisma.feedPost.updateMany({
         where: { id: target.id, hiddenAt: null },
         data: { hiddenAt: now },
      });
   } else {
      await prisma.feedComment.updateMany({
         where: { id: target.id, hiddenAt: null },
         data: { hiddenAt: now },
      });
      /* The inbox quotes a comment; a hidden one is not quoted there
         either. Put back from the comment itself if the team keeps it. */
      await prisma.notification.updateMany({
         where: { commentId: target.id },
         data: { body: null },
      });
   }
}

async function unhide(target: Target) {
   if (target.kind === 'post') {
      await prisma.feedPost.updateMany({
         where: { id: target.id },
         data: { hiddenAt: null },
      });
   } else {
      await prisma.feedComment.updateMany({
         where: { id: target.id },
         data: { hiddenAt: null },
      });
      const comment = await prisma.feedComment.findFirst({
         where: { id: target.id, deletedAt: null },
         select: { body: true },
      });
      if (comment) {
         await notificationsService.rewordComment(target.id, comment.body);
      }
   }
}

/*
 * Whether the words were changed after a moment: a comment by its own edit
 * stamp, a post by its catch's (the post's own stamp moves with every like,
 * so it cannot say "edited").
 */
async function changedSince(target: Target, since: Date) {
   if (target.kind === 'comment') {
      const comment = await prisma.feedComment.findFirst({
         where: { id: target.id },
         select: { editedAt: true },
      });
      return Boolean(comment?.editedAt && comment.editedAt > since);
   }
   const post = await prisma.feedPost.findFirst({
      where: { id: target.id },
      select: { updatedAt: true, catch: { select: { updatedAt: true } } },
   });
   const stamp = post?.catch?.updatedAt ?? post?.updatedAt ?? null;
   return Boolean(stamp && stamp > since);
}

async function closeReports(
   key: string,
   adminId: string,
   outcome: 'REMOVED' | 'KEPT'
) {
   await prisma.contentReport.updateMany({
      where: { targetKey: key, resolvedAt: null },
      data: { resolvedAt: new Date(), resolvedById: adminId, outcome },
   });
}

export const moderationService = {
   /**
    * Report a post or a comment. Answers `already` when this person has
    * reported it before, `own` for their own words, and `gone` when there is
    * nothing there to report.
    */
   async report(
      reporterId: string,
      target: Target,
      reason: ReportReason,
      note: string | null
   ): Promise<{
      status: 'reported' | 'already' | 'own' | 'gone';
      hidden: boolean;
   }> {
      const author = await authorOf(target);
      if (!author) return { status: 'gone', hidden: false };
      if (author === reporterId) return { status: 'own', hidden: false };

      const key = keyOf(target);

      /*
       * One open report per person per thing. Once the team has decided, the
       * same person may report it again only if it has changed since: a post
       * kept today can be edited into something else tomorrow. A report on
       * something the team kept and nobody has touched is the same report,
       * and three people who disagree with the team cannot hide it again at
       * once just by pressing Report a second time.
       */
      const earlier = await prisma.contentReport.findUnique({
         where: { reporterId_targetKey: { reporterId, targetKey: key } },
         select: { id: true, resolvedAt: true, outcome: true },
      });
      if (earlier && !earlier.resolvedAt) {
         return { status: 'already', hidden: false };
      }
      if (
         earlier?.outcome === 'KEPT' &&
         earlier.resolvedAt &&
         !(await changedSince(target, earlier.resolvedAt))
      ) {
         return { status: 'already', hidden: false };
      }

      try {
         if (earlier) {
            await prisma.contentReport.update({
               where: { id: earlier.id },
               data: {
                  reason,
                  note,
                  createdAt: new Date(),
                  resolvedAt: null,
                  resolvedById: null,
                  outcome: null,
               },
            });
         } else {
            await prisma.contentReport.create({
               data: {
                  targetKey: key,
                  postId: target.kind === 'post' ? target.id : null,
                  commentId: target.kind === 'comment' ? target.id : null,
                  reporterId,
                  reason,
                  note,
               },
            });
         }
      } catch (error) {
         /* Two presses at once: the second meets the first's row. */
         if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
         ) {
            return { status: 'already', hidden: false };
         }
         throw error;
      }

      /*
       * Counted from the table after the write, so two reports landing at once
       * both see the other and the third voice hides it whichever arrives last.
       */
      const open = await prisma.contentReport.count({
         where: { targetKey: key, resolvedAt: null },
      });
      const hidden = open >= HIDE_AFTER;
      if (hidden) await hide(target);
      return { status: 'reported', hidden };
   },

   /** The open reports, one row per thing reported, most reported first. */
   async queue() {
      const open = await prisma.contentReport.findMany({
         where: { resolvedAt: null },
         orderBy: { createdAt: 'desc' },
         take: 500,
         select: {
            targetKey: true,
            reason: true,
            note: true,
            createdAt: true,
            reporter: {
               select: { id: true, displayName: true, username: true },
            },
         },
      });

      const byTarget = new Map<string, typeof open>();
      for (const report of open) {
         const list = byTarget.get(report.targetKey) ?? [];
         list.push(report);
         byTarget.set(report.targetKey, list);
      }

      const postIds: string[] = [];
      const commentIds: string[] = [];
      for (const key of byTarget.keys()) {
         const target = parseKey(key);
         if (target?.kind === 'post') postIds.push(target.id);
         if (target?.kind === 'comment') commentIds.push(target.id);
      }

      const author = {
         select: { id: true, displayName: true, username: true },
      };
      const [posts, comments] = await Promise.all([
         prisma.feedPost.findMany({
            where: { id: { in: postIds } },
            select: {
               id: true,
               content: true,
               hiddenAt: true,
               deletedAt: true,
               createdAt: true,
               author,
               catch: {
                  select: {
                     id: true,
                     title: true,
                     notes: true,
                     species: { select: { commonName: true } },
                  },
               },
            },
         }),
         prisma.feedComment.findMany({
            where: { id: { in: commentIds } },
            select: {
               id: true,
               body: true,
               hiddenAt: true,
               deletedAt: true,
               createdAt: true,
               postId: true,
               user: author,
            },
         }),
      ]);
      const postsById = new Map(posts.map((post) => [post.id, post]));
      const commentsById = new Map(comments.map((c) => [c.id, c]));

      const items = [...byTarget.entries()].map(([key, reports]) => {
         const target = parseKey(key)!;
         const reasons: Record<string, number> = {};
         for (const report of reports) {
            reasons[report.reason] = (reasons[report.reason] ?? 0) + 1;
         }
         const base = {
            key,
            kind: target.kind,
            id: target.id,
            count: reports.length,
            reasons,
            notes: reports
               .filter((report) => report.note)
               .map((report) => ({
                  note: report.note!,
                  by: report.reporter.displayName,
               })),
            lastReportedAt: reports[0]!.createdAt,
         };
         if (target.kind === 'post') {
            const post = postsById.get(target.id);
            return {
               ...base,
               hidden: Boolean(post?.hiddenAt),
               gone: !post || Boolean(post.deletedAt),
               author: post?.author ?? null,
               /* Each once: a post made from a catch carries the catch's
                  notes as its own words. */
               text:
                  [
                     ...new Set(
                        [post?.catch?.title, post?.catch?.notes, post?.content]
                           .map((part) => part?.trim())
                           .filter(Boolean)
                     ),
                  ].join(' · ') || null,
               species: post?.catch?.species?.commonName ?? null,
               catchId: post?.catch?.id ?? null,
               postId: target.id,
            };
         }
         const comment = commentsById.get(target.id);
         return {
            ...base,
            hidden: Boolean(comment?.hiddenAt),
            gone: !comment || Boolean(comment.deletedAt),
            author: comment?.user ?? null,
            text: comment?.body ?? null,
            species: null,
            catchId: null,
            postId: comment?.postId ?? null,
         };
      });

      items.sort(
         (a, b) =>
            b.count - a.count ||
            b.lastReportedAt.getTime() - a.lastReportedAt.getTime()
      );
      return { items, hideAfter: HIDE_AFTER };
   },

   /**
    * The team's decision on a reported thing: take it down, or put it back.
    * Every open report on it is closed with the same answer.
    */
   async resolve(adminId: string, key: string, action: 'remove' | 'keep') {
      const target = parseKey(key);
      if (!target) return null;
      if (action === 'remove') {
         await this.remove(adminId, target);
      } else {
         await unhide(target);
         await closeReports(key, adminId, 'KEPT');
      }
      return { key, action };
   },

   /** Take a post or a comment down, as the team. */
   async remove(adminId: string, target: Target) {
      if (target.kind === 'post') {
         const post = await prisma.feedPost.findFirst({
            where: { id: target.id },
            select: { catchId: true },
         });
         await feedService.deleteFeedPost(adminId, target.id, {
            asAdmin: true,
         });
         /*
          * The post is the catch put on the feed, and the same photographs
          * and words are on the catch's page and the angler's profile. Taken
          * down, it goes from those too: the catch is made private, so the
          * angler keeps it in their own log and nobody else sees it.
          */
         if (post?.catchId) {
            await prisma.catch.updateMany({
               where: { id: post.catchId },
               data: { visibility: 'PRIVATE' },
            });
         }
         await closeReports(keyOf(target), adminId, 'REMOVED');
         return { removed: true };
      }
      /* The thread on the screen drops the replies that went with it and
         takes the post's new count, as it does for the author's own delete. */
      const result = await feedService.deleteComment(adminId, target.id, {
         asAdmin: true,
      });
      await closeReports(keyOf(target), adminId, 'REMOVED');
      return {
         removedIds: result?.removedIds ?? [target.id],
         removed: result?.removed ?? 0,
         commentCount: result?.commentCount ?? null,
      };
   },
};
