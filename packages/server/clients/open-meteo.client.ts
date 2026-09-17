/*
 * Open-Meteo. Keyless, free, and non-commercial by its own terms, which this
 * product is. Replaces the Google Weather API entirely.
 *
 * The important difference is not the price. This reads the hour that brackets
 * the moment a fish was caught, rather than the conditions right now. A fish
 * logged from the car park at 21:00 was caught at 18:40, and 18:40 is what the
 * record should carry.
 *
 * Attribution is a licence condition of the CC BY 4.0 data: "Weather data by
 * Open-Meteo.com" ships in the interface.
 */

import { moonPhase, type MoonPhase } from '../lib/moon';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const HISTORICAL_URL =
   'https://historical-forecast-api.open-meteo.com/v1/forecast';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';

/*
 * past_days is documented up to 92, but measured to return leading nulls at 92
 * while 7, 31 and 60 came back fully populated. Anything older than this goes
 * to the historical-forecast endpoint instead.
 */
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
].join(',');

/* The light. Most shore sessions are planned around one end of it or the other. */
const DAILY_FIELDS = ['sunrise', 'sunset'].join(',');

const MARINE_FIELDS = [
   'sea_surface_temperature',
   'wave_height',
   'swell_wave_height',
   'swell_wave_period',
].join(',');

/* WMO 4677 weather codes, in the words a person would use. */
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

export const toCardinal = (degrees: number | null): string | null => {
   if (degrees === null || !Number.isFinite(degrees)) {
      return null;
   }

   const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
   return CARDINALS[index] ?? null;
};

export type Conditions = {
   /** The hour actually read, which is not the hour asked for. */
   observedAt: string | null;
   timeZoneId: string | null;
   conditionText: string | null;
   temperatureC: number | null;
   feelsLikeC: number | null;
   dewPointC: number | null;
   relativeHumidity: number | null;
   precipitationProbability: number | null;
   pressureMsl: number | null;
   cloudCover: number | null;
   visibilityM: number | null;
   windSpeedKph: number | null;
   windDirectionDegrees: number | null;
   windDirectionCardinal: string | null;
   windGustKph: number | null;
   uvIndex: number | null;
   isDaytime: boolean | null;
   seaSurfaceTemperatureC: number | null;
   waveHeightM: number | null;
   swellHeightM: number | null;
   swellPeriodS: number | null;
   /** Local time of first and last light on the day read. */
   sunrise: string | null;
   sunset: string | null;
   /** Worked out from the date, not fetched. Null only when the date is unusable. */
   moon: MoonPhase | null;
};

const EMPTY: Conditions = {
   sunrise: null,
   sunset: null,
   moon: null,
   observedAt: null,
   timeZoneId: null,
   conditionText: null,
   temperatureC: null,
   feelsLikeC: null,
   dewPointC: null,
   relativeHumidity: null,
   precipitationProbability: null,
   pressureMsl: null,
   cloudCover: null,
   visibilityM: null,
   windSpeedKph: null,
   windDirectionDegrees: null,
   windDirectionCardinal: null,
   windGustKph: null,
   uvIndex: null,
   isDaytime: null,
   seaSurfaceTemperatureC: null,
   waveHeightM: null,
   swellHeightM: null,
   swellPeriodS: null,
};

type HourlyBlock = {
   time?: string[];
   [key: string]: unknown;
};

type MeteoResponse = {
   hourly?: HourlyBlock;
   timezone?: string;
};

type MarineReading = Pick<
   Conditions,
   'seaSurfaceTemperatureC' | 'waveHeightM' | 'swellHeightM' | 'swellPeriodS'
>;

const NO_MARINE: MarineReading = {
   seaSurfaceTemperatureC: null,
   waveHeightM: null,
   swellHeightM: null,
   swellPeriodS: null,
};

/** The local hour Open-Meteo indexes by, e.g. 2026-09-16T18:00. */
const hourKey = (when: Date) =>
   `${when.getUTCFullYear()}-${String(when.getUTCMonth() + 1).padStart(2, '0')}-${String(
      when.getUTCDate()
   ).padStart(2, '0')}T${String(when.getUTCHours()).padStart(2, '0')}:00`;

