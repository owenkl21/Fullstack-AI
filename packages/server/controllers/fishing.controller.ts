// TODO: implement fishing controller.
// Suggested responsibility: validate input and map service errors to HTTP responses.
import type { Request, Response } from 'express';
import { fishingRequestSchema } from '../schemas/fishing.schema';
import { fishingService } from '../services/fishing.service';

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
};
