import type { Request, Response } from 'express';
import { getAuth } from '../lib/auth-context';
import { statsService } from '../services/stats.service';

const fail = (res: Response, code: string, message: string) =>
   res.status(500).json({ code, message });

export const statsController = {
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
