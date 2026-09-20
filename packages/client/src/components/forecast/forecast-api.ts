import axios from 'axios';

/*
 * The week ahead at a place, and the places themselves.
 *
 * Everything here is public data: the forecast and the names come from
 * Open-Meteo and OpenStreetMap through the server, which adds the User-Agent
 * they ask for and remembers answers so two anglers on one beach cost one call.
 */

export type ForecastHour = {
   /* The place's own clock, e.g. 2026-09-19T06:00. */
   local: string;
   time: string;
   conditionText: string | null;
   weatherCode: number | null;
   temperatureC: number | null;
   feelsLikeC: number | null;
   precipitationProbability: number | null;
   precipitationMm: number | null;
   cape: number | null;
   pressureMsl: number | null;
   cloudCover: number | null;
   visibilityM: number | null;
   windSpeedKph: number | null;
   windGustKph: number | null;
   windDirectionDegrees: number | null;
   windDirectionCardinal: string | null;
   uvIndex: number | null;
   isDaytime: boolean | null;
   seaSurfaceTemperatureC: number | null;
   waveHeightM: number | null;
   wavePeriodS: number | null;
   waveDirectionDegrees: number | null;
   swellHeightM: number | null;
   swellPeriodS: number | null;
   swellDirectionDegrees: number | null;
   /*
    * How high the water stands this hour, in metres against mean sea level.
    * The shape of the tide rather than a tide table: the model runs on an 8 km
    * grid against mean sea level, not chart datum, so the rise and fall are
    * right and the figures would argue with the printed tables. Null inland,
    * and undefined for the few minutes a cached answer of the older shape is
    * still being served, which is why every reader takes it with `?? null`.
    */
   seaLevelM: number | null;
};

export type MoonPhase = {
   fraction: number;
   illumination: number;
   name: string;
   spring: boolean;
};

export type ForecastDay = {
   date: string;
   sunrise: string | null;
   sunset: string | null;
   /*
    * When the moon comes up and goes down, on the place's own clock. A moonset
    * can fall earlier in the day than the moonrise, because the moon that sets
    * at 01:15 rose the evening before, and about once a lunation a date has no
    * rise or no set at all.
    */
   moonrise: string | null;
   moonset: string | null;
   conditionText: string | null;
   weatherCode: number | null;
   temperatureMaxC: number | null;
   temperatureMinC: number | null;
   precipitationSumMm: number | null;
   precipitationProbabilityMax: number | null;
   windMaxKph: number | null;
   windGustMaxKph: number | null;
   windDirectionDominant: number | null;
   uvIndexMax: number | null;
   moon: MoonPhase;
};

/*
 * The rating that rides with a forecast, worked out on the server from the
 * reader's own log, the conditions already fetched and the moon. Null when
 * nobody is signed in, and null when the page had to read Open-Meteo itself
 * because the server was throttled.
 */
export type Band = 'bad' | 'good' | 'great' | 'exceptional';

export type Reason = {
   text: string;
   from: 'log' | 'weather' | 'moon';
   lift: number;
   topic: string;
};

export type RatedHour = {
   /* The place's own clock, matching an hour's `local`. */
   local: string;
   score: number;
   band: Band;
   why: string | null;
};

export type RatedDay = {
   date: string;
   score: number;
   band: Band;
   /* The best three hours of that day, e.g. `05:00` to `07:00`. */
   bestFrom: string | null;
   bestTo: string | null;
   reasons: Reason[];
};

export type ForecastRating = {
   hours: RatedHour[];
   days: RatedDay[];
   basis: {
      catches: number;
      used: number;
      confidence: 'thin' | 'building' | 'solid';
      note: string;
   };
   best: { date: string; from: string | null; to: string | null } | null;
};

export type Forecast = {
   latitude: number;
   longitude: number;
   timezone: string | null;
   utcOffsetSeconds: number;
   issuedAt: string;
   hours: ForecastHour[];
   days: ForecastDay[];
};

export type PlaceHit = {
   id: string;
   name: string;
   region: string | null;
   country: string | null;
   latitude: number;
   longitude: number;
   /* A town, a farm, a winery, a dam: what the place is. */
   kind?: string | null;
};

export type PlaceName = { name: string; region: string | null };

export type ForecastAnswer = {
   forecast: Forecast;
   rating: ForecastRating | null;
};

