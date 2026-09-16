import { useEffect, useRef, useState } from 'react';

const reduced = () =>
   window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/*
 * A number that counts into place. `token` restarts the run, so the record can build
 * itself again the next time it is opened. Under reduced motion it lands at once.
 */
export function Counter({
   to,
   decimals = 0,
   duration = 900,
   token = 0,
}: {
   to: number;
   decimals?: number;
   duration?: number;
   token?: number;
}) {
   const [value, setValue] = useState(0);
   const latest = useRef(0);

   useEffect(() => {
      if (token === 0) return;
      const from = latest.current;
      if (reduced()) {
         const once = requestAnimationFrame(() => {
            latest.current = to;
            setValue(to);
         });
         return () => cancelAnimationFrame(once);
      }
      let raf = 0;
      const start = performance.now();
      const tick = (now: number) => {
         const t = Math.min(1, (now - start) / duration);
         const eased = 1 - (1 - t) ** 3;
         const next = from + (to - from) * eased;
         latest.current = next;
         setValue(next);
         if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
   }, [to, duration, token]);

   return <>{(token === 0 ? 0 : value).toFixed(decimals)}</>;
}

/*
 * The accuracy on the capture receipt, tightening from ±120 m to ±8 m over the 2.6s
 * the fix takes to settle.
 */
export function FixAccuracy({ running }: { running: boolean }) {
   const [metres, setMetres] = useState(120);

   useEffect(() => {
      if (!running) return;
      if (reduced()) {
         const once = requestAnimationFrame(() => setMetres(8));
         return () => cancelAnimationFrame(once);
      }
      let raf = 0;
      const start = performance.now();
      const tick = (now: number) => {
         const t = Math.min(1, (now - start) / 2600);
         const eased = 1 - (1 - t) ** 2.2;
         setMetres(Math.round(120 - 112 * eased));
         if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
   }, [running]);

   return <>±{running ? metres : 120} m</>;
}
