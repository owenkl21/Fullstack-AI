import { prisma } from '../lib/prisma';
import type { EntryRow, Standing } from './competition-entries.service';

/*
 * Teams in a competition.
 *
 * The organiser switches teams on when they start it and says how many, and
 * each angler picks a side when they join. The sides are settled at the start:
 * until then anyone can change their mind and the organiser can move people
 * about, add a side or take away an empty one; from the start a side is a
 * side, because a switch after the first fish is in is a switch to whoever is
 * winning.
 *
 * The team board is added up by the competition's own rule, so it asks the
 * question the individual board asks, of a side instead of a person:
 *
 *   points        the members' scores added together
 *   biggest fish  the biggest single fish anyone on the side caught
 *   most species  the different species the side caught between them, so two
 *                 members with a kob each count one kob, not two
 */

export class TeamError extends Error {
   constructor(
      public code:
         | 'pick_team'
         | 'no_such_team'
         | 'team_full'
         | 'teams_locked'
         | 'not_organiser'
         | 'too_many_teams'
         | 'too_few_teams'
         | 'team_not_empty'
         | 'not_entrant'
         | 'teams_off'
         | 'name_taken',
      message: string
   ) {
      super(message);
      this.name = 'TeamError';
   }
}

export const TEAM_WORDS = {
   pick_team: 'Pick a team to join.',
   no_such_team: 'That team is not in this competition.',
   team_full: 'That team is full. Pick another one.',
   teams_locked: 'Teams are settled once the competition starts.',
   not_organiser: 'Only the organiser can change the teams.',
   too_many_teams: 'A competition can have eight teams at most.',
   too_few_teams: 'A competition with teams needs at least two.',
   team_not_empty: 'Move everyone off a team before taking it away.',
   not_entrant: 'That angler is not in this competition.',
   teams_off: 'This competition has no teams.',
   name_taken: 'Another team already has that name.',
} as const;

const fail = (code: keyof typeof TEAM_WORDS) =>
   new TeamError(code, TEAM_WORDS[code]);

const MAX_TEAMS = 8;
const MIN_TEAMS = 2;

export type TeamStanding = {
   teamId: string;
   name: string;
   place: number;
   joint: boolean;
   score: number;
   members: number;
   /* How many on the side have a fish on the board. */
   scoring: number;
   best: {
      value: number;
      displayName: string;
      speciesName: string | null;
   } | null;
   distinctSpecies: number;
};

type TeamRow = { id: string; name: string; position: number };

