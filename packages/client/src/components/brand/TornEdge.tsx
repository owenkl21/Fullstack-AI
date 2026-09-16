import { useEffect, useId, useRef } from 'react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { smoothPath } from './path';

/*
 * The painted torn edge between a photograph and a solid section: three smooth,
 * seeded strokes (two translucent paper strokes and the next section's ground),
 * built from low-frequency noise and emitted as cubic curves so nothing is jagged.
 */
type Fill = 'bg' | 'bg-2' | 'black';

function rng(seed: number) {
   let s = seed * 7919 + 13;
   return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
   };
}

function noise1(seed: number, spacing: number, w: number) {
   const r = rng(seed);
   const n = Math.ceil(w / spacing) + 2;
   const v = Array.from({ length: n }, r);
   return (x: number) => {
      const t = x / spacing;
      const i = Math.floor(t);
      const f = t - i;
      const u = f * f * (3 - 2 * f);
      return v[i] * (1 - u) + v[i + 1] * u;
   };
}

function edgePath(
   seed: number,
   amp: number,
   lift: number,
   w: number,
   h: number
) {
   const a = noise1(seed, 140, w);
   const b = noise1(seed + 3, 46, w);
   const pts: number[][] = [];
   for (let x = 0; x <= w; x += 20) {
      pts.push([x, h - lift - amp * (0.25 + 0.75 * a(x)) - amp * 0.28 * b(x)]);
   }
   return `${smoothPath(pts)} L${w} ${h} L0 ${h} Z`;
}

export function TornEdge({
   fill = 'bg',
   flip = false,
   seed,
   className,
}: {
   fill?: Fill;
   flip?: boolean;
   seed?: number;
   className?: string;
}) {
   const id = useId();
   const ref = useRef<HTMLDivElement>(null);
   const theme = useTheme();

   useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const s = seed ?? Array.from(id).reduce((n, c) => n + c.charCodeAt(0), 0);
      const cs = getComputedStyle(document.documentElement);
      const varName =
         fill === 'black' ? '--black' : fill === 'bg-2' ? '--bg-2' : '--bg';
      const ground = cs.getPropertyValue(varName).trim() || '#ffffff';
      const w = 1600;
      const h = 90;
      el.innerHTML =
         `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">` +
         `<path d="${edgePath(s * 11 + 5, 34, 14, w, h)}" fill="rgba(244,241,236,0.38)"/>` +
         `<path d="${edgePath(s * 11 + 29, 30, 4, w, h)}" fill="rgba(244,241,236,0.5)"/>` +
         `<path d="${edgePath(s * 11 + 2, 30, 0, w, h)}" fill="${ground}"/>` +
         `</svg>`;
   }, [fill, seed, id, theme]);

   return (
      <div
         ref={ref}
         aria-hidden="true"
         className={cn(
            'torn',
            flip && 'top-[-2px] bottom-auto -scale-y-100',
            className
         )}
      />
   );
}
