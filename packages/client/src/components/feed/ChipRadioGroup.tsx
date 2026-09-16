import { useId, useRef, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

export type ChipOption<T extends string> = {
   value: T;
   label: string;
};

/*
 * Square chips, one choice at a time. A radiogroup rather than a row of toggles,
 * so the arrow keys move between the options and only the chosen chip is a tab
 * stop, which is what a screen reader expects from a filter like this.
 */
export function ChipRadioGroup<T extends string>({
   label,
   value,
   options,
   onChange,
   className,
}: {
   label: string;
   value: T;
   options: ReadonlyArray<ChipOption<T>>;
   onChange: (next: T) => void;
   className?: string;
}) {
   const labelId = useId();
   const groupRef = useRef<HTMLDivElement>(null);

   const move = (step: number) => {
      const current = options.findIndex((option) => option.value === value);
      const next = options[(current + step + options.length) % options.length];
      if (!next) return;
      onChange(next.value);
      const buttons =
         groupRef.current?.querySelectorAll<HTMLButtonElement>(
            '[role="radio"]'
         );
      buttons?.[options.indexOf(next)]?.focus();
   };

   const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
         event.preventDefault();
         move(1);
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
         event.preventDefault();
         move(-1);
      }
   };

   return (
      <div className={cn('flex flex-col gap-2', className)}>
         <span id={labelId} className="lab">
            {label}
         </span>
         <div
            ref={groupRef}
            role="radiogroup"
            aria-labelledby={labelId}
            onKeyDown={onKeyDown}
            className="flex flex-wrap gap-2"
         >
            {options.map((option) => {
               const selected = option.value === value;
               return (
                  <button
                     key={option.value}
                     type="button"
                     role="radio"
                     aria-checked={selected}
                     tabIndex={selected ? 0 : -1}
                     onClick={() => onChange(option.value)}
                     className={cn(
                        'g-tracked inline-flex h-12 items-center border px-4 text-[19px] transition-[background-color,color,border-color] duration-150 [transition-timing-function:var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
                        selected
                           ? 'border-ink bg-ink text-background'
                           : 'border-line text-ink-2 hover:border-ink hover:text-ink'
                     )}
                  >
                     {option.label}
                  </button>
               );
            })}
         </div>
      </div>
   );
}
