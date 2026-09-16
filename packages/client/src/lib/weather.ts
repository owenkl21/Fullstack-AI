const roundToSingleDecimal = (value: number) =>
   Number.isInteger(value) ? value : Number(value.toFixed(1));

export const formatCardinal = (cardinal: string | null | undefined) => {
   if (!cardinal) {
      return '';
   }

   const map: Record<string, string> = {
      NORTH: 'N',
      NORTH_NORTHEAST: 'NNE',
      NORTHEAST: 'NE',
      EAST_NORTHEAST: 'ENE',
      EAST: 'E',
      EAST_SOUTHEAST: 'ESE',
      SOUTHEAST: 'SE',
      SOUTH_SOUTHEAST: 'SSE',
      SOUTH: 'S',
      SOUTH_SOUTHWEST: 'SSW',
      SOUTHWEST: 'SW',
      WEST_SOUTHWEST: 'WSW',
      WEST: 'W',
      WEST_NORTHWEST: 'WNW',
      NORTHWEST: 'NW',
      NORTH_NORTHWEST: 'NNW',
   };

   return map[cardinal] ?? cardinal;
};

export const toMetricTemperature = (
   value: number | null | undefined,
   unit: string | null | undefined
) => {
   if (value === null || value === undefined) {
      return null;
   }

   if (unit === 'FAHRENHEIT') {
      return `${roundToSingleDecimal(((value - 32) * 5) / 9)} °C`;
   }

   return `${roundToSingleDecimal(value)} °C`;
};

export const toMetricWindSpeed = (
   value: number | null | undefined,
   unit: string | null | undefined
) => {
   if (value === null || value === undefined) {
      return null;
   }

   if (unit === 'MILES_PER_HOUR') {
      return `${roundToSingleDecimal(value * 1.60934)} km/h`;
   }

   return `${roundToSingleDecimal(value)} km/h`;
};

/*
 * The conditions snapshot as the write path accepts it. Every field is required,
 * so a snapshot is only ever sent whole or not at all.
 */
export type WeatherSnapshot = {
   weatherCondition: {
      iconBaseUri: string;
      description: { text: string };
   };
   temperature: { degrees: number; unit: string };
   precipitation: { probability: { percent: number } };
   wind: {
      direction: { cardinal: string };
      speed: { value: number; unit: string };
      gust: { value: number; unit: string };
   };
   cloudCover: number;
};

/* The same reading as it comes back on a stored catch, one flat column per value. */
export type StoredConditions = {
   weather?: string | null;
   weatherConditionText?: string | null;
   weatherConditionIconBaseUri?: string | null;
   weatherTemperatureDegrees?: number | null;
   weatherTemperatureUnit?: string | null;
   weatherPrecipitationProbability?: number | null;
   weatherWindDirectionCardinal?: string | null;
   weatherWindSpeedValue?: number | null;
   weatherWindSpeedUnit?: string | null;
   weatherWindGustValue?: number | null;
   weatherWindGustUnit?: string | null;
   weatherCloudCover?: number | null;
};

const isNumber = (value: number | null | undefined): value is number =>
   typeof value === 'number' && Number.isFinite(value);

/*
 * Rebuild the snapshot a stored catch was saved with. Missing readings stay missing:
 * the old editor filled the gaps with zeros and then saved them back as real values,
 * which is how catches ended up reporting 0 °C in a south-easter.
 */
export const snapshotFromStoredConditions = (
   stored: StoredConditions | null | undefined
): WeatherSnapshot | null => {
   if (!stored) {
      return null;
   }

   const text = stored.weatherConditionText?.trim();
   const icon = stored.weatherConditionIconBaseUri?.trim();
   const cardinal = stored.weatherWindDirectionCardinal?.trim();

   if (
      !text ||
      !icon ||
      !cardinal ||
      !isNumber(stored.weatherTemperatureDegrees) ||
      !isNumber(stored.weatherPrecipitationProbability) ||
      !isNumber(stored.weatherWindSpeedValue) ||
      !isNumber(stored.weatherWindGustValue) ||
      !isNumber(stored.weatherCloudCover)
   ) {
      return null;
   }

   return {
      weatherCondition: {
         iconBaseUri: icon,
         description: { text },
      },
      temperature: {
         degrees: stored.weatherTemperatureDegrees,
         unit: stored.weatherTemperatureUnit ?? 'CELSIUS',
      },
      precipitation: {
         probability: { percent: stored.weatherPrecipitationProbability },
      },
      wind: {
         direction: { cardinal },
         speed: {
            value: stored.weatherWindSpeedValue,
            unit: stored.weatherWindSpeedUnit ?? 'KILOMETERS_PER_HOUR',
         },
         gust: {
            value: stored.weatherWindGustValue,
            unit: stored.weatherWindGustUnit ?? 'KILOMETERS_PER_HOUR',
         },
      },
      cloudCover: stored.weatherCloudCover,
   };
};

export type ConditionLine = { label: string; value: string };

const NOT_REPORTED = 'Not reported';

/*
 * The conditions block reads as sentences. A reading that was never taken says so
 * rather than printing a dash or an invented zero.
 */
export const conditionLines = (
   snapshot: WeatherSnapshot | null
): ConditionLine[] => {
   if (!snapshot) {
      return [
         { label: 'Wind', value: NOT_REPORTED },
         { label: 'Air', value: NOT_REPORTED },
         { label: 'Cloud', value: NOT_REPORTED },
         { label: 'Rain', value: NOT_REPORTED },
      ];
   }

   const direction = formatCardinal(snapshot.wind.direction.cardinal);
   const speed = toMetricWindSpeed(
      snapshot.wind.speed.value,
      snapshot.wind.speed.unit
   );
   const gust = toMetricWindSpeed(
      snapshot.wind.gust.value,
      snapshot.wind.gust.unit
   );
   const air = toMetricTemperature(
      snapshot.temperature.degrees,
      snapshot.temperature.unit
   );
   const sky = snapshot.weatherCondition.description.text?.trim();

   return [
      {
         label: 'Wind',
         value:
            speed === null
               ? NOT_REPORTED
               : [direction, speed].filter(Boolean).join(' ') +
                 (gust === null ? '' : `, gusting ${gust}`),
      },
      {
         label: 'Air',
         value: air === null ? NOT_REPORTED : sky ? `${air}, ${sky}` : air,
      },
      {
         label: 'Cloud',
         value: isNumber(snapshot.cloudCover)
            ? `${Math.round(snapshot.cloudCover)}% cover`
            : NOT_REPORTED,
      },
      {
         label: 'Rain',
         value: isNumber(snapshot.precipitation.probability.percent)
            ? `${Math.round(snapshot.precipitation.probability.percent)}% chance`
            : NOT_REPORTED,
      },
   ];
};

/* Required wherever a Google reading is shown. */
export const WEATHER_SOURCE_LINE = 'Weather data by Open-Meteo.com';
