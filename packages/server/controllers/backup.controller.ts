import type { Request, Response } from 'express';
import { backupService } from '../services/backup.service';

/* Copies of the log: what there is, one more now, and a link to fetch one. */
export const backupController = {
   async list(_req: Request, res: Response) {
      return res.json({ backups: await backupService.list() });
   },

   async take(_req: Request, res: Response) {
      try {
         return res.json(await backupService.take());
      } catch (error) {
         console.error('[backup] The copy failed.', error);
         return res.status(500).json({
            code: 'backup_failed',
            message: 'No copy was taken.',
            why: error instanceof Error ? error.message : String(error),
         });
      }
   },

   async link(req: Request, res: Response) {
      const key = String(req.query.key ?? '').trim();
      const url = await backupService.linkTo(key);
      if (!url) {
         return res
            .status(404)
            .json({ code: 'not_found', message: 'No such copy.' });
      }
      return res.json({ url });
   },
};
