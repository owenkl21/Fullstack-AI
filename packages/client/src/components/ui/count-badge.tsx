import { cn } from '@/lib/utils';

/*
 * How many are waiting, on the bell and beside the word in the account panel.
 *
 * Round. One figure sits in a circle and two or more stretch it into a pill,
 * so a 7 and a 12 are the same height and neither is a box. It used to be a
 * square, the house shape, which on a round bell read as a sticker stuck over
 * the control. Round is already what avatars and icon controls are here.
 *
 * Past 99 it stops counting: 99+ says "a lot" in the width of a pill, and the
 * real figure is one tap away.
 */
export function CountBadge({
   count,
   className,
}: {
   count: number;
   className?: string;
}) {
   if (!Number.isFinite(count) || count <= 0) {
      return null;
   }

   const figure = count > 99 ? '99+' : String(Math.floor(count));

   return (
      <span
         aria-hidden="true"
         className={cn(
            'num inline-grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-teal text-[12px] leading-none font-semibold text-teal-ink',
            /* A circle needs no sides. A pill needs the figures held off its
             * round ends, or 99+ touches both. */
            figure.length > 1 && 'px-[6px]',
            className
         )}
      >
         {figure}
      </span>
   );
}
