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
   /* What kind of place: a town, a farm, a winery, a dam. */
   kind: string | null;
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
type PhotonFeature = {
   geometry?: { coordinates?: [number, number] };
   properties?: {
      osm_id?: number | string;
      osm_key?: string;
      osm_value?: string;
      name?: string;
      city?: string;
      town?: string;
      village?: string;
      county?: string;
      state?: string;
      country?: string;
   };
};

/* The kind of place in a word an angler would use. */
const kindOf = (key?: string, value?: string): string | null => {
   if (!value) return null;
   const v = value.replace(/_/g, ' ');
   if (key === 'place')
      return v === 'city' ||
         v === 'town' ||
         v === 'village' ||
         v === 'suburb' ||
         v === 'hamlet' ||
         v === 'locality'
         ? v
         : v;
   if (key === 'natural') return v;
   if (key === 'craft' && v === 'winery') return 'wine farm';
   if (key === 'landuse' && v === 'vineyard') return 'wine farm';
   if (key === 'tourism') return v;
   if (key === 'amenity') return v;
   if (key === 'leisure') return v;
   if (key === 'waterway') return v;
   if (key === 'water') return v;
   if (key === 'landuse') return v;
   return v;
};

/*
 * Photon (komoot's geocoder over OpenStreetMap) answers with real places:
 * farms, wineries, dams, beaches, harbours, not only towns. Biased towards
 * where the reader is, when the client says. Open-Meteo's town index is the
 * fallback when Photon is down or knows nothing by that name.
 */
async function searchPhoton(
   query: string,
   count: number,
   near?: { latitude: number; longitude: number } | null
): Promise<PlaceHit[]> {
   const params: Record<string, string | number> = {
      q: query,
      limit: count,
      lang: 'en',
   };
   if (near) {
      params.lat = near.latitude;
      params.lon = near.longitude;
   }
   const { data } = await axios.get<{ features?: PhotonFeature[] }>(
      'https://photon.komoot.io/api/',
      { params, headers: { 'User-Agent': USER_AGENT }, timeout: 8000 }
   );
   const seen = new Set<string>();
   const hits: PlaceHit[] = [];
   for (const f of data.features ?? []) {
      const props = f.properties ?? {};
      const coords = f.geometry?.coordinates;
      if (!props.name || !coords) continue;
      const [longitude, latitude] = coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      const key = `${props.name}|${latitude.toFixed(3)}|${longitude.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const locality = props.city ?? props.town ?? props.village ?? null;
      const region = [locality, props.state ?? props.county ?? null]
         .filter((part) => part && part !== props.name)
         .join(', ');
      hits.push({
         id: String(props.osm_id ?? key),
         name: props.name,
         region: region || null,
         country: props.country ?? null,
         latitude,
         longitude,
         kind: kindOf(props.osm_key, props.osm_value),
      });
   }
   return hits;
}

async function searchOpenMeteo(
   query: string,
   count: number
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
      kind: null,
   }));
}

export async function searchPlaces(
   query: string,
   count = 10,
   near?: { latitude: number; longitude: number } | null
): Promise<PlaceHit[]> {
   try {
      const hits = await searchPhoton(query, count, near);
      if (hits.length) return hits;
   } catch (error) {
      console.warn('[places] photon failed, falling back', String(error));
   }
   return searchOpenMeteo(query, count);
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
      /*
       * The first named place that is a place. OpenStreetMap carries the
       * municipal wards as boundaries, and around Cape Town the nearest
       * "suburb" to a beach is often "Cape Town Ward 21", which nobody has
       * ever called anywhere. A ward is skipped in favour of the next name.
       */
      const isWard = (value: string | undefined) =>
         !value || /\bward\b\s*\d*/i.test(value);
      const name =
         [
            a.neighbourhood,
            a.suburb,
            a.village,
            a.hamlet,
            a.town,
            a.city_district,
            a.city,
            a.municipality,
            data.name,
         ].find((value) => !isWard(value)) ?? null;

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
