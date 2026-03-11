export async function getCurrentWeather(latitude: number, longitude: number) {
   const apiKey =
      process.env.GOOGLE_WEATHER_API_KEY?.trim() ||
      process.env.GOOGLE_MAPS_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim();

   if (!apiKey) {
      throw new Error(
         'A Google API key is required (GOOGLE_WEATHER_API_KEY, GOOGLE_MAPS_API_KEY, or GOOGLE_API_KEY).'
      );
   }

   const referer =
      process.env.GOOGLE_WEATHER_API_REFERER?.trim() ||
      process.env.GOOGLE_API_HTTP_REFERER?.trim();

   const params = new URLSearchParams({
      key: apiKey,
      unitsSystem: 'METRIC',
   });

   params.set('location.latitude', String(latitude));
   params.set('location.longitude', String(longitude));

   const weatherUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?${params.toString()}`;

   const response = await fetch(weatherUrl, {
      headers: {
         'X-Goog-Api-Key': apiKey,
         ...(referer ? { Referer: referer } : {}),
      },
   });

   if (!response.ok) {
      const details = await response.text();
      const parsedDetails = (() => {
         try {
            const payload = JSON.parse(details) as {
               error?: {
                  message?: string;
                  status?: string;
               };
            };

            if (!payload?.error) {
               return details;
            }

            return `${payload.error.status || 'UNKNOWN'}: ${
               payload.error.message || details
            }`;
         } catch {
            return details;
         }
      })();

      if (
         response.status === 403 &&
         details.includes('API_KEY_HTTP_REFERRER_BLOCKED')
      ) {
         throw new Error(
            'Failed to fetch weather data (403): API key is restricted by HTTP referrer. Either use a server key with IP restrictions, or set GOOGLE_WEATHER_API_REFERER / GOOGLE_API_HTTP_REFERER to an allowed referrer in Google Cloud.'
         );
      }

      throw new Error(
         `Failed to fetch weather data (${response.status}): ${parsedDetails || response.statusText}`
      );
   }

   return response.json();
}
