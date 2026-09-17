import * as Popover from '@radix-ui/react-popover';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * A filter you open, in the house style.
 *
 * A button that says what is chosen, and a panel of options under it. One
 * choice or several. Built on Radix Popover so it handles focus, the escape
 * key and a tap outside; everything visible is ours: radius 0, ink on paper,
 * the dashed rule, League Gothic on the labels.
 *
 * This replaces rows of chips that ran to three lines under a map. A row of
 * chips is right for two or three options; a panel is right for twelve.
 */
export type PickerOption = {
   value: string;
   label: string;
   /* A small mark before the label: a pin, a swatch. */
   mark?: ReactNode;
   hint?: string;
};

export function Picker({
   label,
   options,
   value,
   onChange,
   multiple = false,
   allLabel = 'Any',
   size = 'md',
   align = 'start',
   className,
   icon,
}: {
   label: string;
   options: PickerOption[];
   /* One value, or a list of them for a multiple picker. */
   value: string | string[];
   onChange: (next: string | string[]) => void;
   multiple?: boolean;
   /* What the button says when a multiple picker has nothing chosen. */
   allLabel?: string;
   size?: 'sm' | 'md';
   align?: 'start' | 'end';
   className?: string;
   icon?: ReactNode;
}) {
   const [open, setOpen] = useState(false);
   const chosen = Array.isArray(value) ? value : [value];
   const chosenLabels = options
      .filter((o) => chosen.includes(o.value))
      .map((o) => o.label);

   const summary = multiple
      ? chosenLabels.length === 0
         ? allLabel
         : chosenLabels.length <= 2
           ? chosenLabels.join(', ')
           : `${chosenLabels[0]} + ${chosenLabels.length - 1}`
      : (chosenLabels[0] ?? allLabel);

   const toggle = (option: string) => {
      if (!multiple) {
         onChange(option);
         setOpen(false);
         return;
      }
      const set = new Set(chosen);
      if (set.has(option)) set.delete(option);
      else set.add(option);
      onChange([...set]);
   };

   return (
      <Popover.Root open={open} onOpenChange={setOpen}>
         <Popover.Trigger asChild>
            <button
               type="button"
               className={cn(
                  'inline-flex items-center gap-2 border border-line bg-background text-left transition-colors duration-150 [transition-timing-function:var(--ease)] hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal data-[state=open]:border-ink',
                  size === 'sm' ? 'h-10 px-3' : 'h-11 px-3.5',
                  multiple && chosen.length > 0 && 'border-ink',
                  className
               )}
            >
               {icon ? (
                  <span className="shrink-0 text-ink-2">{icon}</span>
               ) : null}
               <span className="flex min-w-0 flex-col leading-none">
                  <span className="lab text-[10px] text-ink-3">{label}</span>
                  <span
                     className={cn(
                        'g-tracked mt-0.5 truncate',
                        size === 'sm' ? 'text-[15px]' : 'text-[16px]'
                     )}
                  >
                     {summary}
                  </span>
               </span>
               <ChevronDownIcon
                  aria-hidden="true"
                  className={cn(
                     'ml-auto size-4 shrink-0 text-ink-3 transition-transform duration-150',
                     open && 'rotate-180'
                  )}
               />
            </button>
         </Popover.Trigger>
         <Popover.Portal>
            <Popover.Content
               align={align}
               sideOffset={6}
               collisionPadding={12}
               className="blk-plain z-[1000] w-[min(320px,calc(100vw-24px))] border border-line bg-background p-1 text-ink shadow-[0_10px_30px_rgba(11,9,9,0.18)] data-[state=open]:animate-in data-[state=closed]:animate-out"
            >
               <div className="flex items-baseline justify-between px-2 pt-1.5 pb-1">
                  <span className="lab text-ink-3">{label}</span>
                  {multiple && chosen.length > 0 ? (
                     <button
                        type="button"
                        onClick={() => onChange([])}
                        className="g-tracked text-[14px] text-teal-text"
                     >
                        Clear
                     </button>
                  ) : null}
               </div>
               <ul
                  role={multiple ? 'group' : 'listbox'}
                  className="max-h-[min(60vh,360px)] overflow-y-auto"
               >
                  {options.map((option) => {
                     const on = chosen.includes(option.value);
                     return (
                        <li key={option.value}>
                           <button
                              type="button"
                              role={multiple ? 'checkbox' : 'option'}
                              aria-checked={multiple ? on : undefined}
                              aria-selected={multiple ? undefined : on}
                              onClick={() => toggle(option.value)}
                              className={cn(
                                 'flex min-h-11 w-full items-center gap-3 px-2 text-left transition-colors duration-100 hover:bg-bg-2',
                                 on && !multiple && 'bg-bg-2'
                              )}
                           >
                              <span
                                 aria-hidden="true"
                                 className={cn(
                                    'grid size-5 shrink-0 place-items-center border',
                                    on
                                       ? 'border-ink bg-ink text-background'
                                       : 'border-line-2'
                                 )}
                              >
                                 {on ? (
                                    <CheckIcon
                                       className="size-3.5"
                                       strokeWidth={3}
                                    />
                                 ) : null}
                              </span>
                              {option.mark ? (
                                 <span className="shrink-0">{option.mark}</span>
                              ) : null}
                              <span className="flex min-w-0 flex-col">
                                 <span className="g-tracked truncate text-[16px]">
                                    {option.label}
                                 </span>
                                 {option.hint ? (
                                    <span className="text-[13px] text-ink-3">
                                       {option.hint}
                                    </span>
                                 ) : null}
                              </span>
                           </button>
                        </li>
                     );
                  })}
               </ul>
            </Popover.Content>
         </Popover.Portal>
      </Popover.Root>
   );
}
