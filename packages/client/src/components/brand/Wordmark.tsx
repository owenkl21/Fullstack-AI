import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/*
 * The mark and the name.
 *
 * The mark is Owen's line drawing of a bass leaving the water. It was drawn
 * in black on white, and the header is always black, so audit/logo.mjs flips
 * it to paper lines, knocks the black out and trims it; the file under
 * public/brand is only ever shown on black, which is why one file does. The
 * name follows it in the display face, tracked like the nav words.
 */
export function Wordmark({
   className,
   to = '/',
}: {
   className?: string;
   to?: string;
}) {
   return (
      <Link
         to={to}
         aria-label="Fishtagram, home"
         className={cn(
            'g-tracked inline-flex min-h-11 items-center gap-2 text-[24px] text-paper md:gap-2.5 md:text-[28px]',
            className
         )}
      >
         <img
            src="/brand/fishtagram-mark.png"
            alt=""
            width={192}
            height={190}
            decoding="async"
            className="h-[44px] w-auto md:h-[50px]"
         />
         <span>Fishtagram</span>
      </Link>
   );
}