/*
 * The daily block is one entry per day; a forecast asks for the day in hand.
 *
 * The request is made in UTC on purpose, because the hourly lookup matches the
 * hour a fish was caught by its UTC key. That means Open-Meteo returns a naive
 * "2026-09-16T03:53" which is really UTC, and printing it as written would have
 * told a Durban angler the sun rose at ten to four. Marking it as the instant it
 * actually is lets the screen show it in the reader's own time.
 */
const firstDaily = (weather: MeteoResponse, field: string): string | null => {
   const block = (weather as unknown as Record<string, unknown>).daily as
      | Record<string, unknown>
      | undefined;
   const series = block?.[field];
   const value =
      Array.isArray(series) && typeof series[0] === 'string' ? series[0] : null;
   if (!value) {
      return null;
   }
   return /[Zz]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
};

const readAt = (hourly: HourlyBlock, field: string, index: number) => {
   const series = hourly[field];

   if (!Array.isArray(series)) {
      return null;
   }

   const value = series[index];
   return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const daysAgo = (when: Date) =>
   Math.floor((Date.now() - when.getTime()) / 86_400_000);

/**
 * Conditions at a moment and a place, or a block of nulls.
 *
 * Never throws. A catch is worth more than its weather, so a forecast outage
 * must not stop a fish being logged.
 */
export async function getConditionsAt(
   latitude: number,
   longitude: number,
   when: Date
): Promise<Conditions> {
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

   /*
    * Three cases: the future or the last hour, recent past, and older than the
    * forecast archive carries.
    */
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

   try {
      const [weather, marine] = await Promise.all([
         fetch(url).then((r) =>
            r.ok ? (r.json() as Promise<MeteoResponse>) : null
         ),
         fetchMarine(latitude, longitude, wanted, age).catch(() => NO_MARINE),
      ]);

      if (!weather) {
         return EMPTY;
      }

      const hourly = (weather.hourly ?? {}) as HourlyBlock;
      const times = Array.isArray(hourly.time) ? hourly.time : [];
      const index = times.indexOf(wanted);

      if (index === -1) {
         return { ...EMPTY, timeZoneId: weather.timezone ?? null };
      }

      const code = readAt(hourly, 'weather_code', index);
      const direction = readAt(hourly, 'wind_direction_10m', index);
      const isDay = readAt(hourly, 'is_day', index);

      return {
         observedAt: times[index] ?? null,
         timeZoneId: weather.timezone ?? null,
         conditionText: code === null ? null : (WEATHER_CODES[code] ?? null),
         temperatureC: readAt(hourly, 'temperature_2m', index),
         feelsLikeC: readAt(hourly, 'apparent_temperature', index),
         dewPointC: readAt(hourly, 'dew_point_2m', index),
         relativeHumidity: readAt(hourly, 'relative_humidity_2m', index),
         precipitationProbability: readAt(
            hourly,
            'precipitation_probability',
            index
         ),
         pressureMsl: readAt(hourly, 'pressure_msl', index),
         cloudCover: readAt(hourly, 'cloud_cover', index),
         visibilityM: readAt(hourly, 'visibility', index),
         windSpeedKph: readAt(hourly, 'wind_speed_10m', index),
         windDirectionDegrees: direction,
         windDirectionCardinal: toCardinal(direction),
         windGustKph: readAt(hourly, 'wind_gusts_10m', index),
         uvIndex: readAt(hourly, 'uv_index', index),
         isDaytime: isDay === null ? null : isDay === 1,
         sunrise: firstDaily(weather, 'sunrise'),
         sunset: firstDaily(weather, 'sunset'),
         /*
          * Worked out rather than fetched: no weather API publishes a moon
          * phase, and spring tides run with the new and the full moon, which is
          * what a shore angler plans around.
          */
         moon: moonPhase(when),
         ...marine,
      };
   } catch (error) {
      console.error('[open-meteo] conditions lookup failed', error);
      return EMPTY;
   }
}

/* Sea surface temperature, wave and swell. Coastal only: inland returns nulls. */
async function fetchMarine(
   latitude: number,
   longitude: number,
   wanted: string,
   age: number
): Promise<MarineReading> {
   const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      hourly: MARINE_FIELDS,
      timezone: 'UTC',
   });

   /*
    * The marine endpoint defaults to today onwards. Without this a past catch
    * never finds its hour in the series and the sea reads as null, which looks
    * exactly like an inland spot.
    */
   if (age > 0) {
      const day = wanted.slice(0, 10);
      params.set('start_date', day);
      params.set('end_date', day);
   }

   const response = await fetch(`${MARINE_URL}?${params.toString()}`);

   if (!response.ok) {
      return NO_MARINE;
   }

   const payload = (await response.json()) as MeteoResponse;
   const hourly = payload.hourly ?? {};
   const times = Array.isArray(hourly.time) ? hourly.time : [];
   const index = times.indexOf(wanted);

   if (index === -1) {
      return NO_MARINE;
   }

   return {
      seaSurfaceTemperatureC: readAt(hourly, 'sea_surface_temperature', index),
      waveHeightM: readAt(hourly, 'wave_height', index),
      swellHeightM: readAt(hourly, 'swell_wave_height', index),
      swellPeriodS: readAt(hourly, 'swell_wave_period', index),
   };
}

