import { cn } from '@/lib/utils';

/*
 * The small figures: how many, how deep, how warm the water was.
 *
 * The same box as a length or a weight, a size down, because these three sit
 * three across inside the More fold and are read rather than aimed at. A unit
 * that cannot be changed is a word in its own cell, never a dropdown.
 */
export function SmallBox({
   id,
   label,
   value,
   onChange,
   unit,
   inputMode = 'decimal',
   placeholder,
   className,
}: {
   id: string;
   label: string;
   value: string;
   onChange: (value: string) => void;
   /* Left out, the figure takes the whole box: a count has no unit. */
   unit?: string;
   inputMode?: 'decimal' | 'numeric';
   placeholder?: string;
   className?: string;
}) {
   return (
      <div className={cn('flex min-w-0 flex-col gap-2', className)}>
         <label className="lab" htmlFor={id}>
            {label}
         </label>
         <div className="flex items-stretch border border-line bg-bg-2 transition-colors duration-150 focus-within:border-ink hover:border-ink-3">
            <input
               id={id}
               name={id}
               type="text"
               inputMode={inputMode}
               autoComplete="off"
               value={value}
               placeholder={placeholder}
               onChange={(event) => onChange(event.target.value)}
               className="g num h-11 min-w-0 flex-1 bg-transparent px-3 text-[24px] text-ink outline-none placeholder:text-ink-3"
            />
            {unit ? (
               <span className="g-tracked grid w-[52px] shrink-0 place-items-center border-l border-line bg-background text-[15px] text-ink">
                  {unit}
               </span>
            ) : null}
         </div>
      </div>
   );
}
