import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** A placeholder wordmark until the product has a name. */
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
         aria-label="Home"
         className={cn(
            'g-tracked inline-flex items-center gap-2.5 text-[28px] text-paper',
            className
         )}
      >
         <svg
            viewBox="0 0 68 44"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-[22px] w-[34px]"
         >
            <path d="M2 30c10-14 24-20 40-16 8 2 14 6 24 6-8 6-16 8-24 8-16 0-30-4-40 2Z" />
            <path d="M44 14c-4-6-10-8-16-8 4 4 8 6 14 6M22 24c4 4 8 4 12 2" />
         </svg>
         Name
      </Link>
   );
}