/*
 * Open-Meteo reading in the shape the client already knows. The interface has a
 * mapping layer built around the old provider's payload, and rebuilding that to
 * change where the numbers come from would be churn for no gain.
 *
 * Returns null rather than filling gaps with zeros: a missing reading is
 * missing, and a zero would read as still air under clear sky.
 */
export const toWeatherSnapshot = (conditions: Conditions) => {
   if (
      conditions.temperatureC === null ||
      conditions.windSpeedKph === null ||
      conditions.cloudCover === null
   ) {
      return null;
   }

   return {
      weatherCondition: {
         iconBaseUri: '',
         description: { text: conditions.conditionText ?? '' },
      },
      temperature: { degrees: conditions.temperatureC, unit: 'CELSIUS' },
      precipitation: {
         probability: { percent: conditions.precipitationProbability ?? 0 },
      },
      wind: {
         direction: { cardinal: conditions.windDirectionCardinal ?? '' },
         speed: {
            value: conditions.windSpeedKph,
            unit: 'KILOMETERS_PER_HOUR',
         },
         gust: {
            value: conditions.windGustKph ?? conditions.windSpeedKph,
            unit: 'KILOMETERS_PER_HOUR',
         },
      },
      cloudCover: conditions.cloudCover,

      /*
       * Everything else the reading carries. The block above keeps the shape
       * the interface was built around; this adds the rest rather than
       * rewriting it. Pressure in particular was being dropped here, which is
       * why the pressure readout on the home page was always blank even though
       * the figure had been fetched.
       *
       * Null where a reading is missing, never zero: nought millibars is not a
       * calm day.
       */
      airPressure: { meanSeaLevelMillibars: conditions.pressureMsl },
      feelsLike: { degrees: conditions.feelsLikeC, unit: 'CELSIUS' },
      dewPoint: { degrees: conditions.dewPointC, unit: 'CELSIUS' },
      relativeHumidity: conditions.relativeHumidity,
      visibilityM: conditions.visibilityM,
      uvIndex: conditions.uvIndex,
      isDaytime: conditions.isDaytime,
      observedAt: conditions.observedAt,
      sun: { rise: conditions.sunrise, set: conditions.sunset },
      moon: conditions.moon,
      sea: {
         surfaceTemperatureC: conditions.seaSurfaceTemperatureC,
         waveHeightM: conditions.waveHeightM,
         swellHeightM: conditions.swellHeightM,
         swellPeriodS: conditions.swellPeriodS,
      },
   };
};
