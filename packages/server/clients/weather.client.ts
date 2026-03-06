// TODO: implement weather client.

// Suggested responsibility: fetch current weather by coordinates.
export async function getCurrentWeather(latitude: number, longitude: number) {
   const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}` +
      `&longitude=${longitude}` +
      `&current=temperature_2m,wind_speed_10m,precipitation` +
      `&timezone=auto`;

   const response = await fetch(weatherUrl);

   if (!response.ok) {
      throw new Error(`Failed to fetch weather data: ${response.statusText}`);
   }
   return response.json();
}
