// TODO: implement fishing service.
// Suggested responsibility: orchestrate geocoding, weather, and tides clients.
import { getCoordinates } from '../clients/geocoding.client';
import { getCurrentWeather } from '../clients/weather.client';

export const fishingService = {
   async getFishingConditions(locationName: string) {
      const coordinates = await getCoordinates(locationName);
      const weather = await getCurrentWeather(
         coordinates.latitude,
         coordinates.longitude
      );
      return {
         location: coordinates,
         weather,
      };
   },
};
