import type { Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import {
   createCatchSchema,
   createFishingSiteSchema,
   fishingRequestSchema,
   weatherLookupSchema,
   updateCatchSchema,
   updateFishingSiteSchema,
} from '../schemas/fishing.schema';
import { fishingService } from '../services/fishing.service';

const unauthorizedResponse = {
   code: 'unauthorized',
   message: 'Authentication required.',
};

const asSingleParam = (value: string | string[] | undefined) =>
   Array.isArray(value) ? value[0] : value;

export const fishingController = {
   async getCurrentWeatherByCoordinates(req: Request, res: Response) {
      const parseResult = weatherLookupSchema.safeParse(req.query);

      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }

      try {
         const weather = await fishingService.getCurrentWeatherByCoordinates(
            parseResult.data.latitude,
            parseResult.data.longitude
         );

         return res.json({ weather });
      } catch (error) {
         console.error('Failed to get weather by coordinates', error);
         return res.status(500).json({
            code: 'failed_to_fetch_weather',
            message: 'Unable to fetch weather for this location right now.',
         });
      }
   },

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
         console.error('Failed to create catch', {
            error,
            payload: parseResult.data,
            userId: auth.userId,
         });
         return res.status(500).json({
            code: 'failed_to_create_catch',
            message:
               'Unable to save your catch right now. Please try again without images first.',
         });
      }
   },

   async listMyCatches(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const catches = await fishingService.listMyCatches(auth.userId);
      return res.json({ catches });
   },

   async updateCatch(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const catchId = asSingleParam(req.params.catchId);
      if (!catchId) {
         return res.status(400).json({
            code: 'missing_catch_id',
            message: 'Catch id is required.',
         });
      }

      const parseResult = updateCatchSchema.safeParse(req.body);
      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }

      const updated = await fishingService.updateCatch(
         auth.userId,
         catchId,
         parseResult.data
      );

      if (!updated) {
         return res.status(404).json({
            code: 'catch_not_found',
            message: 'Catch not found.',
         });
      }

      return res.json({ catch: updated });
   },

   async deleteCatch(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const catchId = asSingleParam(req.params.catchId);
      if (!catchId) {
         return res.status(400).json({
            code: 'missing_catch_id',
            message: 'Catch id is required.',
         });
      }

      const deleted = await fishingService.deleteCatch(auth.userId, catchId);
      if (!deleted) {
         return res.status(404).json({
            code: 'catch_not_found',
            message: 'Catch not found.',
         });
      }

      return res.status(204).send();
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

   async listMyFishingSites(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const sites = await fishingService.listMyFishingSites(auth.userId);
      return res.json({ sites });
   },

   async updateFishingSite(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const siteId = asSingleParam(req.params.siteId);
      if (!siteId) {
         return res.status(400).json({
            code: 'missing_site_id',
            message: 'Site id is required.',
         });
      }

      const parseResult = updateFishingSiteSchema.safeParse(req.body);
      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }

      const updated = await fishingService.updateFishingSite(
         auth.userId,
         siteId,
         parseResult.data
      );
      if (!updated) {
         return res.status(404).json({
            code: 'site_not_found',
            message: 'Fishing site not found.',
         });
      }

      return res.json({ site: updated });
   },

   async deleteFishingSite(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const siteId = asSingleParam(req.params.siteId);
      if (!siteId) {
         return res.status(400).json({
            code: 'missing_site_id',
            message: 'Site id is required.',
         });
      }

      const deleted = await fishingService.deleteFishingSite(
         auth.userId,
         siteId
      );
      if (!deleted) {
         return res.status(404).json({
            code: 'site_not_found',
            message: 'Fishing site not found.',
         });
      }

      return res.status(204).send();
   },

   async listFishingSites(_req: Request, res: Response) {
      const sites = await fishingService.listFishingSites();
      return res.json({ sites });
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
