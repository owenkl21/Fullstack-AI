import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { NoPhoto } from '@/components/brand/FishMark';
import { Img } from '@/components/Img';
import type { Framing } from '@/lib/framing';
import { cn } from '@/lib/utils';

/*
 * One row grammar for catches, spots and gear: a 52px photo, the name in League
 * Gothic, one Jost line under it, the number that matters on the right, and a
 * hairline between rows. No cards, no nested borders. The whole row is the link;
 * a trailing control sits above it so it stays separately reachable.
 */

/** A photograph as any of the list endpoints hands it over. */
export type RowPhoto = {
   image: {
      url?: string | null;
      cardUrl?: string | null;
      thumbUrl?: string | null;
   } & Framing;
};

export type RowProps = {
   to: string;
   title: string;
   /** The line under the name. A node, so a spot can draw it one way on a phone
    * and another on a desktop. */
   subline: ReactNode;
   /** What the link is called to a screen reader. Defaults to the title. */
   label?: string;
   photoUrl?: string | null;
   /*
    * The same photograph at 900px and at 160px. The row draws 52 square, so it
    * reads the thumb and the other two exist only so a photograph logged before
    * the variants did still has something to fall back on.
    */
   photoCardUrl?: string | null;
   photoThumbUrl?: string | null;
   photoAlt?: string;
   /** Gear is photographed on a table, so it is contained rather than cropped. */
   photoFit?: 'cover' | 'contain';
   /**
    * A catch photograph's framing, so the square keeps what the angler kept.
    * Only a catch passes it; a spot or gear is centred as it always was.
    */
   photoFraming?: Framing | null;
   /** The right hand cell: the headline number, or a sentence when there is none. */
   right?: ReactNode;
   /** A control that is not part of the link, such as Delete on gear. */
   trailing?: ReactNode;
   /**
    * A small mark after the name, inside the link: the badges a catch carries.
    * Decorative, so it reads as part of the row rather than as a second target.
    */
   titleMark?: ReactNode;
   /** Quiet the title, for a row that records a trip rather than a fish. */
   muted?: boolean;
   /** The row that just landed from a save, marked for four seconds. */
   marked?: boolean;
};

export function Row({
   to,
   title,
   subline,
   label,
   photoUrl,
   photoCardUrl,
   photoThumbUrl,
   photoAlt = '',
   photoFit = 'cover',
   photoFraming,
   right,
   trailing,
   titleMark,
   muted = false,
   marked = false,
}: RowProps) {
   return (
      <div
         className={cn(
            'relative -mx-2 grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-line px-2 py-3 transition-[background-color,transform] duration-150 [transition-timing-function:var(--ease)] hover:bg-bg-2 active:scale-[0.995]',
            'hover:bg-bg-2 has-[a:focus-visible]:bg-bg-2'
         )}
      >
         {marked ? (
            <span
               aria-hidden="true"
               className="absolute top-0 left-0 h-full w-[3px] bg-teal"
            />
         ) : null}

         {photoUrl || photoThumbUrl ? (
            <Img
               src={photoUrl}
               cardSrc={photoCardUrl}
               thumbSrc={photoThumbUrl}
               alt={photoAlt}
               ratio="1 / 1"
               sizes="52px"
               fit={photoFit}
               framing={photoFraming}
               className={cn(
                  'size-[52px] shrink-0',
                  photoFit === 'contain' && 'p-1'
               )}
            />
         ) : (
            <NoPhoto className="size-[52px]" />
         )}

         <div className="min-w-0">
            <Link
               to={to}
               aria-label={label ?? title}
               className={cn(
                  'g block text-[22px] tracking-[0.04em] after:absolute after:inset-0',
                  muted ? 'text-ink-3' : 'text-ink'
               )}
            >
               {titleMark ? (
                  <span className="flex min-w-0 items-center gap-2">
                     <span className="truncate">{title}</span>
                     {titleMark}
                  </span>
               ) : (
                  <span className="block truncate">{title}</span>
               )}
            </Link>
            <p className="truncate text-sm text-ink-2">{subline}</p>
         </div>

         <div className="flex items-baseline justify-end gap-5 justify-self-end">
            {right}
            {trailing ? (
               <span className="relative z-10">{trailing}</span>
            ) : null}
         </div>
      </div>
   );
}

/** The headline number on the right of a row: League Gothic, tabular, one line. */
export function RowNumber({
   children,
   className,
   style,
}: {
   children: ReactNode;
   className?: string;
   style?: CSSProperties;
}) {
   return (
      <span
         className={cn(
            'g num block whitespace-nowrap text-[24px] tracking-[0.03em] text-ink',
            className
         )}
         style={style}
      >
         {children}
      </span>
   );
}

/** A row list: rows stack, the hairline above each one does the dividing. */
export function RowList({
   children,
   className,
}: {
   children: ReactNode;
   className?: string;
}) {
   /*
    * The closing rule matters most on a short list: with a rule above every row
    * and none below the last, two catches trailed off into empty page rather
    * than reading as a list that had ended.
    */
   return (
      <div className={cn('flex flex-col border-b border-line', className)}>
         {children}
      </div>
   );
}
