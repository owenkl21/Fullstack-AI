import type { ReactNode, SVGProps } from 'react';
import { type BadgeKind } from '@/components/badges/kinds';

/*
 * The marks, drawn here rather than imported.
 *
 * Same hand as the map pins: a 24 grid, round caps and joins, one idea each and
 * no more, so it still reads at twenty pixels on a feed card and holds its
 * nerve at sixty four on the record. No emoji and no icon font: a badge is the
 * team's own mark, and half of these have no glyph in any set anyway.
 *
 * Strokes are scaled by the viewBox, so one drawing serves every size.
 */
const MARKS: Record<BadgeKind, ReactNode> = {
   /* A star: the oldest way of saying this one was good. */
   GREAT_CATCH: (
      <path
         d="M12 3.6 14.47 8.61 20 9.41 16 13.31 16.94 18.81 12 16.21 7.06 18.81 8 13.31 4 9.41 9.53 8.61Z"
         fill="currentColor"
      />
   ),
   /* A specimen tag with its hole: the fish gets labelled and written up. */
   COOL_SPECIES: (
      <>
         <path
            d="M3.6 12.5 11 5.1a2 2 0 0 1 1.4-.6h5.1a2 2 0 0 1 2 2v5.1a2 2 0 0 1-.6 1.4l-7.4 7.4a2 2 0 0 1-2.8 0l-5.1-5.1a2 2 0 0 1 0-2.8Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
         />
         <circle cx="16.1" cy="7.9" r="1.5" fill="currentColor" />
      </>
   ),
   /*
    * Three bars on a rule, each taller than the last, in the hand the insights
    * page already draws its own. An arrow over a rule was the first try and it
    * came out as the browser's upload glyph, which is not what a best is.
    */
   PERSONAL_BEST: (
      <>
         <path
            d="M3.4 20.4h17.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
         />
         <path
            d="M6.4 17.6v-4.2M12 17.6V8.8M17.6 17.6V4.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
         />
      </>
   ),
   /* A compass: this one came from somewhere else. */
   RARE_VISITOR: (
      <>
         <circle
            cx="12"
            cy="12"
            r="8.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
         />
         <path
            d="M16.1 7.9 13.9 13.9 7.9 16.1 10.1 10.1Z"
            fill="currentColor"
         />
      </>
   ),
   /* Straight back down into the water. */
   RELEASED_WELL: (
      <>
         <path
            d="M12 3.4v9.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
         />
         <path
            d="m8 9.4 4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
         />
         <path
            d="M3 18.6c1.8-2.1 3.6-2.1 5.4 0s3.6 2.1 5.4 0 3.6-2.1 5.4 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
         />
      </>
   ),
   /*
    * A rod bent over, the line hanging straight off the tip to a float. The
    * line has to drop plumb: when it ran back at an angle the whole thing read
    * as a tick rather than as a rod.
    */
   YOUNG_ANGLER: (
      <>
         <path
            d="M2.8 20.2C5.6 12.6 11.4 6.6 19.4 4.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
         />
         <path
            d="M19.4 4.8v8.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
         />
         <circle cx="19.4" cy="15.8" r="2.2" fill="currentColor" />
      </>
   ),
   /* A rosette, ribbons and all. */
   CATCH_OF_THE_WEEK: (
      <>
         <circle
            cx="12"
            cy="8.8"
            r="5.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
         />
         <path
            d="M8.6 13.2 7 21.2l5-2.7 5 2.7-1.6-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
         />
      </>
   ),
   /* A drawing pin: the team put this one up. */
   TEAM_PICK: (
      <>
         <path
            d="M8.5 3.2h7M10 3.2v5.2c0 1.2-.7 2.3-1.8 2.8l-1.4.7h10.4l-1.4-.7c-1.1-.5-1.8-1.6-1.8-2.8V3.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
         />
         <path
            d="M12 11.9v8.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
         />
      </>
   ),
};

/*
 * A badge in outline, for the one place that needs a single glyph for all
 * eight: the inbox, where the line already says which badge it was. Drawn on
 * the same grid as the Heroicons it sits among, and it is the same mark the
 * team's control wears, so the two read as the same thing.
 */
export function BadgeCueMark(props: SVGProps<SVGSVGElement>) {
   return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
         <rect
            x="3.6"
            y="3.6"
            width="16.8"
            height="16.8"
            stroke="currentColor"
            strokeWidth="1.8"
         />
         <rect x="8.4" y="8.4" width="7.2" height="7.2" fill="currentColor" />
      </svg>
   );
}

/** One badge's drawing, at whatever size the box around it is. */
export function BadgeMark({ kind }: { kind: BadgeKind }) {
   return (
      <svg
         viewBox="0 0 24 24"
         aria-hidden="true"
         focusable="false"
         className="badge-mark"
      >
         {MARKS[kind]}
      </svg>
   );
}
