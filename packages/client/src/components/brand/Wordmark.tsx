import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/*
 * The mark and the name.
 *
 * The mark is Owen's own drawing, a bass with a teal dorsal fin, delivered as
 * a raster on a black square and kept under public/brand with the black
 * knocked out so it sits on the always-black header whatever exact black the
 * export used. It is only ever shown on black, which is why one file does.
 * The name follows it in the display face, tracked like the nav words.
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
            'g-tracked inline-flex min-h-11 items-center gap-2.5 text-[24px] text-paper md:text-[28px]',
            className
         )}
      >
         <img
            src="/brand/fishtagram-mark.png"
            alt=""
            width={320}
            height={158}
            decoding="async"
            className="h-[30px] w-auto md:h-[34px]"
         />
         <span>Fishtagram</span>
      </Link>
   );
}
