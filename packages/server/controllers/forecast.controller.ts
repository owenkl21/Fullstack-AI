import type { Request, Response } from 'express';
import z from 'zod';
import { getForecast } from '../clients/open-meteo.client';
import { getAuth } from '../lib/auth-context';
import { rateForAngler } from '../services/forecast-rating.service';

const forecastLookupSchema = z.object({
   latitude: z.coerce.number().min(-90).max(90),
   longitude: z.coerce.number().min(-180).max(180),
   days: z.coerce.number().int().min(1).max(7).default(7),
   /*
    * The reader's own units, because the rating answers in sentences and a
    * sentence in the wrong unit is simply wrong. Everything else on this
    * answer stays metric and is converted on the page.
    */
   units: z.enum(['METRIC', 'IMPERIAL']).default('METRIC'),
});

/*
 * Public weather at a public place, so no sign-in: the forecast is the one
 * page an angler might send to a friend who has not made an account yet.
 *
 * The rating that rides with it is not public. It is read off the reader's own
 * log, so the session is looked at without being demanded: a stranger gets the
 * week, and the angler gets the week with his own fish counted into it. The
 * moment a rating is attached the answer stops being shareable cache, which is
 * what the two Cache-Control lines below are about.
 */
export const forecastController = {
   async get(req: Request, res: Response) {
      const parsed = forecastLookupSchema.safeParse(req.query);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }

      const { latitude, longitude, days, units } = parsed.data;
      const forecast = await getForecast(latitude, longitude, days);
      if (!forecast) {
         return res.status(503).json({ forecast: null, failed: true });
      }

      const { userId } = getAuth(req);
      const rating = await rateForAngler(forecast, userId, units);

      res.setHeader(
         'Cache-Control',
         userId ? 'private, max-age=120' : 'public, max-age=300'
      );
      return res.json({ forecast, rating });
   },
};
