import axios from 'axios';
import {
   formatCardinal,
   toMetricTemperature,
   toMetricWindSpeed,
} from '@/lib/weather';

/*
 * The catch and conditions endpoints as the three catch surfaces read them, with
 * the display sentences the conditions turn into. These belong in src/lib once
 * that directory is free.
 */

export type CatchImage = {
   image: {
      id: string;
      url: string;
      /* How the angler framed it (lib/framing.ts); all null when they never did. */
      focusX?: number | null;
      focusY?: number | null;
      zoom?: number | null;
   };
};

export type CatchSummary = {
   id: string;
   title: string;
   caughtAt: string;
   /* The last fish of a log with several, where the photographs gave a time. */
   caughtUntil?: string | null;
   count: number;
   length: number | null;
   weight: number | null;
   released?: boolean;
   /* The conditions on the record, for counting on the insights page. */
   weatherConditionText?: string | null;
   weatherWindDirectionCardinal?: string | null;
   weatherWindSpeedValue?: number | null;
   weatherAirPressureMeanSeaLevelMillibars?: number | null;
   weatherSeaSurfaceTemperatureC?: number | null;
   weatherSwellHeightM?: number | null;
   weatherMoonPhase?: string | null;
   weatherMoonSpringTide?: boolean | null;
   weatherIsDaytime?: boolean | null;
   waterTemp?: number | null;
   site: {
      id: string;
      name: string;
      latitude?: number | null;
      longitude?: number | null;
   } | null;
   species: { id: string; commonName: string } | null;
   gears?: { id: string; name: string; type: string }[];
   images: CatchImage[];
};

export type CatchDetail = {
   id: string;
   title: string;
   notes: string | null;
   /* The catch's own pin, where it had one; null when only the spot is known. */
   latitude?: number | null;
   longitude?: number | null;
   visibility?: 'PRIVATE' | 'GROUPS' | 'PUBLIC';
   hideLocation?: boolean;
   caughtAt: string;
   caughtUntil?: string | null;
   weather: string | null;
   weatherConditionText: string | null;
   weatherTemperatureDegrees: number | null;
   weatherTemperatureUnit: string | null;
   weatherPrecipitationProbability: number | null;
   weatherWindDirectionCardinal: string | null;
   weatherWindSpeedValue: number | null;
   weatherWindSpeedUnit: string | null;
   weatherWindGustValue: number | null;
   weatherWindGustUnit: string | null;
   weatherCloudCover: number | null;
   weatherRelativeHumidity: number | null;
   weatherUvIndex: number | null;
   depth: number | null;
   waterTemp: number | null;
   count: number;
   length: number | null;
   weight: number | null;
   createdBy: {
      id: string;
      displayName: string | null;
      username: string | null;
   } | null;
   site: {
      id: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
   } | null;
   species: { commonName: string; scientificName?: string | null } | null;
   gears: {
      id: string;
      name: string;
      brand: string;
      type: string;
      imageUrl: string | null;
   }[];
   images: CatchImage[];
};

/** What the conditions lookup returns. Every branch is optional: the sky is not a contract. */
export type WeatherSnapshot = {
   weatherCondition?: {
      iconBaseUri?: string;
      description?: { text?: string };
   };
   temperature?: { degrees?: number; unit?: string };
   feelsLikeTemperature?: { degrees?: number; unit?: string };
   precipitation?: {
      probability?: { percent?: number };
      /* Millimetres in the hour. */
      amountMm?: number | null;
   };
   /* Convective energy, J/kg. The nearest thing to a lightning forecast. */
   thunder?: { cape?: number | null };
   wind?: {
      direction?: { cardinal?: string; degrees?: number | null };
      speed?: { value?: number; unit?: string };
      gust?: { value?: number; unit?: string };
   };
   airPressure?: { meanSeaLevelMillibars?: number | null };
   relativeHumidity?: number | null;
   uvIndex?: number | null;
   cloudCover?: number | null;
   feelsLike?: { degrees?: number | null; unit?: string };
   dewPoint?: { degrees?: number | null; unit?: string };
   visibilityM?: number | null;
   isDaytime?: boolean | null;
   observedAt?: string | null;
   /** First and last light, as instants. Render them in the reader's own zone. */
   sun?: { rise?: string | null; set?: string | null };
   /** Worked out from the date rather than fetched. */
   moon?: {
      fraction: number;
      illumination: number;
      name: string;
      spring: boolean;
   } | null;
   sea?: {
      surfaceTemperatureC?: number | null;
      waveHeightM?: number | null;
      swellHeightM?: number | null;
      swellPeriodS?: number | null;
   };
};

