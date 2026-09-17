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
export type CompetitionScope = 'PUBLIC' | 'GROUP' | 'PRIVATE';
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
   inviteeIds?: string[];
};

/* A week to answer an invitation. */
const INVITE_DAYS = 7;

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

      if (input.scope === 'PRIVATE' && input.inviteeIds?.length) {
         await this.invite(userId, competition.id, input.inviteeIds);
      }

      return competition;
   },

   /**
    * Invite followers to a private competition. Only the organiser may, and
    * only people who follow them: an invitation to a stranger is spam.
    */
   async invite(userId: string, competitionId: string, userIds: string[]) {
      const competition = await prisma.competition.findFirst({
         where: { id: competitionId, deletedAt: null, createdById: userId },
         select: { id: true, scope: true },
      });
      if (!competition || competition.scope !== 'PRIVATE') return null;

      const followers = await prisma.follow.findMany({
         where: { followingId: userId, followerId: { in: userIds } },
         select: { followerId: true },
      });
      const allowed = new Set(followers.map((f) => f.followerId));
      const expiresAt = new Date(Date.now() + INVITE_DAYS * 86400000);

      let sent = 0;
      for (const inviteeId of userIds) {
         if (!allowed.has(inviteeId) || inviteeId === userId) continue;
         await prisma.competitionInvite.upsert({
            where: {
               competitionId_userId: { competitionId, userId: inviteeId },
            },
            update: { state: 'PENDING', expiresAt, answeredAt: null },
            create: {
               competitionId,
               userId: inviteeId,
               invitedById: userId,
               expiresAt,
            },
         });
         sent += 1;
      }
      return { sent };
   },

   /** The invitations waiting on an angler, newest first, unexpired. */
   async invitesFor(userId: string) {
      const rows = await prisma.competitionInvite.findMany({
         where: { userId, state: 'PENDING', expiresAt: { gt: new Date() } },
         orderBy: { createdAt: 'desc' },
         select: {
            id: true,
            expiresAt: true,
            createdAt: true,
            invitedBy: {
               select: { id: true, displayName: true, username: true },
            },
            competition: { select: COMPETITION_SELECT },
         },
      });
      return rows.map((row) => ({
         id: row.id,
         expiresAt: row.expiresAt,
         invitedBy: row.invitedBy,
         competition: {
            ...row.competition,
            entrantCount: row.competition._count.entrants,
         },
      }));
   },

   async answerInvite(userId: string, inviteId: string, accept: boolean) {
      const invite = await prisma.competitionInvite.findFirst({
         where: { id: inviteId, userId, state: 'PENDING' },
         select: { id: true, competitionId: true, expiresAt: true },
      });
      if (!invite) return null;
      if (invite.expiresAt < new Date()) {
         return { state: 'EXPIRED' as const };
      }
      await prisma.competitionInvite.update({
         where: { id: invite.id },
         data: {
            state: accept ? 'ACCEPTED' : 'DECLINED',
            answeredAt: new Date(),
         },
      });
      if (accept) {
         await prisma.competitionEntrant.upsert({
            where: {
               competitionId_userId: {
                  competitionId: invite.competitionId,
                  userId,
               },
            },
            update: { leftAt: null },
            create: { competitionId: invite.competitionId, userId },
         });
      }
      return { state: accept ? ('ACCEPTED' as const) : ('DECLINED' as const) };
   },

   /** The people who follow an angler, for the invitation list. */
   async followersOf(userId: string) {
      const rows = await prisma.follow.findMany({
         where: { followingId: userId },
         orderBy: { createdAt: 'desc' },
         take: 200,
         select: {
            follower: {
               select: {
                  id: true,
                  displayName: true,
                  username: true,
                  avatarUrl: true,
               },
            },
         },
      });
      return rows.map((r) => r.follower);
   },

   /**
    * The list an angler can act on: everything public, plus anything they have
    * already entered. A group competition they are not in is somebody else's.
    */
   async list(userId: string, page = 1, size = 20) {
      /*
       * Everything public, plus anything this angler is in or has been
       * invited to. A private competition is invisible to everyone else,
       * which is the whole point of it being private. Running ones first,
       * then upcoming, then finished, newest at the top within each.
       */
      const where = {
         deletedAt: null as null,
         state: { not: 'DRAFT' as const },
         OR: [
            { scope: 'PUBLIC' as const },
            { entrants: { some: { userId, leftAt: null } } },
            { invites: { some: { userId, state: 'PENDING' as const } } },
         ],
      };
      const total = await prisma.competition.count({ where });
      const rows = await prisma.competition.findMany({
         where,
         orderBy: [{ endsAt: 'desc' }],
         skip: (page - 1) * size,
         take: size,
         select: COMPETITION_SELECT,
      });

      const mine = await prisma.competitionEntrant.findMany({
         where: { userId, leftAt: null },
         select: { competitionId: true },
      });
      const entered = new Set(mine.map((m) => m.competitionId));

      const now = new Date();
      const items = rows.map((row) => ({
         ...row,
         entrantCount: row._count.entrants,
         youEntered: entered.has(row.id),
         youOrganise: row.createdById === userId,
         /* Worked out rather than stored, so it is never stale. */
         status:
            now < row.startsAt
               ? ('upcoming' as const)
               : now > row.endsAt
                 ? ('finished' as const)
                 : ('running' as const),
      }));
      const order = { running: 0, upcoming: 1, finished: 2 };
      items.sort((a, b) => order[a.status] - order[b.status]);
      return { items, total, page, size };
   },

   async join(userId: string, competitionId: string) {
      const competition = await prisma.competition.findFirst({
         where: { id: competitionId, deletedAt: null },
         select: { id: true, scope: true, groupId: true },
      });

      if (!competition) {
         return null;
      }

      /* A private competition is entered by answering the invitation. */
      if (competition.scope === 'PRIVATE') {
         const invite = await prisma.competitionInvite.findFirst({
            where: { competitionId, userId, state: 'ACCEPTED' },
            select: { id: true },
         });
         const organiser = await prisma.competition.findFirst({
            where: { id: competitionId, createdById: userId },
            select: { id: true },
         });
         if (!invite && !organiser) return null;
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
   async standings(competitionId: string, viewerId: string | null = null) {
      const competition = await prisma.competition.findFirst({
         where: { id: competitionId, deletedAt: null },
         select: COMPETITION_SELECT,
      });

      if (!competition) {
         return null;
      }

      /* Private: the standings are for the people in it. */
      if (competition.scope === 'PRIVATE') {
         const inIt =
            viewerId !== null &&
            (competition.createdById === viewerId ||
               (await prisma.competitionEntrant.findFirst({
                  where: { competitionId, userId: viewerId, leftAt: null },
                  select: { id: true },
               })) !== null);
         if (!inIt) return null;
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
