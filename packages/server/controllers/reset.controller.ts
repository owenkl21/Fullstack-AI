import type { Request, Response } from 'express';
import { getAuth } from '../lib/auth-context';
import { resetService } from '../services/reset.service';

/*
 * Emptying the log. The admin guard on the route decides who may be here at
 * all; what this adds is the second hand on the key: the phrase has to be
 * typed, so a stray tap on a phone cannot end a season of fishing.
 */
const PHRASE = 'start fresh';

/* One at a time. A second press while the first is still deleting would read
   the same rows again and log two resets for one. */
let running = false;

export const resetController = {
   async preview(_req: Request, res: Response) {
      return res.json(await resetService.preview());
   },

   async startFresh(req: Request, res: Response) {
      const auth = getAuth(req);
      const body = req.body as { phrase?: unknown } | undefined;
      const said =
         typeof body?.phrase === 'string'
            ? body.phrase.trim().toLowerCase()
            : '';

      if (said !== PHRASE) {
         return res.status(400).json({
            code: 'phrase_required',
            message: 'Type start fresh to empty the log.',
         });
      }

      if (running) {
         return res.status(409).json({
            code: 'already_running',
            message: 'A reset is already going.',
         });
      }

      running = true;
      try {
         return res.json(
            await resetService.startFresh(auth.userId ?? 'unknown')
         );
      } catch (error) {
         console.error('[reset] The reset failed.', error);
         return res.status(500).json({
            code: 'reset_failed',
            message: 'Nothing was emptied. Try again.',
         });
      } finally {
         running = false;
      }
   },
};
