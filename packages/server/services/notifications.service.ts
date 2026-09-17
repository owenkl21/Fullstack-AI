import { prisma } from '../lib/prisma';

export type NotificationKind =
   | 'FOLLOW'
   | 'COMMENT'
   | 'LIKE'
   | 'INVITE'
   | 'INVITE_ANSWER';

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
      competitionId?: string | null;
      body?: string | null;
   }) {
      if (input.actorId && input.actorId === input.userId) return;
      try {
         if (input.kind === 'LIKE' || input.kind === 'FOLLOW') {
            const existing = await prisma.notification.findFirst({
               where: {
                  userId: input.userId,
                  actorId: input.actorId ?? null,
                  kind: input.kind,
                  postId: input.postId ?? null,
                  readAt: null,
               },
               select: { id: true },
            });
            if (existing) return;
         }
         await prisma.notification.create({
            data: {
               userId: input.userId,
               actorId: input.actorId ?? null,
               kind: input.kind,
               postId: input.postId ?? null,
               competitionId: input.competitionId ?? null,
               body: input.body ? input.body.slice(0, 300) : null,
            },
         });
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
      return { notifications: rows, total, unread, page, size };
   },

   async unreadCount(userId: string) {
      return prisma.notification.count({ where: { userId, readAt: null } });
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
};
