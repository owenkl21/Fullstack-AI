import type { Request, Response } from 'express';
import { z } from 'zod';
import { getAuth } from '../lib/auth-context';
import { groupsService } from '../services/groups.service';

const createSchema = z.object({
   name: z.string().trim().min(2).max(60),
   blurb: z.string().trim().max(280).optional().nullable(),
   joinMode: z.enum(['OPEN', 'INVITE_ONLY', 'CODE']).optional(),
});

const joinSchema = z.object({ code: z.string().trim().min(4).max(16) });

const needsAuth = (res: Response) =>
   res
      .status(401)
      .json({ code: 'unauthorized', message: 'Authentication required.' });

export const groupsController = {
   async listMine(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return needsAuth(res);

      try {
         return res.json({ groups: await groupsService.listMine(auth.userId) });
      } catch (error) {
         console.error('[groups:list] failed', error);
         return res.status(500).json({
            code: 'failed_to_list_groups',
            message: 'Unable to load your groups.',
         });
      }
   },

   async create(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return needsAuth(res);

      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }

      try {
         return res.json(await groupsService.create(auth.userId, parsed.data));
      } catch (error) {
         console.error('[groups:create] failed', error);
         return res.status(500).json({
            code: 'failed_to_create_group',
            message: 'Unable to create the group.',
         });
      }
   },

   async join(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return needsAuth(res);

      const parsed = joinSchema.safeParse(req.body);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }

      try {
         const result = await groupsService.joinByCode(
            auth.userId,
            parsed.data.code
         );

         if (result.code === 'no_such_group') {
            return res.status(404).json({
               code: 'no_such_group',
               message: 'That code does not match a group you can join.',
            });
         }

         return res.json(result);
      } catch (error) {
         console.error('[groups:join] failed', error);
         return res.status(500).json({
            code: 'failed_to_join',
            message: 'Unable to join that group.',
         });
      }
   },

   async boards(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return needsAuth(res);

      const groupId = req.params.groupId as string;

      try {
         /* Members only. A group board is not a public leaderboard. */
         if (!(await groupsService.isMember(groupId, auth.userId))) {
            return res.status(403).json({
               code: 'not_a_member',
               message: 'That board is for members of the group.',
            });
         }

         return res.json(await groupsService.boards(groupId));
      } catch (error) {
         console.error('[groups:boards] failed', error);
         return res.status(500).json({
            code: 'failed_to_load_board',
            message: 'Unable to load the board.',
         });
      }
   },
};
