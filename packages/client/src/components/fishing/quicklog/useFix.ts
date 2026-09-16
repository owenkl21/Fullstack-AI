import { useEffect, useState } from 'react';

/*
 * The position fix behind the receipt. It starts the moment the fast log opens and
 * tightens as readings arrive; the coordinates are only shown once the fix is under
 * 30 m, and after six seconds with nothing the receipt says so and the save carries
 * on regardless. Nothing here can hold up a catch.
 */

export type FixStatus =
   | 'seeking'
   | 'fixed'
   | 'waiting'
   | 'denied'
   | 'unsupported';

export type Fix = {
   latitude: number;
   longitude: number;
   accuracy: number;
};

const GOOD_ENOUGH_METRES = 30;
const CEILING_MS = 6000;
const GIVE_UP_MS = 25000;

const isSupported = () =>
   typeof navigator !== 'undefined' && Boolean(navigator.geolocation);

export function usePositionFix() {
   const supported = isSupported();
   const [status, setStatus] = useState<FixStatus>(() =>
      isSupported() ? 'seeking' : 'unsupported'
   );
   const [fix, setFix] = useState<Fix | null>(null);

   useEffect(() => {
      if (!supported) {
         return;
      }

      let best: Fix | null = null;
      let watchId: number | null = null;

      const clearWatch = () => {
         if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
         }
      };

      const ceiling = window.setTimeout(() => {
         if (!best) {
            setStatus('waiting');
         }
      }, CEILING_MS);

      const giveUp = window.setTimeout(clearWatch, GIVE_UP_MS);

      watchId = navigator.geolocation.watchPosition(
         (position) => {
            const next: Fix = {
               latitude: position.coords.latitude,
               longitude: position.coords.longitude,
               accuracy: position.coords.accuracy,
            };
            if (!best || next.accuracy < best.accuracy) {
               best = next;
               setFix(next);
            }
            if (next.accuracy <= GOOD_ENOUGH_METRES) {
               setStatus('fixed');
               clearWatch();
            } else {
               setStatus('seeking');
            }
         },
         (error) => {
            setStatus(
               error.code === error.PERMISSION_DENIED ? 'denied' : 'waiting'
            );
         },
         { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      );

      return () => {
         window.clearTimeout(ceiling);
         window.clearTimeout(giveUp);
         clearWatch();
      };
   }, [supported]);

   return {
      status,
      fix,
      isSharp: fix !== null && fix.accuracy <= GOOD_ENOUGH_METRES,
   };
}
