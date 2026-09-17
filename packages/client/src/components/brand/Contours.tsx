import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { smoothPath } from './path';

/*
 * Contour line art traced from a smooth field with marching squares, chained into
 * lines and smoothed, so it nests and flows like a real topographic sheet. The
 * `.contour` class fades it out through a mask before any edge can cut it, and the
 * lines draw on when they come into view.
 */
function buildPaths(W: number, H: number, seedIn: number) {
   const seed = seedIn * 1.7;
   /*
    * Two fields, one broad and one fine, blended by a slow third so the
    * sheet has wide sweeps in one part and tight rings in another, the way
    * a real survey sheet does over mixed ground. The x and y scales follow
    * the box's aspect so features are the same size across and down.
    */
   /*
    * Frequencies in cycles per thousand pixels, so a feature is the same
    * size on a phone and a wide screen: broad sweeps about 900 px across,
    * tight rings about 350 px.
    */
   const sx = (W / 1400) * Math.PI * 2;
   const sy = (H / 1400) * Math.PI * 2;
   const broad = (x: number, y: number) =>
      Math.sin(x * sx * 1.1 + seed) * 0.55 +
      Math.sin(y * sy * 0.9 + seed * 1.7) * 0.5 +
      Math.sin((x * sx * 0.7 + y * sy * 0.6) * 1.2 + seed * 0.6) * 0.35;
   const fine = (x: number, y: number) =>
      Math.sin(x * sx * 2.9 + seed * 2.3) * 0.5 +
      Math.sin(y * sy * 2.6 + seed * 0.9) * 0.45 +
      Math.sin((x * sx * 1.9 - y * sy * 2.2) * 1.3 + seed) * 0.3;
   const f = (x: number, y: number) => {
      const w =
         0.5 +
         0.5 *
            Math.sin(x * sx * 0.45 + y * sy * 0.35 + seed * 0.4) *
            Math.cos(y * sy * 0.5 - seed * 0.2);
      return (
         broad(x, y) * (0.55 + 0.45 * w) + fine(x, y) * (0.25 + 0.5 * (1 - w))
      );
   };
   /* Sampled at the same spacing across and down, so rings stay round. */
   const nx = Math.max(24, Math.round(W / 16));
   const ny = Math.max(12, Math.round(H / 16));
   const g: number[][] = [];
   for (let j = 0; j <= ny; j++) {
      g[j] = [];
      for (let i = 0; i <= nx; i++) g[j][i] = f(i / nx, j / ny);
   }
   const px = (i: number) => (i * W) / nx;
   const py = (j: number) => (j * H) / ny;
   const paths: string[] = [];
   for (let k = 0; k < 7; k++) {
      const lv = -1.2 + k * 0.4;
      const segs: number[][][] = [];
      const lerp = (a: number, b: number, va: number, vb: number) =>
         a + (b - a) * ((lv - va) / (vb - va));
      for (let j = 0; j < ny; j++) {
         for (let i = 0; i < nx; i++) {
            const a = g[j][i];
            const b = g[j][i + 1];
            const c = g[j + 1][i + 1];
            const d = g[j + 1][i];
            const idx =
               (a > lv ? 8 : 0) |
               (b > lv ? 4 : 0) |
               (c > lv ? 2 : 0) |
               (d > lv ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            const top = [lerp(px(i), px(i + 1), a, b), py(j)];
            const right = [px(i + 1), lerp(py(j), py(j + 1), b, c)];
            const bottom = [lerp(px(i), px(i + 1), d, c), py(j + 1)];
            const left = [px(i), lerp(py(j), py(j + 1), a, d)];
            const table: Record<number, number[][]> = {
               1: [left, bottom],
               2: [bottom, right],
               3: [left, right],
               4: [top, right],
               5: [top, left, bottom, right],
               6: [top, bottom],
               7: [top, left],
               8: [top, left],
               9: [top, bottom],
               10: [top, right, bottom, left],
               11: [top, right],
               12: [left, right],
               13: [bottom, right],
               14: [left, bottom],
            };
            const e = table[idx];
            segs.push([e[0], e[1]]);
            if (e.length === 4) segs.push([e[2], e[3]]);
         }
      }
      const key = (p: number[]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
      const pts = new Map<string, number[]>();
      const adj = new Map<string, Set<string>>();
      const link = (a: string, b: string) => {
         if (!adj.has(a)) adj.set(a, new Set());
         adj.get(a)!.add(b);
      };
      segs.forEach(([p, q]) => {
         const a = key(p);
         const b = key(q);
         if (a === b) return;
         pts.set(a, p);
         pts.set(b, q);
         link(a, b);
         link(b, a);
      });
      const seen = new Set<string>();
      const ek = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
      [...adj.keys()]
         .sort((a, b) => adj.get(a)!.size - adj.get(b)!.size)
         .forEach((start) => {
            adj.get(start)!.forEach((nb) => {
               if (seen.has(ek(start, nb))) return;
               const line = [pts.get(start)!];
               let prev = start;
               let cur = nb;
               seen.add(ek(prev, cur));
               for (let guard = 0; guard < 6000; guard++) {
                  line.push(pts.get(cur)!);
                  const next = [...adj.get(cur)!].find(
                     (n) => n !== prev && !seen.has(ek(cur, n))
                  );
                  if (!next) break;
                  seen.add(ek(cur, next));
                  prev = cur;
                  cur = next;
               }
               if (line.length > 6) {
                  const first = line[0]!;
                  const last = line[line.length - 1]!;
                  const closed =
                     Math.abs(first[0]! - last[0]!) < 0.6 &&
                     Math.abs(first[1]! - last[1]!) < 0.6;
                  const thinned = line.filter(
                     (_, i) => i % 2 === 0 || i === line.length - 1
                  );
                  /*
                   * A loop closes on itself, drawn as one. A line that is not
                   * a loop began and ended on the edge of the sheet, because a
                   * contour of a smooth field has nowhere else to stop.
                   */
                  paths.push(
                     closed ? smoothPath(thinned, true) : smoothPath(thinned)
                  );
               }
            });
         });
   }
   return paths;
}

export function Contours({
   seed = 1,
   width,
   height,
   className,
   style,
}: {
   seed?: number;
   /** Fixed dimensions. Leave both out and the art matches the box it sits in. */
   width?: number;
   height?: number;
   className?: string;
   style?: React.CSSProperties;
}) {
   const ref = useRef<SVGSVGElement>(null);

   /*
    * Contours are generated at the shape they will be drawn at.
    *
    * They used to be built in a fixed 460 by 240 box and then stretched across
    * whatever they landed in. On a phone that box is about the right shape and
    * it looked like a survey sheet; on a desktop it was stretched across 1440
    * by 300, nearly five to one, so the lines came out smeared sideways and
    * the pattern visibly repeated. Measuring the box first is the fix: the
    * field is sampled at the real aspect, so the lines are the same weight and
    * the same spacing at every width.
    */
   const [box, setBox] = useState<{ w: number; h: number } | null>(null);

   useEffect(() => {
      if (width && height) {
         setBox({ w: width, h: height });
         return;
      }

      const svg = ref.current;
      if (!svg) return;

      const observer = new ResizeObserver(([entry]) => {
         const rect = entry?.contentRect;
         if (!rect || rect.width < 8 || rect.height < 8) return;
         /* Rounded, so a pixel of resize does not rebuild the whole field. */
         setBox({
            w: Math.round(rect.width / 20) * 20,
            h: Math.round(rect.height / 20) * 20,
         });
      });

      observer.observe(svg);
      return () => observer.disconnect();
   }, [width, height]);

   useEffect(() => {
      const svg = ref.current;
      if (!svg || !box) return;
      const paths = buildPaths(box.w, box.h, seed);
      svg.innerHTML = paths
         .map(
            (d, i) =>
               `<path d="${d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="transition-delay:${((i % 12) * 0.09).toFixed(2)}s"/>`
         )
         .join('');
      const io = new IntersectionObserver(
         (entries) => {
            entries.forEach((e) => {
               if (!e.isIntersecting) return;
               svg.querySelectorAll('path').forEach((p) => {
                  (p as SVGPathElement).style.strokeDashoffset = '0';
               });
               io.disconnect();
            });
         },
         { threshold: 0.15 }
      );
      io.observe(svg);
      return () => io.disconnect();
   }, [seed, box]);

   return (
      <svg
         ref={ref}
         style={style}
         className={cn('contour', className)}
         viewBox={box ? `0 0 ${box.w} ${box.h}` : undefined}
         preserveAspectRatio="none"
         aria-hidden="true"
      />
   );
}
