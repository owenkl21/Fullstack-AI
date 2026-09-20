/*
 * The rating that rides along with a forecast.
 *
 * Everything that decides a band lives in `lib/bite-score.ts`, which is pure
 * and knows nothing about this database. This is the join: it reads the
 * angler's own log, hands it to the scorer in the shape the scorer asks for,
 * and keeps the answer for a couple of minutes so that flipping between days
 * on the forecast page does not open the log again every time.
 *
 * Signed out there is no log and no rating, and the page falls back to what it
 * always showed. Signed in the rating is the reader's own and nobody else's,
 * which is why the forecast answer stops being publicly cacheable the moment
 * one is attached.
 */

import { prisma } from '../lib/prisma';
import {
   rateForecast,
   type ForecastRating,
   type LoggedConditions,
   type UnitSystem,
} from '../lib/bite-score';
import type { Forecast } from '../clients/open-meteo.client';

const REMEMBER_MS = 2 * 60 * 1000;

/*
 * A log does not change while somebody reads a forecast, and a week of days
 * clicked through is a week of requests. Kept by user for two minutes, which
 * is shorter than the forecast's own ten and long enough to matter.
 */
const logs = new Map<string, { until: number; value: LoggedConditions[] }>();

/* Degrees were only stored later, so an older catch has the cardinal alone. */
const CARDINAL_DEGREES: Record<string, number> = {
   N: 0,
   NNE: 22.5,
   NE: 45,
   ENE: 67.5,
   E: 90,
   ESE: 112.5,
   SE: 135,
   SSE: 157.5,
   S: 180,
   SSW: 202.5,
   SW: 225,
   WSW: 247.5,
   W: 270,
   WNW: 292.5,
   NW: 315,
   NNW: 337.5,
};

/*
 * Illumination was stored on the catch; phase was stored as a word. Where the
 * figure is missing the word still says roughly how much of the disc was lit,
 * which is enough for a comparison that runs on quantiles.
 */
const PHASE_ILLUMINATION: Record<string, number> = {
   'New moon': 0.02,
   'Waxing crescent': 0.25,
   'First quarter': 0.5,
   'Waxing gibbous': 0.75,
   'Full moon': 0.98,
   'Waning gibbous': 0.75,
   'Last quarter': 0.5,
   'Waning crescent': 0.25,
};

export async function readAnglerLog(
   userId: string
): Promise<LoggedConditions[]> {
   const held = logs.get(userId);
   if (held && held.until > Date.now()) return held.value;

   /*
    * Only the columns the scorer reads, and only this angler's own fish. No
    * images, no gear, no titles: this is a few hundred numbers at most and it
    * should cost about that.
    */
   const rows = await prisma.catch.findMany({
      where: { createdById: userId, deletedAt: null },
      orderBy: { caughtAt: 'desc' },
      take: 500,
      select: {
         caughtAt: true,
         latitude: true,
         longitude: true,
         weatherWindSpeedValue: true,
         weatherWindDirectionDegrees: true,
         weatherWindDirectionCardinal: true,
         weatherAirPressureMeanSeaLevelMillibars: true,
         weatherSeaSurfaceTemperatureC: true,
         weatherSwellHeightM: true,
         weatherSwellPeriodS: true,
         weatherCloudCover: true,
         weatherMoonIllumination: true,
         weatherMoonPhase: true,
         weatherIsDaytime: true,
         species: { select: { commonName: true } },
         site: { select: { latitude: true, longitude: true } },
      },
   });

   const value: LoggedConditions[] = rows.map((row) => ({
      caughtAt: row.caughtAt,
      species: row.species?.commonName ?? null,
      /* Where the fish came out, or failing that where the spot is. */
      latitude: row.latitude ?? row.site?.latitude ?? null,
      longitude: row.longitude ?? row.site?.longitude ?? null,
      windSpeedKph: row.weatherWindSpeedValue,
      windDirectionDegrees:
         row.weatherWindDirectionDegrees ??
         (row.weatherWindDirectionCardinal
            ? (CARDINAL_DEGREES[row.weatherWindDirectionCardinal] ?? null)
            : null),
      pressureMsl: row.weatherAirPressureMeanSeaLevelMillibars,
      seaSurfaceTemperatureC: row.weatherSeaSurfaceTemperatureC,
      swellHeightM: row.weatherSwellHeightM,
      swellPeriodS: row.weatherSwellPeriodS,
      cloudCover: row.weatherCloudCover,
      moonIllumination:
         row.weatherMoonIllumination ??
         (row.weatherMoonPhase
            ? (PHASE_ILLUMINATION[row.weatherMoonPhase] ?? null)
            : null),
      isDaytime: row.weatherIsDaytime,
   }));

   if (logs.size > 200) logs.clear();
   logs.set(userId, { until: Date.now() + REMEMBER_MS, value });
   return value;
}

/**
 * The band, the number and the reasons for a forecast, read for one angler.
 *
 * Never throws and never blocks the forecast: a rating that cannot be worked
 * out is simply absent, and the page draws the week it always drew.
 */
export async function rateForAngler(
   forecast: Forecast,
   userId: string | null,
   units: UnitSystem
): Promise<ForecastRating | null> {
   try {
      const log = userId ? await readAnglerLog(userId) : [];

      return rateForecast({
         latitude: forecast.latitude,
         longitude: forecast.longitude,
         utcOffsetSeconds: forecast.utcOffsetSeconds,
         units,
         hours: forecast.hours,
         days: forecast.days.map((day) => ({
            date: day.date,
            sunrise: day.sunrise,
            sunset: day.sunset,
            moonrise: day.moonrise,
            moonset: day.moonset,
            moonFraction: day.moon.fraction,
         })),
         log,
      });
   } catch (error) {
      console.error('[forecast-rating] could not rate the week', error);
      return null;
   }
}
