import type { CSSProperties } from 'react';
import { BADGES, knownBadges, type BadgeKind } from '@/components/badges/kinds';
import { BadgeMark } from '@/components/badges/marks';
import type { CatchBadge } from '@/components/badges/badges-api';
import { cn } from '@/lib/utils';

/*
 * A badge, wherever it is shown.
 *
 * The chip is a square of the kind's colour with the kind's mark on it, drawn
 * in the ink that reads on that colour. Square, like everything else in the
 * product, and solid rather than tinted, because it has to hold on a black
 * card, on paper and beside a photograph without being restyled each time.
 *
 * Three sizes: twenty on a feed card, eighteen in a row, sixty four on the
 * record. Nothing in between, so the mark is only ever tested at the sizes it
 * is used at.
 */

const SIZES = { row: 18, card: 20, big: 64 } as const;

export function BadgeChip({
   kind,
   size = 'card',
   landed = false,
   className,
}: {
   kind: BadgeKind;
   size?: keyof typeof SIZES;
   /* The one that was just awarded, so it lands rather than appears. */
   landed?: boolean;
   className?: string;
}) {
   const badge = BADGES[kind];
   return (
      <span
         className={cn('badge-chip', landed && 'badge-landed', className)}
         style={
            {
               '--badge': badge.fill,
               '--badge-ink': badge.ink,
               '--badge-size': `${SIZES[size]}px`,
            } as CSSProperties
         }
      >
         <BadgeMark kind={kind} />
      </span>
   );
}

/*
 * The badges on a feed card: two of them, named, and a "+1" for the rest.
 *
 * Two, because three names is a second line of type in a place the eye is
 * trying to read a fish and its size, and because the pair the team gave first
 * is the pair they meant most.
 */
export function BadgeStrip({
   badges,
   justLanded,
   className,
}: {
   badges: CatchBadge[];
   /* The kind awarded a moment ago, which arrives rather than appears. */
   justLanded?: BadgeKind | null;
   className?: string;
}) {
   const drawable = knownBadges(badges);
   if (drawable.length === 0) return null;
   /*
    * The two the team gave first, except that one just pinned always shows.
    * Without this, badging a fish that already carries two put the new badge
    * straight behind the "+1" and nothing at all appeared to happen.
    */
   const order =
      justLanded && drawable.findIndex((b) => b.kind === justLanded) > 1
         ? [
              ...drawable.filter((b) => b.kind === justLanded),
              ...drawable.filter((b) => b.kind !== justLanded),
           ]
         : drawable;
   const shown = order.slice(0, 2);
   const rest = order.length - shown.length;

   return (
      <p className={cn('badge-strip', className)}>
         {shown.map((badge) => (
            <span key={badge.id} className="badge-tag">
               <BadgeChip
                  kind={badge.kind}
                  landed={justLanded === badge.kind}
               />
               <span className="g-tracked badge-tag-name">
                  {BADGES[badge.kind].name}
               </span>
            </span>
         ))}
         {rest > 0 ? (
            <span className="num badge-more">
               +{rest}
               <span className="sr-only"> more from the Fisherfeed team</span>
            </span>
         ) : null}
      </p>
   );
}

/*
 * The marks in a list row: the chips alone, small, beside the name. No words:
 * a row is one line of type and the colour and the mark are enough to say the
 * team has been here. The full names are read out for anyone who cannot see
 * them.
 */
export function BadgeMarks({
   badges,
   className,
}: {
   badges: CatchBadge[];
   className?: string;
}) {
   const drawable = knownBadges(badges);
   if (drawable.length === 0) return null;
   /*
    * One mark, and a count for the rest. A row is a single line of type and
    * the fish's name has to keep it: at 390 a second mark and a count together
    * cut "Largemouth bass" down to "Largemo" and the row stopped saying what
    * was caught, which is the one thing it is for.
    */
   const shown = drawable.slice(0, 1);
   const rest = drawable.length - shown.length;
   return (
      <span className={cn('badge-marks', className)}>
         {shown.map((badge) => (
            <BadgeChip key={badge.id} kind={badge.kind} size="row" />
         ))}
         {rest > 0 ? <span className="num badge-more">+{rest}</span> : null}
         <span className="sr-only">
            {shown.map((badge) => BADGES[badge.kind].name).join(', ')}
            {rest > 0 ? ` and ${rest} more` : ''} from the Fisherfeed team
         </span>
      </span>
   );
}
