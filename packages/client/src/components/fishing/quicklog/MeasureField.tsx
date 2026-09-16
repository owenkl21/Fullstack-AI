import { cn } from '@/lib/utils';
import { convertTyped, type MeasureUnit } from './measure';

/*
 * Length and weight as big numerals with a unit beside them. Switching the unit
 * converts what is already typed rather than throwing it away. How the fish was
 * measured is shown but cannot be stored yet.
 */
// TODO(api): appendix E, a catch stores no measurement source, so "on a tape" and
// "on a scale" are shown to the angler but not saved.

export function MeasureField({
   id,
   label,
   units,
   unit,
   value,
   onChange,
   onUnitChange,
   sourceLabel,
   sourceAction,
   sourceOn,
   onSourceToggle,
}: {
   id: string;
   label: string;
   units: readonly [MeasureUnit, MeasureUnit];
   unit: MeasureUnit;
   value: string;
   onChange: (value: string) => void;
   onUnitChange: (unit: MeasureUnit) => void;
   sourceLabel: string;
   sourceAction: string;
   sourceOn: boolean;
   onSourceToggle: () => void;
}) {
   const switchUnit = (next: MeasureUnit) => {
      if (next === unit) {
         return;
      }
      onChange(convertTyped(value, unit, next));
      onUnitChange(next);
   };

   return (
      <div className="flex flex-col gap-1.5 rule-dashed pt-2">
         <label className="lab" htmlFor={id}>
            {label}
         </label>
         <div className="flex items-baseline gap-1.5">
            <input
               id={id}
               name={id}
               type="text"
               inputMode="decimal"
               autoComplete="off"
               value={value}
               onChange={(event) => onChange(event.target.value)}
               className="g num w-full min-w-0 border-0 bg-transparent p-0 text-[48px] leading-none outline-none"
            />
            <span className="shrink-0 text-[14px] text-ink-2">{unit}</span>
         </div>
         <div className="flex gap-1.5">
            {units.map((option) => (
               <button
                  key={option}
                  type="button"
                  aria-pressed={unit === option}
                  aria-label={`${label} in ${option}`}
                  onClick={() => switchUnit(option)}
                  className={cn(
                     'g-tracked inline-flex h-11 items-center border px-3 text-[17px] transition-[background-color,color] duration-150',
                     unit === option
                        ? 'border-ink bg-ink text-background'
                        : 'border-ink text-ink hover:bg-bg-2'
                  )}
               >
                  {option}
               </button>
            ))}
         </div>
         <div
            className={cn(
               'flex flex-wrap items-center gap-x-3 text-[14px]',
               sourceOn ? 'text-ink' : 'text-ink-3'
            )}
         >
            <span>{sourceLabel}</span>
            <button
               type="button"
               aria-pressed={sourceOn}
               onClick={onSourceToggle}
               className="inline-flex h-11 items-center font-medium text-teal-text"
            >
               {sourceOn ? 'Undo' : sourceAction}
            </button>
         </div>
      </div>
   );
}
