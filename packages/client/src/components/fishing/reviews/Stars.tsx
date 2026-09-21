import { StarIcon } from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';
import { RATING_MAX } from './reviews-api';

/*
 * A rating as it is read: five stars in the empty colour, with a teal copy of
 * the same five laid over them and cut off where the value falls. One row
 * serves the spot header, the summary, the review rows, the lists and the map
 * cards, so an average reads the same wherever it is printed.
 *
 * The size is a custom property, --star, set by the caller beside the gap, so
 * a breakpoint can change both in one class list. Stars are teal only.
 */

const POINTS = Array.from({ length: RATING_MAX }, (_, i) => i + 1);

/* The fill as a clip over the whole row, gaps included, as drawn. A whole
   number always lands in a gap, so review rows need no second path. Kept to
   this file: a component file that exports a function loses fast refresh. */
const starClip = (value: number) =>
   `inset(0 ${Math.round((1 - Math.min(RATING_MAX, Math.max(0, value)) / RATING_MAX) * 10000) / 100}% 0 0)`;

export function Stars({
   value,
   className,
   emptyClassName = 'text-line-2',
   label,
}: {
   /* 0 to 5. May be fractional, since it is an average as often as it is a
      rating; anything outside the scale is clamped. */
   value: number;
   /* The row's size and gap, such as
      "gap-0.5 [--star:22px] md:gap-[3px] md:[--star:28px]". */
   className?: string;
   /* The unfilled colour. On the black plate it is 'text-paper/28'. */
   emptyClassName?: string;
   /* Given, the row is an image with this name. Left out, the row is hidden
      from assistive tech, because the figure or the label beside it already
      says the value. */
   label?: string;
}) {
   const row = POINTS.map((point) => (
      <StarIcon key={point} className="size-[var(--star,16px)] shrink-0" />
   ));

   return (
      <span
         role={label ? 'img' : undefined}
         aria-label={label}
         aria-hidden={label ? undefined : true}
         className={cn(
            'relative inline-flex shrink-0',
            emptyClassName,
            className
         )}
      >
         {row}
         <span
            aria-hidden="true"
            className="absolute inset-0 inline-flex text-teal [gap:inherit]"
            style={{ clipPath: starClip(value) }}
         >
            {row}
         </span>
      </span>
   );
}
