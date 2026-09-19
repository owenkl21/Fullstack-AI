import type { Request, Response } from 'express';
import z from 'zod';
import { fetchPlaces } from '../services/places.service';
import { namePlace, searchPlaces } from '../clients/geocoding.client';

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
/*
 * Two degrees, not six. Every request over about a degree and a half took
 * both mirrors past thirty seconds and came back empty, while a box of half a
 * degree answered in a second with thirty three places. The map asks for
 * places only from a zoom where the box is about this size anyway.
 */
const MAX_SPAN = 2;

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

const searchSchema = z.object({
   q: z.string().trim().min(2).max(80),
   /* Where the reader is or is looking, to put the near one first. */
   lat: z.coerce.number().min(-90).max(90).optional(),
   lng: z.coerce.number().min(-180).max(180).optional(),
});

const pointSchema = z.object({
   latitude: z.coerce.number().min(-90).max(90),
   longitude: z.coerce.number().min(-180).max(180),
});

export const placesController = {
   /* A typed name to a short list of places, for the forecast search. */
   async search(req: Request, res: Response) {
      const parsed = searchSchema.safeParse(req.query);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }
      try {
         const near =
            typeof parsed.data.lat === 'number' &&
            typeof parsed.data.lng === 'number'
               ? { latitude: parsed.data.lat, longitude: parsed.data.lng }
               : null;
         const places = await searchPlaces(parsed.data.q, 10, near);
         res.setHeader('Cache-Control', 'public, max-age=600');
         return res.json({ places });
      } catch (error) {
         console.warn('[places] search failed', String(error));
         return res.status(503).json({ places: [], failed: true });
      }
   },

   /* Coordinates to the nearest named place, so a panel can say where it is. */
   async name(req: Request, res: Response) {
      const parsed = pointSchema.safeParse(req.query);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }
      const place = await namePlace(
         parsed.data.latitude,
         parsed.data.longitude
      );
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.json({ place });
   },

   async list(req: Request, res: Response) {
      const parsed = boundsSchema.safeParse(req.query);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }

      const places = await fetchPlaces(clamp(parsed.data));
      if (places === null) {
         /* Say so, so the map keeps what it has rather than clearing it. */
         return res.status(503).json({ places: [], failed: true });
      }
      /* Public data, so let the browser and the CDN keep it for a bit. */
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.json({ places });
   },
};
