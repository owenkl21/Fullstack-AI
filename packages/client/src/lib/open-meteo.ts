import { moonPhase } from './moon';
import type { WeatherSnapshot } from '@/components/fishing/record/api';
import type {
   Forecast,
   ForecastDay,
   ForecastHour,
} from '@/components/forecast/forecast-api';

/*
 * Open-Meteo, read from the browser.
 *
 * The server reads the same endpoints and is the first thing asked, because
 * it remembers an hour for ten minutes and one call serves everyone on the
 * beach. But the server lives on a hosted address it shares with strangers,
 * and Open-Meteo counts requests by address: on a bad minute the answer is a
 * 429 for every angler at once, and the panel went blank while the sky was
 * perfectly readable. A phone has an address of its own. So when the server
 * cannot answer, the page asks Open-Meteo itself, and the catch it saves
 * carries the reading it got.
 *
 * This is a port of the server's client, kept in the same order so a change
 * in one can be walked into the other. Attribution ("Weather data by
 * Open-Meteo.com") is a licence condition and ships in the interface.
 */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const HISTORICAL_URL =
   'https://historical-forecast-api.open-meteo.com/v1/forecast';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';

const MAX_PAST_DAYS = 60;

const HOURLY_FIELDS = [
   'temperature_2m',
   'relative_humidity_2m',
   'dew_point_2m',
   'apparent_temperature',
   'precipitation_probability',
   'weather_code',
   'pressure_msl',
   'cloud_cover',
   'visibility',
   'wind_speed_10m',
   'wind_direction_10m',
   'wind_gusts_10m',
   'uv_index',
   'is_day',
   'precipitation',
   'cape',
].join(',');

const DAILY_FIELDS = ['sunrise', 'sunset'].join(',');

const MARINE_FIELDS = [
   'sea_surface_temperature',
   'wave_height',
   'swell_wave_height',
   'swell_wave_period',
].join(',');

const WEATHER_CODES: Record<number, string> = {
   0: 'Clear',
   1: 'Mainly clear',
   2: 'Partly cloudy',
   3: 'Overcast',
   45: 'Fog',
   48: 'Freezing fog',
   51: 'Light drizzle',
   53: 'Drizzle',
   55: 'Heavy drizzle',
   56: 'Light freezing drizzle',
   57: 'Freezing drizzle',
   61: 'Light rain',
   63: 'Rain',
   65: 'Heavy rain',
   66: 'Light freezing rain',
   67: 'Freezing rain',
   71: 'Light snow',
   73: 'Snow',
   75: 'Heavy snow',
   77: 'Snow grains',
   80: 'Light showers',
   81: 'Showers',
   82: 'Violent showers',
   85: 'Light snow showers',
   86: 'Snow showers',
   95: 'Thunderstorm',
   96: 'Thunderstorm with hail',
   99: 'Thunderstorm with heavy hail',
};

const CARDINALS = [
   'N',
   'NNE',
   'NE',
   'ENE',
   'E',
   'ESE',
   'SE',
   'SSE',
   'S',
   'SSW',
   'SW',
   'WSW',
   'W',
   'WNW',
   'NW',
   'NNW',
];

const toCardinal = (degrees: number | null): string | null => {
   if (degrees === null || !Number.isFinite(degrees)) return null;
   const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
   return CARDINALS[index] ?? null;
};

type Block = Record<string, unknown>;

type MeteoResponse = {
   timezone?: string;
   utc_offset_seconds?: number;
   hourly?: Block;
   daily?: Block;
};

const column = <T>(block: Block | undefined, field: string): (T | null)[] =>
   Array.isArray(block?.[field]) ? (block[field] as (T | null)[]) : [];

const num = (value: unknown): number | null =>
   typeof value === 'number' && Number.isFinite(value) ? value : null;

const at = (block: Block, field: string, index: number | undefined) =>
   index === undefined ? null : num(column(block, field)[index]);

