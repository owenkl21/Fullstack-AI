import { nowStripe, type NowMark } from './band-geometry';

/*
 * The now band, inside a drawn row.
 *
 * Every cell row marks the current hour by colouring that cell. A band has no
 * cells, so it gets the same teal at the same x, drawn under the curve rather
 * than over it: the stripe says which hour, the curve still says what the
 * water is doing in it.
 */
export function NowStripe({ now }: { now: NowMark | null }) {
   if (!now) return null;
   return (
      <span
         aria-hidden="true"
         className="fc-now pointer-events-none absolute top-0 bottom-0"
         style={nowStripe(now)}
      />
   );
}