export const teamsService = {
   /** The sides, in order, each with who is on it. */
   async roster(competitionId: string) {
      const [teams, entrants] = await Promise.all([
         prisma.competitionTeam.findMany({
            where: { competitionId },
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, name: true, position: true },
         }),
         prisma.competitionEntrant.findMany({
            where: { competitionId, leftAt: null },
            orderBy: { joinedAt: 'asc' },
            select: {
               userId: true,
               teamId: true,
               user: {
                  select: {
                     id: true,
                     displayName: true,
                     username: true,
                     verified: true,
                  },
               },
            },
         }),
      ]);
      return {
         teams: teams.map((team) => ({
            ...team,
            members: entrants
               .filter((entrant) => entrant.teamId === team.id)
               .map((entrant) => entrant.user),
         })),
         /* In the competition without a side: somebody who joined before the
            organiser added teams, or whose side was taken away. */
         unassigned: entrants
            .filter((entrant) => !entrant.teamId)
            .map((entrant) => entrant.user),
      };
   },

   /** The team board, from the individual board and the entries under it. */
   standings(
      rule: 'SPECIES_POINTS' | 'BIGGEST_FISH' | 'SPECIES_VARIETY',
      teams: TeamRow[],
      entrants: { userId: string; teamId: string | null }[],
      individual: Standing[],
      counted: EntryRow[]
   ): TeamStanding[] {
      const sideOf = new Map(entrants.map((e) => [e.userId, e.teamId]));
      const byAngler = new Map(individual.map((s) => [s.anglerId, s]));

      const rows = teams.map((team) => {
         const memberIds = entrants
            .filter((e) => e.teamId === team.id)
            .map((e) => e.userId);
         const entries = counted.filter(
            (e) => sideOf.get(e.userId) === team.id
         );
         const species = new Set(
            entries.map((e) => e.speciesId ?? e.speciesName ?? 'unnamed')
         );
         const best = entries
            .filter((e) => typeof e.value === 'number')
            .reduce<EntryRow | null>(
               (b, e) =>
                  b === null || (e.value ?? 0) > (b.value ?? 0) ? e : b,
               null
            );
         const scoring = memberIds.filter((id) => byAngler.has(id)).length;

         let score: number;
         if (rule === 'SPECIES_VARIETY') score = species.size;
         else if (rule === 'BIGGEST_FISH') score = best?.value ?? 0;
         else
            score = memberIds.reduce(
               (sum, id) => sum + (byAngler.get(id)?.score ?? 0),
               0
            );

         return {
            teamId: team.id,
            name: team.name,
            score: Math.round(score * 1000) / 1000,
            members: memberIds.length,
            scoring,
            best: best
               ? {
                    value: best.value ?? 0,
                    displayName: best.user.displayName,
                    speciesName: best.speciesName ?? null,
                 }
               : null,
            distinctSpecies: species.size,
            position: team.position,
         };
      });

      rows.sort(
         (a, b) =>
            b.score - a.score ||
            (b.best?.value ?? 0) - (a.best?.value ?? 0) ||
            a.position - b.position
      );

      const out: TeamStanding[] = [];
      rows.forEach((row, i) => {
         const prev = out[i - 1];
         const place = prev && prev.score === row.score ? prev.place : i + 1;
         const { position: _position, ...rest } = row;
         out.push({ ...rest, place, joint: false });
      });
      for (const s of out) {
         s.joint = out.filter((o) => o.place === s.place).length > 1;
      }
      return out;
   },

   /**
    * Put an angler on a side, checking everything a side has to be. Used when
    * they join, when they change their mind, and when the organiser moves them.
    */
   async place(
      competitionId: string,
      userId: string,
      teamId: string,
      options: { byOrganiser?: boolean } = {}
   ) {
      const competition = await prisma.competition.findFirst({
         where: { id: competitionId, deletedAt: null },
         select: { teamsEnabled: true, maxPerTeam: true, startsAt: true },
      });
      if (!competition) throw fail('no_such_team');
      if (!competition.teamsEnabled) throw fail('teams_off');

      const team = await prisma.competitionTeam.findFirst({
         where: { id: teamId, competitionId },
         select: { id: true },
      });
      if (!team) throw fail('no_such_team');

      const entrant = await prisma.competitionEntrant.findUnique({
         where: { competitionId_userId: { competitionId, userId } },
         select: { teamId: true, leftAt: true },
      });
      /*
       * The side an angler was on is remembered when they leave, and counts
       * as theirs: leaving and coming back after the start is not a way to
       * change side, because their fish would go with them.
       */
      const switching = Boolean(entrant?.teamId && entrant.teamId !== teamId);
      const returning = Boolean(entrant?.teamId && entrant.teamId === teamId);
      const started = new Date() >= competition.startsAt;
      if (switching && started) throw fail('teams_locked');
      if (options.byOrganiser && started) throw fail('teams_locked');

      /*
       * The count and the write in one transaction, with the side's row
       * held, so two anglers taking the last place at once cannot both get
       * it. Somebody coming back to their own side is let back on even if it
       * filled while they were away.
       */
      await prisma.$transaction(async (tx: any) => {
         if (competition.maxPerTeam && !returning) {
            await tx.$queryRaw`SELECT id FROM competition_teams WHERE id = ${teamId} FOR UPDATE`;
            const onIt = await tx.competitionEntrant.count({
               where: {
                  competitionId,
                  teamId,
                  leftAt: null,
                  userId: { not: userId },
               },
            });
            if (onIt >= competition.maxPerTeam) throw fail('team_full');
         }
         await tx.competitionEntrant.upsert({
            where: { competitionId_userId: { competitionId, userId } },
            update: { leftAt: null, teamId },
            create: { competitionId, userId, teamId },
         });
      });
      return { teamId };
   },

   async assertOrganiser(competitionId: string, userId: string) {
      const competition = await prisma.competition.findFirst({
         where: { id: competitionId, deletedAt: null },
         select: { createdById: true, teamsEnabled: true, startsAt: true },
      });
      if (!competition || competition.createdById !== userId) {
         throw fail('not_organiser');
      }
      if (!competition.teamsEnabled) throw fail('teams_off');
      return competition;
   },

   async add(competitionId: string, organiserId: string, name: string) {
      const competition = await this.assertOrganiser(
         competitionId,
         organiserId
      );
      if (new Date() >= competition.startsAt) throw fail('teams_locked');
      const teams = await prisma.competitionTeam.findMany({
         where: { competitionId },
         select: { name: true, position: true },
      });
      if (teams.length >= MAX_TEAMS) throw fail('too_many_teams');
      if (teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
         throw fail('name_taken');
      }
      return prisma.competitionTeam.create({
         data: {
            competitionId,
            name,
            position: Math.max(-1, ...teams.map((t) => t.position)) + 1,
         },
         select: { id: true, name: true, position: true },
      });
   },

   /* A name can change at any time: it moves nobody. */
   async rename(
      competitionId: string,
      organiserId: string,
      teamId: string,
      name: string
   ) {
      await this.assertOrganiser(competitionId, organiserId);
      const clash = await prisma.competitionTeam.findFirst({
         where: { competitionId, name, id: { not: teamId } },
         select: { id: true },
      });
      if (clash) throw fail('name_taken');
      const updated = await prisma.competitionTeam.updateMany({
         where: { id: teamId, competitionId },
         data: { name },
      });
      if (updated.count === 0) throw fail('no_such_team');
      return { teamId, name };
   },

   async remove(competitionId: string, organiserId: string, teamId: string) {
      const competition = await this.assertOrganiser(
         competitionId,
         organiserId
      );
      if (new Date() >= competition.startsAt) throw fail('teams_locked');
      const [count, members] = await Promise.all([
         prisma.competitionTeam.count({ where: { competitionId } }),
         prisma.competitionEntrant.count({
            where: { competitionId, teamId, leftAt: null },
         }),
      ]);
      if (count <= MIN_TEAMS) throw fail('too_few_teams');
      if (members > 0) throw fail('team_not_empty');
      await prisma.competitionTeam.deleteMany({
         where: { id: teamId, competitionId },
      });
      return { removed: teamId };
   },

   async assign(
      competitionId: string,
      organiserId: string,
      userId: string,
      teamId: string
   ) {
      await this.assertOrganiser(competitionId, organiserId);
      const entrant = await prisma.competitionEntrant.findFirst({
         where: { competitionId, userId, leftAt: null },
         select: { id: true },
      });
      if (!entrant) throw fail('not_entrant');
      return this.place(competitionId, userId, teamId, { byOrganiser: true });
   },
};
