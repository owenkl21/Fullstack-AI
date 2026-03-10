import z from 'zod';

export const feedScopeSchema = z.enum(['GLOBAL', 'NEARBY']);
export const feedTypeSchema = z.enum(['CATCH', 'SITE']);

export const listFeedSchema = z.object({
   scope: feedScopeSchema.optional().default('GLOBAL'),
   type: feedTypeSchema.optional(),
   latitude: z.coerce.number().min(-90).max(90).optional(),
   longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const createFeedPostSchema = z
   .object({
      type: feedTypeSchema,
      scope: feedScopeSchema.optional().default('GLOBAL'),
      content: z.string().trim().min(1).max(2000).optional().nullable(),
      catchId: z.string().trim().min(1).optional().nullable(),
      siteId: z.string().trim().min(1).optional().nullable(),
      latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
      longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
   })
   .superRefine((value, ctx) => {
      if (value.type === 'CATCH' && !value.catchId) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['catchId'],
            message: 'catchId is required for CATCH feed posts.',
         });
      }

      if (value.type === 'SITE' && !value.siteId) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['siteId'],
            message: 'siteId is required for SITE feed posts.',
         });
      }
   });

export const updateFeedPostSchema = z.object({
   scope: feedScopeSchema.optional(),
   content: z.string().trim().min(1).max(2000).optional().nullable(),
});

export const createFeedCommentSchema = z.object({
   body: z.string().trim().min(1).max(1000),
});