/** The UTC hour Open-Meteo indexes by, e.g. 2026-09-16T18:00. */
const hourKey = (when: Date) => {
   const pad = (n: number) => String(n).padStart(2, '0');
   return `${when.getUTCFullYear()}-${pad(when.getUTCMonth() + 1)}-${pad(
      when.getUTCDate()
   )}T${pad(when.getUTCHours())}:00`;
};

const daysAgo = (when: Date) =>
   Math.max(0, Math.floor((Date.now() - when.getTime()) / 86400000));

/* A naive UTC daily value, marked as the instant it is. */
const stampUtc = (value: unknown) =>
   typeof value === 'string' && value
      ? /[Zz]|[+-]\d{2}:\d{2}$/.test(value)
         ? value
         : `${value}Z`
      : null;

async function getJson<T>(
   url: string,
   signal?: AbortSignal
): Promise<T | null> {
   try {
      const response = await fetch(url, { signal });
      if (!response.ok) return null;
      return (await response.json()) as T;
   } catch {
      return null;
   }
}

/**
 * The conditions at a place, at an hour, in the shape the interface reads.
 * Null when Open-Meteo cannot be reached from here either.
 */
export async function readConditions(
   latitude: number,
   longitude: number,
   when: Date,
   signal?: AbortSignal
): Promise<WeatherSnapshot | null> {
   const age = daysAgo(when);
   const wanted = hourKey(when);

   const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      hourly: HOURLY_FIELDS,
      daily: DAILY_FIELDS,
      timezone: 'UTC',
      wind_speed_unit: 'kmh',
   });

   let url: string;
   if (age > MAX_PAST_DAYS) {
      const day = wanted.slice(0, 10);
      params.set('start_date', day);
      params.set('end_date', day);
      url = `${HISTORICAL_URL}?${params.toString()}`;
   } else {
      params.set(
         'past_days',
         String(Math.min(Math.max(age + 1, 1), MAX_PAST_DAYS))
      );
      params.set('forecast_days', '2');
      url = `${FORECAST_URL}?${params.toString()}`;
   }

   const marineParams = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      hourly: MARINE_FIELDS,
      timezone: 'UTC',
   });
   if (age > 0) {
      const day = wanted.slice(0, 10);
      marineParams.set('start_date', day);
      marineParams.set('end_date', day);
   }

   const [weather, marine] = await Promise.all([
      getJson<MeteoResponse>(url, signal),
      getJson<MeteoResponse>(`${MARINE_URL}?${marineParams}`, signal),
   ]);
   if (!weather) return null;

   const hourly = weather.hourly ?? {};
   const index = column<string>(hourly, 'time').indexOf(wanted);
   if (index === -1) return null;

   const sea = marine?.hourly ?? {};
   const seaIndex = column<string>(sea, 'time').indexOf(wanted);
   const j = seaIndex === -1 ? undefined : seaIndex;

   const code = at(hourly, 'weather_code', index);
   const direction = at(hourly, 'wind_direction_10m', index);
   const isDay = at(hourly, 'is_day', index);
   const temperature = at(hourly, 'temperature_2m', index);
   const wind = at(hourly, 'wind_speed_10m', index);
   const cloud = at(hourly, 'cloud_cover', index);

   /* The same rule as the server: no reading without the three that matter. */
   if (temperature === null || wind === null || cloud === null) return null;

   return {
      weatherCondition: {
         iconBaseUri: '',
         description: {
            text: code === null ? '' : (WEATHER_CODES[code] ?? ''),
         },
      },
      temperature: { degrees: temperature, unit: 'CELSIUS' },
      precipitation: {
         probability: {
            percent: at(hourly, 'precipitation_probability', index) ?? 0,
         },
         amountMm: at(hourly, 'precipitation', index),
      },
      thunder: { cape: at(hourly, 'cape', index) },
      wind: {
         direction: {
            cardinal: toCardinal(direction) ?? '',
            degrees: direction,
         },
         speed: { value: wind, unit: 'KILOMETERS_PER_HOUR' },
         gust: {
            value: at(hourly, 'wind_gusts_10m', index) ?? wind,
            unit: 'KILOMETERS_PER_HOUR',
         },
      },
      cloudCover: cloud,
      airPressure: { meanSeaLevelMillibars: at(hourly, 'pressure_msl', index) },
      feelsLike: {
         degrees: at(hourly, 'apparent_temperature', index),
         unit: 'CELSIUS',
      },
      dewPoint: { degrees: at(hourly, 'dew_point_2m', index), unit: 'CELSIUS' },
      relativeHumidity: at(hourly, 'relative_humidity_2m', index),
      visibilityM: at(hourly, 'visibility', index),
      uvIndex: at(hourly, 'uv_index', index),
      isDaytime: isDay === null ? null : isDay === 1,
      observedAt: wanted,
      sun: {
         rise: stampUtc(column(weather.daily, 'sunrise')[0]),
         set: stampUtc(column(weather.daily, 'sunset')[0]),
      },
      moon: moonPhase(when),
      sea: {
         surfaceTemperatureC: at(sea, 'sea_surface_temperature', j),
         waveHeightM: at(sea, 'wave_height', j),
         swellHeightM: at(sea, 'swell_wave_height', j),
         swellPeriodS: at(sea, 'swell_wave_period', j),
      },
   };
}

