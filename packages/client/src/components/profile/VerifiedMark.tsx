import { cn } from '@/lib/utils';

/*
 * The verified mark, and the only one in the app.
 *
 * Square, because everything here is: the rounded blue tick belongs to other
 * people's products, and a mark shaped like theirs would read as a badge
 * anybody can earn. This is a teal square with the tick cut into it in
 * teal-ink, the same pair a primary button uses, so it sits right on paper,
 * on a black card and in the night theme without being told which it is on.
 *
 * It is drawn from one boolean the server writes and nothing else. A name and
 * a handle cannot produce it: the app refuses the brand words in a handle and
 * in a display name, and refuses a tick character in a name outright, so the
 * only tick beside a name on any page is this one.
 */
export function VerifiedMark({
   className,
   label = 'Verified account',
}: {
   className?: string;
   /* Read out by a screen reader and shown on hover. */
   label?: string;
}) {
   return (
      <svg
         viewBox="0 0 16 16"
         role="img"
         aria-label={label}
         className={cn(
            'ml-1 inline-block size-[14px] shrink-0 align-[-0.14em]',
            className
         )}
      >
         <title>{label}</title>
         {/* A plain square. A corner cut to echo the cards' teal tab was tried
             and read as a rendering fault at the 12 to 15 pixels this mark
             actually lives at, and a notch big enough to read there clipped
             the tick. */}
         <rect width="16" height="16" fill="var(--teal)" />
         {/* Square caps and a mitred elbow: the same hand as the hairlines
             and the corner tab, rather than a soft rounded tick. */}
         <path
            d="M3.4 8.3 6.4 11.2 12.6 4.7"
            fill="none"
            stroke="var(--teal-ink)"
            strokeWidth="2.2"
            strokeLinecap="square"
            strokeLinejoin="miter"
         />
      </svg>
   );
}
