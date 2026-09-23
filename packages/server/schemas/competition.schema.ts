import z from 'zod';
import { cleanOptional, cleanTransform } from '../lib/moderation';

/*
 * Teams: at least two sides, and eight is past any weekend a club would run.
 * A team name is short, because it sits in a board column and on a button.
 */
export const MIN_TEAMS = 2;
export const MAX_TEAMS = 8;
const teamName = z
   .string()
   .trim()
   .min(1, 'Give the team a name.')
   .max(40, 'A team name is forty letters at most.')
   .transform(cleanTransform);

/* How many fish one competition can be for. */
export const MAX_COMPETITION_SPECIES = 12;
const TOO_MANY_SPECIES = `A competition can be for ${MAX_COMPETITION_SPECIES} species at most.`;

/* The two species fields as the one list the service keeps: each fish once. */
const speciesOf = (value: {
   speciesIds: string[];
   speciesId?: string | null;
}) =>
   new Set([
      ...value.speciesIds,
      ...(value.speciesId ? [value.speciesId] : []),
   ]);

/*
 * What an angler is allowed to decide when they start a competition.
 *
 * The dates arrive as whatever the browser sent and are coerced here, because a
 * competition that ends before it starts is the one mistake that makes the
 * standings meaningless rather than merely wrong.
 */
export const createCompetitionSchema = z
   .object({
      name: z.string().trim().min(2).max(120).transform(cleanTransform),
      blurb: z
         .string()
         .trim()
         .min(1)
         .max(280)
         .optional()
         .nullable()
         .transform(cleanOptional),
      rule: z
         .enum(['SPECIES_POINTS', 'BIGGEST_FISH', 'SPECIES_VARIETY'])
         .default('SPECIES_POINTS'),
      measure: z.enum(['LENGTH', 'WEIGHT']).default('LENGTH'),
      scope: z.enum(['PUBLIC', 'GROUP', 'PRIVATE']).default('PUBLIC'),
      /* For a private competition: the followers to invite. */
      inviteeIds: z
         .array(z.string().trim().min(1))
         .max(100)
         .optional()
         .default([]),
      /*
       * The fish it is for. An empty list is any species. Twelve is past any
       * list an organiser would read out at a weigh in, and it keeps the rules
       * line on a card to something a person can take in.
       */
      speciesIds: z
         .array(z.string().trim().min(1).max(64))
         .max(MAX_COMPETITION_SPECIES, TOO_MANY_SPECIES)
         .optional()
         .default([]),
      /* The older single field, still read so a client that has not reloaded
       * since this shipped keeps working. It is folded into the list. */
      speciesId: z.string().trim().min(1).max(64).optional().nullable(),
      groupId: z.string().trim().min(1).optional().nullable(),
      startsAt: z.coerce.date(),
      endsAt: z.coerce.date(),
      /* The cap that stops a competition being won on time spent. */
      maxPerSpeciesPerDay: z.coerce.number().int().min(1).max(20).default(3),
      /* Where a catch has to come from. The exact spot is never shown. */
      areaType: z.enum(['ANYWHERE', 'WATERBODY', 'REGION']).default('ANYWHERE'),
      areaName: z.string().trim().min(2).max(120).optional().nullable(),
      areaLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
      areaLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
      areaRadiusKm: z.coerce.number().min(1).max(500).optional().nullable(),
      /* Casual counts on pass; review waits for the organiser every time. */
      checks: z.enum(['CASUAL', 'REVIEW']).default('CASUAL'),
      /*
       * Teams. The names are the sides, in order; when there are none but
       * teams are on, the service names them Team 1, Team 2 and so on from
       * teamCount.
       */
      teamsEnabled: z.boolean().default(false),
      teamCount: z.coerce
         .number()
         .int()
         .min(
            MIN_TEAMS,
            `A competition with teams needs at least ${MIN_TEAMS} of them.`
         )
         .max(MAX_TEAMS, `A competition can have ${MAX_TEAMS} teams at most.`)
         .optional()
         .nullable(),
      /* In order, one per side. A blank one is named for its place. */
      teamNames: z
         .array(
            z
               .string()
               .trim()
               .max(40, 'A team name is forty letters at most.')
               .transform(cleanTransform)
         )
         .max(MAX_TEAMS)
         .optional()
         .default([]),
      maxPerTeam: z.coerce
         .number()
         .int()
         .min(1, 'A team needs room for at least one angler.')
         .max(500)
         .optional()
         .nullable(),
   })
   .refine(
      (value) => value.areaType === 'ANYWHERE' || Boolean(value.areaName),
      {
         message: 'Name the waterbody or the province.',
         path: ['areaName'],
      }
   )
   .refine((value) => value.endsAt > value.startsAt, {
      message: 'A competition has to end after it starts.',
      path: ['endsAt'],
   })
   .refine((value) => speciesOf(value).size <= MAX_COMPETITION_SPECIES, {
      message: TOO_MANY_SPECIES,
      path: ['speciesIds'],
   })
   .refine(
      /* One fish cannot be won on variety; none, or several, can. */
      (value) =>
         value.rule !== 'SPECIES_VARIETY' || speciesOf(value).size !== 1,
      {
         message: 'Most species needs more than one fish to choose from.',
         path: ['speciesIds'],
      }
   )
   .refine((value) => value.scope !== 'GROUP' || Boolean(value.groupId), {
      message: 'A group competition needs a group.',
      path: ['groupId'],
   })
   .refine(
      (value) =>
         !value.teamsEnabled ||
         Math.max(value.teamNames.length, value.teamCount ?? 0) >= MIN_TEAMS,
      {
         message: `A competition with teams needs at least ${MIN_TEAMS} of them.`,
         path: ['teamCount'],
      }
   )
   .refine(
      (value) =>
         new Set(
            value.teamNames.filter(Boolean).map((name) => name.toLowerCase())
         ).size === value.teamNames.filter(Boolean).length,
      {
         message: 'Two teams cannot have the same name.',
         path: ['teamNames'],
      }
   );