export async function fetchMyCatches(signal?: AbortSignal) {
   const { data } = await axios.get<{ catches: CatchSummary[] }>(
      '/api/catches/me',
      {
         signal,
      }
   );
   return data.catches ?? [];
}

export async function fetchCatch(catchId: string, signal?: AbortSignal) {
   const { data } = await axios.get<{ catch: CatchDetail }>(
      `/api/catches/${catchId}`,
      {
         signal,
      }
   );
   return data.catch;
}

/**
 * The conditions at a place, at a moment.
 *
 * `at` is the hour the fish was caught. Left out, it means now, which is right
 * for the home page and wrong for a catch logged that evening from the couch:
 * that one wants the weather it was actually caught in.
 */
export async function fetchConditions(
   latitude: number,
   longitude: number,
   signal?: AbortSignal,
   at?: Date | null
) {
   /*
    * The server first, for its shared memory of the hour. When it has no
    * reading, which on a bad minute means Open-Meteo throttled the address
    * the server shares, the page reads Open-Meteo itself from its own.
    */
   let data: { weather: WeatherSnapshot | null; weatherError?: string };
   try {
      ({ data } = await axios.get<typeof data>('/api/weather/current', {
         params: {
            latitude,
            longitude,
            ...(at ? { at: at.toISOString() } : {}),
         },
         signal,
      }));
   } catch (error) {
      if (axios.isCancel(error)) throw error;
      data = { weather: null };
   }
   if (!data.weather) {
      const { readConditions } = await import('@/lib/open-meteo');
      return readConditions(latitude, longitude, at ?? new Date(), signal);
   }
   return data.weather ?? null;
}

/**
 * The catch endpoint only accepts a snapshot with every branch present, so a
 * partial reading is sent as no snapshot rather than failing the whole save.
 */
export function toSavableSnapshot(snapshot: WeatherSnapshot | null) {
   const condition = snapshot?.weatherCondition;
   const temperature = snapshot?.temperature;
   const wind = snapshot?.wind;
   const percent = snapshot?.precipitation?.probability?.percent;

   /*
    * Open-Meteo sends no icon and no probability for some hours; a reading
    * missing those is still a reading. What must be there is the sky, the
    * air and the wind. The rest defaults rather than sinking the snapshot.
    */
   if (
      !snapshot ||
      !condition?.description?.text ||
      typeof temperature?.degrees !== 'number' ||
      !temperature.unit ||
      typeof wind?.speed?.value !== 'number' ||
      !wind.speed.unit
   ) {
      return null;
   }
   const gust = wind.gust ?? wind.speed;
   const cardinal = wind.direction?.cardinal || 'N';
   const chance = typeof percent === 'number' ? percent : 0;
   const cloud =
      typeof snapshot?.cloudCover === 'number' ? snapshot.cloudCover : 0;

   return {
      weatherCondition: {
         iconBaseUri: condition.iconBaseUri ?? '',
         description: { text: condition.description.text },
      },
      temperature: { degrees: temperature.degrees, unit: temperature.unit },
      precipitation: {
         probability: { percent: chance },
         amountMm: snapshot.precipitation?.amountMm ?? null,
      },
      wind: {
         direction: {
            cardinal,
            degrees: wind.direction?.degrees ?? null,
         },
         speed: { value: wind.speed.value, unit: wind.speed.unit },
         gust: {
            value: gust.value ?? wind.speed.value,
            unit: gust.unit ?? wind.speed.unit,
         },
      },
      cloudCover: cloud,
      /*
       * The rest of the reading, so a save made while the server cannot reach
       * Open-Meteo still stores the sea, the moon and the pressure. The
       * server reads for itself first and uses this only when that fails.
       */
      thunder: { cape: snapshot.thunder?.cape ?? null },
      airPressure: {
         meanSeaLevelMillibars:
            snapshot.airPressure?.meanSeaLevelMillibars ?? null,
      },
      feelsLike: { degrees: snapshot.feelsLike?.degrees ?? null },
      dewPoint: { degrees: snapshot.dewPoint?.degrees ?? null },
      relativeHumidity: snapshot.relativeHumidity ?? null,
      visibilityM: snapshot.visibilityM ?? null,
      uvIndex: snapshot.uvIndex ?? null,
      isDaytime: snapshot.isDaytime ?? null,
      observedAt: snapshot.observedAt ?? null,
      sun: { rise: snapshot.sun?.rise ?? null, set: snapshot.sun?.set ?? null },
      moon: snapshot.moon ?? null,
      sea: {
         surfaceTemperatureC: snapshot.sea?.surfaceTemperatureC ?? null,
         waveHeightM: snapshot.sea?.waveHeightM ?? null,
         swellHeightM: snapshot.sea?.swellHeightM ?? null,
         swellPeriodS: snapshot.sea?.swellPeriodS ?? null,
      },
   };
}

