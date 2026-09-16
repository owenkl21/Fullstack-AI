/*
 * Shared curve geometry for the painted brand art. Lives apart from the
 * components so both TornEdge and Contours can draw from it.
 */

/* Emits a smooth cubic path through the given points (Catmull-Rom to Bezier). */
export function smoothPath(pts: number[][]) {
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
