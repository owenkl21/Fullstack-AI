import type { Request, Response } from 'express';
import { getAuth } from '../lib/auth-context';
import { progressService } from '../services/progress.service';
import { statsService } from '../services/stats.service';

const fail = (res: Response, code: string, message: string) =>
   res.status(500).json({ code, message });

export const statsController = {
   /* Your own rank, counted over every catch. */
   async myProgress(req: Request, res: Response) {
      const userId = getAuth(req).userId;
      if (!userId) return res.status(401).json({ code: 'unauthorized' });
      return res.json({
         progress: await progressService.forUser(userId, userId),
      });
   },

   /* Another angler's rank, counted over what they made public. */
   async progressOf(req: Request, res: Response) {
      const target = String(req.params.userId ?? '');
      if (!target) return res.status(400).json({ code: 'missing_user_id' });
      return res.json({
         progress: await progressService.forUser(target, getAuth(req).userId),
      });
   },

   async myStats(req: Request, res: Response) {
      const auth = getAuth(req);

      if (!auth.userId) {
         return res.status(401).json({
            code: 'unauthorized',
            message: 'Authentication required.',
         });
      }

      try {
         const [stats, bests] = await Promise.all([
            statsService.profileStats(auth.userId),
            statsService.personalBests(auth.userId),
         ]);

         return res.json({ stats, personalBests: bests });
      } catch (error) {
         console.error('[stats:me] failed', error);
         return fail(res, 'failed_to_load_stats', 'Unable to load your stats.');
      }
   },

   /* The personal bests on their own, for the log and the insights, which
      want the row of bests and none of the heavier profile figures. */
   async myBests(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json({
            code: 'unauthorized',
            message: 'Authentication required.',
         });
      }
      try {
         return res.json({
            personalBests: await statsService.personalBests(auth.userId),
         });
      } catch (error) {
         console.error('[stats:bests] failed', error);
         return fail(
            res,
            'failed_to_load_bests',
            'Unable to load your personal bests.'
         );
      }
   },

   async rivals(req: Request, res: Response) {
      const auth = getAuth(req);

      if (!auth.userId) {
         return res.status(401).json({
            code: 'unauthorized',
            message: 'Authentication required.',
         });
      }

      try {
         return res.json(await statsService.rivalryBoard(auth.userId));
      } catch (error) {
         console.error('[stats:rivals] failed', error);
         return fail(res, 'failed_to_load_board', 'Unable to load the board.');
      }
   },

   /* Public: a species board is a reference table of who caught what. */
   async speciesBoards(_req: Request, res: Response) {
      try {
         return res.json({ boards: await statsService.speciesBoards() });
      } catch (error) {
         console.error('[stats:species] failed', error);
         return fail(
            res,
            'failed_to_load_boards',
            'Unable to load the boards.'
         );
      }
   },
};
