// Brand art generators, ported from the app's Contours.tsx and TornEdge.tsx.
// Both return SVG path data only; the components draw them.

function smoothPath(pts, closed = false) {
   if (closed && pts.length > 3) {
      const ring = pts.slice(0, -1),
         n = ring.length;
      const at = (i) => ring[((i % n) + n) % n];
      let d = `M${at(0)[0].toFixed(1)} ${at(0)[1].toFixed(1)}`;
      for (let i = 0; i < n; i++) {
         const p0 = at(i - 1),
            p1 = at(i),
            p2 = at(i + 1),
            p3 = at(i + 2);
         const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
         const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
         d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      return d + ' Z';
   }
   let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
   for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i],
         p1 = pts[i],
         p2 = pts[i + 1],
         p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
   }
   return d;
}

export function contourPaths(W, H, seedIn = 17) {
   const seed = seedIn * 1.7;
   const sx = (W / 1400) * Math.PI * 2,
      sy = (H / 1400) * Math.PI * 2;
   const broad = (x, y) =>
      Math.sin(x * sx * 1.1 + seed) * 0.55 +
      Math.sin(y * sy * 0.9 + seed * 1.7) * 0.5 +
      Math.sin((x * sx * 0.7 + y * sy * 0.6) * 1.2 + seed * 0.6) * 0.35;
   const fine = (x, y) =>
      Math.sin(x * sx * 2.9 + seed * 2.3) * 0.5 +
      Math.sin(y * sy * 2.6 + seed * 0.9) * 0.45 +
      Math.sin((x * sx * 1.9 - y * sy * 2.2) * 1.3 + seed) * 0.3;
   const f = (x, y) => {
      const w =
         0.5 +
         0.5 *
            Math.sin(x * sx * 0.45 + y * sy * 0.35 + seed * 0.4) *
            Math.cos(y * sy * 0.5 - seed * 0.2);
      return (
         broad(x, y) * (0.55 + 0.45 * w) + fine(x, y) * (0.25 + 0.5 * (1 - w))
      );
   };
   const nx = Math.max(24, Math.round(W / 16)),
      ny = Math.max(12, Math.round(H / 16));
   const g = [];
   for (let j = 0; j <= ny; j++) {
      g[j] = [];
      for (let i = 0; i <= nx; i++) g[j][i] = f(i / nx, j / ny);
   }
   const px = (i) => (i * W) / nx,
      py = (j) => (j * H) / ny;
   const paths = [];
   for (let k = 0; k < 7; k++) {
      const lv = -1.2 + k * 0.4,
         segs = [];
      const lerp = (a, b, va, vb) => a + (b - a) * ((lv - va) / (vb - va));
      for (let j = 0; j < ny; j++)
         for (let i = 0; i < nx; i++) {
            const a = g[j][i],
               b = g[j][i + 1],
               c = g[j + 1][i + 1],
               d = g[j + 1][i];
            const idx =
               (a > lv ? 8 : 0) |
               (b > lv ? 4 : 0) |
               (c > lv ? 2 : 0) |
               (d > lv ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            const top = [lerp(px(i), px(i + 1), a, b), py(j)],
               right = [px(i + 1), lerp(py(j), py(j + 1), b, c)];
            const bottom = [lerp(px(i), px(i + 1), d, c), py(j + 1)],
               left = [px(i), lerp(py(j), py(j + 1), a, d)];
            const table = {
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
      const key = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
      const pts = new Map(),
         adj = new Map();
      const link = (a, b) => {
         if (!adj.has(a)) adj.set(a, new Set());
         adj.get(a).add(b);
      };
      segs.forEach(([p, q]) => {
         const a = key(p),
            b = key(q);
         if (a === b) return;
         pts.set(a, p);
         pts.set(b, q);
         link(a, b);
         link(b, a);
      });
      const seen = new Set(),
         ek = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
      [...adj.keys()]
         .sort((a, b) => adj.get(a).size - adj.get(b).size)
         .forEach((start) => {
            adj.get(start).forEach((nb) => {
               if (seen.has(ek(start, nb))) return;
               const line = [pts.get(start)];
               let prev = start,
                  cur = nb;
               seen.add(ek(prev, cur));
               for (let guard = 0; guard < 6000; guard++) {
                  line.push(pts.get(cur));
                  const next = [...adj.get(cur)].find(
                     (n) => n !== prev && !seen.has(ek(cur, n))
                  );
                  if (!next) break;
                  seen.add(ek(cur, next));
                  prev = cur;
                  cur = next;
               }
               if (line.length > 6) {
                  const first = line[0],
                     last = line[line.length - 1];
                  const closed =
                     Math.abs(first[0] - last[0]) < 0.6 &&
                     Math.abs(first[1] - last[1]) < 0.6;
                  const thinned = line.filter(
                     (_, i) => i % 2 === 0 || i === line.length - 1
                  );
                  paths.push(
                     closed ? smoothPath(thinned, true) : smoothPath(thinned)
                  );
               }
            });
         });
   }
   return paths;
}

// The waterline, one still frame. viewBox 0 0 1600 120, preserveAspectRatio none.
const WIDTH = 1600,
   HEIGHT = 120,
   STEPS = 90;
function trace(band, t) {
   const ys = [];
   for (let i = 0; i <= STEPS; i++) {
      const x = (i / STEPS) * WIDTH;
      let y = HEIGHT - band.lift;
      for (const w of band.waves)
         y -=
            Math.sin((x / w.length + t * w.speed + w.phase) * Math.PI * 2) *
            w.amp;
      ys.push(y);
   }
   return ys;
}
const xAt = (i) => ((i / STEPS) * WIDTH).toFixed(1);
const lineOf = (ys) =>
   ys.map((y, i) => `${i ? 'L' : 'M'}${xAt(i)} ${y.toFixed(1)}`).join('');
const under = (ys) =>
   `${lineOf(ys)} L${WIDTH} ${HEIGHT + 56} L0 ${HEIGHT + 56} Z`;
const between = (top, bottom) =>
   `${lineOf(top)} ${bottom
      .map((y, i) => `L${xAt(i)} ${y.toFixed(1)}`)
      .reverse()
      .join('')} Z`;

export function waterline(seed = 1, t = 0.35) {
   const bands = [
      {
         lift: 26,
         waves: [
            { length: 760, amp: 19, speed: 0.036, phase: seed * 0.13 },
            { length: 430, amp: 10, speed: -0.058, phase: seed * 0.41 },
            { length: 237, amp: 5, speed: 0.088, phase: seed * 0.77 },
         ],
      },
      {
         lift: 13,
         waves: [
            { length: 610, amp: 16, speed: -0.048, phase: seed * 0.29 },
            { length: 347, amp: 9, speed: 0.076, phase: seed * 0.61 },
            { length: 193, amp: 4.5, speed: -0.115, phase: seed * 0.19 },
         ],
      },
      {
         lift: 0,
         waves: [
            { length: 520, amp: 15, speed: 0.063, phase: seed * 0.53 },
            { length: 281, amp: 8, speed: -0.097, phase: seed * 0.83 },
            { length: 157, amp: 3.5, speed: 0.138, phase: seed * 0.31 },
         ],
      },
   ];
   const ys = bands.map((b) => trace(b, t));
   const plate = ys[2];
   return {
      water: under(plate),
      shadow: `${lineOf(plate.map((y) => y + 9))} L${WIDTH} -6 L0 -6 Z`,
      strip0: between(plate, ys[0]),
      strip1: between(plate, ys[1]),
      foam: lineOf(plate),
   };
}
