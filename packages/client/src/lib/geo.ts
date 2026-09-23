/*
 * Distance on the ground, and the spot that is already there.
 *
 * Two catches a few hundred metres apart on the same beach are the same
 * place to an angler. Without polygons for every body of water, distance
 * is the honest proxy: a saved spot within this much of the position is
 * offered as the place, and the angler can say no.
 */

const EARTH_M = 6371000;

export const distanceM = (
   a: { latitude: number; longitude: number },
   b: { latitude: number; longitude: number }
) => {
   const rad = Math.PI / 180;
   const dLat = (b.latitude - a.latitude) * rad;
   const dLng = (b.longitude - a.longitude) * rad;
   const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.latitude * rad) *
         Math.cos(b.latitude * rad) *
         Math.sin(dLng / 2) ** 2;
   return 2 * EARTH_M * Math.asin(Math.sqrt(h));
};

/* Close enough to be the same water: about a beach, not a coastline. */
export const SAME_WATER_M = 600;

export type SpotLike = {
   id: string;
   name: string;
   latitude: number | null;
   longitude: number | null;
};

export const nearestSpot = <T extends SpotLike>(
   spots: ReadonlyArray<T>,
   at: { latitude: number; longitude: number } | null | undefined,
   withinM = SAME_WATER_M
): { spot: T; metres: number } | null => {
   if (!at) return null;
   let best: { spot: T; metres: number } | null = null;
   for (const spot of spots) {
      if (
         typeof spot.latitude !== 'number' ||
         typeof spot.longitude !== 'number'
      )
         continue;
      const metres = distanceM(at, {
         latitude: spot.latitude,
         longitude: spot.longitude,
      });
      if (metres <= withinM && (!best || metres < best.metres)) {
         best = { spot, metres };
      }
   }
   return best;
};

export const formatMetres = (metres: number) =>
   metres < 1000
      ? `${Math.round(metres / 10) * 10} m`
      : `${(metres / 1000).toFixed(1)} km`;
