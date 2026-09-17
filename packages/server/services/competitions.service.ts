import { prisma } from '../lib/prisma';
import { massKgFor, type ScoringSpecies } from './scoring';

/*
 * Competitions anglers run themselves.
 *
 * The Competition table existed but nothing ever read or wrote it, so there was
 * no way to start one. This gives an angler the four decisions that actually
 * make a competition: when it runs, whether it is for one species, what a fish
 * is judged on, and who can enter.
 *
 * Standings are worked out from the catches themselves every time, never stored.
 * A board that is derived cannot disagree with the records it describes, which
 * is the same choice the species boards already make. It also means editing a
 * catch corrects the standings rather than leaving a stale score behind.
 *
 * Figures come back in metric. The unit an angler reads in is theirs, not the
 * competition's, so the conversion belongs on the screen and a shared
 * competition shows the same fish to everyone who opens it.
 */

export type CompetitionMeasure = 'LENGTH' | 'WEIGHT';
export type CompetitionScope = 'PUBLIC' | 'GROUP';
export type CompetitionRule =
   | 'SPECIES_POINTS'
   | 'BIGGEST_FISH'
   | 'SPECIES_VARIETY';

export type CreateCompetitionInput = {
   name: string;
   blurb?: string | null;
   rule: CompetitionRule;
   measure: CompetitionMeasure;
   scope: CompetitionScope;
   speciesId?: string | null;
   groupId?: string | null;
   startsAt: Date;
   endsAt: Date;
   maxPerSpeciesPerDay?: number;
};

const COMPETITION_SELECT = {
   id: true,
   name: true,
   blurb: true,
   rule: true,
   measure: true,
   scope: true,
   state: true,
   startsAt: true,
   endsAt: true,
   timeZoneId: true,
   maxPerSpeciesPerDay: true,
   createdById: true,
   groupId: true,
   speciesId: true,
   species: { select: { id: true, commonName: true } },
   createdBy: { select: { id: true, displayName: true, username: true } },
   _count: { select: { entrants: true } },
} as const;

type CatchRow = {
   id: string;
   createdById: string;
   speciesId: string | null;
   length: number | null;
   weight: number | null;
   weightSource: 'LENGTH' | 'SCALE';
   caughtAt: Date;
   title: string;
   species: {
      commonName: string;
      lwA: number | null;
      lwB: number | null;
   } | null;
};

export type CompetitionStanding = {
   anglerId: string;
   displayName: string;
   username: string | null;
   /* Metric always: centimetres, and kilograms. */
   total: number;
   best: number;
   entries: number;
   distinctSpecies: number;
};

/**
 * What one fish is worth in this competition.
 *
 * Null means it cannot be counted, and the reason matters: a competition judged
 * on weight cannot score a fish with no length and no scale reading, and one
 * judged on length cannot score a fish nobody measured. Those catches are left
 * out rather than counted as nought.
 */
const valueOf = (row: CatchRow, measure: CompetitionMeasure): number | null => {
   if (measure === 'LENGTH') {
      return row.length ?? null;
   }

   if (row.weight !== null) {
      return row.weight;
   }

   /*
    * No scale reading, so fall back to the published length-weight figures,
    * the same conversion the species boards use. A species without published
    * figures cannot be converted, and that fish stays out of the standings
    * rather than being guessed at.
    */
   if (!row.species) {
      return null;
   }

   const species: ScoringSpecies = {
      commonName: row.species.commonName,
      lwA: row.species.lwA,
      lwB: row.species.lwB,
      /* Neither matters here: this competition is not scoring by size class. */
      sizeClass: 'EDIBLE',
      minLegalCm: null,
      closedFrom: null,
      closedTo: null,
   };

   const mass = massKgFor(
      {
         lengthCm: row.length,
         weightKg: row.weight,
         weightSource: row.weightSource,
         released: true,
         caughtAt: row.caughtAt,
      },
      species
   );

   return mass?.massKg ?? null;
};

