import z from 'zod';

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
      /* Set, and the competition is for that one fish. */
      speciesId: z.string().trim().min(1).optional().nullable(),
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
   note: z.string().trim().min(1).max(280).optional().nullable(),
});

export const reviewEntrySchema = z.object({
   action: z.enum(['accept', 'exclude']),
   note: z.string().trim().min(1).max(280).optional().nullable(),
});

export const flagEntrySchema = z.object({
   reason: z.string().trim().min(2).max(280),
});
