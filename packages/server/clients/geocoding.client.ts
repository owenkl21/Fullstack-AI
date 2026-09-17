/*
 * Names and places.
 *
 * Two directions. A name typed into the forecast search becomes coordinates,
 * through Open-Meteo's geocoder, which is keyless and covers every town and
 * headland in the Cape. Coordinates from a phone become a name, through
 * Nominatim, so the conditions panel can say "at Kommetjie" rather than
 * printing a pair of numbers nobody can read.
 *
 * Both are asked from here rather than the browser: Nominatim requires a real
 * User-Agent, and a page cannot set one.
 */

import axios from 'axios';

const USER_AGENT =
   'fishlogger/1.0 (South African shore fishing log; github.com/owenkl21/fishlogger)';

export interface Coordinates {
   latitude: number;
   longitude: number;
   name: string;
   country: string;
}

export type PlaceHit = {
   id: string;
   name: string;
   /* Province or state, then country. What tells two Kommetjies apart. */
   region: string | null;
   country: string | null;
   latitude: number;
   longitude: number;
};

type GeocodeRow = {
   id: number;
   name: string;
   latitude: number;
   longitude: number;
   country?: string;
   admin1?: string;
};

export async function getCoordinates(
   locationName: string
): Promise<Coordinates> {
   const [place] = await searchPlaces(locationName, 1);
   if (!place) {
      throw new Error(`No coordinates found for location: ${locationName}`);
   }
   return {
      latitude: place.latitude,
      longitude: place.longitude,
      name: place.name,
      country: place.country ?? '',
   };
}

/** Up to `count` places matching a typed name, best first. */
export async function searchPlaces(
   query: string,
   count = 6
): Promise<PlaceHit[]> {
   const { data } = await axios.get<{ results?: GeocodeRow[] }>(
      'https://geocoding-api.open-meteo.com/v1/search',
      {
         params: { name: query, count, language: 'en', format: 'json' },
         headers: { 'User-Agent': USER_AGENT },
         timeout: 8000,
      }
   );

   return (data.results ?? []).map((row) => ({
      id: String(row.id),
      name: row.name,
      region: row.admin1 ?? null,
      country: row.country ?? null,
      latitude: row.latitude,
      longitude: row.longitude,
   }));
}

export type PlaceName = {
   /* The nearest named place: a suburb, village or town. */
   name: string;
   region: string | null;
};

/*
 * Reverse lookups are cached for a day on the place to two decimals, about a
 * kilometre. Nominatim asks for at most one request a second from anyone, and
 * every visit to the home page would otherwise be one.
 */
const NAME_TTL_MS = 24 * 60 * 60 * 1000;
const names = new Map<string, { at: number; value: PlaceName | null }>();

type NominatimReverse = {
   name?: string;
   address?: Record<string, string>;
};

export async function namePlace(
   latitude: number,
   longitude: number
): Promise<PlaceName | null> {
   const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
   const hit = names.get(key);
   if (hit && Date.now() - hit.at < NAME_TTL_MS) {
      return hit.value;
   }

   let value: PlaceName | null = null;
   try {
      const { data } = await axios.get<NominatimReverse>(
         'https://nominatim.openstreetmap.org/reverse',
         {
            params: {
               format: 'jsonv2',
               lat: latitude,
               lon: longitude,
               /* Suburb or village, not the street: nobody fishes an address. */
               zoom: 14,
               'accept-language': 'en',
            },
            headers: { 'User-Agent': USER_AGENT },
            timeout: 8000,
         }
      );

      const a = data.address ?? {};
      const name =
         a.suburb ??
         a.village ??
         a.hamlet ??
         a.town ??
         a.city_district ??
         a.city ??
         a.municipality ??
         data.name ??
         null;

      if (name) {
         value = { name, region: a.state ?? a.province ?? a.county ?? null };
      }
   } catch (error) {
      console.warn('[geocoding] reverse lookup failed', {
         key,
         error: String(error),
      });
      /* Not remembered: a failure should be tried again, not repeated. */
      return null;
   }

   if (names.size > 2000) names.clear();
   names.set(key, { at: Date.now(), value });
   return value;
}