export const competitionsService = {
   async create(userId: string, input: CreateCompetitionInput) {
      if (input.endsAt <= input.startsAt) {
         throw new Error('A competition has to end after it starts.');
      }

      const competition = await prisma.competition.create({
         data: {
            name: input.name,
            blurb: input.blurb ?? null,
            rule: input.rule,
            measure: input.measure,
            scope: input.scope,
            speciesId: input.speciesId ?? null,
            groupId: input.scope === 'GROUP' ? (input.groupId ?? null) : null,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            createdById: userId,
            /* Started by a person rather than drafted by the system. */
            state: 'OPEN',
            maxPerSpeciesPerDay: input.maxPerSpeciesPerDay ?? 3,
            /* Whoever starts it is in it. */
            entrants: { create: { userId } },
         },
         select: COMPETITION_SELECT,
      });

      return competition;
   },

   /**
    * The list an angler can act on: everything public, plus anything they have
    * already entered. A group competition they are not in is somebody else's.
    */
   async list(userId: string) {
      const rows = await prisma.competition.findMany({
         where: {
            deletedAt: null,
            state: { not: 'DRAFT' },
            OR: [
               { scope: 'PUBLIC' },
               { entrants: { some: { userId, leftAt: null } } },
            ],
         },
         orderBy: [{ endsAt: 'desc' }],
         take: 50,
         select: COMPETITION_SELECT,
      });

      const mine = await prisma.competitionEntrant.findMany({
         where: { userId, leftAt: null },
         select: { competitionId: true },
      });
      const entered = new Set(mine.map((m) => m.competitionId));

      const now = new Date();
      return rows.map((row) => ({
         ...row,
         entrantCount: row._count.entrants,
         youEntered: entered.has(row.id),
         /* Worked out rather than stored, so it is never stale. */
         status:
            now < row.startsAt
               ? ('upcoming' as const)
               : now > row.endsAt
                 ? ('finished' as const)
                 : ('running' as const),
      }));
   },

   async join(userId: string, competitionId: string) {
      const competition = await prisma.competition.findFirst({
         where: { id: competitionId, deletedAt: null },
         select: { id: true, scope: true, groupId: true },
      });

      if (!competition) {
         return null;
      }

      /* A group competition is for that group. Anyone else is not invited. */
      if (competition.scope === 'GROUP' && competition.groupId) {
         const member = await prisma.groupMember.findFirst({
            where: {
               groupId: competition.groupId,
               userId,
               leftAt: null,
            },
            select: { id: true },
         });
         if (!member) {
            return null;
         }
      }

      await prisma.competitionEntrant.upsert({
         where: { competitionId_userId: { competitionId, userId } },
         update: { leftAt: null },
         create: { competitionId, userId },
      });

      return { joined: true };
   },

   async leave(userId: string, competitionId: string) {
      await prisma.competitionEntrant.updateMany({
         where: { competitionId, userId, leftAt: null },
         data: { leftAt: new Date() },
      });
      return { left: true };
   },

   /**
    * The standings, counted from the catches that fall inside the competition.
    *
    * Only entrants are counted: fishing during the window is not the same as
    * entering, and counting people who never entered would put strangers on a
    * board they did not ask to be on.
    */
   async standings(competitionId: string) {
      const competition = await prisma.competition.findFirst({
         where: { id: competitionId, deletedAt: null },
         select: COMPETITION_SELECT,
      });

      if (!competition) {
         return null;
      }

      const entrants = await prisma.competitionEntrant.findMany({
         where: { competitionId, leftAt: null },
         select: {
            userId: true,
            user: { select: { displayName: true, username: true } },
         },
      });

      if (!entrants.length) {
         return { competition, standings: [] as CompetitionStanding[] };
      }

      const rows = (await prisma.catch.findMany({
         where: {
            deletedAt: null,
            createdById: { in: entrants.map((e) => e.userId) },
            caughtAt: { gte: competition.startsAt, lte: competition.endsAt },
            ...(competition.speciesId
               ? { speciesId: competition.speciesId }
               : {}),
         },
         select: {
            id: true,
            createdById: true,
            speciesId: true,
            length: true,
            weight: true,
            weightSource: true,
            caughtAt: true,
            title: true,
            species: { select: { commonName: true, lwA: true, lwB: true } },
         },
      })) as CatchRow[];

      const measure = competition.measure as CompetitionMeasure;

      /*
       * The daily cap, applied per angler per species per day, which is what
       * stops a competition being won by whoever had the most time rather than
       * the best fish. The largest of the day's fish are the ones kept.
       */
      const perDay = new Map<string, { value: number; row: CatchRow }[]>();
      for (const row of rows) {
         const value = valueOf(row, measure);
         if (value === null || value <= 0) {
            continue;
         }
         const day = row.caughtAt.toISOString().slice(0, 10);
         const key = `${row.createdById}|${row.speciesId ?? 'none'}|${day}`;
         const list = perDay.get(key) ?? [];
         list.push({ value, row });
         perDay.set(key, list);
      }

      const counted: { anglerId: string; value: number; speciesId: string }[] =
         [];
      for (const list of perDay.values()) {
         list.sort((a, b) => b.value - a.value);
         for (const entry of list.slice(0, competition.maxPerSpeciesPerDay)) {
            counted.push({
               anglerId: entry.row.createdById,
               value: entry.value,
               speciesId: entry.row.speciesId ?? 'none',
            });
         }
      }

      const byAngler = new Map<string, CompetitionStanding>();
      for (const entrant of entrants) {
         byAngler.set(entrant.userId, {
            anglerId: entrant.userId,
            displayName: entrant.user.displayName,
            username: entrant.user.username,
            total: 0,
            best: 0,
            entries: 0,
            distinctSpecies: 0,
         });
      }

      const speciesSeen = new Map<string, Set<string>>();
      for (const entry of counted) {
         const standing = byAngler.get(entry.anglerId);
         if (!standing) continue;
         standing.total += entry.value;
         standing.best = Math.max(standing.best, entry.value);
         standing.entries += 1;
         const seen = speciesSeen.get(entry.anglerId) ?? new Set<string>();
         seen.add(entry.speciesId);
         speciesSeen.set(entry.anglerId, seen);
      }

      for (const [anglerId, seen] of speciesSeen) {
         const standing = byAngler.get(anglerId);
         if (standing) standing.distinctSpecies = seen.size;
      }

      /* The rule decides what "ahead" means. */
      const rank = (s: CompetitionStanding) =>
         competition.rule === 'BIGGEST_FISH'
            ? s.best
            : competition.rule === 'SPECIES_VARIETY'
              ? s.distinctSpecies
              : s.total;

      const standings = [...byAngler.values()].sort(
         (a, b) => rank(b) - rank(a) || b.best - a.best
      );

      return { competition, standings };
   },
};
