import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';
import {
   ENTRY_SELECT,
   entriesService,
   type EntryRow,
} from './competition-entries.service';
import { notificationsService } from './notifications.service';

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
   areaType?: 'ANYWHERE' | 'WATERBODY' | 'REGION';
   areaName?: string | null;
   areaLatitude?: number | null;
   areaLongitude?: number | null;
   areaRadiusKm?: number | null;
   checks?: 'CASUAL' | 'REVIEW';
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
   areaType: true,
   areaName: true,
   areaLatitude: true,
   areaLongitude: true,
   areaRadiusKm: true,
   checks: true,
   _count: { select: { entrants: { where: { leftAt: null } } } },
} as const;

type CompetitionRow = Prisma.CompetitionGetPayload<{
   select: typeof COMPETITION_SELECT;
}>;
export type DecoratedCompetition = Omit<CompetitionRow, '_count'> & {
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
            ...row.competition,
            entrantCount: row.competition._count.entrants,
         },
      }));
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
            select: { competitionId: true },
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
      const invited = new Map(invites.map((i) => [i.competitionId, i]));
      const byCompetition = new Map<string, EntryRow[]>();
      for (const e of entries) {
         const list = byCompetition.get(e.competitionId) ?? [];
         list.push(e);
         byCompetition.set(e.competitionId, list);
      }
      return rows.map((row) => {
         const { _count, ...rest } = row;
         const own = byCompetition.get(row.id) ?? [];
         const invite = invited.get(row.id);
         return {
            ...rest,
            entrantCount: _count.entrants,
            entryCount: own.filter((e) => e.state === 'COUNTED').length,
            youEntered: entered.has(row.id),
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
         entries: shaped,
         you: {
            entered: competition.youEntered,
            organise,
            invite: competition.invite,
         },
      };
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
