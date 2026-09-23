import { useRef, type KeyboardEvent } from 'react';
import { unitFor, useUnits, writeUnits } from '@/lib/units';
import { cn } from '@/lib/utils';

/*
 * Centimetres or inches, kilograms or pounds, on a competition.
 *
 * Only the pair the competition is judged in: a length competition offers
 * cm and in, a weight one kg and lb, because the other pair would change
 * nothing on the page. The choice is the reader's and is kept on the device
 * (lib/units.ts), so the standings, the entries and the entry form all move
 * with it, and so does every other board. The competition itself is never
 * converted: its rankings stay in the unit it was set up in.
 *
 * Two square cells on a hairline with an ink block that slides to the one
 * chosen, the way a switch on a scale reads. A radio group, so the arrow keys
 * move the choice and Tab lands on the chosen cell only.
 */
export function UnitToggle({
   measure,
   className,
}: {
   measure: 'LENGTH' | 'WEIGHT';
   className?: string;
}) {
   const units = useUnits();
   const current = unitFor(measure, units);
   const options =
      measure === 'LENGTH' ? (['cm', 'in'] as const) : (['kg', 'lb'] as const);
   const refs = useRef<(HTMLButtonElement | null)[]>([]);
   const index = options.findIndex((option) => option === current);

   const choose = (next: (typeof options)[number]) =>
      writeUnits(
         measure === 'LENGTH'
            ? { length: next as 'cm' | 'in' }
            : { mass: next as 'kg' | 'lb' }
      );

   const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      const step =
         event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? 1
            : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
              ? -1
              : 0;
      if (!step) return;
      event.preventDefault();
      const next = (index + step + options.length) % options.length;
      choose(options[next]!);
      refs.current[next]?.focus();
   };

   return (
      <div className={cn('flex items-center gap-3', className)}>
         <span className="lab" id={`units-${measure}`}>
            Show in
         </span>
         <div
            role="radiogroup"
            aria-labelledby={`units-${measure}`}
            onKeyDown={onKeyDown}
            className="relative grid grid-cols-2 border border-line-2"
         >
            {/* The ink block behind the chosen cell. */}
            <span
               aria-hidden="true"
               className="absolute inset-y-0 left-0 w-1/2 bg-ink transition-transform duration-300 [transition-timing-function:var(--ease)]"
               style={{ transform: `translateX(${index * 100}%)` }}
            />
            {options.map((option, i) => {
               const on = option === current;
               return (
                  <button
                     key={option}
                     ref={(node) => {
                        refs.current[i] = node;
                     }}
                     type="button"
                     role="radio"
                     aria-checked={on}
                     tabIndex={on ? 0 : -1}
                     onClick={() => choose(option)}
                     className={cn(
                        'g-tracked relative grid h-11 w-12 place-items-center text-[17px] transition-colors duration-200 [transition-timing-function:var(--ease)] focus-visible:outline-offset-2',
                        on ? 'text-background' : 'text-ink-2 hover:text-ink'
                     )}
                  >
                     {option}
                  </button>
               );
            })}
         </div>
      </div>
   );
}
