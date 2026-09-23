import { StarIcon } from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';
import { RATING_MAX, RATING_WORDS } from './reviews-api';

/*
 * Setting a rating: the same five stars the page reads a rating in, one
 * button each, drawn in outline until they are filled up to the one you mean.
 *
 * The hover is held by the caller rather than in here, because the word line
 * under the stars says what the star under the pointer would mean before it
 * is tapped. A tap sets the value and lets go of the preview, so a finger,
 * which has no hover, never leaves one behind.
 *
 * Focus does not preview. Each star's label already says its word, and the
 * word line is live, so a preview on focus would say every word twice.
 */

const POINTS = Array.from({ length: RATING_MAX }, (_, i) => i + 1);

export function StarPicker({
   value,
   hover,
   onHover,
   onChange,
   disabled = false,
   className,
}: {
   value: number | null;
   hover: number | null;
   onHover: (next: number | null) => void;
   onChange: (next: number) => void;
   disabled?: boolean;
   className?: string;
}) {
   const shown = hover ?? value ?? 0;

   return (
      <div
         role="radiogroup"
         aria-label="Your rating"
         onMouseLeave={() => onHover(null)}
         className={cn('flex', className)}
      >
         {POINTS.map((point) => {
            const on = point <= shown;
            return (
               <button
                  key={point}
                  type="button"
                  role="radio"
                  aria-checked={value === point}
                  aria-label={`${point} out of ${RATING_MAX}, ${RATING_WORDS[point]}`}
                  disabled={disabled}
                  onMouseEnter={() => onHover(point)}
                  onClick={() => {
                     onChange(point);
                     onHover(null);
                  }}
                  className={cn(
                     'flex h-14 flex-1 cursor-pointer items-center justify-center bg-transparent p-0 disabled:opacity-50 md:h-[60px]',
                     on ? 'text-teal' : 'text-paper/45'
                  )}
               >
                  <StarIcon
                     className={cn(
                        'size-9 stroke-current stroke-[1.5] transition-transform duration-[120ms] [stroke-linejoin:round] [transition-timing-function:var(--ease)] md:size-10',
                        on ? 'fill-teal' : 'fill-none',
                        point === shown && 'scale-[1.12]'
                     )}
                  />
               </button>
            );
         })}
      </div>
   );
}
