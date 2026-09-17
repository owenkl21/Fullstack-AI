import type { Request, Response } from 'express';
import { getAuth } from '../lib/auth-context';
import {
   createWaypointSchema,
   updateWaypointSchema,
} from '../schemas/waypoint.schema';
import { waypointsService } from '../services/waypoints.service';

/* Express can hand back a repeated route value as an array. */
const asSingleParam = (value: string | string[] | undefined) =>
   Array.isArray(value) ? value[0] : value;

const unauthorized = {
   code: 'unauthorized',
   message: 'Authentication required.',
};

const notFound = {
   code: 'waypoint_not_found',
   message: 'That waypoint could not be found.',
};

export const waypointsController = {
   async listMine(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorized);
      }

      const waypoints = await waypointsService.listMine(auth.userId);
      return res.json({ waypoints });
   },

   async create(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorized);
      }

      const parsed = createWaypointSchema.safeParse(req.body);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }

      const waypoint = await waypointsService.create(auth.userId, parsed.data);
      return res.status(201).json({ waypoint });
   },

   async update(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorized);
      }

      const id = asSingleParam(req.params.waypointId);
      if (!id) {
         return res.status(400).json(notFound);
      }

      const parsed = updateWaypointSchema.safeParse(req.body);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }

      const waypoint = await waypointsService.update(
         auth.userId,
         id,
         parsed.data
      );

      /*
       * Somebody else's waypoint matches nothing, so it is reported the same way
       * as one that does not exist. Saying "not yours" would confirm that it is
       * somebody's, which is exactly what a private mark must not do.
       */
      return waypoint ? res.json({ waypoint }) : res.status(404).json(notFound);
   },

   async remove(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorized);
      }

      const id = asSingleParam(req.params.waypointId);
      if (!id) {
         return res.status(400).json(notFound);
      }

      const removed = await waypointsService.remove(auth.userId, id);
      return removed
         ? res.json({ removed: true })
         : res.status(404).json(notFound);
   },
};
