/*
 * Shared curve geometry for the painted brand art. Lives apart from the
 * components so both TornEdge and Contours can draw from it.
 */

/*
 * Emits a smooth cubic path through the given points (Catmull-Rom to Bezier).
 * A closed path wraps its neighbours round the ends and finishes with Z, so a
 * loop meets itself without a kink or a hairline gap.
 */
export function smoothPath(pts: number[][], closed = false) {
   if (closed && pts.length > 3) {
      const ring = pts.slice(0, -1);
      const n = ring.length;
      const at = (i: number) => ring[((i % n) + n) % n]!;
      let d = `M${at(0)[0]!.toFixed(1)} ${at(0)[1]!.toFixed(1)}`;
      for (let i = 0; i < n; i++) {
         const p0 = at(i - 1);
         const p1 = at(i);
         const p2 = at(i + 1);
         const p3 = at(i + 2);
         const c1 = [
            p1[0]! + (p2[0]! - p0[0]!) / 6,
            p1[1]! + (p2[1]! - p0[1]!) / 6,
         ];
         const c2 = [
            p2[0]! - (p3[0]! - p1[0]!) / 6,
            p2[1]! - (p3[1]! - p1[1]!) / 6,
         ];
         d += ` C${c1[0]!.toFixed(1)} ${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)} ${c2[1]!.toFixed(1)} ${p2[0]!.toFixed(1)} ${p2[1]!.toFixed(1)}`;
      }
      return d + ' Z';
   }
   let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
   for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
   }
   return d;
}
