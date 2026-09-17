import type { PinKind } from '@/lib/leaflet';

/*
 * Boat ramps, marinas, tackle shops and parking, from OpenStreetMap.
 *
 * OpenStreetMap data is ODbL, the same licence as the tiles already under the
 * map, so the attribution already on screen covers it. That matters: this
 * product is non-commercial by choice and a paid points-of-interest feed would
 * be the first thing to change that.
 *
 * The fetch itself lives on the server: see places.service.ts for why. This
 * file only asks our own API and shapes the answer for the map. A failure is
 * silent by design: the map is still a map without a bait shop on it.
 */

export type Poi = {
   id: string;
   kind: PinKind;
   name: string;
   latitude: number;
   longitude: number;
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
   /*
    * Through our own server, not straight to Overpass. Overpass refuses a
    * cross-origin request from a page, so asking from here loaded nothing,
    * ever, and the map went out with an empty layer that the code looked like
    * it filled. The server also carries a User-Agent the mirrors ask for and
    * keeps a short cache, so panning back and forth is not a fresh query each
    * time against a community-run service.
    */
   const params = new URLSearchParams({
      south: bounds.south.toFixed(4),
      west: bounds.west.toFixed(4),
      north: bounds.north.toFixed(4),
      east: bounds.east.toFixed(4),
   });

   try {
      const response = await fetch(`/api/places?${params.toString()}`, {
         signal,
         credentials: 'include',
      });
      if (!response.ok) {
         return [];
      }
      const data = (await response.json()) as { places?: Poi[] };
      return Array.isArray(data.places) ? data.places : [];
   } catch {
      /* A map without a bait shop is still a map. */
      return [];
   }
}
