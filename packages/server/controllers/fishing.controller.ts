import type { Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import {
   createCatchSchema,
   createFishingSiteSchema,
   fishingRequestSchema,
} from '../schemas/fishing.schema';
import { fishingService } from '../services/fishing.service';

const unauthorizedResponse = {
   code: 'unauthorized',
   message: 'Authentication required.',
};

export const fishingController = {
   async getConditions(req: Request, res: Response) {
      const parseResult = fishingRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }

      try {
         const result = await fishingService.getFishingConditions(
            parseResult.data.locationName
         );
         return res.json(result);
      } catch (error) {
         console.error(
            'Failed to process /api/fishing/conditions request:',
            error
         );
         return res.status(500).json({
            error: 'An error occurred while loading fishing conditions.',
         });
      }
   },

   async createCatch(req: Request, res: Response) {
      const auth = getAuth(req);

      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const parseResult = createCatchSchema.safeParse(req.body);

      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }

      try {
         const created = await fishingService.createCatch(
            auth.userId,
            parseResult.data
         );
         return res.status(201).json({ catch: created });
      } catch (error) {
         console.error('Failed to create catch', error);
         return res.status(500).json({
            code: 'failed_to_create_catch',
            message: 'Unable to save your catch right now.',
         });
      }
   },

   async getCatchById(req: Request, res: Response) {
      const catchIdParam = req.params.catchId;
      const catchId = Array.isArray(catchIdParam)
         ? catchIdParam[0]
         : catchIdParam;

      if (!catchId) {
         return res.status(400).json({
            code: 'missing_catch_id',
            message: 'Catch id is required.',
         });
      }

      const catchRecord = await fishingService.getCatchById(catchId);

      if (!catchRecord) {
         return res.status(404).json({
            code: 'catch_not_found',
            message: 'Catch not found.',
         });
      }

      return res.json({ catch: catchRecord });
   },

   async createFishingSite(req: Request, res: Response) {
      const auth = getAuth(req);

      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const parseResult = createFishingSiteSchema.safeParse(req.body);

      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }

      try {
         const created = await fishingService.createFishingSite(
            auth.userId,
            parseResult.data
         );
         return res.status(201).json({ site: created });
      } catch (error) {
         console.error('Failed to create fishing site', error);
         return res.status(500).json({
            code: 'failed_to_create_site',
            message: 'Unable to save your fishing site right now.',
         });
      }
   },

   async getFishingSiteById(req: Request, res: Response) {
      const siteIdParam = req.params.siteId;
      const siteId = Array.isArray(siteIdParam) ? siteIdParam[0] : siteIdParam;

      if (!siteId) {
         return res.status(400).json({
            code: 'missing_site_id',
            message: 'Site id is required.',
         });
      }

      const site = await fishingService.getFishingSiteById(siteId);

      if (!site) {
         return res.status(404).json({
            code: 'site_not_found',
            message: 'Fishing site not found.',
         });
      }

      return res.json({ site });
   },
};
