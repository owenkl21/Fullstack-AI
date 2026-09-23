import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import fs from 'node:fs';

/*
 * A solid silhouette traced from Owen's line drawing, for the places that
 * need the fish at 14 to 24 pixels: the map pins, the square that stands in
 * for a missing photograph, a feed card's mark. The drawing itself is line
 * art with scales and fin rays in it, which at that size is mud; the outline
 * of the inked region, filled, still reads as this fish.
 *
 * Render, threshold, keep the largest blob, trace it with marching squares,
 * walk the boundary and drop the points that sit on a line between their
 * neighbours (Douglas-Peucker), then write the path in a 100 x 100 box.
 *   node trace.mjs <in.svg> <tolerance> [size]
 */
const [, , input, tolArg, sizeArg] = process.argv;
const SIZE = Number(sizeArg || 400);
const TOL = Number(tolArg || 0.6);

const svg = fs.readFileSync(input, 'utf8');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: SIZE, height: SIZE } });
await p.setContent(
   `<html><body style="margin:0;background:#fff"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" style="width:${SIZE}px;height:${SIZE}px;display:block"></body></html>`
);
await p.waitForTimeout(600);
const png = PNG.sync.read(await p.screenshot());
await b.close();

/* Ink: anything clearly darker than the paper. */
const ink = (x, y) => {
   if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return false;
   const i = (SIZE * y + x) * 4;
   const l = (png.data[i] * 299 + png.data[i + 1] * 587 + png.data[i + 2] * 114) / 1000;
   return l < 205;
};

/*
 * Close the drawing up first. The line art is open work: scales and fin rays
 * are strokes with paper between them, so the raw ink is dozens of islands.
 * A dilate then an erode of the same radius (a morphological close) joins
 * strokes that are within 2r of each other and puts the outline back where
 * it was, which turns the drawing into the one shape it depicts.
 */
const R = Number(process.env.CLOSE ?? Math.max(3, Math.round(SIZE / 90)));
const grid = new Uint8Array(SIZE * SIZE);
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (ink(x, y)) grid[SIZE * y + x] = 1;
const morph = (src, r, grow) => {
   const out = new Uint8Array(src.length);
   for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
         let hit = false;
         for (let dy = -r; dy <= r && !hit; dy++) {
            for (let dx = -r; dx <= r; dx++) {
               if (dx * dx + dy * dy > r * r) continue;
               const nx = x + dx, ny = y + dy;
               const v = nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE ? 0 : src[SIZE * ny + nx];
               if (grow ? v === 1 : v === 0) { hit = true; break; }
            }
         }
         out[SIZE * y + x] = grow ? (hit ? 1 : 0) : hit ? 0 : 1;
      }
   }
   return out;
};
let solid = morph(morph(grid, R, true), R, false);

/* The largest blob only, and its holes filled: one closed outline. */
const label = new Int32Array(solid.length).fill(-1);
let best = -1, bestN = 0;
for (let s = 0; s < solid.length; s++) {
   if (solid[s] !== 1 || label[s] !== -1) continue;
   const id = s;
   let n = 0;
   const stack = [s];
   label[s] = id;
   while (stack.length) {
      const c = stack.pop();
      n++;
      const cx = c % SIZE, cy = (c - cx) / SIZE;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
         const nx = cx + dx, ny = cy + dy;
         if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
         const k = SIZE * ny + nx;
         if (solid[k] === 1 && label[k] === -1) { label[k] = id; stack.push(k); }
      }
   }
   if (n > bestN) { bestN = n; best = id; }
}
const shape = new Uint8Array(solid.length);
for (let s = 0; s < solid.length; s++) if (label[s] === best) shape[s] = 1;
/* Fill holes: flood the outside of the blob, everything else is inside. */
const outside = new Uint8Array(solid.length);
const q = [0];
outside[0] = 1;
while (q.length) {
   const c = q.pop();
   const cx = c % SIZE, cy = (c - cx) / SIZE;
   for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
      const k = SIZE * ny + nx;
      if (!outside[k] && shape[k] === 0) { outside[k] = 1; q.push(k); }
   }
}
for (let s = 0; s < shape.length; s++) if (!outside[s]) shape[s] = 1;

/* Walk the boundary: moore neighbourhood, clockwise. */
const at = (x, y) => (x < 0 || y < 0 || x >= SIZE || y >= SIZE ? 0 : shape[SIZE * y + x]);
let start = null;
for (let y = 0; y < SIZE && !start; y++) for (let x = 0; x < SIZE; x++) if (at(x, y)) { start = [x, y]; break; }
const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const walk = [];
let cur = start, dir = 6;
for (let guard = 0; guard < SIZE * SIZE * 4; guard++) {
   walk.push(cur);
   let moved = false;
   for (let i = 0; i < 8; i++) {
      const d = (dir + 5 + i) % 8;
      const nx = cur[0] + N8[d][0], ny = cur[1] + N8[d][1];
      if (at(nx, ny)) { cur = [nx, ny]; dir = d; moved = true; break; }
   }
   if (!moved) break;
   if (cur[0] === start[0] && cur[1] === start[1]) break;
}

/* Douglas-Peucker. */
const simplify = (pts, tol) => {
   if (pts.length < 3) return pts;
   const d2 = (p, a, bb) => {
      const [x, y] = p, [x1, y1] = a, [x2, y2] = bb;
      const dx = x2 - x1, dy = y2 - y1;
      const t = dx || dy ? ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy) : 0;
      const cx = x1 + Math.max(0, Math.min(1, t)) * dx, cy = y1 + Math.max(0, Math.min(1, t)) * dy;
      return (x - cx) ** 2 + (y - cy) ** 2;
   };
   const keep = new Uint8Array(pts.length);
   keep[0] = keep[pts.length - 1] = 1;
   const stack = [[0, pts.length - 1]];
   while (stack.length) {
      const [a, z] = stack.pop();
      let far = -1, fd = tol * tol;
      for (let i = a + 1; i < z; i++) {
         const dd = d2(pts[i], pts[a], pts[z]);
         if (dd > fd) { fd = dd; far = i; }
      }
      if (far > 0) { keep[far] = 1; stack.push([a, far], [far, z]); }
   }
   return pts.filter((_, i) => keep[i]);
};

const pts = simplify(walk, TOL);
/* Into a 100 x 100 box, keeping the aspect. */
const xs = pts.map((q2) => q2[0]), ys = pts.map((q2) => q2[1]);
const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
const w = maxX - minX, h = maxY - minY;
const s = 100 / Math.max(w, h);
const ox = (100 - w * s) / 2, oy = (100 - h * s) / 2;
const d =
   pts
      .map((q3, i) => `${i ? 'L' : 'M'}${(ox + (q3[0] - minX) * s).toFixed(1)} ${(oy + (q3[1] - minY) * s).toFixed(1)}`)
      .join('') + 'Z';
console.log(JSON.stringify({ walk: walk.length, points: pts.length, chars: d.length, ratio: +(w / h).toFixed(2) }));
fs.writeFileSync(process.env.OUT_PATH || './fish-path.txt', d);