/* Joining, or choosing a side, in a competition with teams. */
export const joinCompetitionSchema = z.object({
   teamId: z.string().trim().min(1).max(64).optional().nullable(),
});

/* The organiser's hand on the teams, before the start. */
export const addTeamSchema = z.object({ name: teamName });
export const renameTeamSchema = z.object({ name: teamName });
export const assignTeamSchema = z.object({
   userId: z.string().trim().min(1).max(64),
   teamId: z.string().trim().min(1).max(64),
});

export const inviteSchema = z.object({
   userIds: z.array(z.string().trim().min(1)).min(1).max(100),
});

export const listCompetitionsSchema = z.object({
   tab: z.enum(['all', 'mine', 'invites']).default('all'),
   page: z.coerce.number().int().min(1).default(1),
   /* Twenty a page, newest first. */
   size: z.coerce.number().int().min(5).max(50).default(20),
});

/* A catch entered in a competition. Figures are metric on the wire. */
export const submitEntrySchema = z.object({
   catchId: z.string().trim().min(1),
   /* Which of the catch's photographs is the fish. Left out by a client
      older than the two photo steps; the catch's cover stands in. */
   fishImage: z
      .object({ storageKey: z.string().trim().min(1).max(512) })
      .optional()
      .nullable(),
   measureImage: z
      .object({
         storageKey: z.string().trim().min(1).max(512),
         url: z.string().trim().url(),
      })
      .optional()
      .nullable(),
   declaredValue: z.coerce
      .number()
      .positive()
      .max(100000)
      .optional()
      .nullable(),
   areaConfirmed: z.boolean().default(false),
   photoTakenAt: z.coerce.date().optional().nullable(),
   /* What the camera wrote in the measure photograph. */
   measureTakenAt: z.coerce.date().optional().nullable(),
   note: z
      .string()
      .trim()
      .min(1)
      .max(280)
      .optional()
      .nullable()
      .transform(cleanOptional),
});

export const reviewEntrySchema = z.object({
   action: z.enum(['accept', 'exclude']),
   note: z
      .string()
      .trim()
      .min(1)
      .max(280)
      .optional()
      .nullable()
      .transform(cleanOptional),
});

export const flagEntrySchema = z.object({
   reason: z.string().trim().min(2).max(280),
});
