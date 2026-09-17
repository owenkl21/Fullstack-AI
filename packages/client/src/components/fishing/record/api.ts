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

export type CatchImage = { image: { id: string; url: string } };

export type CatchSummary = {
   id: string;
   title: string;
   caughtAt: string;
   count: number;
   length: number | null;
   weight: number | null;
   site: { id: string; name: string } | null;
   species: { id: string; commonName: string } | null;
   images: CatchImage[];
};

export type CatchDetail = {
   id: string;
   title: string;
   notes: string | null;
   caughtAt: string;
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
   precipitation?: { probability?: { percent?: number } };
   wind?: {
      direction?: { cardinal?: string };
      speed?: { value?: number; unit?: string };
      gust?: { value?: number; unit?: string };
   };
   airPressure?: { meanSeaLevelMillibars?: number };
   relativeHumidity?: number;
   uvIndex?: number;
   cloudCover?: number;
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

export async function fetchConditions(
   latitude: number,
   longitude: number,
   signal?: AbortSignal
) {
   const { data } = await axios.get<{
      weather: WeatherSnapshot | null;
      weatherError?: string;
   }>('/api/weather/current', { params: { latitude, longitude }, signal });
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

   if (
      !condition?.iconBaseUri ||
      !condition.description?.text ||
      typeof temperature?.degrees !== 'number' ||
      !temperature.unit ||
      typeof percent !== 'number' ||
      !wind?.direction?.cardinal ||
      typeof wind.speed?.value !== 'number' ||
      !wind.speed.unit ||
      typeof wind.gust?.value !== 'number' ||
      !wind.gust.unit ||
      typeof snapshot?.cloudCover !== 'number'
   ) {
      return null;
   }

   return {
      weatherCondition: {
         iconBaseUri: condition.iconBaseUri,
         description: { text: condition.description.text },
      },
      temperature: { degrees: temperature.degrees, unit: temperature.unit },
      precipitation: { probability: { percent } },
      wind: {
         direction: { cardinal: wind.direction.cardinal },
         speed: { value: wind.speed.value, unit: wind.speed.unit },
         gust: { value: wind.gust.value, unit: wind.gust.unit },
      },
      cloudCover: snapshot.cloudCover,
   };
}

const numberOrNull = (value: number | undefined) =>
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
      // TODO(api): appendix E, no pressure is stored on a catch, so there is no
      // change to show since the last trip.
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

/** `SW 24 km/h, gusting 38` */
export function describeWind(snapshot: WeatherSnapshot | null) {
   const speed = toMetricWindSpeed(
      snapshot?.wind?.speed?.value,
      snapshot?.wind?.speed?.unit
   );
   if (!speed) {
      return null;
   }
   const cardinal = formatCardinal(snapshot?.wind?.direction?.cardinal);
   const gust = toMetricWindSpeed(
      snapshot?.wind?.gust?.value,
      snapshot?.wind?.gust?.unit
   );
   const head = cardinal ? `${cardinal} ${speed}` : speed;
   return gust ? `${head}, gusting ${gust.replace(' km/h', '')}` : head;
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
