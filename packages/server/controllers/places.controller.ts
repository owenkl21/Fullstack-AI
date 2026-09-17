import type { Request, Response } from 'express';
import z from 'zod';
import { fetchPlaces } from '../services/places.service';

/*
 * The box is capped at about two degrees a side. Overpass will happily be asked
 * for a continent and then time out, and nobody reads slipways at that scale.
 */
const boundsSchema = z
   .object({
      south: z.coerce.number().min(-90).max(90),
      west: z.coerce.number().min(-180).max(180),
      north: z.coerce.number().min(-90).max(90),
      east: z.coerce.number().min(-180).max(180),
   })
   .refine((b) => b.north > b.south && b.east > b.west, {
      message: 'The box is inside out.',
   })
   .refine((b) => b.north - b.south <= 2.5 && b.east - b.west <= 2.5, {
      message: 'Zoom in: that box is too large to ask about.',
   });

export const placesController = {
   async list(req: Request, res: Response) {
      const parsed = boundsSchema.safeParse(req.query);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }

      const places = await fetchPlaces(parsed.data);
      /* Public data, so let the browser and the CDN keep it for a bit. */
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.json({ places });
   },
};
