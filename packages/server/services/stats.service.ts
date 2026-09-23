import { maybeResolveAvatarReadUrl } from './user.service';
import { prisma } from '../lib/prisma';
import { canSeeSite, siteGateSelect, type SiteGate } from '../lib/site-privacy';
import {
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
   /* For a favourite spot, and the gate that says whether it may be named. */
   site: { select: { id: true, name: true, ...siteGateSelect } },
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
   site: ({ id: string; name: string } & SiteGate) | null;
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
   /* What made it the best: its weight, or its length for a species this
      angler has never weighed. */
   by: 'WEIGHT' | 'LENGTH';
   weightKg: number | null;
   /* How the weight was had: on a scale, by eye, or worked out from the
      length. Only a scale weight is a weighed fish. */
   weightSource: 'SCALE' | 'EYE' | 'LENGTH' | null;
   lengthCm: number | null;
   caughtAt: Date;
   catchId: string;
   title: string;
   /* How many of this species the angler has logged. */
   count: number;
};

export const statsService = {
   /**
    * A personal best per species: the heaviest fish, weight first.
    *
    * An angler asks "what is my biggest carp" and means the weight, so a
    * species with any weight on record is judged on weight alone: the
    * heaviest, then the longer of two the same weight, then the earlier. A
    * species that has only ever been measured is judged on length, so a fish
    * nobody weighed still has a best. Weighed species come first, heaviest
    * first, then the measured ones, longest first.
    */
   async personalBests(userId: string): Promise<PersonalBest[]> {
      const rows = await prisma.catch.findMany({
         where: {
            createdById: userId,
            deletedAt: null,
            speciesId: { not: null },
            OR: [{ weight: { not: null } }, { length: { not: null } }],
         },
         select: {
            id: true,
            speciesId: true,
            weight: true,
            weightSource: true,
            length: true,
            caughtAt: true,
            title: true,
            species: { select: { commonName: true } },
         },
      });

      const counts = new Map<string, number>();
      const bySpecies = new Map<string, (typeof rows)[number][]>();
      for (const row of rows) {
         if (!row.speciesId || !row.species) continue;
         counts.set(row.speciesId, (counts.get(row.speciesId) ?? 0) + 1);
         const list = bySpecies.get(row.speciesId) ?? [];
         list.push(row);
         bySpecies.set(row.speciesId, list);
      }

      const positive = (n: number | null): n is number =>
         typeof n === 'number' && Number.isFinite(n) && n > 0;

      const bests: PersonalBest[] = [];
      for (const [speciesId, list] of bySpecies) {
         const weighed = list.filter((row) => positive(row.weight));
         const pool = weighed.length
            ? weighed
            : list.filter((row) => positive(row.length));
         if (!pool.length) continue;
         const by = weighed.length ? 'WEIGHT' : 'LENGTH';
         pool.sort(
            (a, b) =>
               (by === 'WEIGHT' ? (b.weight ?? 0) - (a.weight ?? 0) : 0) ||
               (b.length ?? 0) - (a.length ?? 0) ||
               a.caughtAt.getTime() - b.caughtAt.getTime()
         );
         const top = pool[0]!;
         bests.push({
            speciesId,
            commonName: top.species!.commonName,
            by,
            weightKg: positive(top.weight) ? top.weight : null,
            weightSource: positive(top.weight)
               ? (top.weightSource as PersonalBest['weightSource'])
               : null,
            lengthCm: positive(top.length) ? top.length : null,
            caughtAt: top.caughtAt,
            catchId: top.id,
            title: top.title,
            count: counts.get(speciesId) ?? 1,
         });
      }

      return bests.sort(
         (a, b) =>
            (a.by === b.by ? 0 : a.by === 'WEIGHT' ? -1 : 1) ||
            (b.weightKg ?? 0) - (a.weightKg ?? 0) ||
            (b.lengthCm ?? 0) - (a.lengthCm ?? 0) ||
            a.commonName.localeCompare(b.commonName)
      );
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

      /*
       * The three figures an angler would actually mention. Each is counted over
       * the catches already in hand rather than costing another query, and each
       * is null unless it happened more than once: one catch does not make a
       * favourite species, and calling it one would be flattery rather than a
       * record. Ties go to whichever was seen first, so two identical page loads
       * never disagree.
       */
      const favourite = <T>(
         items: RawCatch[],
         key: (row: RawCatch) => T | null | undefined,
         name: (row: RawCatch) => string
      ) => {
         const counts = new Map<T, { count: number; name: string }>();

         for (const row of items) {
            const k = key(row);
            if (k === null || k === undefined) {
               continue;
            }
            const seen = counts.get(k);
            if (seen) {
               seen.count += 1;
            } else {
               counts.set(k, { count: 1, name: name(row) });
            }
         }

         let best: { count: number; name: string } | null = null;
         for (const entry of counts.values()) {
            if (!best || entry.count > best.count) {
               best = entry;
            }
         }

         return best && best.count > 1 ? best : null;
      };

      const favouriteSpecies = favourite(
         withSpecies,
         (r) => r.speciesId,
         (r) => r.species?.commonName ?? 'Unknown'
      );

      /*
       * Their own log, but not always their own spot: a mark somebody else
       * made, fished while it was public and kept private since, is not
       * named back to them here any more than it is on the catch.
       */
      const favouriteSpot = favourite(
         rows,
         (r) => (canSeeSite(r.site, userId) ? r.site?.id : null),
         (r) => r.site?.name ?? 'Unknown'
      );

      /* The best day counts fish, not trips. */
      const bestDay = favourite(
         rows,
         (r) => r.caughtAt.toISOString().slice(0, 10),
         (r) => r.caughtAt.toISOString().slice(0, 10)
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
         favouriteSpecies: favouriteSpecies
            ? { name: favouriteSpecies.name, count: favouriteSpecies.count }
            : null,
         favouriteSpot: favouriteSpot
            ? { name: favouriteSpot.name, count: favouriteSpot.count }
            : null,
         bestDay: bestDay ? { date: bestDay.name, count: bestDay.count } : null,
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
         standings: (
            await Promise.all(
               anglerIds.map(async (id) => {
                  const standing =
                     standings.find((s) => s.anglerId === id) ?? null;
                  const person = byId.get(id);

                  return {
                     anglerId: id,
                     displayName: person?.displayName ?? 'Unknown angler',
                     username: person?.username ?? null,
                     avatarUrl: await maybeResolveAvatarReadUrl(
                        person?.avatarUrl ?? null
                     ),
                     isYou: id === userId,
                     points: standing?.points ?? 0,
                     qualifyingCount: standing?.qualifyingCount ?? 0,
                     longestCm: standing?.longestCm ?? 0,
                     distinctSpecies: standing?.distinctSpecies ?? 0,
                  };
               })
            )
         ).sort((a, b) => b.points - a.points || b.longestCm - a.longestCm),
         mutualCount: mutual.length,
      };
   },

   /**
    * Per species boards, over everyone or over one angler's rivals.
    *
    * "Who has the best kob" is a different question from "who has the most
    * points", and usually the more interesting one on a shore.
    */
   /**
    * One live board per species: who has the heaviest.
    *
    * Every public catch of the species counts, however it was logged. A
    * weight typed in is taken as it is, whether it came off a scale, by eye
    * or from the length, and a fish logged with only a length is given the
    * weight its length means where the species has published figures, marked
    * as estimated. A species nobody has weighed is still ranked, by length.
    * None of the competition rules (a minimum weight, a legal size, a closed
    * season) keeps a fish off: this is the record of what was caught, and the
    * points are still worked out for the Points order.
    *
    * Private catches stay off, so a fish kept to yourself is not a figure on
    * a public board.
    */
   async speciesBoards(anglerIds?: string[]) {
      const rows = (await prisma.catch.findMany({
         where: {
            deletedAt: null,
            speciesId: { not: null },
            visibility: 'PUBLIC',
            ...(anglerIds ? { createdById: { in: anglerIds } } : {}),
         },
         select: CATCH_FOR_SCORING,
      })) as RawCatch[];

      const positive = (n: number | null | undefined): n is number =>
         typeof n === 'number' && Number.isFinite(n) && n > 0;

      type Row = {
         anglerId: string;
         points: number;
         qualifyingCount: number;
         totalMassKg: number;
         distinctSpecies: number;
         longestCm: number;
         /* The heaviest fish, and whether its weight was estimated. */
         bestMassKg: number | null;
         bestEstimated: boolean;
         bestCatchId: string | null;
         bestAt: number;
      };

      type Board = {
         speciesId: string;
         commonName: string;
         rows: Map<string, Row>;
         unmeasured: number;
      };
      const boards = new Map<string, Board>();

      for (const row of rows) {
         if (!row.speciesId || !row.species) continue;
         const board =
            boards.get(row.speciesId) ??
            ({
               speciesId: row.speciesId,
               commonName: row.species.commonName,
               rows: new Map(),
               unmeasured: 0,
            } as Board);
         boards.set(row.speciesId, board);

         /* The weight: as logged, or what the length means. */
         let massKg: number | null = null;
         let estimated = false;
         if (positive(row.weight)) {
            massKg = row.weight;
            estimated = row.weightSource !== 'SCALE';
         } else if (
            positive(row.length) &&
            row.species.lwA != null &&
            row.species.lwB != null
         ) {
            massKg =
               (row.species.lwA *
                  Math.pow(Math.floor(row.length), row.species.lwB)) /
               1000;
            estimated = true;
         }
         if (massKg == null && !positive(row.length)) board.unmeasured += 1;

         const entry =
            board.rows.get(row.createdById) ??
            ({
               anglerId: row.createdById,
               points: 0,
               qualifyingCount: 0,
               totalMassKg: 0,
               distinctSpecies: 1,
               longestCm: 0,
               bestMassKg: null,
               bestEstimated: false,
               bestCatchId: null,
               bestAt: Number.POSITIVE_INFINITY,
            } as Row);
         board.rows.set(row.createdById, entry);

         entry.qualifyingCount += 1;
         if (massKg != null) {
            entry.totalMassKg =
               Math.round((entry.totalMassKg + massKg) * 1000) / 1000;
         }
         if (positive(row.length) && row.length > entry.longestCm) {
            entry.longestCm = Math.floor(row.length);
         }
         const scored = score(row);
         if (scored.qualifies) {
            entry.points = Math.round((entry.points + scored.points) * 10) / 10;
         }
         /* Heaviest wins; a tie goes to the earlier fish. */
         const at = row.caughtAt.getTime();
         if (
            massKg != null &&
            (entry.bestMassKg == null ||
               massKg > entry.bestMassKg ||
               (massKg === entry.bestMassKg && at < entry.bestAt))
         ) {
            entry.bestMassKg = Math.round(massKg * 1000) / 1000;
            entry.bestEstimated = estimated;
            entry.bestCatchId = row.id;
            entry.bestAt = at;
         }
      }

      const ids = new Set<string>();
      for (const board of boards.values()) {
         for (const id of board.rows.keys()) ids.add(id);
      }
      const people = await prisma.user.findMany({
         where: { id: { in: [...ids] } },
         select: { id: true, displayName: true, username: true },
      });
      const byId = new Map(people.map((p) => [p.id, p]));
      const name = (id: string | null) =>
         id ? (byId.get(id)?.displayName ?? 'Unknown angler') : null;

      const out = [...boards.values()].map((board) => {
         const standings = [...board.rows.values()]
            .sort(
               (a, b) =>
                  (b.bestMassKg ?? -1) - (a.bestMassKg ?? -1) ||
                  b.longestCm - a.longestCm ||
                  a.bestAt - b.bestAt
            )
            .map(({ bestAt: _bestAt, ...row }) => ({
               ...row,
               displayName: name(row.anglerId) ?? 'Unknown angler',
               username: byId.get(row.anglerId)?.username ?? null,
            }));
         const heaviest = standings.find((s) => s.bestMassKg != null) ?? null;
         const longest = [...standings].sort(
            (a, b) => b.longestCm - a.longestCm
         )[0];
         return {
            speciesId: board.speciesId,
            commonName: board.commonName,
            standings,
            heaviestKg: heaviest?.bestMassKg ?? null,
            heaviestEstimated: heaviest?.bestEstimated ?? false,
            heaviestBy: heaviest?.anglerId ?? null,
            heaviestByName: name(heaviest?.anglerId ?? null),
            longestCm: longest?.longestCm ?? 0,
            longestBy: longest?.longestCm ? longest.anglerId : null,
            longestByName: longest?.longestCm ? name(longest.anglerId) : null,
            anglers: standings.length,
            /* Kept for the screen: fish logged with neither a weight nor a
               length, which the board can only count. */
            loggedButUnscored: board.unmeasured,
            unscoredReason: board.unmeasured
               ? 'Logged with no weight or length, so it is counted but not ranked.'
               : null,
         };
      });

      /* The busiest board first, then by name, so the order holds still. */
      return out.sort(
         (a, b) =>
            b.anglers - a.anglers ||
            b.standings.length - a.standings.length ||
            a.commonName.localeCompare(b.commonName)
      );
   },
};
