import { cn } from '@/lib/utils';
import { convertTyped, type MeasureUnit } from './measure';

/*
 * A measurement on the fast log: the figure in a box with its unit fixed to
 * the right, and under it a two-way switch for how it was taken. The switch
 * is a real segmented control at the full width of the field, because "by
 * eye" versus "on a tape" is the difference between a fish and a fish story,
 * and a thumb has to be able to hit it on a rock in the wind.
 */
export function MeasureField({
   id,
   label,
   units,
   unit,
   value,
   onChange,
   onUnitChange,
   sources,
   source,
   onSourceChange,
   placeholder,
}: {
   id: string;
   label: string;
   units: readonly [MeasureUnit, MeasureUnit];
   unit: MeasureUnit;
   value: string;
   onChange: (value: string) => void;
   onUnitChange: (unit: MeasureUnit) => void;
   /* The two ways it could have been taken, the rough one first. */
   sources: readonly [
      { value: string; label: string },
      { value: string; label: string },
   ];
   source: string;
   onSourceChange: (source: string) => void;
   placeholder?: string;
}) {
   const switchUnit = (next: MeasureUnit) => {
      if (next === unit) return;
      onChange(convertTyped(value, unit, next));
      onUnitChange(next);
   };

   return (
      <div className="flex min-w-0 flex-col">
         <label className="lab" htmlFor={id}>
            {label}
         </label>
         <div className="mt-1.5 flex items-stretch">
            <input
               id={id}
               name={id}
               type="text"
               inputMode="decimal"
               autoComplete="off"
               value={value}
               placeholder={placeholder}
               onChange={(event) => onChange(event.target.value)}
               className="input-line g num min-w-0 flex-1 text-[30px]"
            />
            <div
               role="group"
               aria-label={`${label} unit`}
               className="flex shrink-0 border border-l-0 border-line border-b-2 border-b-line-2"
            >
               {units.map((option) => (
                  <button
                     key={option}
                     type="button"
                     aria-pressed={unit === option}
                     onClick={() => switchUnit(option)}
                     className={cn(
                        'g-tracked min-w-11 px-2.5 text-[16px] transition-colors duration-150 [transition-timing-function:var(--ease)]',
                        unit === option
                           ? 'bg-ink text-background'
                           : 'text-ink-2 hover:text-ink'
                     )}
                  >
                     {option}
                  </button>
               ))}
            </div>
         </div>
         <div
            role="radiogroup"
            aria-label={`How the ${label.toLowerCase()} was taken`}
            className="mt-2 grid grid-cols-2 border border-line"
         >
            {sources.map((option) => {
               const on = source === option.value;
               return (
                  <button
                     key={option.value}
                     type="button"
                     role="radio"
                     aria-checked={on}
                     onClick={() => onSourceChange(option.value)}
                     className={cn(
                        'g-tracked h-11 text-[16px] transition-colors duration-150 [transition-timing-function:var(--ease)]',
                        on
                           ? 'bg-ink text-background'
                           : 'text-ink-2 hover:text-ink'
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
