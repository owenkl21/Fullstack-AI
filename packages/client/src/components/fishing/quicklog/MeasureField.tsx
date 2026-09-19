import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { MeasureBox } from '@/components/ui/measure-box';
import { convertTyped, type MeasureUnit } from './measure';

/*
 * A measurement, on the fast log and on the full form: the figure in a box
 * with its unit as a chip to the right, and under it a quiet line for how it
 * was taken. "By eye" against "on a tape" is the difference between a fish
 * and a fish story, so it is never hidden, but it is quiet: a 40px line under
 * a hairline, not a switch.
 *
 * The box itself is the shared MeasureBox, so a fish and a competition's
 * radius are literally the same object. Only the line under it is ours.
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
   error,
   onBlur,
   readOnly = false,
   fieldName,
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
   /* What is wrong with the figure, checked when the field is left. */
   error?: string;
   onBlur?: () => void;
   /* Set by a reading off a photograph, and not for typing over. */
   readOnly?: boolean;
   /* The name the form's focus-on-error looks the field up by. */
   fieldName?: string;
}) {
   const switchUnit = (next: MeasureUnit) => {
      if (next === unit) return;
      onChange(convertTyped(value, unit, next));
      onUnitChange(next);
   };

   return (
      <MeasureBox
         id={id}
         label={label}
         value={value}
         onChange={onChange}
         unit={unit}
         units={units}
         onUnitChange={switchUnit}
         placeholder={placeholder}
         error={error}
         onBlur={onBlur}
         readOnly={readOnly}
         fieldName={fieldName}
      >
         <div className="relative">
            <select
               aria-label={`How the ${label.toLowerCase()} was taken`}
               value={source}
               disabled={readOnly}
               onChange={(event) => onSourceChange(event.target.value)}
               className="h-10 w-full cursor-pointer appearance-none border-b border-line bg-transparent pr-6 text-[14px] text-ink-2 outline-none focus-visible:text-ink disabled:opacity-60"
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
               className="pointer-events-none absolute top-1/2 right-0 size-3.5 -translate-y-1/2 text-ink-2"
            />
         </div>
      </MeasureBox>
   );
}
