import { prisma } from '../lib/prisma';
import { buildSpeciesBoards, buildStandings, scoreCatch } from './scoring';
import type { ScoredEntry, ScoringSpecies, SizeClass } from './scoring';

/*
 * Ring four: groups and the competitions that run inside them.
 *
 * The rule that shapes this file: a group is a new audience for a spot. Every
 * catch publishes a feed post, and a spot post carries exact coordinates, so
 * joining a group must never be the thing that makes an angler's mark public.
 * Visibility is checked on the way in, not patched on the way out.
 */

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Eight characters, no I/O/0/1, because these get read aloud on a beach. */
const makeJoinCode = () =>
   Array.from(
      { length: 8 },
      () =>
         JOIN_CODE_ALPHABET[
            Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)
         ]
   ).join('');

const CATCH_FOR_SCORING = {
   id: true,
   createdById: true,
   speciesId: true,
   length: true,
   weight: true,
   weightSource: true,
   released: true,
   caughtAt: true,
   visibility: true,
   species: {
      select: {
         id: true,
         commonName: true,
         lwA: true,
         lwB: true,
         sizeClass: true,
         minLegalCm: true,
         closedFrom: true,
         closedTo: true,
      },
   },
} as const;

type RawCatch = {
   createdById: string;
   speciesId: string | null;
   length: number | null;
   weight: number | null;
   weightSource: 'LENGTH' | 'SCALE';
   released: boolean;
   caughtAt: Date;
   visibility: 'PRIVATE' | 'GROUPS' | 'PUBLIC';
   species: {
      id: string;
      commonName: string;
      lwA: number | null;
      lwB: number | null;
      sizeClass: SizeClass;
      minLegalCm: number | null;
      closedFrom: string | null;
      closedTo: string | null;
   } | null;
};

const score = (row: RawCatch): ScoredEntry => ({
   ...scoreCatch(
      {
         lengthCm: row.length,
         weightKg: row.weight,
         weightSource: row.weightSource,
         released: row.released,
         caughtAt: row.caughtAt,
      },
      row.species
         ? ({
              commonName: row.species.commonName,
              lwA: row.species.lwA,
              lwB: row.species.lwB,
              sizeClass: row.species.sizeClass,
              minLegalCm: row.species.minLegalCm,
              closedFrom: row.species.closedFrom,
              closedTo: row.species.closedTo,
           } satisfies ScoringSpecies)
         : null
   ),
   anglerId: row.createdById,
   speciesId: row.speciesId,
   caughtAt: row.caughtAt,
   lengthCm: row.length,
});

export const groupsService = {
   async listMine(userId: string) {
      const memberships = await prisma.groupMember.findMany({
         where: { userId, leftAt: null },
         select: {
            role: true,
            joinedAt: true,
            group: {
               select: {
                  id: true,
                  name: true,
                  blurb: true,
                  joinMode: true,
                  memberCount: true,
                  createdById: true,
               },
            },
         },
         orderBy: { joinedAt: 'desc' },
      });

      return memberships
         .filter((m) => m.group)
         .map((m) => ({ ...m.group, role: m.role, joinedAt: m.joinedAt }));
   },

   async create(
      userId: string,
      input: {
         name: string;
         blurb?: string | null;
         joinMode?: 'OPEN' | 'INVITE_ONLY' | 'CODE';
      }
   ) {
      return prisma.$transaction(async (tx) => {
         const group = await tx.group.create({
            data: {
               name: input.name,
               blurb: input.blurb ?? null,
               createdById: userId,
               joinMode: input.joinMode ?? 'INVITE_ONLY',
               joinCode: input.joinMode === 'CODE' ? makeJoinCode() : null,
               /* The creator is the first member, counted here rather than later. */
               memberCount: 1,
            },
         });

         await tx.groupMember.create({
            data: { groupId: group.id, userId, role: 'OWNER' },
         });

         return group;
      });
   },

   async joinByCode(userId: string, code: string) {
      const group = await prisma.group.findUnique({
         where: { joinCode: code.trim().toUpperCase() },
         select: { id: true, joinMode: true, deletedAt: true },
      });

      if (!group || group.deletedAt || group.joinMode !== 'CODE') {
         return { code: 'no_such_group' as const };
      }

      const existing = await prisma.groupMember.findUnique({
         where: { groupId_userId: { groupId: group.id, userId } },
         select: { id: true, leftAt: true },
      });

      if (existing && !existing.leftAt) {
         return { code: 'already_a_member' as const, groupId: group.id };
      }

      await prisma.$transaction(async (tx) => {
         if (existing) {
            await tx.groupMember.update({
               where: { id: existing.id },
               data: { leftAt: null },
            });
         } else {
            await tx.groupMember.create({
               data: { groupId: group.id, userId, role: 'MEMBER' },
            });
         }

         /* Counted from the rows rather than incremented, so it cannot drift. */
         const count = await tx.groupMember.count({
            where: { groupId: group.id, leftAt: null },
         });
         await tx.group.update({
            where: { id: group.id },
            data: { memberCount: count },
         });
      });

      return { code: 'joined' as const, groupId: group.id };
   },

   async isMember(groupId: string, userId: string) {
      const row = await prisma.groupMember.findUnique({
         where: { groupId_userId: { groupId, userId } },
         select: { leftAt: true },
      });

      return Boolean(row && !row.leftAt);
   },

   /**
    * A group's boards.
    *
    * PRIVATE catches never appear, even to fellow members. Marking a catch
    * private is the angler saying no, and a leaderboard is not a reason to
    * overrule it: the entry is left out and the total is simply lower.
    */
   async boards(groupId: string) {
      const members = await prisma.groupMember.findMany({
         where: { groupId, leftAt: null },
         select: { userId: true },
      });

      const memberIds = members.map((m) => m.userId);

      if (!memberIds.length) {
         return { standings: [], speciesBoards: [], excludedPrivate: 0 };
      }

      const rows = (await prisma.catch.findMany({
         where: { createdById: { in: memberIds }, deletedAt: null },
         select: CATCH_FOR_SCORING,
      })) as RawCatch[];

      const visible = rows.filter((r) => r.visibility !== 'PRIVATE');
      const scored = visible.map(score);

      const names = new Map<string, string>();
      for (const row of visible) {
         if (row.speciesId && row.species) {
            names.set(row.speciesId, row.species.commonName);
         }
      }

      const people = await prisma.user.findMany({
         where: { id: { in: memberIds } },
         select: { id: true, displayName: true, username: true },
      });
      const byId = new Map(people.map((p) => [p.id, p]));
      const named = (id: string) =>
         byId.get(id)?.displayName ?? 'Unknown angler';

      return {
         standings: buildStandings(scored).map((s) => ({
            ...s,
            displayName: named(s.anglerId),
            username: byId.get(s.anglerId)?.username ?? null,
         })),
         speciesBoards: buildSpeciesBoards(scored, names).map((b) => ({
            ...b,
            longestByName: b.longestBy ? named(b.longestBy) : null,
            standings: b.standings.map((s) => ({
               ...s,
               displayName: named(s.anglerId),
               username: byId.get(s.anglerId)?.username ?? null,
            })),
         })),
         /*
          * Reported rather than hidden. A member should be able to see that
          * some catches are being kept back, without seeing which.
          */
         excludedPrivate: rows.length - visible.length,
      };
   },
};
