import type { Request, Response } from 'express';
import { z } from 'zod';
import { getAuth } from '../lib/auth-context';
import { siteMergeService } from '../services/site-merge.service';

/*
 * Two pins on one piece of water, made one spot.
 *
 * Reading the suggestions changes nothing. The merge itself cannot undo
 * itself, so it names every spot it is folding in rather than taking a
 * cluster id and deciding for the reader.
 */
const mergeSchema = z.object({
   keepId: z.string().min(1),
   fromIds: z.array(z.string().min(1)).min(1).max(10),
   /* The name the kept spot should carry afterwards. The map's name for the
      water is offered as the default, but the angler has the last word. */
   name: z.string().trim().min(1).max(120).optional(),
});

export const siteMergeController = {
   async suggestions(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res
            .status(401)
            .json({ code: 'unauthenticated', message: 'Sign in first.' });
      }
      const groups = await siteMergeService.suggestions(auth.userId);
      return res.json({ groups });
   },

   async merge(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res
            .status(401)
            .json({ code: 'unauthenticated', message: 'Sign in first.' });
      }

      const parsed = mergeSchema.safeParse(req.body);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }

      try {
         const result = await siteMergeService.merge({
            userId: auth.userId,
            ...parsed.data,
         });
         return res.json(result);
      } catch (cause) {
         const message =
            cause instanceof Error ? cause.message : 'The merge did not run.';
         return res.status(400).json({ code: 'merge_failed', message });
      }
   },
};
