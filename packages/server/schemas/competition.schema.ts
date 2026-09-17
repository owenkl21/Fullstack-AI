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
   })
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
   page: z.coerce.number().int().min(1).default(1),
   /* Twenty a page, newest first. */
   size: z.coerce.number().int().min(5).max(50).default(20),
});
