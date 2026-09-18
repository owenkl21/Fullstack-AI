import { useId, useState, type ReactNode } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

/*
 * A section that folds.
 *
 * The heading is the handle: the whole line is the button, the chevron says
 * which way it will go, and the body opens on a grid row that grows from
 * nothing, which is the one way to animate height in CSS without measuring.
 */
export function Fold({
   title,
   aside,
   open: openAtFirst = false,
   className,
   headingClassName,
   children,
}: {
   title: ReactNode;
   /* Something small on the right of the heading: a count, a unit. */
   aside?: ReactNode;
   open?: boolean;
   className?: string;
   headingClassName?: string;
   children: ReactNode;
}) {
   const id = useId();
   const [open, setOpen] = useState(openAtFirst);

   return (
      <div className={cn('fold', open && 'fold-open', className)}>
         <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((was) => !was)}
            className="group flex min-h-12 w-full items-center justify-between gap-4 text-left"
         >
            <span
               className={cn('g text-[30px] md:text-[36px]', headingClassName)}
            >
               {title}
            </span>
            <span className="flex shrink-0 items-center gap-3">
               {aside ? (
                  <span className="lab num text-ink-3">{aside}</span>
               ) : null}
               <ChevronDownIcon
                  aria-hidden="true"
                  strokeWidth={2}
                  className={cn(
                     'size-6 text-ink-2 transition-transform duration-300 [transition-timing-function:var(--ease)] group-hover:text-ink',
                     open && 'rotate-180'
                  )}
               />
            </span>
         </button>
         {/*
          * The body is collapsed by height, not removed, so `inert` is what
          * keeps its fields out of the tab order and out of focus-on-error
          * while it is shut.
          */}
         <div
            id={id}
            className="fold-body"
            aria-hidden={!open}
            inert={!open || undefined}
         >
            <div className="fold-inner min-h-0">{children}</div>
         </div>
      </div>
   );
}
