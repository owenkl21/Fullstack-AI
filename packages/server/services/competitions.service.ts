import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';
import {
   ENTRY_SELECT,
   SPECIES_ALLOWED_SELECT,
   allowedSpeciesOf,
   entriesService,
   type AllowedSpecies,
   type EntryRow,
} from './competition-entries.service';
import { notificationsService } from './notifications.service';
import {
   TeamError,
   teamsService,
   type TeamStanding,
} from './competition-teams.service';

/*
 * Competitions anglers run themselves.
 *
 * The Competition table existed but nothing ever read or wrote it, so there was
 * no way to start one. This gives an angler the four decisions that actually
 * make a competition: when it runs, which fish it is for, what a fish
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
   /* The fish it is for. Empty, or left out, is any species. */
   speciesIds?: string[];
   /* The older single field; folded into the list. */
   speciesId?: string | null;
   groupId?: string | null;
   startsAt: Date;
   endsAt: Date;
   maxPerSpeciesPerDay?: number;
   inviteeIds?: string[];
   areaType?: 'ANYWHERE' | 'WATERBODY' | 'REGION';
   areaName?: string | null;
   areaLatitude?: number | null;
   areaLongitude?: number | null;
   areaRadiusKm?: number | null;
   checks?: 'CASUAL' | 'REVIEW';
   teamsEnabled?: boolean;
   teamCount?: number | null;
   teamNames?: string[];
   maxPerTeam?: number | null;
};

/* A week to answer an invitation. */
const INVITE_DAYS = 7;

/** A species id on the form that is not a species. The controller says so. */
export class UnknownSpeciesError extends Error {
   constructor() {
      super('One of those species could not be found.');
      this.name = 'UnknownSpeciesError';
   }
}

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
   ...SPECIES_ALLOWED_SELECT,
   createdBy: { select: { id: true, displayName: true, username: true } },
   areaType: true,
   areaName: true,
   areaLatitude: true,
   areaLongitude: true,
   areaRadiusKm: true,
   checks: true,
   teamsEnabled: true,
   maxPerTeam: true,
   _count: { select: { entrants: { where: { leftAt: null } } } },
} as const;

type CompetitionRow = Prisma.CompetitionGetPayload<{
   select: typeof COMPETITION_SELECT;
}>;

/*
 * The row as a client reads it: `species` is the list of fish it is for,
 * whichever of the two columns they were kept in, and empty means any species.
 */
const withSpecies = <T extends Parameters<typeof allowedSpeciesOf>[0]>(
   row: T
): Omit<T, 'species' | 'speciesAllowed'> & { species: AllowedSpecies[] } => {
   const { species, speciesAllowed, ...rest } = row;
   return { ...rest, species: allowedSpeciesOf({ species, speciesAllowed }) };
};

export type DecoratedCompetition = Omit<
   CompetitionRow,
   '_count' | 'species' | 'speciesAllowed'
> & {
   /* Every fish it is for. Empty means any species. */
   species: AllowedSpecies[];
   entrantCount: number;
   entryCount: number;
   youEntered: boolean;
   youOrganise: boolean;
   leading: {
      displayName: string;
      value: number;
      speciesName: string | null;
   } | null;
   invite: { id: string; expiresAt: Date } | null;
   status: 'upcoming' | 'running' | 'finished';
   /* The side this angler is on, in a competition with teams. */
   yourTeamId: string | null;
};

/*
 * The sides a new competition starts with, in order. A side left without a
 * name is named for where it stands, so Sharks and two blanks are Sharks,
 * Team 2 and Team 3, and a blank between two names is the team in that place.
 * A generated name never takes one the organiser gave another side.
 */
const teamNamesFor = (input: CreateCompetitionInput) => {
   const given = input.teamNames ?? [];
   const count = Math.min(Math.max(given.length, input.teamCount ?? 0, 2), 8);
   const own = given.slice(0, count).filter(Boolean);
   const names: string[] = [];
   const taken = (name: string) =>
      [...own, ...names].some((n) => n.toLowerCase() === name.toLowerCase());
   for (let i = 0; i < count; i += 1) {
      const name = given[i];
      if (name) {
         names.push(name);
         continue;
      }
      let n = i + 1;
      while (taken(`Team ${n}`)) n += 1;
      names.push(`Team ${n}`);
   }
   return names;
};

