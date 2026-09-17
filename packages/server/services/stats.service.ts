import { prisma } from '../lib/prisma';
import {
   buildSpeciesBoards,
   buildStandings,
   scoreCatch,
   type ScoredEntry,
   type ScoringSpecies,
   type SizeClass,
} from './scoring';

/*
 * Rings two and three of the social layer: personal bests and profile stats,
 * then the mutual-follow rivalry board.
 *
 * Neither needs a new table. Both read catches, which is the point: a board
 * that is derived cannot drift from the records it describes.
 */

const CATCH_FOR_SCORING = {
   id: true,
   createdById: true,
   speciesId: true,
   length: true,
   weight: true,
   weightSource: true,
   released: true,
   caughtAt: true,
   title: true,
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
   id: string;
   createdById: string;
   speciesId: string | null;
   length: number | null;
   weight: number | null;
   weightSource: 'LENGTH' | 'SCALE';
   released: boolean;
   caughtAt: Date;
   title: string;
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

const toScoringSpecies = (s: RawCatch['species']): ScoringSpecies | null =>
   s
      ? {
           commonName: s.commonName,
           lwA: s.lwA,
           lwB: s.lwB,
           sizeClass: s.sizeClass,
           minLegalCm: s.minLegalCm,
           closedFrom: s.closedFrom,
           closedTo: s.closedTo,
        }
      : null;

const score = (row: RawCatch): ScoredEntry => ({
   ...scoreCatch(
      {
         lengthCm: row.length,
         weightKg: row.weight,
         weightSource: row.weightSource,
         released: row.released,
         caughtAt: row.caughtAt,
      },
      toScoringSpecies(row.species)
   ),
   anglerId: row.createdById,
   speciesId: row.speciesId,
   caughtAt: row.caughtAt,
   lengthCm: row.length,
});

export type PersonalBest = {
   speciesId: string;
   commonName: string;
   lengthCm: number;
   caughtAt: Date;
   catchId: string;
   title: string;
};

export const statsService = {
   /**
    * A personal best per species: the longest fish, earliest wins a tie.
    *
    * Length rather than points, because a personal best is about the fish
    * rather than the arithmetic, and length is recorded far more often than a
    * scale weight.
    */
   async personalBests(userId: string): Promise<PersonalBest[]> {
      const rows = (await prisma.catch.findMany({
         where: {
            createdById: userId,
            deletedAt: null,
            speciesId: { not: null },
            length: { not: null },
         },
         select: CATCH_FOR_SCORING,
         orderBy: [{ length: 'desc' }, { caughtAt: 'asc' }],
      })) as RawCatch[];

      const best = new Map<string, PersonalBest>();

      for (const row of rows) {
         if (!row.speciesId || !row.species || row.length == null) {
            continue;
         }

         /* Ordered longest first, so the first of each species is the best. */
         if (best.has(row.speciesId)) {
            continue;
         }

         best.set(row.speciesId, {
            speciesId: row.speciesId,
            commonName: row.species.commonName,
            lengthCm: Math.floor(row.length),
            caughtAt: row.caughtAt,
            catchId: row.id,
            title: row.title,
         });
      }

      return [...best.values()].sort((a, b) => b.lengthCm - a.lengthCm);
   },

   /**
    * The numbers a profile can stand behind.
    *
    * Every one is counted rather than estimated, and anything that cannot be
    * known is null rather than zero: no species recorded is not the same as
    * zero species.
    */
   async profileStats(userId: string) {
      const rows = (await prisma.catch.findMany({
         where: { createdById: userId, deletedAt: null },
         select: CATCH_FOR_SCORING,
      })) as RawCatch[];

      const scored = rows.map(score);
      const standing = buildStandings(scored)[0] ?? null;

      const withSpecies = rows.filter((r) => r.speciesId);
      const withLength = rows.filter((r) => r.length != null);
      const released = rows.filter((r) => r.released);

      const days = new Set(
         rows.map((r) => r.caughtAt.toISOString().slice(0, 10))
      );

      return {
         catches: rows.length,
         /* Null, not zero, when nothing has a species yet. */
         distinctSpecies: withSpecies.length
            ? new Set(withSpecies.map((r) => r.speciesId)).size
            : null,
         daysOnTheWater: days.size,
         releasedCount: released.length,
         longestCm: withLength.length
            ? Math.max(...withLength.map((r) => Math.floor(r.length as number)))
            : null,
         points: standing?.points ?? 0,
         qualifyingCatches: standing?.qualifyingCount ?? 0,
         /*
          * How many catches could not be scored, so the profile can explain a
          * zero rather than just showing one.
          */
         unscored: scored.filter((e) => !e.qualifies).length,
      };
   },

   /**
    * The rivalry board: this angler and everyone they mutually follow.
    *
    * Mutual on purpose. Following someone should not put you on their board,
    * and being followed should not drag you onto a stranger's.
    */
   async rivalryBoard(userId: string) {
      const [following, followers] = await Promise.all([
         prisma.follow.findMany({
            where: { followerId: userId },
            select: { followingId: true },
         }),
         prisma.follow.findMany({
            where: { followingId: userId },
            select: { followerId: true },
         }),
      ]);

      const followingIds = new Set(following.map((f) => f.followingId));
      const mutual = followers
         .map((f) => f.followerId)
         .filter((id) => followingIds.has(id));

      const anglerIds = [userId, ...mutual];

      const rows = (await prisma.catch.findMany({
         where: { createdById: { in: anglerIds }, deletedAt: null },
         select: CATCH_FOR_SCORING,
      })) as RawCatch[];

      const scored = rows.map(score);
      const standings = buildStandings(scored);

      const people = await prisma.user.findMany({
         where: { id: { in: anglerIds } },
         select: {
            id: true,
            displayName: true,
            username: true,
            avatarUrl: true,
         },
      });
      const byId = new Map(people.map((p) => [p.id, p]));

      return {
         /* Everyone on the board, including anglers who have not scored. */
         standings: anglerIds
            .map((id) => {
               const standing =
                  standings.find((s) => s.anglerId === id) ?? null;
               const person = byId.get(id);

               return {
                  anglerId: id,
                  displayName: person?.displayName ?? 'Unknown angler',
                  username: person?.username ?? null,
                  avatarUrl: person?.avatarUrl ?? null,
                  isYou: id === userId,
                  points: standing?.points ?? 0,
                  qualifyingCount: standing?.qualifyingCount ?? 0,
                  longestCm: standing?.longestCm ?? 0,
                  distinctSpecies: standing?.distinctSpecies ?? 0,
               };
            })
            .sort((a, b) => b.points - a.points || b.longestCm - a.longestCm),
         mutualCount: mutual.length,
      };
   },

   /**
    * Per species boards, over everyone or over one angler's rivals.
    *
    * "Who has the best kob" is a different question from "who has the most
    * points", and usually the more interesting one on a shore.
    */
   async speciesBoards(anglerIds?: string[]) {
      const rows = (await prisma.catch.findMany({
         where: {
            deletedAt: null,
            speciesId: { not: null },
            ...(anglerIds ? { createdById: { in: anglerIds } } : {}),
         },
         select: CATCH_FOR_SCORING,
      })) as RawCatch[];

      const names = new Map<string, string>();
      for (const row of rows) {
         if (row.speciesId && row.species) {
            names.set(row.speciesId, row.species.commonName);
         }
      }

      const boards = buildSpeciesBoards(rows.map(score), names);

      /* Attach display names, since a board of ids is no use to a screen. */
      const ids = new Set(
         boards.flatMap((b) => [
            ...b.standings.map((s) => s.anglerId),
            ...(b.longestBy ? [b.longestBy] : []),
         ])
      );
      const people = await prisma.user.findMany({
         where: { id: { in: [...ids] } },
         select: { id: true, displayName: true, username: true },
      });
      const byId = new Map(people.map((p) => [p.id, p]));
      const name = (id: string | null) =>
         id ? (byId.get(id)?.displayName ?? 'Unknown angler') : null;

      return boards.map((board) => ({
         ...board,
         longestByName: name(board.longestBy),
         standings: board.standings.map((s) => ({
            ...s,
            displayName: name(s.anglerId) ?? 'Unknown angler',
            username: byId.get(s.anglerId)?.username ?? null,
         })),
      }));
   },
};
