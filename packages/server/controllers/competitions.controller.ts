import type { Request, Response } from 'express';
import { getAuth } from '../lib/auth-context';
import {
   createCompetitionSchema,
   inviteSchema,
   listCompetitionsSchema,
} from '../schemas/competition.schema';
import { competitionsService } from '../services/competitions.service';

/* Express can hand back a repeated route value as an array. */
const asSingleParam = (value: string | string[] | undefined) =>
   Array.isArray(value) ? value[0] : value;

const unauthorized = {
   code: 'unauthorized',
   message: 'Authentication required.',
};

export const competitionsController = {
   async invite(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const id = asSingleParam(req.params.competitionId);
      const parsed = inviteSchema.safeParse(req.body);
      if (!id || !parsed.success) {
         return res.status(400).json({ code: 'bad_invite' });
      }
      const result = await competitionsService.invite(
         auth.userId,
         id,
         parsed.data.userIds
      );
      if (!result) {
         return res.status(404).json({ code: 'competition_not_yours' });
      }
      return res.json(result);
   },

   async myInvites(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      return res.json({
         invites: await competitionsService.invitesFor(auth.userId),
      });
   },

   async answerInvite(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const id = asSingleParam(req.params.inviteId);
      const accept = req.body?.accept === true;
      if (!id) return res.status(400).json({ code: 'invite_id_required' });
      const result = await competitionsService.answerInvite(
         auth.userId,
         id,
         accept
      );
      if (!result) return res.status(404).json({ code: 'invite_not_found' });
      return res.json(result);
   },

   async myFollowers(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      return res.json({
         followers: await competitionsService.followersOf(auth.userId),
      });
   },

   async list(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorized);
      }

      const query = listCompetitionsSchema.safeParse(req.query);
      const { page, size } = query.success ? query.data : { page: 1, size: 20 };
      const result = await competitionsService.list(auth.userId, page, size);
      return res.json({
         competitions: result.items,
         total: result.total,
         page: result.page,
         size: result.size,
      });
   },

   async create(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorized);
      }

      const parsed = createCompetitionSchema.safeParse(req.body);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }

      try {
         const competition = await competitionsService.create(
            auth.userId,
            parsed.data
         );
         return res.status(201).json({ competition });
      } catch (error) {
         console.error('[competitions:create] failed', error);
         return res.status(500).json({
            code: 'failed_to_create_competition',
            message: 'Could not start that competition.',
         });
      }
   },

   async standings(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorized);
      }

      const id = asSingleParam(req.params.competitionId);
      if (!id) {
         return res.status(400).json({
            code: 'competition_id_required',
            message: 'A competition id is required.',
         });
      }

      const result = await competitionsService.standings(id, auth.userId);
      if (!result) {
         return res.status(404).json({
            code: 'competition_not_found',
            message: 'That competition could not be found.',
         });
      }

      return res.json(result);
   },

   async join(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorized);
      }

      const id = asSingleParam(req.params.competitionId);
      if (!id) {
         return res.status(400).json({
            code: 'competition_id_required',
            message: 'A competition id is required.',
         });
      }

      const result = await competitionsService.join(auth.userId, id);
      if (!result) {
         /* Either it is gone, or it belongs to a group this angler is not in.
          * Both are "you cannot enter this", and saying which would leak
          * whether a private competition exists. */
         return res.status(404).json({
            code: 'competition_not_open',
            message: 'That competition is not open to you.',
         });
      }

      return res.json(result);
   },

   async leave(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorized);
      }

      const id = asSingleParam(req.params.competitionId);
      if (!id) {
         return res.status(400).json({
            code: 'competition_id_required',
            message: 'A competition id is required.',
         });
      }

      return res.json(await competitionsService.leave(auth.userId, id));
   },
};