export const competitionsService = {
   async create(userId: string, input: CreateCompetitionInput) {
      if (input.endsAt <= input.startsAt) {
         throw new Error('A competition has to end after it starts.');
      }

      /* One list from the two fields, each fish once, and only real fish. */
      const speciesIds = [
         ...new Set([
            ...(input.speciesIds ?? []),
            ...(input.speciesId ? [input.speciesId] : []),
         ]),
      ];
      if (speciesIds.length) {
         const known = await prisma.species.count({
            where: { id: { in: speciesIds } },
         });
         if (known !== speciesIds.length) throw new UnknownSpeciesError();
      }

      const competition = await prisma.competition.create({
         data: {
            name: input.name,
            blurb: input.blurb ?? null,
            rule: input.rule,
            measure: input.measure,
            scope: input.scope,
            /* The older column stays true for a competition with one fish, so
             * anything still reading it sees what it always saw. */
            speciesId: speciesIds.length === 1 ? speciesIds[0]! : null,
            speciesAllowed: {
               create: speciesIds.map((speciesId) => ({ speciesId })),
            },
            groupId: input.scope === 'GROUP' ? (input.groupId ?? null) : null,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            createdById: userId,
            /* Started by a person rather than drafted by the system. */
            state: 'OPEN',
            maxPerSpeciesPerDay: input.maxPerSpeciesPerDay ?? 3,
            areaType: input.areaType ?? 'ANYWHERE',
            areaName:
               input.areaType === 'ANYWHERE' ? null : (input.areaName ?? null),
            areaLatitude:
               input.areaType === 'WATERBODY'
                  ? (input.areaLatitude ?? null)
                  : null,
            areaLongitude:
               input.areaType === 'WATERBODY'
                  ? (input.areaLongitude ?? null)
                  : null,
            areaRadiusKm:
               input.areaType === 'WATERBODY'
                  ? (input.areaRadiusKm ?? 25)
                  : null,
            checks: input.checks ?? 'CASUAL',
            teamsEnabled: Boolean(input.teamsEnabled),
            maxPerTeam: input.teamsEnabled ? (input.maxPerTeam ?? null) : null,
            /*
             * The sides, in the order given. Names the organiser typed come
             * first; any more from teamCount are Team 3, Team 4 and on.
             */
            ...(input.teamsEnabled
               ? {
                    teams: {
                       create: teamNamesFor(input).map((name, position) => ({
                          name,
                          position,
                       })),
                    },
                 }
               : {}),
            /* Whoever starts it is in it. With teams, they pick a side like
               everybody else, so the organiser is in it without one. */
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
         select: { id: true, scope: true, name: true },
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
         await notificationsService.notify({
            userId: inviteeId,
            actorId: userId,
            kind: 'INVITE',
            competitionId,
            body: competition.name,
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
            ...withSpecies(row.competition),
            entrantCount: row.competition._count.entrants,
         },
      }));
   },

   /**
    * Take a competition away, for its organiser or the Fisherfeed team.
    *
    * Marked deleted rather than erased, the way a post is: every read of a
    * competition already passes over a deleted one, so its page, its board,
    * its entries and its teams are gone from the app at once, and a mistake
    * can still be put right from the database. What would otherwise still
    * point at it goes too: invitations nobody answered stop being offered,
    * and the lines in anybody's inbox about it are cleared. The catches
    * entered in it stay in each angler's own log: they are their fish.
    */
   async remove(userId: string, competitionId: string) {
      const competition = await prisma.competition.findFirst({
         where: { id: competitionId, deletedAt: null },
         select: { id: true, createdById: true },
      });
      if (!competition) return { error: 'not_found' as const };
      if (competition.createdById !== userId) {
         const actor = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
         });
         if (actor?.role !== 'ADMIN')
            return { error: 'not_organiser' as const };
      }
      const now = new Date();
      await prisma.$transaction([
         prisma.competition.update({
            where: { id: competitionId },
            data: { deletedAt: now },
         }),
         prisma.competitionInvite.updateMany({
            where: { competitionId, state: 'PENDING' },
            data: { expiresAt: now },
         }),
         prisma.notification.deleteMany({ where: { competitionId } }),
      ]);
      return { removed: true as const };
   },

   async answerInvite(userId: string, inviteId: string, accept: boolean) {
      const invite = await prisma.competitionInvite.findFirst({
         where: { id: inviteId, userId, state: 'PENDING' },
         select: {
            id: true,
            competitionId: true,
            expiresAt: true,
            invitedById: true,
            competition: { select: { name: true } },
         },
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
      await notificationsService.notify({
         userId: invite.invitedById,
         actorId: userId,
         kind: 'INVITE_ANSWER',
         competitionId: invite.competitionId,
         body: `${accept ? 'accepted' : 'declined'}|${invite.competition?.name ?? ''}`,
      });
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
   /**
    * A competition as the client sees it: the row, plus what it means to
    * this angler and the catch to beat. Shared by list, create and detail so
    * every payload is the same shape.
    */
   async decorate(
      userId: string,
      rows: CompetitionRow[]
   ): Promise<DecoratedCompetition[]> {
      if (!rows.length) return [];
      const ids = rows.map((r) => r.id);
      const now = new Date();
      const [mine, invites, entries] = await Promise.all([
         prisma.competitionEntrant.findMany({
            where: { userId, leftAt: null, competitionId: { in: ids } },
            select: { competitionId: true, teamId: true },
         }),
         prisma.competitionInvite.findMany({
            where: {
               userId,
               state: 'PENDING',
               expiresAt: { gt: now },
               competitionId: { in: ids },
            },
            select: { id: true, competitionId: true, expiresAt: true },
         }),
         prisma.competitionEntry.findMany({
            where: { competitionId: { in: ids }, state: { not: 'EXCLUDED' } },
            select: ENTRY_SELECT,
         }),
      ]);
      const entered = new Set(mine.map((m) => m.competitionId));
      const sides = new Map(mine.map((m) => [m.competitionId, m.teamId]));
      const invited = new Map(invites.map((i) => [i.competitionId, i]));
      const byCompetition = new Map<string, EntryRow[]>();
      for (const e of entries) {
         const list = byCompetition.get(e.competitionId) ?? [];
         list.push(e);
         byCompetition.set(e.competitionId, list);
      }
      return rows.map((row) => {
         const { _count, ...rest } = withSpecies(row);
         const own = byCompetition.get(row.id) ?? [];
         const invite = invited.get(row.id);
         return {
            ...rest,
            entrantCount: _count.entrants,
            entryCount: own.filter((e) => e.state === 'COUNTED').length,
            youEntered: entered.has(row.id),
            yourTeamId: sides.get(row.id) ?? null,
            youOrganise: row.createdById === userId,
            leading: entriesService.leading(row, own),
            invite: invite
               ? { id: invite.id, expiresAt: invite.expiresAt }
               : null,
            /* Worked out rather than stored, so it is never stale. */
            status:
               now < row.startsAt
                  ? ('upcoming' as const)
                  : now > row.endsAt
                    ? ('finished' as const)
                    : ('running' as const),
         };
      });
   },

   async list(
      userId: string,
      page = 1,
      size = 20,
      tab: 'all' | 'mine' | 'invites' = 'all'
   ) {
      /*
       * Everything public, plus anything this angler is in or has been
       * invited to. A private competition is invisible to everyone else,
       * which is the whole point of it being private. Running ones first,
       * then upcoming, then finished, newest at the top within each.
       */
      const now = new Date();
      const where = {
         deletedAt: null as null,
         state: { not: 'DRAFT' as const },
         ...(tab === 'mine'
            ? {
                 OR: [
                    { createdById: userId },
                    { entrants: { some: { userId, leftAt: null } } },
                 ],
              }
            : tab === 'invites'
              ? {
                   invites: {
                      some: {
                         userId,
                         state: 'PENDING' as const,
                         expiresAt: { gt: now },
                      },
                   },
                }
              : {
                   OR: [
                      { scope: 'PUBLIC' as const },
                      { entrants: { some: { userId, leftAt: null } } },
                      {
                         invites: {
                            some: { userId, state: 'PENDING' as const },
                         },
                      },
                   ],
                }),
      };
      const total = await prisma.competition.count({ where });
      const rows = await prisma.competition.findMany({
         where,
         orderBy: [{ endsAt: 'desc' }],
         skip: (page - 1) * size,
         take: size,
         select: COMPETITION_SELECT,
      });
      const items = await this.decorate(userId, rows);
      const order = { running: 0, upcoming: 1, finished: 2 };
      items.sort((a, b) => order[a.status] - order[b.status]);
      return { items, total, page, size };
   },

   /** One competition with its board and its entries, as this angler may see it. */
   async detail(competitionId: string, viewerId: string) {
      const row = await prisma.competition.findFirst({
         where: { id: competitionId, deletedAt: null },
         select: COMPETITION_SELECT,
      });
      if (!row) return null;
      const [competition] = await this.decorate(viewerId, [row]);
      if (!competition) return null;
      const organise = row.createdById === viewerId;
      const entrant = competition.youEntered || organise;
      if (row.scope === 'PRIVATE' && !entrant && !competition.invite)
         return null;
      if (row.scope === 'GROUP' && row.groupId && !entrant) {
         const member = await prisma.groupMember.findFirst({
            where: { groupId: row.groupId, userId: viewerId, leftAt: null },
            select: { id: true },
         });
         if (!member) return null;
      }
      const entries = await entriesService.listFor(competitionId);
      const standings = entriesService.standings(row, entries);

      /* With teams: who is on which side, and the board for the sides. */
      let teams: Awaited<ReturnType<typeof teamsService.roster>> | null = null;
      let teamStandings: TeamStanding[] | null = null;
      if (row.teamsEnabled) {
         teams = await teamsService.roster(competitionId);
         const entrants = teams.teams.flatMap((team) =>
            team.members.map((member) => ({
               userId: member.id,
               teamId: team.id,
            }))
         );
         teamStandings = teamsService.standings(
            row.rule as CompetitionRule,
            teams.teams,
            entrants,
            standings,
            entries.filter((e) => e.state === 'COUNTED')
         );
      }
      const shaped = await Promise.all(
         entries.map((e) =>
            entriesService.shape(e, {
               id: viewerId,
               organiser: organise,
               entrant,
            })
         )
      );
      return {
         competition,
         standings,
         teams,
         teamStandings,
         entries: shaped,
         you: {
            entered: competition.youEntered,
            organise,
            invite: competition.invite,
         },
      };
   },

   async join(userId: string, competitionId: string, teamId?: string | null) {
      const competition = await prisma.competition.findFirst({
         where: { id: competitionId, deletedAt: null },
         select: { id: true, scope: true, groupId: true, teamsEnabled: true },
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

      /*
       * With teams, joining is joining a side, and the same call changes
       * side before the start. The checks (which side, room on it, not after
       * the start) are the teams service's, so they are the same for an
       * angler choosing and an organiser moving somebody.
       */
      if (competition.teamsEnabled) {
         if (!teamId) throw new TeamError('pick_team', 'Pick a team to join.');
         await teamsService.place(competitionId, userId, teamId);
         return { joined: true, teamId };
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
      /* Kept for the old route; the board is the detail's board now. */
      if (!viewerId) return null;
      const detail = await this.detail(competitionId, viewerId);
      if (!detail) return null;
      return {
         competition: detail.competition,
         standings: detail.standings.map((s) => ({
            anglerId: s.anglerId,
            displayName: s.displayName,
            username: s.username,
            total: s.score,
            best: s.bestValue ?? 0,
            entries: s.entries,
            distinctSpecies: s.distinctSpecies,
         })),
      };
   },
};
