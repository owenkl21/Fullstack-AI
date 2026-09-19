import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * What a pin is, and what you can do about it, as the product's own card.
 *
 * On a desktop a pin opens a popover beside itself, which is what a map
 * reader expects. On a phone that popover covered the pin it described and
 * wrapped its actions onto two clipped rows, so there the same card is the
 * contents of the app's sheet instead. One card, drawn in React, so a label
 * that depends on state (Keep and Kept) is always the live one.
 */
export type CardAction = {
   label: string;
   onClick: () => void;
   tone?: 'primary' | 'plain' | 'danger';
   disabled?: boolean;
};

export function PinCard({
   kicker,
   title,
   facts,
   tags,
   children,
   actions,
}: {
   kicker: string;
   title: string;
   /* A line each: what has come out of here, who saved it, where it is. */
   facts: { value: string; quiet?: boolean; figures?: boolean }[];
   tags?: string[];
   /* Anything this pin alone needs, such as a name for a spot being saved. */
   children?: ReactNode;
   actions: CardAction[];
}) {
   return (
      <div className="p-4">
         <p className="lab">{kicker}</p>
         <h2 className="g mt-1.5 text-[28px] break-words">{title}</h2>

         {facts.length ? (
            <ul className="mt-2.5 flex flex-col gap-1">
               {facts
                  .filter((fact) => fact.value)
                  .map((fact) => (
                     <li
                        key={fact.value}
                        className={cn(
                           'text-[15px]',
                           fact.figures && 'num',
                           fact.quiet ? 'text-ink-3' : 'text-ink-2'
                        )}
                     >
                        {fact.value}
                     </li>
                  ))}
            </ul>
         ) : null}

         {tags?.length ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
               {tags.map((tag) => (
                  <li
                     key={tag}
                     className="g-tracked border border-line px-2 py-1 text-[13px] text-ink-2"
                  >
                     {tag}
                  </li>
               ))}
            </ul>
         ) : null}

         {children}

         <div className="mt-4 flex flex-wrap gap-2">
            {actions.map((action) => (
               <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={cn(
                     'g-tracked inline-flex min-h-11 min-w-[calc(50%-4px)] flex-1 items-center justify-center px-4 text-[16px] transition-colors duration-150 [transition-timing-function:var(--ease)] disabled:opacity-60',
                     action.tone === 'primary'
                        ? 'bg-ink text-background'
                        : action.tone === 'danger'
                          ? 'border border-line text-destructive hover:border-destructive'
                          : 'border border-line text-ink hover:border-ink'
                  )}
               >
                  {action.label}
               </button>
            ))}
         </div>
      </div>
   );
}
