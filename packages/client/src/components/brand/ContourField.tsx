import { Contours } from './Contours';

/*
 * A survey sheet behind a page.
 *
 * One field over the whole page, not patches: every line on it is either
 * a ring that closes on itself or a line that runs from one edge of the
 * page to another, because that is the only way a contour of a smooth
 * field can end. The sheet is drawn a little larger than the page and
 * clipped to it, so the slow drift never pulls a bare strip in from the
 * side. The field itself has broad sweeps in one part and tight rings in
 * another. Absolute over the page's own box; the page stays `relative`.
 */
export function ContourField({ seed = 1 }: { seed?: number }) {
   return (
      <div
         aria-hidden="true"
         className="pointer-events-none absolute inset-0 overflow-hidden"
      >
         <Contours
            seed={seed}
            className="top-[-40px] left-[-40px] h-[calc(100%+80px)] w-[calc(100%+80px)]"
         />
      </div>
   );
}
