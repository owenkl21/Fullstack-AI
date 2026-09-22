import type { Request, Response } from 'express';
import {
   adminService,
   isAdminSection,
   ADMIN_SECTIONS,
} from '../services/admin.service';

/*
 * The admin panel's readings.
 *
 * Who may be here is settled before this file runs, by requireAdmin in
 * lib/admin.ts, which reads the role out of the database for every request
 * and drops a caller who is not the admin out of the router entirely. So
 * there is no role check in here and there must never be one: a second place
 * that decides who is an admin is a second place to get it wrong.
 *
 * An unknown section answers 404 rather than a list of the sections there
 * are, which is the same answer the guard gives, so probing learns nothing
 * either way.
 */

export const adminController = {
   async section(req: Request, res: Response) {
      const section = String(req.params.section ?? '');

      if (!isAdminSection(section)) {
         return res.status(404).json({ code: 'not_found' });
      }

      try {
         return res.json(await adminService.read(section));
      } catch (error) {
         console.error(`[admin:${section}] failed`, error);
         return res.status(500).json({
            code: 'failed_to_read',
            message: 'Could not read that just now.',
         });
      }
   },

   /* The sections this build answers, for the panel to ask for. */
   sections: ADMIN_SECTIONS,
};
