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
};

export type PlaceName = { name: string; region: string | null };

export async function fetchForecast(
   latitude: number,
   longitude: number,
   signal?: AbortSignal
): Promise<Forecast | null> {
   const { data } = await axios.get<{ forecast: Forecast | null }>(
      '/api/forecast',
      { params: { latitude, longitude, days: 7 }, signal }
   );
   return data.forecast ?? null;
}

export async function searchPlaces(
   q: string,
   signal?: AbortSignal
): Promise<PlaceHit[]> {
   const { data } = await axios.get<{ places: PlaceHit[] }>(
      '/api/places/search',
      { params: { q }, signal }
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

/* The place's clock right now, in the same form as an hour's `local`. */
export function localHourNow(utcOffsetSeconds: number) {
   const shifted = new Date(Date.now() + utcOffsetSeconds * 1000);
   const pad = (n: number) => String(n).padStart(2, '0');
   return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
      shifted.getUTCDate()
   )}T${pad(shifted.getUTCHours())}:00`;
}
