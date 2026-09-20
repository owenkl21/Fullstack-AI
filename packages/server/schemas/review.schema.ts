import z from 'zod';

/*
 * What an angler makes of a spot: a figure out of five, and optionally the
 * words behind it.
 *
 * The words are optional on purpose. A rating with nothing written is still a
 * rating, and demanding a paragraph is how a spot ends up with two opinions on
 * it instead of twenty. The column is not nullable, so an empty one is stored
 * as an empty string rather than as null.
 */

export const RATING_MIN = 1;
export const RATING_MAX = 5;

export const writeReviewSchema = z.object({
   rating: z.coerce.number().int().min(RATING_MIN).max(RATING_MAX),
   body: z.string().trim().max(2000).optional().default(''),
});

export const listReviewsSchema = z.object({
   limit: z.coerce.number().int().min(1).max(100).optional().default(20),
   offset: z.coerce.number().int().min(0).optional().default(0),
});

export type WriteReviewInput = z.infer<typeof writeReviewSchema>;
