import type { RefObject } from 'react';
import { cn } from '@/lib/utils';
import { NOT_SURE } from './species';

/*
 * Species in three taps: the fish this angler actually logs, most recent first, and
 * a line to type anything else. There is no species field on a catch yet, so the
 * name chosen here becomes the record's title.
 */
export function SpeciesField({
   options,
   chosen,
   typed,
   onChoose,
   onType,
   error,
   inputRef,
}: {
   options: string[];
   chosen: string | null;
   typed: string;
   onChoose: (species: string) => void;
   onType: (value: string) => void;
   error: string | null;
   inputRef: RefObject<HTMLInputElement | null>;
}) {
   return (
      <div
         className="flex flex-col gap-2"
         role="group"
         aria-labelledby="species-label"
      >
         <span className="lab" id="species-label">
            Species
         </span>
         <div className="flex flex-wrap gap-2">
            {[...options, NOT_SURE].map((option) => {
               const on = chosen === option;
               return (
                  <button
                     key={option}
                     type="button"
                     aria-pressed={on}
                     onClick={() => onChoose(option)}
                     className={cn(
                        'g-tracked inline-flex h-11 items-center border px-3.5 text-[19px] transition-[background-color,color] duration-150',
                        on
                           ? 'border-ink bg-ink text-background'
                           : 'border-ink text-ink hover:bg-bg-2'
                     )}
                  >
                     {option}
                  </button>
               );
            })}
         </div>
         <label className="lab mt-1" htmlFor="species-other">
            Another species
         </label>
         <input
            ref={inputRef}
            id="species-other"
            name="species-other"
            type="text"
            autoComplete="off"
            maxLength={120}
            value={typed}
            onChange={(event) => onType(event.target.value)}
            className="input-line text-[16px]"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'species-error' : undefined}
         />
         {error ? (
            <p
               id="species-error"
               role="alert"
               className="text-[14px] text-destructive"
            >
               {error}
            </p>
         ) : null}
      </div>
   );
}
