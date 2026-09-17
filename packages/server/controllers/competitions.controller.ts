import type { Request, Response } from 'express';
import { getAuth } from '../lib/auth-context';
import { createCompetitionSchema } from '../schemas/competition.schema';
import { competitionsService } from '../services/competitions.service';

/* Express can hand back a repeated route value as an array. */
const asSingleParam = (value: string | string[] | undefined) =>
   Array.isArray(value) ? value[0] : value;

const unauthorized = {
   code: 'unauthorized',
   message: 'Authentication required.',
};

export const competitionsController = {
   async list(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorized);
      }

      const competitions = await competitionsService.list(auth.userId);
      return res.json({ competitions });
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

      const result = await competitionsService.standings(id);
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
