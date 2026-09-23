import type { BadgeKind } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notificationsService } from './notifications.service';

/*
 * The badges the Fisherfeed team pins on a fish.
 *
 * Writing is the team's alone, and that is settled at the door by requireAdmin
 * (lib/admin.ts), which reads the role off the database row behind the session
 * and answers 404 to everybody else. Nothing in here takes a "this caller is an
 * admin" flag from the caller; the controller hands over the admin's own id,
 * read from the session, and that is the only identity this file trusts.
 *
 * Reading is not guarded at all, on purpose: a badge is a public fact about a
 * catch, and it rides along with whatever the reader was already allowed to see
 * (the feed post, the catch page, their own log), so it can never show a fish
 * that was otherwise hidden.
 */

export const BADGE_KINDS = [
   'GREAT_CATCH',
   'COOL_SPECIES',
   'PERSONAL_BEST',
   'RARE_VISITOR',
   'RELEASED_WELL',
   'YOUNG_ANGLER',
   'CATCH_OF_THE_WEEK',
   'TEAM_PICK',
] as const satisfies readonly BadgeKind[];

export const isBadgeKind = (value: unknown): value is BadgeKind =>
   typeof value === 'string' &&
   (BADGE_KINDS as readonly string[]).includes(value);

/* The most a team note may run to, matching the column. */
export const NOTE_LIMIT = 140;

/*
 * What a badge looks like wherever it is read: on the feed card, on the catch
 * page and in a row. Exported so the feed and catch reads select exactly this
 * and nothing creeps in later. Never the awarder's email address: the whole
 * point is that this is the team, and an address would be a person.
 */
export const badgeSelect = {
   id: true,
   kind: true,
   note: true,
   createdAt: true,
   awardedBy: { select: { id: true, displayName: true, username: true } },
} as const;

/* Ordered the way they were given, so the two a card shows are the first two. */
export const badgeRead = {
   select: badgeSelect,
   orderBy: { createdAt: 'asc' as const },
} as const;

/*
 * The inbox line, packed into the one column a notification has for it.
 *
 * `KIND|what was caught|the note`, which is the shape INVITE_ANSWER already
 * uses. The client holds the wording for each kind, so a badge renamed on the
 * screen does not need every row in the table rewritten. The note can itself
 * carry a bar, so only the first two separators are ever split on.
 */
const packBody = (kind: BadgeKind, fish: string, note: string | null) =>
   [kind, fish, note ?? ''].join('|');

/* A catch as the badge routes need it: who owns it, and what to call the fish. */
const catchForBadge = (catchId: string) =>
   prisma.catch.findFirst({
      where: { id: catchId, deletedAt: null },
      select: {
         id: true,
         createdById: true,
         title: true,
         species: { select: { commonName: true } },
      },
   });

export const badgesService = {
   /**
    * Pin a badge on a fish.
    *
    * `adminId` is read from the session by the route's guard and passed in; it
    * is never taken from the request body. Returns null when there is no such
    * catch, which the controller turns into the same 404 a stranger gets for
    * the route itself.
    *
    * One of each kind per catch. Awarding a kind that is already there is not
    * an error: the row is left where it is and handed back, so a double tap on
    * a slow connection cannot write two, and nobody is told twice.
    */
   async award(input: {
      catchId: string;
      kind: BadgeKind;
      adminId: string;
      note?: string | null;
   }) {
      const fish = await catchForBadge(input.catchId);
      if (!fish) return null;

      const note = input.note?.trim().slice(0, NOTE_LIMIT) || null;

      const existing = await prisma.catchBadge.findUnique({
         where: { catchId_kind: { catchId: fish.id, kind: input.kind } },
         select: badgeSelect,
      });
      if (existing) return { badge: existing, created: false };

      let badge;
      try {
         badge = await prisma.catchBadge.create({
            data: {
               catchId: fish.id,
               kind: input.kind,
               awardedById: input.adminId,
               note,
            },
            select: badgeSelect,
         });
      } catch (error) {
         /*
          * Two taps landing together: the unique pair stopped the second one.
          * The badge the first tap wrote is the answer to both.
          */
         const already = await prisma.catchBadge.findUnique({
            where: { catchId_kind: { catchId: fish.id, kind: input.kind } },
            select: badgeSelect,
         });
         if (!already) throw error;
         return { badge: already, created: false };
      }

      /*
       * Tell the angler. notify() drops a row whose actor is its reader, so an
       * admin badging their own fish is not told about it, and a failure to
       * write is logged and swallowed in there: the badge is already pinned.
       */
      await notificationsService.notify({
         userId: fish.createdById,
         actorId: input.adminId,
         kind: 'BADGE',
         catchId: fish.id,
         body: packBody(
            input.kind,
            fish.species?.commonName?.trim() || fish.title.trim() || 'catch',
            note
         ),
      });

      return { badge, created: true };
   },

   /**
    * Take a badge off again.
    *
    * The line in the angler's inbox goes with it. A badge that was pinned by
    * mistake and taken off a minute later should not leave an inbox saying the
    * team called their fish something it no longer does, which is the same rule
    * a removed comment follows.
    */
   async remove(input: { catchId: string; kind: BadgeKind }) {
      const removed = await prisma.catchBadge.deleteMany({
         where: { catchId: input.catchId, kind: input.kind },
      });
      if (removed.count === 0) return { removed: false };

      try {
         /*
          * Read the fish's badge lines and pick the ones this kind wrote,
          * rather than asking the database for a prefix. startsWith becomes a
          * LIKE pattern with the kind's own underscores left in it, and an
          * underscore is LIKE's single character wildcard: today no two of the
          * eight kinds are the same length, so nothing is confused, but a
          * ninth that happened to be would quietly take another badge's line
          * down with it. There are never more than eight rows to read.
          */
         const lines = await prisma.notification.findMany({
            where: { kind: 'BADGE', catchId: input.catchId },
            select: { id: true, body: true },
         });
         const ours = lines
            .filter((line) => line.body?.startsWith(`${input.kind}|`))
            .map((line) => line.id);
         if (ours.length > 0) {
            await prisma.notification.deleteMany({
               where: { id: { in: ours } },
            });
         }
      } catch (error) {
         console.warn('[badges] could not withdraw the inbox line', {
            catchId: input.catchId,
            error,
         });
      }

      return { removed: true };
   },

   /** Every badge on one fish, in the order they were given. */
   async listForCatch(catchId: string) {
      return prisma.catchBadge.findMany({
         where: { catchId },
         ...badgeRead,
      });
   },
};
