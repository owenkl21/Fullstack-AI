import { cn } from '@/lib/utils';

/*
 * The team mark: the people who run Fisherfeed, said the way a magazine
 * credits its staff.
 *
 * It is a word, not a chip. The verified seal beside it is a filled teal
 * shape, so this one stays open: the small tracked label the product already
 * uses for every piece of small type, in teal, inside a hairline. Two teal
 * marks side by side read as a pair only if they are different kinds of
 * thing; a second filled lozenge would have fought the seal for the eye.
 *
 * The one flourish is the corner. Every card in the product carries a teal
 * tab in its top right corner, and the label carries the same tab at its own
 * scale. That is what makes it ours rather than any app's "staff" pill.
 *
 * Small says TEAM, large says FISHERFEED TEAM. A feed header at 390 has about
 * 180 pixels for a name, the seal and this, and the full words would take
 * most of it. A screen reader hears the full words at both sizes.
 *
 * It sits on the name's baseline by being an inline block with text in it,
 * so it lines up in running text and in a baseline flex row alike. It never
 * wraps inside itself and never shrinks, so where a row is tight it is the
 * name that gives way. For that to hold, the name has to be its own
 * truncating box with the marks after it, not inside it:
 *
 *    <span className="flex min-w-0 items-baseline">
 *       <span className="truncate">{name}</span>
 *       <VerifiedMark className="relative top-[0.16em]" />
 *       <TeamBadge />
 *    </span>
 *
 * The seal takes its drop as an offset there, because a flex item ignores
 * vertical-align. The feed header's two line clamp goes the same way: a
 * clamp cuts whatever comes last, and the marks come last.
 *
 * On a profile the name wraps rather than truncates, and on a phone the
 * large label rarely fits beside it. Left inline it would drop to a line of
 * its own the full height of the name, indented by its own margin. As a
 * wrapping row it drops flush left and close, like a byline:
 *
 *    <h1 className="g flex flex-wrap items-baseline gap-3 ...">
 *       <span className="min-w-0 break-words hyphens-auto">
 *          {name}
 *          <VerifiedMark className="ml-2 size-[22px] align-[0.16em]" />
 *       </span>
 *       <TeamBadge size="lg" className="ml-0" />
 *    </h1>
 *
 * Nothing about it changes under a pointer. It is a fact about a person, not
 * something to press, and inside a link it is simply part of the link.
 */
export function TeamBadge({
   size = 'sm',
   className,
}: {
   size?: 'sm' | 'lg';
   className?: string;
}) {
   const large = size === 'lg';

   return (
      <span
         title="Fisherfeed team"
         className={cn(
            'relative inline-block shrink-0 border align-baseline font-sans font-medium whitespace-nowrap text-teal-text uppercase not-italic no-underline',
            'border-[color-mix(in_srgb,var(--teal-text)_50%,transparent)]',
            /*
             * Beside running text the label's letters share the name's
             * baseline, and the hairline hangs to where the name's
             * descenders reach. Beside display capitals there are no
             * descenders for it to answer to, so it rises by exactly that
             * hang and stands on the baseline like one more capital: at 22px
             * League Gothic the small box is the height of the capitals.
             */
            large
               ? 'ml-3 px-[9px] pt-[4px] pb-[3px] text-[12px] leading-[14px] in-[.g]:-top-[7px]'
               : 'ml-1.5 px-[5px] pt-[2px] pb-[1px] text-[10px] leading-[12px] in-[.g]:-top-[5px]',
            'tracking-[0.16em]',
            className
         )}
      >
         {/* The tracking would leave a gap after the last letter; this
             takes it back so the hairline sits the same distance either side. */}
         <span aria-hidden="true" className="-mr-[0.16em]">
            {large ? 'Fisherfeed team' : 'Team'}
         </span>
         <span className="sr-only">Fisherfeed team</span>
         <svg
            aria-hidden="true"
            viewBox="0 0 6 6"
            className={cn(
               'absolute -top-px -right-px block',
               large ? 'size-[7px]' : 'size-[5px]'
            )}
         >
            <path d="M0 0H6V6Z" fill="var(--teal)" />
         </svg>
      </span>
   );
}
