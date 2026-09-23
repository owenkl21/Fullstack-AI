import { useRef, type KeyboardEvent } from 'react';
import { PROVINCES } from '@/components/social/competitions-api';
import { cn } from '@/lib/utils';

/*
 * The nine provinces, all of them on the page.
 *
 * This was a dropdown, and a dropdown is for a list too long to show. Nine
 * names is not: opening a panel to read them, scrolling it for the ninth and
 * closing it again was three steps around a choice that fits in the space
 * the closed field and its label took. So they are a grid of cells, two
 * across on a phone and three on a desktop, and picking one is one tap with
 * nothing to open, nothing to scroll and nothing that can land off the screen.
 *
 * One radio group: the arrow keys move through the cells and only the chosen
 * one, or the first when none is, is a tab stop.
 */
export function ProvinceGrid({
   value,
   onChange,
   invalid = false,
}: {
   value: string;
   onChange: (next: string) => void;
   invalid?: boolean;
}) {
   const group = useRef<HTMLDivElement>(null);

   const onKeys = (event: KeyboardEvent<HTMLDivElement>) => {
      const step =
         event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? 1
            : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
              ? -1
              : 0;
      if (!step) return;
      event.preventDefault();
      const cells = Array.from(
         group.current?.querySelectorAll<HTMLButtonElement>('[role=radio]') ??
            []
      );
      const at = cells.indexOf(document.activeElement as HTMLButtonElement);
      const next = cells[(at + step + cells.length) % cells.length];
      if (!next) return;
      next.focus();
      /* A radio group chooses as it moves, the way a native one does. */
      onChange(next.value);
   };

   return (
      <div className="flex flex-col gap-2">
         <span className="lab" id="comp-region-label">
            Region
         </span>
         <div
            ref={group}
            role="radiogroup"
            aria-labelledby="comp-region-label"
            aria-invalid={invalid || undefined}
            onKeyDown={onKeys}
            /* The hairlines are the gaps: one line between any two cells and
               none doubled, which borders on the cells themselves cannot do. */
            className={cn(
               'grid grid-cols-2 gap-px border bg-line md:grid-cols-3',
               invalid ? 'border-destructive' : 'border-line'
            )}
         >
            {PROVINCES.map((province, i) => {
               const on = value === province;
               return (
                  <button
                     key={province}
                     type="button"
                     role="radio"
                     value={province}
                     aria-checked={on}
                     tabIndex={on || (!value && i === 0) ? 0 : -1}
                     onClick={() => onChange(province)}
                     className={cn(
                        'g-tracked flex h-12 min-w-0 items-center px-3 text-left text-[16px] transition-colors duration-150 [transition-timing-function:var(--ease)] focus-visible:relative focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal',
                        on
                           ? 'bg-ink text-background'
                           : 'bg-background text-ink hover:bg-bg-2'
                     )}
                  >
                     <span className="truncate">{province}</span>
                  </button>
               );
            })}
            {/* Nine cells in two columns leave a tenth; it is paper, not a
                grey block of the rule colour showing through. */}
            <span aria-hidden="true" className="bg-background md:hidden" />
         </div>
      </div>
   );
}
