import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { convertTyped, type MeasureUnit } from './measure';

/*
 * A measurement on the fast log: the figure in a box with its unit as a
 * dropdown fixed to the right, and under it a line for how it was taken.
 * "By eye" against "on a tape" is the difference between a fish and a fish
 * story, so it is never hidden, but it is quiet: a muted line, not a switch.
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
         <label className="lab text-ink-2" htmlFor={id}>
            {label}
         </label>
         <div className="mt-1.5 flex items-stretch border border-line-2 bg-bg-2 transition-colors duration-150 [transition-timing-function:var(--ease)] focus-within:border-ink hover:border-ink-3">
            <input
               id={id}
               name={id}
               type="text"
               inputMode="decimal"
               autoComplete="off"
               value={value}
               placeholder={placeholder}
               onChange={(event) => onChange(event.target.value)}
               className="g num h-[52px] min-w-0 flex-1 bg-transparent px-3 text-[26px] text-ink outline-none placeholder:text-ink-3"
            />
            {/* The unit: a real dropdown, with the chevron given its own room
                rather than jammed against the edge. */}
            <div className="relative flex shrink-0 border-l border-line-2 bg-background">
               <select
                  aria-label={`${label} unit`}
                  value={unit}
                  onChange={(event) =>
                     switchUnit(event.target.value as MeasureUnit)
                  }
                  className="g-tracked h-full w-[68px] cursor-pointer appearance-none bg-transparent pr-7 pl-3 text-[16px] text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal"
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
                  className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-2"
               />
            </div>
         </div>
         <div className="relative">
            <select
               aria-label={`How the ${label.toLowerCase()} was taken`}
               value={source}
               onChange={(event) => onSourceChange(event.target.value)}
               className="h-10 w-full cursor-pointer appearance-none border-b border-line bg-transparent pr-7 text-[13px] text-ink-2 outline-none focus-visible:text-ink"
            >
               {sources.map((option) => (
                  <option key={option.value} value={option.value}>
                     {option.label}
                  </option>
               ))}
            </select>
            <ChevronDownIcon
               aria-hidden="true"
               strokeWidth={2}
               className="pointer-events-none absolute top-1/2 right-1 size-3.5 -translate-y-1/2 text-ink-3"
            />
         </div>
      </div>
   );
}