export async function fetchForecast(
   latitude: number,
   longitude: number,
   signal?: AbortSignal,
   /*
    * Read past the browser's own copy. The answer is served with
    * `max-age=300`, so asking again for the same place inside five minutes
    * never leaves the tab and the page is asked to prove it is current with
    * the very answer that is out of date. A nonce makes it a new address,
    * which is the only lever a browser gives us here; the server keeps its
    * own answer for ten minutes, so this can still come back with the
    * timestamp it had before, and the line under the hours says so.
    */
   fresh?: boolean,
   /* The reasons come back as sentences, so they are written in these. */
   units?: 'METRIC' | 'IMPERIAL'
): Promise<ForecastAnswer | null> {
   /* The server first; the browser itself when the server is throttled. */
   try {
      const { data } = await axios.get<{
         forecast: Forecast | null;
         rating?: ForecastRating | null;
      }>('/api/forecast', {
         params: {
            latitude,
            longitude,
            days: 7,
            ...(units ? { units } : {}),
            ...(fresh ? { t: Date.now() } : {}),
         },
         headers: fresh ? { 'Cache-Control': 'no-cache' } : undefined,
         signal,
      });
      if (data.forecast) {
         return { forecast: data.forecast, rating: data.rating ?? null };
      }
   } catch (error) {
      if (axios.isCancel(error)) throw error;
   }
   /* Read straight off Open-Meteo. No log here, so no rating with it. */
   const { readForecast } = await import('@/lib/open-meteo');
   const forecast = await readForecast(latitude, longitude, 7, signal);
   return forecast ? { forecast, rating: null } : null;
}

export async function searchPlaces(
   q: string,
   signal?: AbortSignal,
   near?: { latitude: number; longitude: number } | null
): Promise<PlaceHit[]> {
   const { data } = await axios.get<{ places: PlaceHit[] }>(
      '/api/places/search',
      {
         params: near
            ? {
                 q,
                 lat: near.latitude.toFixed(4),
                 lng: near.longitude.toFixed(4),
              }
            : { q },
         signal,
      }
   );
   return data.places ?? [];
}

export async function namePlace(
   latitude: number,
   longitude: number,
   signal?: AbortSignal
): Promise<PlaceName | null> {
   const { data } = await axios.get<{ place: PlaceName | null }>(
      '/api/places/name',
      { params: { latitude, longitude }, signal }
   );
   return data.place ?? null;
}

/*
 * Thunder, in a word.
 *
 * No free source publishes lightning strikes. What the model does carry is the
 * convective energy in the air, in joules per kilogram, and the forecasters'
 * rule of thumb is that storms need a few hundred and feed on a thousand. That
 * plus a thunderstorm in the sky reading is the honest version of a lightning
 * forecast.
 */
export function thunderRisk(
   cape: number | null | undefined,
   conditionText: string | null | undefined
): 'storms' | 'likely' | 'possible' | null {
   if (/thunder|storm/i.test(conditionText ?? '')) return 'storms';
   if (typeof cape !== 'number') return null;
   if (cape >= 1000) return 'likely';
   if (cape >= 400) return 'possible';
   return null;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/* The place's clock right now, in the same form as an hour's `local`. The
   moment is a parameter so the page can tick it rather than reading it once
   and keeping that hour until someone reloads. */
export function localHourNow(
   utcOffsetSeconds: number,
   at: number = Date.now()
) {
   const shifted = new Date(at + utcOffsetSeconds * 1000);
   return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(
      shifted.getUTCDate()
   )}T${pad2(shifted.getUTCHours())}:00`;
}

/* Open-Meteo writes its hours with no zone on them and means UTC, e.g.
   `2026-09-19T17:00`. A browser reads a stamp like that as its own clock, so
   printing one straight off the wire says 17:00 in a country where it is
   19:00. Anything that carries a Z or an offset is a real instant already. */
const ZONED = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** The clock at the place, e.g. `19:00`, whatever zone the reader is in. */
export function clockAtPlace(
   value: string | number | Date | null | undefined,
   utcOffsetSeconds: number
): string | null {
   if (value === null || value === undefined) return null;
   const asUtc =
      typeof value === 'string' && DATE_TIME.test(value) && !ZONED.test(value)
         ? `${value}Z`
         : value;
   const date = asUtc instanceof Date ? asUtc : new Date(asUtc);
   if (Number.isNaN(date.getTime())) return null;
   const shifted = new Date(date.getTime() + utcOffsetSeconds * 1000);
   return `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`;
}
