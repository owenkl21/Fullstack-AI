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
   /* Millimetres in the hour, next to the chance of any. */
   'precipitation',
   /* Convective energy, in joules per kilogram: the thunder forecast. */
   'cape',
].join(',');

/* The light. Most shore sessions are planned around one end of it or the other. */
const DAILY_FIELDS = ['sunrise', 'sunset'].join(',');

const MARINE_FIELDS = [
   'sea_surface_temperature',
   'wave_height',
   'swell_wave_height',
   'swell_wave_period',
].join(',');

/*
 * One fetch for every endpoint, with the two things a keyless upstream needs:
 * a name in the User-Agent, and a second try. Open-Meteo throttles by address,
 * and a hosted server shares its outbound address with strangers, so a 429 on
 * the first try says nothing about a second one a moment later. The status and
 * the start of the body are logged on the way out, because "no reading" on its
 * own cost an afternoon of guessing.
 */
const UA = 'fisherfeed/1.0 (rock and surf fishing log; non-commercial)';
const TRIES = 3;

async function getJson<T>(url: string, attempt = 1): Promise<T | null> {
   try {
      const response = await fetch(url, { headers: { 'User-Agent': UA } });
      if (response.ok) return (await response.json()) as T;

      const body = (await response.text().catch(() => '')).slice(0, 240);
      const again =
         attempt < TRIES && (response.status === 429 || response.status >= 500);
      console.warn('[open-meteo] upstream answered', {
         status: response.status,
         attempt,
         body,
         endpoint: url.replace(/\?.*$/, ''),
      });
      if (!again) return null;
   } catch (error) {
      console.warn('[open-meteo] request failed', {
         attempt,
         error: String(error),
      });
      if (attempt >= TRIES) return null;
   }

   await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
   return getJson<T>(url, attempt + 1);
}

/*
 * The same hour at the same place is asked for over and over: every visit to
 * the home page reads the conditions here and now, and two anglers on one
 * beach ask the same question. Remembered for ten minutes, keyed on the hour
 * and the place to two decimals (about a kilometre), so the upstream sees one
 * request where it used to see dozens. Only a full reading is kept; an empty
 * one is a failure, and a failure should be retried, not repeated.
 */
const memory = new Map<string, { until: number; value: Conditions }>();
const REMEMBER_MS = 10 * 60 * 1000;

function remembered(key: string): Conditions | null {
   const hit = memory.get(key);
   if (!hit) return null;
   if (hit.until < Date.now()) {
      memory.delete(key);
      return null;
   }
   return hit.value;
}