const FORECAST_HOURLY = [
   'temperature_2m',
   'apparent_temperature',
   'precipitation_probability',
   'precipitation',
   'weather_code',
   'pressure_msl',
   'cloud_cover',
   'visibility',
   'wind_speed_10m',
   'wind_direction_10m',
   'wind_gusts_10m',
   'uv_index',
   'is_day',
   'cape',
].join(',');

const FORECAST_DAILY = [
   'sunrise',
   'sunset',
   'weather_code',
   'temperature_2m_max',
   'temperature_2m_min',
   'precipitation_sum',
   'precipitation_probability_max',
   'wind_speed_10m_max',
   'wind_gusts_10m_max',
   'wind_direction_10m_dominant',
   'uv_index_max',
   'moonrise',
   'moonset',
].join(',');

const FORECAST_MARINE = [
   'sea_surface_temperature',
   'wave_height',
   'wave_period',
   'wave_direction',
   'swell_wave_height',
   'swell_wave_period',
   'swell_wave_direction',
   'sea_level_height_msl',
].join(',');

const offsetSuffix = (seconds: number) => {
   const sign = seconds < 0 ? '-' : '+';
   const abs = Math.abs(seconds);
   const h = String(Math.floor(abs / 3600)).padStart(2, '0');
   const m = String(Math.floor((abs % 3600) / 60)).padStart(2, '0');
   return `${sign}${h}:${m}`;
};

