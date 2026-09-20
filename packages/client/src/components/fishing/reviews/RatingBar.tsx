import { useState } from 'react';
import { cn } from '@/lib/utils';
import { RATING_MAX, RATING_WORDS } from './reviews-api';

/*
 * How a rating is drawn here.
 *
 * Not five gold stars. The product is condensed type, hairlines and square
 * corners, and a star row would be the one piece of borrowed furniture in it.
 * It is also a poor instrument: half a star is a shape nobody can draw and
 * everybody has to squint at.
 *
 * So a rating is a figure with a bar under it. The bar is one track cut into
 * the five points of the scale by hairlines, filled teal from the left to
 * exactly where the average falls, so 4.2 sits a fifth of the way into the
 * fifth cell and reads as a position rather than as four and a bit symbols.
 * The figure above it carries the precision; the bar carries the place.
 *
 * The picker is the same five cells, set rather than read: you fill the bar up
 * to the point you mean. Reading and setting look alike on purpose.
 */

const POINTS = Array.from({ length: RATING_MAX }, (_, i) => i + 1);

export function RatingBar({
   value,
   className,
   label,
}: {
   /* May be fractional: this is an average as often as it is a rating. */
   value: number;
   className?: string;
   label?: string;
}) {
   const filled = Math.max(0, Math.min(RATING_MAX, value)) / RATING_MAX;

   return (
      <div
         role="img"
         aria-label={label ?? `${value} out of ${RATING_MAX}`}
         className={cn(
            'relative h-2.5 w-full border border-line-2 bg-bg-2',
            className
         )}
      >
         <span
            className="absolute inset-y-0 left-0 bg-teal transition-[width] duration-500 [transition-timing-function:var(--ease)]"
            style={{ width: `${filled * 100}%` }}
         />
         {/* The cuts sit over the fill as well as over the ground, so the
             scale can still be read where the bar is teal. */}
         <span aria-hidden="true" className="absolute inset-0 flex">
            {POINTS.map((point) => (
               <span
                  key={point}
                  className="flex-1 border-l border-line-2 first:border-l-0"
               />
            ))}
         </span>
      </div>
   );
}

export function RatingPicker({
   value,
   onChange,
   disabled = false,
   className,
}: {
   value: number | null;
   onChange: (next: number) => void;
   disabled?: boolean;
   className?: string;
}) {
   /* A pointer over a cell shows what that cell would fill, and lets go of it
      again on the way out. A finger has no hover and simply sets the value. */
   const [preview, setPreview] = useState<number | null>(null);
   const shown = preview ?? value ?? 0;

   return (
      <div
         role="radiogroup"
         aria-label="Your rating"
         className={cn('flex min-w-0', className)}
         onMouseLeave={() => setPreview(null)}
      >
         {POINTS.map((point, index) => {
            const on = point <= shown;
            return (
               <button
                  key={point}
                  type="button"
                  role="radio"
                  aria-checked={value === point}
                  aria-label={`${point} out of ${RATING_MAX}, ${RATING_WORDS[point]}`}
                  disabled={disabled}
                  onMouseEnter={() => setPreview(point)}
                  onFocus={() => setPreview(point)}
                  onBlur={() => setPreview(null)}
                  onClick={() => onChange(point)}
                  className={cn(
                     'g flex h-12 min-w-0 flex-1 items-center justify-center border border-line-2 text-[24px] transition-colors duration-150 [transition-timing-function:var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-50',
                     index > 0 && 'border-l-0',
                     on
                        ? 'bg-teal text-teal-ink'
                        : 'bg-background text-ink hover:bg-bg-2'
                  )}
               >
                  {point}
               </button>
            );
         })}
      </div>
   );
}
