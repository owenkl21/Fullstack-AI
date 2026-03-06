// TODO: implement geocoding client.
// Suggested responsibility: resolve a location name to coordinates.
import axios from 'axios';

export interface Coordinates {
   latitude: number;
   longitude: number;
   name: string;
   country: string;
}

export async function getCoordinates(
   locationName: string
): Promise<Coordinates> {
   const { data } = await axios.get(
      'https://geocoding-api.open-meteo.com/v1/search',
      {
         params: {
            name: locationName,
            count: 1,
            language: 'en',
            format: 'json',
         },
      }
   );
   if (!data.results || data.results.length === 0) {
      throw new Error(`No coordinates found for location: ${locationName}`);
   }
   const place = data.results[0];
   return {
      latitude: place.latitude,
      longitude: place.longitude,
      name: place.name,
      country: place.country,
   };
}
