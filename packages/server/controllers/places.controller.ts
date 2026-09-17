import type { Request, Response } from 'express';
import z from 'zod';
import { fetchPlaces } from '../services/places.service';

const boundsSchema = z
   .object({
      south: z.coerce.number().min(-90).max(90),
      west: z.coerce.number().min(-180).max(180),
      north: z.coerce.number().min(-90).max(90),
      east: z.coerce.number().min(-180).max(180),
   })
   .refine((b) => b.north > b.south && b.east > b.west, {
      message: 'The box is inside out.',
   });

/*
 * Overpass will happily be asked for a continent and then time out, so the box
 * is clamped to this many degrees a side, around its own centre. Clamped, not
 * refused: the first version returned 400 for anything over two and a half
 * degrees, and the map opens on a stretch of coast about eight degrees wide,
 * so every opening view was refused and nobody ever saw a slipway.
 */
const MAX_SPAN = 6;

const clamp = (b: z.infer<typeof boundsSchema>) => {
   const midLat = (b.north + b.south) / 2;
   const midLng = (b.east + b.west) / 2;
   const halfLat = Math.min(b.north - b.south, MAX_SPAN) / 2;
   const halfLng = Math.min(b.east - b.west, MAX_SPAN) / 2;
   return {
      south: midLat - halfLat,
      north: midLat + halfLat,
      west: midLng - halfLng,
      east: midLng + halfLng,
   };
};

export const placesController = {
   async list(req: Request, res: Response) {
      const parsed = boundsSchema.safeParse(req.query);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }

      const places = await fetchPlaces(clamp(parsed.data));
      /* Public data, so let the browser and the CDN keep it for a bit. */
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.json({ places });
   },
};
