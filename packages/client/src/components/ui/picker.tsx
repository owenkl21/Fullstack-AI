import * as Popover from '@radix-ui/react-popover';
import {
   CheckIcon,
   ChevronDownIcon,
   XMarkIcon,
} from '@heroicons/react/24/outline';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { usePhone } from '@/lib/media';

/*
 * A filter you open, in the house style.
 *
 * A button that says what is chosen, and a panel of options under it. One
 * choice or several. Built on Radix Popover so it handles focus, the escape
 * key and a tap outside; everything visible is ours: radius 0, ink on paper,
 * League Gothic on the labels.
 *
 * On a phone the panel is a sheet that rises from the bottom of the screen
 * with a Done button, because a popover pinned to a thumb-sized trigger is
 * what made these feel loose. On a desktop it is a panel under the button.
 * The button itself says how many are chosen and which, the open one is
 * ruled in ink, and chosen rows are marked and tinted so a long list still
 * reads at a glance.
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
   const phone = usePhone();
   const chosen = Array.isArray(value) ? value : [value];
   const chosenOptions = options.filter((o) => chosen.includes(o.value));
   const chosenLabels = chosenOptions.map((o) => o.label);

   const summary = multiple
      ? chosenLabels.length === 0
         ? allLabel
         : chosenLabels.length <= 2
           ? chosenLabels.join(', ')
           : `${chosenLabels[0]}, ${chosenLabels[1]} and ${chosenLabels.length - 2} more`
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

   const list = (
      <ul
         role={multiple ? 'group' : 'listbox'}
         aria-label={label}
         className={cn(
            'thread-scroll overflow-y-auto',
            phone ? 'max-h-[min(60vh,480px)]' : 'max-h-[min(60vh,360px)]'
         )}
      >
         {options.length === 0 ? (
            <li className="px-3 py-3 text-[14px] text-ink-3">
               Nothing to choose from yet.
            </li>
         ) : null}
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
                        'flex w-full items-center gap-3 border-l-[3px] px-3 text-left transition-colors duration-100',
                        phone ? 'min-h-12' : 'min-h-11',
                        on
                           ? 'border-teal bg-teal/10'
                           : 'border-transparent hover:bg-bg-2'
                     )}
                  >
                     <span
                        aria-hidden="true"
                        className={cn(
                           'grid size-5 shrink-0 place-items-center border transition-colors duration-100',
                           on
                              ? 'border-ink bg-ink text-background'
                              : 'border-line-2',
                           !multiple && 'rounded-full'
                        )}
                     >
                        {on ? (
                           <CheckIcon className="size-3.5" strokeWidth={3} />
                        ) : null}
                     </span>
                     {option.mark ? (
                        <span className="shrink-0">{option.mark}</span>
                     ) : null}
                     <span className="flex min-w-0 flex-col">
                        <span
                           className={cn(
                              'g-tracked truncate text-[16px]',
                              on && 'text-ink'
                           )}
                        >
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
   );

   const head = (
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
         <span className="flex min-w-0 flex-col">
            <span className="lab text-ink-3">{label}</span>
            {multiple ? (
               <span className="num text-[13px] text-ink-2">
                  {chosen.length === 0
                     ? 'None chosen'
                     : `${chosen.length} chosen`}
               </span>
            ) : null}
         </span>
         <span className="flex items-center gap-4">
            {multiple && chosen.length > 0 ? (
               <button
                  type="button"
                  onClick={() => onChange([])}
                  className="g-tracked text-[15px] text-teal-text"
               >
                  Clear
               </button>
            ) : null}
            {phone ? (
               <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="g-tracked inline-flex h-10 items-center gap-1 bg-ink px-3 text-[16px] text-background"
               >
                  Done
               </button>
            ) : null}
         </span>
      </div>
   );

   return (
      <Popover.Root open={open} onOpenChange={setOpen}>
         <Popover.Trigger asChild>
            <button
               type="button"
               aria-haspopup="listbox"
               aria-expanded={open}
               className={cn(
                  'inline-flex w-full items-center gap-2 border bg-background text-left transition-colors duration-150 [transition-timing-function:var(--ease)] hover:border-ink-3',
                  size === 'sm' ? 'min-h-11 px-3' : 'min-h-12 px-3.5',
                  open
                     ? 'border-ink shadow-[inset_0_-2px_0_var(--teal)]'
                     : chosen.length > 0 && (multiple || chosen[0])
                       ? 'border-ink'
                       : 'border-line',
                  className
               )}
            >
               {icon ? (
                  <span className="shrink-0 text-ink-2">{icon}</span>
               ) : null}
               <span className="flex min-w-0 flex-1 flex-col leading-none">
                  <span className="lab text-[10px] text-ink-3">{label}</span>
                  <span
                     className={cn(
                        'g-tracked mt-0.5 truncate',
                        size === 'sm' ? 'text-[15px]' : 'text-[16px]',
                        multiple && chosen.length === 0 && 'text-ink-2'
                     )}
                  >
                     {summary}
                  </span>
               </span>
               {multiple && chosen.length > 0 ? (
                  <span className="num grid size-6 shrink-0 place-items-center bg-ink text-[12px] text-background">
                     {chosen.length}
                  </span>
               ) : null}
               <ChevronDownIcon
                  aria-hidden="true"
                  className={cn(
                     'size-4 shrink-0 text-ink-3 transition-transform duration-150',
                     open && 'rotate-180 text-ink'
                  )}
               />
            </button>
         </Popover.Trigger>
         <Popover.Portal>
            {phone ? (
               <Popover.Content
                  side="bottom"
                  align="center"
                  sideOffset={0}
                  avoidCollisions={false}
                  onOpenAutoFocus={(event) => event.preventDefault()}
                  className="picker-sheet fixed inset-x-0 bottom-0 z-[1000] w-screen border-t-2 border-teal bg-background text-ink shadow-[0_-10px_30px_rgba(11,9,9,0.25)]"
               >
                  {head}
                  {list}
                  <div className="h-[env(safe-area-inset-bottom)]" />
               </Popover.Content>
            ) : (
               <Popover.Content
                  align={align}
                  sideOffset={6}
                  collisionPadding={12}
                  className="blk-plain z-[1000] w-[min(360px,calc(100vw-24px))] border border-line bg-background text-ink shadow-[0_10px_30px_rgba(11,9,9,0.18)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1"
               >
                  {head}
                  {list}
               </Popover.Content>
            )}
         </Popover.Portal>
      </Popover.Root>
   );
}

/* Small marks the pickers share: the cross that clears a chosen item. */
export function PickerClear({
   onClick,
   label,
}: {
   onClick: () => void;
   label: string;
}) {
   return (
      <button
         type="button"
         aria-label={label}
         onClick={onClick}
         className="grid size-6 place-items-center text-ink-3 hover:text-ink"
      >
         <XMarkIcon aria-hidden="true" className="size-4" />
      </button>
   );
}
