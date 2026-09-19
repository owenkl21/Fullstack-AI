import type { Request, Response } from 'express';
import { getAuth } from '../lib/auth-context';
import { savedService } from '../services/saved.service';

/* Express can hand back a repeated route value as an array. */
const asSingleParam = (value: string | string[] | undefined) =>
   Array.isArray(value) ? value[0] : value;

const unauthorized = {
   code: 'unauthorized',
   message: 'Authentication required.',
};

/*
 * A save that cannot happen and one that refers to nothing are reported the
 * same way. Saying which would tell somebody whether a private spot exists.
 */
const notSavable = {
   code: 'not_savable',
   message: 'That cannot be saved.',
};

export const savedController = {
   async listPosts(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      return res.json({ posts: await savedService.listPosts(auth.userId) });
   },

   async savePost(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const postId = asSingleParam(req.params.postId);
      if (!postId) return res.status(400).json(notSavable);
      const result = await savedService.savePost(auth.userId, postId);
      if (!result) return res.status(404).json(notSavable);
      return res.status(201).json(result);
   },

   async removePost(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const postId = asSingleParam(req.params.postId);
      if (!postId) return res.status(400).json(notSavable);
      return res.json(await savedService.removePost(auth.userId, postId));
   },

   async listSpots(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      return res.json({ spots: await savedService.listSpots(auth.userId) });
   },

   async saveSpot(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);

      const siteId = asSingleParam(req.params.siteId);
      if (!siteId) return res.status(400).json(notSavable);

      const note =
         typeof req.body?.note === 'string'
            ? req.body.note.slice(0, 500)
            : null;

      const result = await savedService.saveSpot(auth.userId, siteId, note);
      return result ? res.json(result) : res.status(404).json(notSavable);
   },

   async removeSpot(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);

      const siteId = asSingleParam(req.params.siteId);
      if (!siteId) return res.status(400).json(notSavable);

      return res.json(await savedService.removeSpot(auth.userId, siteId));
   },

   async listGear(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      return res.json({ gear: await savedService.listGear(auth.userId) });
   },

   async saveGear(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);

      const gearId = asSingleParam(req.params.gearId);
      if (!gearId) return res.status(400).json(notSavable);

      const result = await savedService.saveGear(auth.userId, gearId);
      return result ? res.json(result) : res.status(404).json(notSavable);
   },

   async removeGear(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);

      const gearId = asSingleParam(req.params.gearId);
      if (!gearId) return res.status(400).json(notSavable);

      return res.json(await savedService.removeGear(auth.userId, gearId));
   },
};
