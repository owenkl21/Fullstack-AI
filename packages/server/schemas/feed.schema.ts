import z from 'zod';
import { cleanOptional, cleanTransform } from '../lib/moderation';

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
   /* One post by id, for a link that lands on a comment. Bounded like any id. */
   postId: z.string().trim().min(1).max(64).optional(),
});

export const createFeedPostSchema = z.object({
   type: feedTypeSchema.optional().default('CATCH'),
   scope: feedScopeSchema.optional().default('GLOBAL'),
   content: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .optional()
      .nullable()
      .transform(cleanOptional),
   /* A post without its catch is a headline and nothing else, so the catch is
    * required rather than checked afterwards. The spot rides along with it. */
   catchId: z.string().trim().min(1),
   siteId: z.string().trim().min(1).optional().nullable(),
   latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
   longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
});

export const updateFeedPostSchema = z.object({
   scope: feedScopeSchema.optional(),
   content: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .optional()
      .nullable()
      .transform(cleanOptional),
});

/*
 * One bound for the words, shared by writing a comment and editing one, so an
 * edit can never make a comment longer than a new one was allowed to be.
 */
const feedCommentBody = z
   .string()
   .trim()
   .min(1)
   .max(1000)
   .transform(cleanTransform);

export const createFeedCommentSchema = z.object({
   body: feedCommentBody,
   /*
    * The comment being answered, when this is a reply. It may itself be a
    * reply: the service walks up to the top-level comment, so the client never
    * has to know the thread is one level deep. A cuid is 25 characters; the
    * bound only stops a megabyte of id reaching the database.
    */
   parentId: z.string().trim().min(1).max(64).optional().nullable(),
});

export const updateFeedCommentSchema = z.object({
   body: feedCommentBody,
});

/* A comment id off the path, bounded for the same reason as parentId. */
export const feedCommentIdSchema = z.string().trim().min(1).max(64);
