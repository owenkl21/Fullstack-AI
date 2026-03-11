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
