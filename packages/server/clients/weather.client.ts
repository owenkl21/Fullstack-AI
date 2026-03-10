export async function getCurrentWeather(latitude: number, longitude: number) {
   const apiKey = process.env.GOOGLE_WEATHER_API_KEY?.trim();

   if (!apiKey) {
      throw new Error('GOOGLE_WEATHER_API_KEY is required.');
   }

   const params = new URLSearchParams({
      key: apiKey,
      unitsSystem: 'METRIC',
   });

   params.set('location.latitude', String(latitude));
   params.set('location.longitude', String(longitude));

   const weatherUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?${params.toString()}`;

   const response = await fetch(weatherUrl);

   if (!response.ok) {
      const details = await response.text();
      throw new Error(
         `Failed to fetch weather data (${response.status}): ${details || response.statusText}`
      );
   }

   return response.json();
}
