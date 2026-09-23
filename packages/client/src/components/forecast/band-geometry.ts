/*
 * The arithmetic the drawn rows share.
 *
 * Every band in the hour grid is one cell spanning all twenty four columns, so
 * it has to line up with the hour heads at any width: on a phone the table is
 * 24 by 56 pixels and scrolls sideways, on a desk it stretches to the page
 * column. The answer is a viewBox a thousand units wide stretched to whatever
 * the cell is (preserveAspectRatio "none"), with x read off the clock. A
 * thousand units over about fourteen hundred pixels is close enough to one to
 * one that a stroke stays a stroke rather than a smear, which is what happens
 * when a band is drawn one unit per hour and stretched sixty times.
 *
 * Times are read off the local string with slice, never parsed to a Date. The
 * strings carry the place's offset, and parsing one would move sunrise into
 * the reader's own time zone.
 */

export const BAND_W = 1000;

/* The centre of an hour's column, which is where its reading belongs. */
export const columnX = (index: number, count: number) =>
   ((index + 0.5) / count) * BAND_W;

export const minutesX = (minutes: number) => (minutes / 1440) * BAND_W;

/* Minutes since local midnight, from '2026-09-18T06:41+02:00'. */
export const minutesOfStamp = (stamped: string | null | undefined) => {
   if (!stamped || stamped.length < 16) return null;
   const h = Number(stamped.slice(11, 13));
   const m = Number(stamped.slice(14, 16));
   if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
   return h * 60 + m;
};

export const clockOfMinutes = (minutes: number) => {
   const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
   const pad = (n: number) => String(n).padStart(2, '0');
   return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

const round = (n: number) => Math.round(n * 100) / 100;

/*
 * A line through the samples rather than between them: Catmull-Rom control
 * points turned into cubic curves, which is the water's own shape and not a
 * row of corners.
 */
export function smoothPath(points: { x: number; y: number }[]) {
   if (points.length === 0) return '';
   const first = points[0];
   if (points.length === 1) return `M ${round(first.x)} ${round(first.y)}`;
   let d = `M ${round(first.x)} ${round(first.y)}`;
   for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i + 2 < points.length ? points[i + 2] : p2;
      d +=
         ` C ${round(p1.x + (p2.x - p0.x) / 6)} ${round(p1.y + (p2.y - p0.y) / 6)}` +
         `, ${round(p2.x - (p3.x - p1.x) / 6)} ${round(p2.y - (p3.y - p1.y) / 6)}` +
         `, ${round(p2.x)} ${round(p2.y)}`;
   }
   return d;
}

export type Turn = {
   /* Where the turn falls, as a fractional position in the sample list. */
   at: number;
   /* What the reading is there, fitted rather than sampled. */
   value: number;
   kind: 'low' | 'high';
};

/*
 * Where the water turns.
 *
 * The model speaks once an hour and a tide turns whenever it likes, so the
 * sample nearest a high is up to half an hour out. A parabola through the
 * turning sample and its two neighbours puts the turn back where it belongs,
 * usually within ten minutes, which is the difference between a useful time
 * and a wrong one.
 */
export function turningPoints(values: number[]): Turn[] {
   const turns: Turn[] = [];
   for (let i = 1; i < values.length - 1; i += 1) {
      const before = values[i - 1];
      const here = values[i];
      const after = values[i + 1];
      const high = here > before && here >= after;
      const low = here < before && here <= after;
      if (!high && !low) continue;
      const curve = before - 2 * here + after;
      const offset = curve === 0 ? 0 : (0.5 * (before - after)) / curve;
      const shift = Math.abs(offset) > 0.5 ? 0 : offset;
      turns.push({
         at: i + shift,
         value: here - 0.25 * (before - after) * shift,
         kind: high ? 'high' : 'low',
      });
   }
   return turns;
}

/*
 * A half arc from one horizon crossing to the other, bulging upwards. Sweep
 * one with y running down the screen is the way over rather than the way
 * under, which is the difference between a sunrise and an eclipse.
 */
export function arcPath(
   fromX: number,
   toX: number,
   horizonY: number,
   peakY: number
) {
   const rx = Math.max(1, (toX - fromX) / 2);
   const ry = Math.max(1, horizonY - peakY);
   return `M ${round(fromX)} ${horizonY} A ${round(rx)} ${round(ry)} 0 0 1 ${round(toX)} ${horizonY}`;
}

/* The quarter of an arc that is left when the rest of it happened yesterday. */
export function quarterPath(
   fromX: number,
   fromY: number,
   toX: number,
   toY: number
) {
   const rx = Math.max(1, Math.abs(toX - fromX));
   const ry = Math.max(1, Math.abs(toY - fromY));
   return `M ${round(fromX)} ${round(fromY)} A ${round(rx)} ${round(ry)} 0 0 1 ${round(toX)} ${round(toY)}`;
}

/* A position in the band as a percentage of it, and never outside it. */
export const bandPercent = (x: number) => {
   const percent = (x / BAND_W) * 100;
   return Math.min(100, Math.max(0, percent));
};

/*
 * Where a label sits against the mark it names.
 *
 * It used to sit centred on the mark and clamped seven per cent in from the
 * band's edges, and it lost its left half twice over. Once to the band's own
 * box, because seven per cent of a band is narrower than half of "Moonset
 * 01:15", which is why the desktop printed NSET 01:15. And again to the rail:
 * the hours scroll sideways inside a box with the row names stuck over its
 * left edge, so a label centred on a mark that has just come past the rail is
 * half under it, which is why the phone printed 2:18 for a low at 12:18 and
 * N 12:41 for high noon.
 *
 * So a label is never centred. It opens to the right of its mark through the
 * first half of the day and closes to the left of it through the second,
 * which is always the side with room in the band and always the side the
 * reader is scrolling towards. A mark you can see brings its whole name with
 * it, at any scroll position and any width, and none of this has to know how
 * long the string is: the shift is the label's own width.
 */
export const labelAt = (x: number) => {
   const percent = bandPercent(x);
   const closing = percent > 55;
   return {
      left: `${round(percent)}%`,
      transform: closing ? 'translateX(calc(-100% - 4px))' : 'translateX(4px)',
   };
};

/*
 * Where the hour the reader is standing in falls, as a share of the band.
 *
 * A cell row can mark now by colouring the cell. A band is one drawing across
 * every column and has no cells to colour, so it takes the same band as a
 * stripe laid over it at the same x, and the two line up because both are
 * measured off the column count rather than off pixels.
 */
export type NowMark = { index: number; count: number };

export const nowStripe = (now: NowMark) => ({
   left: `${(now.index / now.count) * 100}%`,
   width: `${(1 / now.count) * 100}%`,
});
