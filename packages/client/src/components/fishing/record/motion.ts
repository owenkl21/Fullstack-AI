import { useEffect, useState } from 'react';

/*
 * The two motions the catch surfaces share: a record knowing it has just been built,
 * and a numeral counting into place. Both stop travelling under reduced motion;
 * nothing is lost, only the travel.
 */

export function prefersReducedMotion() {
   if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
   }
   return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** True one frame after mount, so an entrance can transition out of its start state. */
export function useBuilt() {
   const [built, setBuilt] = useState(false);
   useEffect(() => {
      const frame = requestAnimationFrame(() => setBuilt(true));
      return () => cancelAnimationFrame(frame);
   }, []);
   return built;
}

/**
 * Counts from zero into `value` over `durationMs` with an ease-out cubic, the way
 * the record settles its numerals. Returns the number to print, already rounded,
 * and nothing at all when there is no number.
 */
export function useCountIn(
   value: number | null,
   decimals = 0,
   run = true,
   durationMs = 1100
) {
   const [progress, setProgress] = useState(() =>
      run && !prefersReducedMotion() ? 0 : 1
   );

   useEffect(() => {
      if (value === null || !run || prefersReducedMotion()) {
         return;
      }
      let start: number | null = null;
      let frame = 0;
      const tick = (now: number) => {
         start ??= now;
         const elapsed = Math.min(1, (now - start) / durationMs);
         setProgress(1 - Math.pow(1 - elapsed, 3));
         if (elapsed < 1) {
            frame = requestAnimationFrame(tick);
         }
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
   }, [value, run, durationMs]);

   return value === null ? null : (value * progress).toFixed(decimals);
}
