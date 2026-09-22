import type { Request, Response } from 'express';
import z from 'zod';
import { getAuth } from '../lib/auth-context';
import { notificationsService } from '../services/notifications.service';

const unauthorized = {
   code: 'unauthorized',
   message: 'Authentication required.',
};

const listSchema = z.object({
   page: z.coerce.number().int().min(1).max(500).default(1),
});

const readSchema = z.object({
   ids: z.array(z.string().trim().min(1)).max(200).optional(),
});

export const notificationsController = {
   async list(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const parsed = listSchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json(parsed.error.format());
      res.setHeader('Cache-Control', 'no-store');
      return res.json(
         await notificationsService.list(auth.userId, parsed.data.page)
      );
   },

   async unread(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      res.setHeader('Cache-Control', 'no-store');
      return res.json(await notificationsService.pulse(auth.userId));
   },

   async clear(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      return res.json(await notificationsService.clear(auth.userId));
   },

   async markRead(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const parsed = readSchema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json(parsed.error.format());
      return res.json(
         await notificationsService.markRead(auth.userId, parsed.data.ids)
      );
   },
};
