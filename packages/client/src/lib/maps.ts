/*
 * What a link from Maps carries, and what a pair of typed fields means.
 * Nothing here talks to Google: parsing a pasted link is a regex over a
 * string, with no network call and no key. The map itself is Leaflet, in
 * lib/leaflet.ts.
 */

/** Pulls a position out of a link copied from Google Maps, in any of its shapes. */
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

/* ---------- Coordinates as the forms handle them ---------- */

export type MapPosition = { lat: number; lng: number };

/** A pair of typed fields becomes a position only when both are real and in range. */
export const readPosition = (
   latitude: string,
   longitude: string
): MapPosition | null => {
   if (!latitude.trim() || !longitude.trim()) {
      return null;
   }

   const lat = Number(latitude);
   const lng = Number(longitude);

   if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
   }

   if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
   }

   return { lat, lng };
};

/**
 * Five decimals is about a metre, which is finer than any fix the phone gives
 * and as fine as a pin dropped by hand can honestly claim. The sixth decimal
 * was a tenth of a metre printed against a position good to thirty.
 */
export const formatCoordinate = (value: number) => value.toFixed(5);
