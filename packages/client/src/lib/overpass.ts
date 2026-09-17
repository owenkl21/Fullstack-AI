import type { PinKind } from '@/lib/leaflet';

/*
 * Boat ramps, marinas, tackle shops and parking, from OpenStreetMap.
 *
 * Overpass is keyless and free, and the data is ODbL, which is the same licence
 * as the tiles already under the map, so the attribution already on screen
 * covers it. That matters: this product is non-commercial by choice and a paid
 * points-of-interest feed would be the first thing to change that.
 *
 * Nothing is stored. These are somebody else's facts about the world and they
 * change without telling us, so they are read when a map is looked at and
 * thrown away afterwards. A failure is silent by design: the map is still a map
 * without a bait shop on it.
 */

const ENDPOINTS = [
   'https://overpass-api.de/api/interpreter',
   /* Overpass is community run and throttles. A second mirror means one being
    * busy does not empty the map. */
   'https://overpass.kumi.systems/api/interpreter',
];

export type Poi = {
   id: string;
   kind: PinKind;
   name: string;
   latitude: number;
   longitude: number;
};

/* What each thing is called when it has no name of its own. */
const FALLBACK: Partial<Record<PinKind, string>> = {
   ramp: 'Slipway',
   marina: 'Marina',
   tackle: 'Tackle shop',
   parking: 'Parking',
};

type OverpassElement = {
   type: string;
   id: number;
   lat?: number;
   lon?: number;
   center?: { lat: number; lon: number };
   tags?: Record<string, string>;
};

const kindOf = (tags: Record<string, string>): PinKind | null => {
   if (tags.leisure === 'slipway' || tags.waterway === 'slipway') return 'ramp';
   if (tags.leisure === 'marina') return 'marina';
   if (tags.shop === 'fishing') return 'tackle';
   /* Only parking that is actually at the water, which is the query's job. */
   if (tags.amenity === 'parking') return 'parking';
   return null;
};

/**
 * Everything useful inside a bounding box.
 *
 * The box comes from the map rather than a fixed radius, so panning somewhere
 * new asks about somewhere new. Bounded to a sane size by the caller, since
 * Overpass will happily be asked for a continent and then time out.
 */
export async function fetchPois(
   bounds: { south: number; west: number; north: number; east: number },
   signal?: AbortSignal
): Promise<Poi[]> {
   const box = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;

   /* `nwr` covers nodes, ways and relations; `center` gives a point for the
    * ones that are areas, since a marina is a polygon and a pin is not. */
   const query = `
      [out:json][timeout:20];
      (
        nwr["leisure"="slipway"](${box});
        nwr["waterway"="slipway"](${box});
        nwr["leisure"="marina"](${box});
        nwr["shop"="fishing"](${box});
      );
      out center tags 120;
   `;

   for (const endpoint of ENDPOINTS) {
      try {
         /*
          * Both headers earn their place. Without the form content type
          * overpass-api.de answers 406, and without the JSON accept it is
          * entitled to hand back XML. A User-Agent would help too, and the
          * mirrors ask for one, but a browser will not let a page set it and
          * sends its own.
          */
         const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/x-www-form-urlencoded',
               Accept: 'application/json',
            },
            body: new URLSearchParams({ data: query }).toString(),
            signal,
         });

         if (!response.ok) {
            continue;
         }

         const data = (await response.json()) as {
            elements?: OverpassElement[];
         };

         const out: Poi[] = [];
         for (const element of data.elements ?? []) {
            const tags = element.tags ?? {};
            const kind = kindOf(tags);
            if (!kind) continue;

            const lat = element.lat ?? element.center?.lat;
            const lon = element.lon ?? element.center?.lon;
            if (typeof lat !== 'number' || typeof lon !== 'number') continue;

            out.push({
               id: `${element.type}/${element.id}`,
               kind,
               name: tags.name?.trim() || FALLBACK[kind] || 'Place',
               latitude: lat,
               longitude: lon,
            });
         }

         return out;
      } catch {
         /* Try the next mirror. A map without a bait shop is still a map. */
      }
   }

   return [];
}
