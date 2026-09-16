type GoogleMapsWindow = NonNullable<Window['google']>;

let googleMapsScriptPromise: Promise<GoogleMapsWindow> | null = null;

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

/** True when the map can be drawn at all. The interface never names the reason. */
export const canDrawMap = () =>
   Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

export const loadGoogleMapsScript = async () => {
   if (window.google?.maps) {
      return window.google;
   }

   if (googleMapsScriptPromise) {
      return googleMapsScriptPromise;
   }

   const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

   if (!apiKey) {
      throw new Error('Maps key absent, falling back to typed coordinates.');
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

/* ---------- Tiles in the product's own palette ---------- */

export type MapStyleRule = {
   featureType?: string;
   elementType?: string;
   stylers: Record<string, string | number>[];
};

/** Reads one colour token off the document, so no colour is written twice. */
const readToken = (name: string): number[] | null => {
   if (typeof document === 'undefined') {
      return null;
   }

   const value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();

   const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);

   if (long) {
      return [long[1], long[2], long[3]].map((part) => parseInt(part, 16));
   }

   const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);

   if (short) {
      return [short[1], short[2], short[3]].map(
         (part) => parseInt(part, 16) * 17
      );
   }

   return null;
};

const toHex = (channels: number[]) =>
   `#${channels
      .map((channel) =>
         Math.max(0, Math.min(255, Math.round(channel)))
            .toString(16)
            .padStart(2, '0')
      )
      .join('')}`;

const mix = (from: number[], to: number[], ratio: number) =>
   toHex(from.map((channel, index) => channel + (to[index] - channel) * ratio));

/**
 * The map wears the theme: land on the secondary surface, water carrying a little
 * of the accent, labels in secondary ink, points of interest and transit gone.
 * Returns an empty list if a token cannot be read, which leaves Google's own tiles.
 */
export const buildMapStyle = (theme: 'day' | 'night'): MapStyleRule[] => {
   const ground = readToken('--bg-2');
   const ink = readToken('--ink');
   const inkTwo = readToken('--ink-2');
   const teal = readToken('--teal');

   if (!ground || !ink || !inkTwo || !teal) {
      return [];
   }

   const night = theme === 'night';
   const land = toHex(ground);
   const water = mix(ground, teal, night ? 0.24 : 0.18);
   const road = mix(ground, ink, night ? 0.12 : 0.1);
   const boundary = mix(ground, ink, night ? 0.24 : 0.2);
   const label = toHex(inkTwo);
   const waterLabel = mix(teal, ink, night ? 0.3 : 0.55);

   return [
      { elementType: 'geometry', stylers: [{ color: land }] },
      { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: label }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: land }] },
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      {
         featureType: 'administrative',
         elementType: 'geometry',
         stylers: [{ color: boundary }],
      },
      {
         featureType: 'landscape',
         elementType: 'geometry',
         stylers: [{ color: land }],
      },
      {
         featureType: 'road',
         elementType: 'geometry',
         stylers: [{ color: road }],
      },
      {
         featureType: 'road',
         elementType: 'labels',
         stylers: [{ visibility: 'simplified' }],
      },
      {
         featureType: 'water',
         elementType: 'geometry',
         stylers: [{ color: water }],
      },
      {
         featureType: 'water',
         elementType: 'labels.text.fill',
         stylers: [{ color: waterLabel }],
      },
   ];
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

/** Six decimals is about a tenth of a metre, which is as fine as a pin gets. */
export const formatCoordinate = (value: number) => value.toFixed(6);
