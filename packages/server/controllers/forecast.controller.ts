import type { Request, Response } from 'express';
import z from 'zod';
import { getForecast } from '../clients/open-meteo.client';

const forecastLookupSchema = z.object({
   latitude: z.coerce.number().min(-90).max(90),
   longitude: z.coerce.number().min(-180).max(180),
   days: z.coerce.number().int().min(1).max(7).default(7),
});

/*
 * Public weather at a public place, so no sign-in: the forecast is the one
 * page an angler might send to a friend who has not made an account yet.
 */
export const forecastController = {
   async get(req: Request, res: Response) {
      const parsed = forecastLookupSchema.safeParse(req.query);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }

      const { latitude, longitude, days } = parsed.data;
      const forecast = await getForecast(latitude, longitude, days);
      if (!forecast) {
         return res.status(503).json({ forecast: null, failed: true });
      }

      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.json({ forecast });
   },
};
