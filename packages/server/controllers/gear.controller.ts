import type { Request, Response } from 'express';
import { getAuth } from '../lib/auth-context';
import {
   isAddressOfKey,
   isOwnImageKey,
   notYourImage,
} from '../lib/image-owner';
import { createGearSchema, updateGearSchema } from '../schemas/gear.schema';
import { gearService } from '../services/gear.service';

const unauthorizedResponse = {
   code: 'unauthorized',
   message: 'Authentication required.',
};

const asSingleParam = (value: string | string[] | undefined) =>
   Array.isArray(value) ? value[0] : value;

/* The key has to be the caller's, and the address has to be that key's: gear
   keeps the address and finds its photograph again by it. */
const isOwnGearImage = (
   auth: Parameters<typeof isOwnImageKey>[0],
   image: { storageKey: string; url: string }
) =>
   isOwnImageKey(auth, image.storageKey) &&
   isAddressOfKey(image.url, image.storageKey);

export const gearController = {
   async createGear(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const parseResult = createGearSchema.safeParse(req.body);
      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }
      if (
         parseResult.data.image &&
         !isOwnGearImage(auth, parseResult.data.image)
      ) {
         return res.status(400).json(notYourImage);
      }

      const gear = await gearService.createGear(auth.userId, parseResult.data);
      return res.status(201).json({ gear });
   },

   async listGear(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const gear = await gearService.listGear();
      return res.json({ gear });
   },

   async listMyGear(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const gear = await gearService.listMyGear(auth.userId);
      return res.json({ gear });
   },

   async updateGear(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const gearId = asSingleParam(req.params.gearId);
      if (!gearId) {
         return res
            .status(400)
            .json({ code: 'missing_gear_id', message: 'Gear id is required.' });
      }

      const parseResult = updateGearSchema.safeParse(req.body);
      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }
      if (
         parseResult.data.image &&
         !isOwnGearImage(auth, parseResult.data.image)
      ) {
         return res.status(400).json(notYourImage);
      }

      const gear = await gearService.updateGear(
         auth.userId,
         gearId,
         parseResult.data
      );
      if (!gear) {
         return res
            .status(404)
            .json({ code: 'gear_not_found', message: 'Gear not found.' });
      }

      return res.json({ gear });
   },

   async deleteGear(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const gearId = asSingleParam(req.params.gearId);
      if (!gearId) {
         return res
            .status(400)
            .json({ code: 'missing_gear_id', message: 'Gear id is required.' });
      }

      const deleted = await gearService.deleteGear(auth.userId, gearId);
      if (!deleted) {
         return res
            .status(404)
            .json({ code: 'gear_not_found', message: 'Gear not found.' });
      }

      return res.status(204).send();
   },
};
