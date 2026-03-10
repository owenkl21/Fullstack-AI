type GoogleMapsWindow = NonNullable<Window['google']>;

let googleMapsScriptPromise: Promise<GoogleMapsWindow> | null = null;

export const parseGoogleMapsCoordinates = (mapsLink: string) => {
   const decodedLink = decodeURIComponent(mapsLink);
   const patterns = [
      /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /[?&](?:q|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
   ];

   for (const pattern of patterns) {
      const match = decodedLink.match(pattern);

      if (!match) {
         continue;
      }

      const parsedLatitude = Number(match[1]);
      const parsedLongitude = Number(match[2]);

      if (
         Number.isFinite(parsedLatitude) &&
         Number.isFinite(parsedLongitude) &&
         parsedLatitude >= -90 &&
         parsedLatitude <= 90 &&
         parsedLongitude >= -180 &&
         parsedLongitude <= 180
      ) {
         return { parsedLatitude, parsedLongitude };
      }
   }

   return null;
};

export const loadGoogleMapsScript = async () => {
   if (window.google?.maps) {
      return window.google;
   }

   if (googleMapsScriptPromise) {
      return googleMapsScriptPromise;
   }

   const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

   if (!apiKey) {
      throw new Error('Google Maps API key is missing.');
   }

   googleMapsScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
         if (!window.google) {
            reject(new Error('Google Maps failed to initialize.'));
            return;
         }

         resolve(window.google);
      };
      script.onerror = () => reject(new Error('Failed to load Google Maps.'));
      document.head.appendChild(script);
   });

   return googleMapsScriptPromise;
};