/** The week ahead at a place, in the place's own time. */
export async function readForecast(
   latitude: number,
   longitude: number,
   days = 7,
   signal?: AbortSignal
): Promise<Forecast | null> {
   const common = {
      latitude: String(latitude),
      longitude: String(longitude),
      timezone: 'auto',
      forecast_days: String(days),
   };
   const weatherParams = new URLSearchParams({
      ...common,
      hourly: FORECAST_HOURLY,
      daily: FORECAST_DAILY,
      wind_speed_unit: 'kmh',
   });
   const marineParams = new URLSearchParams({
      ...common,
      hourly: FORECAST_MARINE,
   });

   const [weather, marine] = await Promise.all([
      getJson<MeteoResponse>(`${FORECAST_URL}?${weatherParams}`, signal),
      getJson<MeteoResponse>(`${MARINE_URL}?${marineParams}`, signal),
   ]);
   if (!weather) return null;

   const suffix = offsetSuffix(weather.utc_offset_seconds ?? 0);
   const hourly = weather.hourly ?? {};
   const daily = weather.daily ?? {};
   const sea = marine?.hourly ?? {};
   const seaAt = new Map(
      column<string>(sea, 'time').map((t, i) => [t ?? '', i] as const)
   );

   const hours: ForecastHour[] = column<string>(hourly, 'time').flatMap(
      (local, i) => {
         if (!local) return [];
         const j = seaAt.get(local);
         const code = at(hourly, 'weather_code', i);
         const direction = at(hourly, 'wind_direction_10m', i);
         const isDay = at(hourly, 'is_day', i);
         return [
            {
               local,
               time: `${local}${suffix}`,
               conditionText:
                  code === null ? null : (WEATHER_CODES[code] ?? null),
               weatherCode: code,
               temperatureC: at(hourly, 'temperature_2m', i),
               feelsLikeC: at(hourly, 'apparent_temperature', i),
               precipitationProbability: at(
                  hourly,
                  'precipitation_probability',
                  i
               ),
               precipitationMm: at(hourly, 'precipitation', i),
               cape: at(hourly, 'cape', i),
               pressureMsl: at(hourly, 'pressure_msl', i),
               cloudCover: at(hourly, 'cloud_cover', i),
               visibilityM: at(hourly, 'visibility', i),
               windSpeedKph: at(hourly, 'wind_speed_10m', i),
               windGustKph: at(hourly, 'wind_gusts_10m', i),
               windDirectionDegrees: direction,
               windDirectionCardinal: toCardinal(direction),
               uvIndex: at(hourly, 'uv_index', i),
               isDaytime: isDay === null ? null : isDay === 1,
               seaSurfaceTemperatureC: at(sea, 'sea_surface_temperature', j),
               waveHeightM: at(sea, 'wave_height', j),
               wavePeriodS: at(sea, 'wave_period', j),
               waveDirectionDegrees: at(sea, 'wave_direction', j),
               swellHeightM: at(sea, 'swell_wave_height', j),
               swellPeriodS: at(sea, 'swell_wave_period', j),
               swellDirectionDegrees: at(sea, 'swell_wave_direction', j),
               seaLevelM: at(sea, 'sea_level_height_msl', j),
            },
         ];
      }
   );

   const stamp = (value: unknown) =>
      typeof value === 'string' && value ? `${value}${suffix}` : null;

   const forecastDays: ForecastDay[] = column<string>(daily, 'time').flatMap(
      (date, i) => {
         if (!date) return [];
         const code = at(daily, 'weather_code', i);
         return [
            {
               date,
               sunrise: stamp(column(daily, 'sunrise')[i]),
               sunset: stamp(column(daily, 'sunset')[i]),
               moonrise: stamp(column(daily, 'moonrise')[i]),
               moonset: stamp(column(daily, 'moonset')[i]),
               conditionText:
                  code === null ? null : (WEATHER_CODES[code] ?? null),
               weatherCode: code,
               temperatureMaxC: at(daily, 'temperature_2m_max', i),
               temperatureMinC: at(daily, 'temperature_2m_min', i),
               precipitationSumMm: at(daily, 'precipitation_sum', i),
               precipitationProbabilityMax: at(
                  daily,
                  'precipitation_probability_max',
                  i
               ),
               windMaxKph: at(daily, 'wind_speed_10m_max', i),
               windGustMaxKph: at(daily, 'wind_gusts_10m_max', i),
               windDirectionDominant: at(
                  daily,
                  'wind_direction_10m_dominant',
                  i
               ),
               uvIndexMax: at(daily, 'uv_index_max', i),
               moon: moonPhase(new Date(`${date}T12:00${suffix}`)),
            },
         ];
      }
   );

   return {
      latitude,
      longitude,
      timezone: weather.timezone ?? null,
      utcOffsetSeconds: weather.utc_offset_seconds ?? 0,
      issuedAt: new Date().toISOString(),
      hours,
      days: forecastDays,
   };
}
