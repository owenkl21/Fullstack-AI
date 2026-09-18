import z from 'zod';

export const feedScopeSchema = z.enum(['GLOBAL', 'NEARBY']);
/*
 * A post is a catch. Spots no longer publish themselves, so there is nothing
 * left to choose between and the list route no longer takes a type at all: it
 * returns catches whatever the caller asks for.
 */
export const feedTypeSchema = z.enum(['CATCH']);

export const listFeedSchema = z.object({
   scope: feedScopeSchema.optional().default('GLOBAL'),
   latitude: z.coerce.number().min(-90).max(90).optional(),
   longitude: z.coerce.number().min(-180).max(180).optional(),
   limit: z.coerce.number().int().min(1).max(100).optional().default(25),
   offset: z.coerce.number().int().min(0).optional().default(0),
});

export const createFeedPostSchema = z.object({
   type: feedTypeSchema.optional().default('CATCH'),
   scope: feedScopeSchema.optional().default('GLOBAL'),
   content: z.string().trim().min(1).max(2000).optional().nullable(),
   /* A post without its catch is a headline and nothing else, so the catch is
    * required rather than checked afterwards. The spot rides along with it. */
   catchId: z.string().trim().min(1),
   siteId: z.string().trim().min(1).optional().nullable(),
   latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
   longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
});

export const updateFeedPostSchema = z.object({
   scope: feedScopeSchema.optional(),
   content: z.string().trim().min(1).max(2000).optional().nullable(),
});

export const createFeedCommentSchema = z.object({
   body: z.string().trim().min(1).max(1000),
});
