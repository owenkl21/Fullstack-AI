/*
 * Slipways, marinas and tackle shops from OpenStreetMap, fetched here rather
 * than in the browser.
 *
 * Overpass refuses cross-origin requests from a page, so the map could never
 * load a single place. Asking from the server fixes that, and lets the request
 * carry a real User-Agent, which the public mirrors require and a browser will
 * not let a page set.
 *
 * Nothing is stored. These are somebody else's facts about the world and they
 * change without telling us. A short in-memory cache keyed on the rounded box
 * stops one angler panning back and forth from hammering a community-run
 * service that throttles.
 */

type Bounds = { south: number; west: number; north: number; east: number };

export type Place = {
   id: string;
   kind: 'ramp' | 'marina' | 'tackle' | 'parking';
   name: string;
   latitude: number;
   longitude: number;
};

const ENDPOINTS = [
   'https://overpass-api.de/api/interpreter',
   'https://overpass.kumi.systems/api/interpreter',
];

const USER_AGENT =
   'fishlogger/1.0 (South African shore fishing log; github.com/owenkl21/fishlogger)';

const FALLBACK: Record<Place['kind'], string> = {
   ramp: 'Slipway',
   marina: 'Marina',
   tackle: 'Tackle shop',
   parking: 'Parking',
};

type Element = {
   type: string;
   id: number;
   lat?: number;
   lon?: number;
   center?: { lat: number; lon: number };
   tags?: Record<string, string>;
};

const kindOf = (tags: Record<string, string>): Place['kind'] | null => {
   if (tags.leisure === 'slipway' || tags.waterway === 'slipway') return 'ramp';
   if (tags.leisure === 'marina') return 'marina';
   if (tags.shop === 'fishing') return 'tackle';
   return null;
};

/* Ten minutes is long enough to absorb a pan and short enough to notice a
 * new ramp within the day. */
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; places: Place[] }>();

/* Rounded so a wobble of a few metres while panning reuses the last answer. */
const keyOf = (b: Bounds) =>
   [b.south, b.west, b.north, b.east].map((n) => n.toFixed(2)).join(',');

/** Null means every mirror failed; an empty list means there is nothing there. */
export async function fetchPlaces(bounds: Bounds): Promise<Place[] | null> {
   const key = keyOf(bounds);
   const hit = cache.get(key);
   if (hit && Date.now() - hit.at < TTL_MS) {
      return hit.places;
   }

   const box = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
   const query = `
      [out:json][timeout:12];
      (
        nwr["leisure"="slipway"](${box});
        nwr["waterway"="slipway"](${box});
        nwr["leisure"="marina"](${box});
        nwr["shop"="fishing"](${box});
      );
      out center tags 150;
   `;

   for (const endpoint of ENDPOINTS) {
      try {
         const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/x-www-form-urlencoded',
               Accept: 'application/json',
               'User-Agent': USER_AGENT,
            },
            body: new URLSearchParams({ data: query }).toString(),
            /* Give up before the map has moved on. A mirror that takes longer
             * than this is throttling us, and the second one gets its turn. */
            signal: AbortSignal.timeout(14000),
         });

         if (!response.ok) continue;

         const data = (await response.json()) as { elements?: Element[] };
         const places: Place[] = [];

         for (const element of data.elements ?? []) {
            const tags = element.tags ?? {};
            const kind = kindOf(tags);
            if (!kind) continue;
            const lat = element.lat ?? element.center?.lat;
            const lon = element.lon ?? element.center?.lon;
            if (typeof lat !== 'number' || typeof lon !== 'number') continue;
            places.push({
               id: `${element.type}/${element.id}`,
               kind,
               name: tags.name?.trim() || FALLBACK[kind],
               latitude: lat,
               longitude: lon,
            });
         }

         cache.set(key, { at: Date.now(), places });
         return places;
      } catch {
         /* Try the next mirror. A map without a bait shop is still a map. */
      }
   }

   /*
    * Not cached and not an empty list. Both mirrors failed, and reporting that
    * as "nothing here" made the map wipe the places it already had every time
    * a request timed out, so slipways appeared and then vanished on the next
    * pan. The caller keeps what it had.
    */
   return null;
}