function remember(key: string, value: Conditions) {
   if (memory.size > 500) memory.clear();
   memory.set(key, { until: Date.now() + REMEMBER_MS, value });
}

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
   precipitationMm: number | null;
   cape: number | null;
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
   precipitationMm: null,
   cape: null,
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

   const key = `${latitude.toFixed(2)}|${longitude.toFixed(2)}|${wanted}`;
   const known = remembered(key);
   if (known) return known;

   try {
      const [weather, marine] = await Promise.all([
         getJson<MeteoResponse>(url),
         fetchMarine(latitude, longitude, wanted, age).catch(() => NO_MARINE),
      ]);

      if (!weather) {
         /*
          * Said out loud. This used to return the empty reading in silence,
          * so a throttled or failing upstream looked exactly like a catch with
          * no conditions, and a whole afternoon of catches was stored with
          * every weather column null before anyone noticed.
          */
         console.warn('[open-meteo] no reading came back', {
            latitude,
            longitude,
            wanted,
         });
         return EMPTY;
      }

      const hourly = (weather.hourly ?? {}) as HourlyBlock;
      const times = Array.isArray(hourly.time) ? hourly.time : [];
      const index = times.indexOf(wanted);
      if (index === -1) {
         console.warn('[open-meteo] hour not in the response', {
            wanted,
            first: times[0],
            last: times[times.length - 1],
            count: times.length,
         });
      }

      if (index === -1) {
         return { ...EMPTY, timeZoneId: weather.timezone ?? null };
      }

      const code = readAt(hourly, 'weather_code', index);
      const direction = readAt(hourly, 'wind_direction_10m', index);
      const isDay = readAt(hourly, 'is_day', index);

      const reading: Conditions = {
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
         precipitationMm: readAt(hourly, 'precipitation', index),
         cape: readAt(hourly, 'cape', index),
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

      remember(key, reading);
      return reading;
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

   const payload = await getJson<MeteoResponse>(
      `${MARINE_URL}?${params.toString()}`
   );

   if (!payload) {
      return NO_MARINE;
   }

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
         amountMm: conditions.precipitationMm,
      },
      /* Convective energy. Over about 400 J/kg thunder is on the cards. */
      thunder: { cape: conditions.cape },
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

/*
 * The week ahead at one place, hour by hour.
 *
 * Asked in the place's own time zone rather than UTC: a forecast is read as
 * "Saturday morning", and Saturday has to begin at local midnight for that to
 * mean anything. Each hour carries both its local label and the real instant,
 * so the screen can print "06:00" and still know which moment that is.
 *
 * Sea state comes from the marine model in the same zone and is joined on the
 * hour. Inland it is simply absent.
 */
export type ForecastHour = {
   /* The place's own clock, e.g. 2026-09-19T06:00. */
   local: string;
   /* The same moment as an instant with its offset. */
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
    * It is the shape of the tide, not a tide table: the model runs on an 8 km
    * grid and is referenced to mean sea level rather than chart datum, so the
    * rise and fall are right and the figures would argue with the printed
    * tables. Null inland, where the marine model has nothing.
    */
   seaLevelM: number | null;
};

export type ForecastDay = {
   /* 2026-09-19 */
   date: string;
   sunrise: string | null;
   sunset: string | null;
   /*
    * When the moon comes up and goes down, on the place's own clock. A moonset
    * can fall earlier in the day than the moonrise, because the moon that sets
    * at 01:15 rose the evening before, and about once a lunation a date has no
    * rise or no set at all, which is null rather than a guess.
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

export type Forecast = {
   latitude: number;
   longitude: number;
   timezone: string | null;
   utcOffsetSeconds: number;
   /* When this was fetched from the model, as an instant. */
   issuedAt: string;
   hours: ForecastHour[];
   days: ForecastDay[];
};

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

type Block = Record<string, unknown>;

type ForecastResponse = {
   timezone?: string;
   utc_offset_seconds?: number;
   hourly?: Block;
   daily?: Block;
};

const column = <T>(block: Block | undefined, field: string): (T | null)[] =>
   Array.isArray(block?.[field]) ? (block[field] as (T | null)[]) : [];

const num = (value: unknown): number | null =>
   typeof value === 'number' && Number.isFinite(value) ? value : null;

const offsetSuffix = (seconds: number) => {
   const sign = seconds < 0 ? '-' : '+';
   const abs = Math.abs(seconds);
   const h = String(Math.floor(abs / 3600)).padStart(2, '0');
   const m = String(Math.floor((abs % 3600) / 60)).padStart(2, '0');
   return `${sign}${h}:${m}`;
};

const forecasts = new Map<string, { until: number; value: Forecast }>();

export async function getForecast(
   latitude: number,
   longitude: number,
   days = 7
): Promise<Forecast | null> {
   const key = `${latitude.toFixed(2)}|${longitude.toFixed(2)}|${days}`;
   const hit = forecasts.get(key);
   if (hit && hit.until > Date.now()) return hit.value;

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
      getJson<ForecastResponse>(`${FORECAST_URL}?${weatherParams}`),
      getJson<ForecastResponse>(`${MARINE_URL}?${marineParams}`),
   ]);
   if (!weather) return null;

   const suffix = offsetSuffix(weather.utc_offset_seconds ?? 0);
   const hourly = weather.hourly ?? {};
   const daily = weather.daily ?? {};
   const sea = marine?.hourly ?? {};
   const seaAt = new Map(
      column<string>(sea, 'time').map((t, i) => [t ?? '', i] as const)
   );

   const at = (block: Block, field: string, index: number | undefined) =>
      index === undefined ? null : num(column(block, field)[index]);

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
               /* The moon at local noon, which is the day's phase for a calendar. */
               moon: moonPhase(new Date(`${date}T12:00${suffix}`)),
            },
         ];
      }
   );

   const value: Forecast = {
      latitude,
      longitude,
      timezone: weather.timezone ?? null,
      utcOffsetSeconds: weather.utc_offset_seconds ?? 0,
      issuedAt: new Date().toISOString(),
      hours,
      days: forecastDays,
   };

   if (forecasts.size > 300) forecasts.clear();
   forecasts.set(key, { until: Date.now() + REMEMBER_MS, value });
   return value;
}
