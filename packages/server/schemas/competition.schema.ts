import z from 'zod';

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
      name: z.string().trim().min(2).max(120),
      blurb: z.string().trim().min(1).max(280).optional().nullable(),
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
   note: z.string().trim().min(1).max(280).optional().nullable(),
});

export const reviewEntrySchema = z.object({
   action: z.enum(['accept', 'exclude']),
   note: z.string().trim().min(1).max(280).optional().nullable(),
});

export const flagEntrySchema = z.object({
   reason: z.string().trim().min(2).max(280),
});