/* A reading can be absent either way: the field missing, or present and null. */
const numberOrNull = (value: number | null | undefined) =>
   typeof value === 'number' && Number.isFinite(value) ? value : null;

export function toKilometresPerHour(value?: number, unit?: string) {
   const raw = numberOrNull(value);
   if (raw === null) {
      return null;
   }
   return unit === 'MILES_PER_HOUR' ? raw * 1.60934 : raw;
}

export function toCelsius(value?: number, unit?: string) {
   const raw = numberOrNull(value);
   if (raw === null) {
      return null;
   }
   return unit === 'FAHRENHEIT' ? ((raw - 32) * 5) / 9 : raw;
}

/** The three numbers the home screen reads out, with the sentence under each. */
export function toReadouts(snapshot: WeatherSnapshot | null) {
   const cardinal = formatCardinal(snapshot?.wind?.direction?.cardinal);
   const gust = toKilometresPerHour(
      snapshot?.wind?.gust?.value,
      snapshot?.wind?.gust?.unit
   );
   const sky = snapshot?.weatherCondition?.description?.text ?? null;

   return {
      wind: {
         value: toKilometresPerHour(
            snapshot?.wind?.speed?.value,
            snapshot?.wind?.speed?.unit
         ),
         unit: 'km/h',
         note:
            cardinal && gust !== null
               ? `${cardinal}, gusting ${Math.round(gust)}`
               : (cardinal ??
                 (gust !== null ? `Gusting ${Math.round(gust)}` : null)),
      },
      pressure: {
         value: numberOrNull(snapshot?.airPressure?.meanSeaLevelMillibars),
         unit: 'hPa',
         note: null as string | null,
      },
      air: {
         value: toCelsius(
            snapshot?.temperature?.degrees,
            snapshot?.temperature?.unit
         ),
         unit: '°C',
         note: sky,
      },
   };
}

/*
 * Whole kilometres an hour. The forecast hands back a tenth the anemometer
 * never measured, and `SE 35.5 km/h, gusting 69.1` reads as a precision the
 * reading does not have.
 */
const wholeWindSpeed = (
   value: number | null | undefined,
   unit: string | null | undefined
) => {
   const metric = toMetricWindSpeed(value, unit);
   if (!metric) {
      return null;
   }
   const figure = Number.parseFloat(metric);
   return Number.isFinite(figure) ? String(Math.round(figure)) : null;
};

/** `SW 24 km/h, gusting 38` */
export function describeWind(snapshot: WeatherSnapshot | null) {
   const speed = wholeWindSpeed(
      snapshot?.wind?.speed?.value,
      snapshot?.wind?.speed?.unit
   );
   if (!speed) {
      return null;
   }
   const cardinal = formatCardinal(snapshot?.wind?.direction?.cardinal);
   const gust = wholeWindSpeed(
      snapshot?.wind?.gust?.value,
      snapshot?.wind?.gust?.unit
   );
   const head = cardinal ? `${cardinal} ${speed} km/h` : `${speed} km/h`;
   return gust ? `${head}, gusting ${gust}` : head;
}

/** `1013 hPa` */
export function describePressure(snapshot: WeatherSnapshot | null) {
   const millibars = snapshot?.airPressure?.meanSeaLevelMillibars;
   return typeof millibars === 'number' ? `${Math.round(millibars)} hPa` : null;
}

/** `11 °C, clear` */
export function describeAir(snapshot: WeatherSnapshot | null) {
   const temperature = toMetricTemperature(
      snapshot?.temperature?.degrees,
      snapshot?.temperature?.unit
   );
   const text = snapshot?.weatherCondition?.description?.text;
   if (!temperature) {
      return text ?? null;
   }
   return text ? `${temperature}, ${text.toLowerCase()}` : temperature;
}
