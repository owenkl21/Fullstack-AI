import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

import { cn } from '@/lib/utils';

/*
 * A stack of rows that fold.
 *
 * Radix owns everything you cannot see: the arrow, home and end keys, the
 * aria wiring between a trigger and its panel, and the bookkeeping that
 * keeps one row open at a time. What is drawn is ours, and it is three
 * things: a hairline, a League Gothic line and a chevron.
 *
 * Nothing in here names a colour of its own, so the same stack reads on a
 * black block as it does on the page. `.blk` and `.on-black` remap ink and
 * line under it, and the rows follow.
 */

/*
 * The keyframes travel with the component, the way the side panel's do in
 * sheet.tsx. React hoists a <style href> into the head once and dedupes it,
 * so an accordion works wherever it is dropped without src/index.css having
 * to learn about it.
 *
 * Height is what moves, and the height of a shut row is not a number anyone
 * can write down here. Radix measures the panel and publishes
 * --radix-accordion-content-height on the element for the length of the
 * change, so the keyframes read it rather than guess it.
 */
const bodyMotion = `
.accordion-body[data-state='open'] { animation: accordion-open 220ms var(--ease); }
.accordion-body[data-state='closed'] { animation: accordion-shut 180ms var(--ease); }
@keyframes accordion-open {
   from { height: 0; opacity: 0; }
   to { height: var(--radix-accordion-content-height); opacity: 1; }
}
@keyframes accordion-shut {
   from { height: var(--radix-accordion-content-height); opacity: 1; }
   to { height: 0; opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
   .accordion-body[data-state='open'],
   .accordion-body[data-state='closed'] {
      animation: none;
   }
}
`;

/*
 * The opening rule lives on the stack, and every row closes itself with one
 * bottom hairline. A rule on the top and the bottom of each row would draw
 * every line twice and read as a two pixel border on half of them.
 */
function Accordion({
   className,
   children,
   ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
   return (
      <AccordionPrimitive.Root
         data-slot="accordion"
         className={cn('w-full border-t border-line', className)}
         {...props}
      >
         <style href="accordion-motion" precedence="medium">
            {bodyMotion}
         </style>
         {children}
      </AccordionPrimitive.Root>
   );
}

function AccordionItem({
   className,
   ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
   return (
      <AccordionPrimitive.Item
         data-slot="accordion-item"
         className={cn('border-b border-line', className)}
         {...props}
      />
   );
}

/*
 * The whole row is the button, so a thumb has the width of the column to
 * land in rather than the words. The chevron says which way the row will
 * go and turns over when it has gone.
 */
function AccordionTrigger({
   className,
   children,
   ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
   return (
      <AccordionPrimitive.Header className="flex">
         <AccordionPrimitive.Trigger
            data-slot="accordion-trigger"
            className={cn(
               'group flex min-h-11 w-full flex-1 items-center justify-between gap-4 py-3.5 text-left',
               'g text-[22px] text-ink transition-colors duration-150 outline-none [transition-timing-function:var(--ease)]',
               'hover:text-teal-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
               className
            )}
            {...props}
         >
            {children}
            <ChevronDownIcon
               aria-hidden="true"
               strokeWidth={1.5}
               className="size-5 shrink-0 text-ink-3 transition-[color,transform] duration-200 [transition-timing-function:var(--ease)] group-hover:text-ink-2 group-data-[state=open]:rotate-180"
            />
         </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
   );
}

function AccordionContent({
   className,
   children,
   ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
   return (
      <AccordionPrimitive.Content
         data-slot="accordion-content"
         className="accordion-body overflow-hidden text-[15px] leading-relaxed text-ink-2"
         {...props}
      >
         {/*
          * The padding sits on an inner box. On the animated element it
          * would be part of the height Radix measured and part of the
          * height being animated to zero, so a shut row would keep it and
          * the fold would stop a few pixels short of closed.
          */}
         <div className={cn('pb-5', className)}>{children}</div>
      </AccordionPrimitive.Content>
   );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
