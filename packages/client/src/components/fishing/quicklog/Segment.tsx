import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/utils';

/*
 * A two or three way choice drawn as one bar, each cell with its mark and
 * word, the chosen one in ink. The same control the design uses for kept or
 * released, who can see it, and whether the spot shows.
 */
export function Segment<T extends string>({
   label,
   value,
   onChange,
   options,
   className,
}: {
   label: string;
   value: T | null;
   onChange: (next: T) => void;
   options: ReadonlyArray<{
      value: T;
      label: string;
      Icon?: ComponentType<SVGProps<SVGSVGElement>>;
   }>;
   className?: string;
}) {
   return (
      <div
         role="radiogroup"
         aria-label={label}
         className={cn('flex min-w-0', className)}
      >
         {options.map((option, i) => {
            const on = value === option.value;
            const Icon = option.Icon;
            return (
               <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange(option.value)}
                  className={cn(
                     'g-tracked flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 border border-line px-3 text-[15px] whitespace-nowrap transition-colors duration-150 [transition-timing-function:var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
                     i > 0 && 'border-l-0',
                     on
                        ? 'border-ink bg-ink text-background'
                        : 'bg-background text-ink hover:border-ink-3'
                  )}
               >
                  {Icon ? (
                     <Icon aria-hidden="true" className="size-4 shrink-0" />
                  ) : null}
                  {option.label}
               </button>
            );
         })}
      </div>
   );
}
