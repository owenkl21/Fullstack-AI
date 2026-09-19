import type { ReactNode } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

/*
 * A figure with its unit: the box the review draws for a weight, a length and
 * a competition's radius, in one place so those are the same object.
 *
 * The figure is League Gothic at 28px in a 52px box on bg-2, and the unit
 * stands in its own cell behind a left hairline on the page's own ground. The
 * unit cell is a dropdown when there is a choice to make (kg or lb, cm or in)
 * and a plain word when there is not (a radius is in km and nothing else), so
 * a fixed unit never pretends to be a control.
 *
 * What this deliberately does not know: how to convert a typed figure when the
 * unit changes, and how it was taken. Conversion belongs to the caller's
 * onUnitChange; "by eye" or "on a tape" is a line of its own, passed as
 * children and drawn under the box.
 */
export function MeasureBox<U extends string>({
   id,
   label,
   value,
   onChange,
   unit,
   units,
   onUnitChange,
   placeholder,
   error,
   onBlur,
   readOnly = false,
   fieldName,
   className,
   children,
}: {
   id: string;
   label: string;
   value: string;
   onChange: (value: string) => void;
   /* The unit shown in the cell on the right. */
   unit: U;
   /* The units on offer. One of them, and the cell is a word, not a select. */
   units: readonly U[];
   onUnitChange?: (unit: U) => void;
   placeholder?: string;
   /* What is wrong with the figure, checked when the field is left. */
   error?: string;
   onBlur?: () => void;
   /* Set by a reading off a photograph, and not for typing over. */
   readOnly?: boolean;
   /* The name the form's focus-on-error looks the field up by. */
   fieldName?: string;
   className?: string;
   /* The quiet line under the box, where a caller has one. */
   children?: ReactNode;
}) {
   const choosable = units.length > 1 && Boolean(onUnitChange);

   return (
      <div className={cn('flex min-w-0 flex-col', className)}>
         <label className="lab" htmlFor={id}>
            {label}
         </label>
         <div
            className={cn(
               'mt-2 flex items-stretch border border-line bg-bg-2 transition-colors duration-150 [transition-timing-function:var(--ease)] focus-within:border-ink hover:border-ink-3',
               error && 'border-destructive'
            )}
         >
            <input
               id={id}
               name={id}
               data-field={fieldName}
               type="text"
               inputMode="decimal"
               autoComplete="off"
               value={value}
               readOnly={readOnly}
               placeholder={placeholder}
               aria-invalid={error ? true : undefined}
               aria-describedby={error ? `${id}-error` : undefined}
               onChange={(event) => onChange(event.target.value)}
               onBlur={onBlur}
               className={cn(
                  'g num h-[52px] min-w-0 flex-1 bg-transparent px-3 text-[28px] text-ink outline-none placeholder:text-ink-3',
                  readOnly && 'text-ink-2'
               )}
            />
            {choosable ? (
               /* The chevron gets its own room rather than being jammed
                  against the hairline. */
               <div className="relative flex shrink-0 border-l border-line bg-background">
                  <select
                     aria-label={`${label} unit`}
                     value={unit}
                     onChange={(event) =>
                        onUnitChange?.(event.target.value as U)
                     }
                     className="g-tracked h-full w-[62px] cursor-pointer appearance-none bg-transparent pr-6 pl-3 text-[16px] text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal md:w-[68px]"
                  >
                     {units.map((option) => (
                        <option key={option} value={option}>
                           {option}
                        </option>
                     ))}
                  </select>
                  <ChevronDownIcon
                     aria-hidden="true"
                     strokeWidth={2}
                     className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-ink-2"
                  />
               </div>
            ) : (
               <span className="g-tracked grid w-[52px] shrink-0 place-items-center border-l border-line bg-background text-[16px] text-ink">
                  {unit}
               </span>
            )}
         </div>
         {children}
         {error ? (
            <p
               id={`${id}-error`}
               role="alert"
               className="mt-1.5 text-[14px] text-destructive"
            >
               {error}
            </p>
         ) : null}
      </div>
   );
}
