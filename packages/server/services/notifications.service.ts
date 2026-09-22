import { prisma } from '../lib/prisma';
import { pushService } from './push.service';
import { resolveAvatarReadUrls } from './user.service';

export type NotificationKind =
   | 'FOLLOW'
   | 'COMMENT'
   | 'LIKE'
   | 'INVITE'
   | 'INVITE_ANSWER'
   | 'COMMENT_REPLY'
   | 'COMMENT_LIKE';

const PAGE = 20;

/*
 * What happened to you, kept so you can read it later.
 *
 * Written from inside the services that do the thing (a follow, a reply, a
 * like, an invitation) and never from a controller, so there is one place
 * that decides what counts. Nothing is ever written about your own actions,
 * and a like or a follow that is already sitting unread is not written twice.
 * A failure to write is logged and swallowed: the reply still posts.
 */
export const notificationsService = {
   async notify(input: {
      userId: string;
      actorId?: string | null;
      kind: NotificationKind;
      postId?: string | null;
      /* The comment the row is about, so removing the comment can find it. */
      commentId?: string | null;
      competitionId?: string | null;
      body?: string | null;
   }) {
      if (input.actorId && input.actorId === input.userId) return;
      try {
         if (
            input.kind === 'LIKE' ||
            input.kind === 'FOLLOW' ||
            input.kind === 'COMMENT_LIKE'
         ) {
            const existing = await prisma.notification.findFirst({
               where: {
                  userId: input.userId,
                  actorId: input.actorId ?? null,
                  kind: input.kind,
                  postId: input.postId ?? null,
                  /* Null for a post like or a follow, so those match as before. */
                  commentId: input.commentId ?? null,
                  readAt: null,
               },
               select: { id: true },
            });
            if (existing) return;
         }
         const written = await prisma.notification.create({
            data: {
               userId: input.userId,
               actorId: input.actorId ?? null,
               kind: input.kind,
               postId: input.postId ?? null,
               commentId: input.commentId ?? null,
               competitionId: input.competitionId ?? null,
               body: input.body ? input.body.slice(0, 300) : null,
            },
         });
         /* The same line, to any browser of theirs that asked to be told with
          * the app closed. Started and not waited for: it cannot throw into
          * this, and the follow or the reply does not wait on a push service. */
         pushService.announce(written);
      } catch (error) {
         console.warn('[notifications] could not write', String(error));
      }
   },

   async list(userId: string, page = 1, size = PAGE) {
      const skip = (Math.max(1, page) - 1) * size;
      const [rows, total, unread] = await Promise.all([
         prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: size,
            select: {
               id: true,
               kind: true,
               postId: true,
               /* So the inbox can open the thread at the comment it names. */
               commentId: true,
               competitionId: true,
               body: true,
               readAt: true,
               createdAt: true,
               actor: {
                  select: {
                     id: true,
                     displayName: true,
                     username: true,
                     avatarUrl: true,
                  },
               },
            },
         }),
         prisma.notification.count({ where: { userId } }),
         prisma.notification.count({ where: { userId, readAt: null } }),
      ]);
      const notifications = await Promise.all(
         rows.map(async (row) => {
            if (!row.actor) return { ...row, actor: null };
            /* The face is drawn at forty pixels, so the thumb rides along and
             * the original is only what a missing thumb falls back to. */
            const face = await resolveAvatarReadUrls(row.actor.avatarUrl);
            return {
               ...row,
               actor: {
                  ...row.actor,
                  avatarUrl: face.url,
                  avatarThumbUrl: face.thumbUrl,
               },
            };
         })
      );
      return { notifications, total, unread, page, size };
   },

   /*
    * What the bell asks every forty five seconds: how many, and which one is
    * newest. The id is how an open app tells that something arrived since it
    * last asked without reading the list each time. It reads the list only
    * when this changes, and that is when a popup is shown.
    */
   async pulse(userId: string) {
      const [unread, newest] = await Promise.all([
         prisma.notification.count({ where: { userId, readAt: null } }),
         prisma.notification.findFirst({
            where: { userId, readAt: null },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
         }),
      ]);
      return { unread, newestId: newest?.id ?? null };
   },

   /** Everything, or the ids given. Only ever your own. */
   async markRead(userId: string, ids?: string[]) {
      const result = await prisma.notification.updateMany({
         where: {
            userId,
            readAt: null,
            ...(ids && ids.length ? { id: { in: ids } } : {}),
         },
         data: { readAt: new Date() },
      });
      return { read: result.count };
   },

   /*
    * The comments are gone, so what was said about them goes too. Takes the
    * transaction the removal runs in and does not swallow a failure: a row
    * left behind would go on quoting words their author took down, so the
    * removal and this succeed or fail as one.
    */
   async forgetComments(
      tx: { notification: typeof prisma.notification },
      commentIds: string[]
   ) {
      if (commentIds.length === 0) return;
      await tx.notification.deleteMany({
         where: { commentId: { in: commentIds } },
      });
   },

   /*
    * An edit changes what the inbox quotes and nothing else: no new row and
    * readAt left alone, so nobody is told twice. Swallowed like a write, as
    * the edit itself has already been kept. A like row quotes the comment it
    * is about as well, so all three kinds that carry a commentId are reworded.
    */
   async rewordComment(commentId: string, body: string) {
      try {
         await prisma.notification.updateMany({
            where: {
               commentId,
               kind: { in: ['COMMENT', 'COMMENT_REPLY', 'COMMENT_LIKE'] },
            },
            data: { body: body.slice(0, 300) },
         });
      } catch (error) {
         console.warn('[notifications] could not reword', String(error));
      }
   },
};
