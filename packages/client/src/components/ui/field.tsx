import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react';
import type { InputHTMLAttributes, Ref, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/*
 * One field, everywhere.
 *
 * Before this there were twelve spellings of the same input across the forms:
 * mt-1 on one page and mt-2 on the next, text-[16px] here and text-base there,
 * h-11 on two of them and nothing on the rest. Nothing looked broken on its own
 * and no two forms lined up with each other, which is the version of wrong that
 * is hardest to point at and easiest to feel.
 *
 * So the rhythm lives here rather than in each page: label, control, hint, and
 * the space between them. A page picks a field and gets the same one the last
 * page got.
 *
 * 16px on the control is not a taste decision. Below it iOS zooms the viewport
 * when the field takes focus, and the page never zooms back.
 */

const CONTROL = 'input-line text-[16px]';

type Common = {
   label: string;
   /** The line under the field. Say what is allowed, not what went wrong. */
   hint?: ReactNode;
   error?: string | null;
   /** Where a field has to sit inside a grid rather than fill the column. */
   className?: string;
   /** For a label only a screen reader needs, such as a search field. */
   hideLabel?: boolean;
};

function Shell({
   id,
   label,
   hint,
   error,
   className,
   hideLabel,
   children,
}: Common & { id: string; children: ReactNode }) {
   return (
      <div className={cn('flex min-w-0 flex-col', className)}>
         <label htmlFor={id} className={cn('lab', hideLabel && 'sr-only')}>
            {label}
         </label>

         {/* One gap, set once. Every field in the product now shares it. */}
         <div className="mt-1.5">{children}</div>

         {error ? (
            <p
               id={`${id}-error`}
               role="alert"
               className="mt-1.5 text-[14px] text-destructive"
            >
               {error}
            </p>
         ) : hint ? (
            <p id={`${id}-hint`} className="mt-1.5 text-[14px] text-ink-3">
               {hint}
            </p>
         ) : null}
      </div>
   );
}

type TextFieldProps = Common &
   Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> & {
      /** Tabular figures, for anything that is a measurement. */
      numeric?: boolean;
      /* A form that reports an error also has to put the cursor back in the
       * field it is complaining about. React 19 takes ref as a plain prop. */
      ref?: Ref<HTMLInputElement>;
   };

export function TextField({
   label,
   hint,
   error,
   className,
   hideLabel,
   numeric,
   ref,
   ...rest
}: TextFieldProps) {
   const id = useId();
   return (
      <Shell
         id={id}
         label={label}
         hint={hint}
         error={error}
         className={className}
         hideLabel={hideLabel}
      >
         <input
            id={id}
            ref={ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={
               error ? `${id}-error` : hint ? `${id}-hint` : undefined
            }
            className={cn(CONTROL, numeric && 'num')}
            {...rest}
         />
      </Shell>
   );
}

type TextAreaProps = Common &
   Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'id'> & {
      ref?: Ref<HTMLTextAreaElement>;
   };

export function TextArea({
   label,
   hint,
   error,
   className,
   hideLabel,
   ref,
   ...rest
}: TextAreaProps) {
   const id = useId();
   return (
      <Shell
         id={id}
         label={label}
         hint={hint}
         error={error}
         className={className}
         hideLabel={hideLabel}
      >
         <textarea
            id={id}
            ref={ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={
               error ? `${id}-error` : hint ? `${id}-hint` : undefined
            }
            className={cn(CONTROL, 'resize-y')}
            {...rest}
         />
      </Shell>
   );
}

type SelectFieldProps = Common &
   Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'id'>;

export function SelectField({
   label,
   hint,
   error,
   className,
   hideLabel,
   children,
   ...rest
}: SelectFieldProps) {
   const id = useId();
   return (
      <Shell
         id={id}
         label={label}
         hint={hint}
         error={error}
         className={className}
         hideLabel={hideLabel}
      >
         <select id={id} className={CONTROL} {...rest}>
            {children}
         </select>
      </Shell>
   );
}

/*
 * One choice from a few, as chips.
 *
 * This pattern was rewritten by hand on six screens, each with its own idea of
 * the selected colour and the height. A radiogroup rather than a row of
 * buttons, so the arrow keys move between the options and only the chosen chip
 * is a tab stop, which is what a screen reader expects of a filter.
 */
export function ChoiceGroup<T extends string>({
   label,
   value,
   options,
   onChange,
   hint,
   className,
   hideLabel,
   size = 'md',
   inline = false,
   nowrap = false,
}: Common & {
   value: T;
   options: ReadonlyArray<{ value: T; label: string }>;
   onChange: (next: T) => void;
   size?: 'sm' | 'md';
   /* One row that scrolls sideways rather than wrapping, for a strip of
    * filters at the top of a phone where every wrapped row is a post lost. */
   nowrap?: boolean;
   /*
    * Label beside the chips rather than above them. Two filter groups stacked
    * with a label over each cost four rows near the top of a phone, which is
    * most of the space before the first post. Beside them it is two.
    */
   inline?: boolean;
}) {
   const id = useId();

   return (
      <div
         className={cn(
            'flex min-w-0',
            inline
               ? cn(
                    'items-center gap-x-3 gap-y-2',
                    nowrap ? 'flex-nowrap' : 'flex-wrap'
                 )
               : 'flex-col',
            className
         )}
      >
         <span id={id} className={cn('lab shrink-0', hideLabel && 'sr-only')}>
            {label}
         </span>

         <div
            role="radiogroup"
            aria-labelledby={id}
            onKeyDown={(event) => {
               /*
                * Only the chosen chip is a tab stop, so the arrows are the one
                * way a keyboard reaches the others. Without this, Only me on
                * the spot and catch forms could not be chosen without a mouse.
                * It chooses as it moves, the way a native radio group does.
                */
               const step =
                  event.key === 'ArrowRight' || event.key === 'ArrowDown'
                     ? 1
                     : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                       ? -1
                       : 0;
               if (!step || !options.length) return;
               event.preventDefault();
               const at = options.findIndex((o) => o.value === value);
               const index =
                  (Math.max(at, 0) + step + options.length) % options.length;
               const next = options[index];
               if (!next) return;
               onChange(next.value);
               const chips =
                  event.currentTarget.querySelectorAll<HTMLButtonElement>(
                     '[role=radio]'
                  );
               chips[index]?.focus();
            }}
            className={cn(
               'flex gap-2',
               nowrap ? 'flex-nowrap' : 'flex-wrap',
               !inline && 'mt-1.5'
            )}
         >
            {options.map((option, index) => {
               const on = option.value === value;
               /* With nothing chosen the first chip holds the tab stop, or
                  the group could not be reached at all. */
               const stop =
                  on ||
                  (index === 0 && !options.some((o) => o.value === value));
               return (
                  <button
                     key={option.value}
                     type="button"
                     role="radio"
                     aria-checked={on}
                     tabIndex={stop ? 0 : -1}
                     onClick={() => onChange(option.value)}
                     className={cn(
                        'g-tracked inline-flex items-center border transition-colors duration-150 [transition-timing-function:var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
                        size === 'sm'
                           ? 'h-10 px-3 text-[15px]'
                           : 'h-11 px-3.5 text-[16px]',
                        on
                           ? 'border-ink bg-ink text-background'
                           : 'border-line text-ink-2 hover:border-ink hover:text-ink'
                     )}
                  >
                     {option.label}
                  </button>
               );
            })}
         </div>

         {hint ? <p className="mt-1.5 text-[14px] text-ink-3">{hint}</p> : null}
      </div>
   );
}

/**
 * The stack a form sits in.
 *
 * One gap between fields, set once, so two forms next to each other agree.
 */
export function FieldStack({
   children,
   className,
}: {
   children: ReactNode;
   className?: string;
}) {
   return (
      <div className={cn('flex flex-col gap-5', className)}>{children}</div>
   );
}

/** Two fields on one line where there is room, stacked where there is not. */
export function FieldRow({
   children,
   className,
}: {
   children: ReactNode;
   className?: string;
}) {
   return (
      <div className={cn('grid gap-5 sm:grid-cols-2', className)}>
         {children}
      </div>
   );
}

/*
 * Several on at once, as chips.
 *
 * The same chip as ChoiceGroup, with checkbox rather than radio semantics: a
 * set of layers on a map, where any number can be showing. Kept beside the
 * single-choice group so the two rows on a map line up, label for label.
 */
export function ToggleGroup({
   label,
   options,
   className,
   hideLabel,
   size = 'md',
   inline = false,
   nowrap = false,
}: Common & {
   options: ReadonlyArray<{
      value: string;
      label: string;
      on: boolean;
      onToggle: () => void;
   }>;
   size?: 'sm' | 'md';
   inline?: boolean;
   nowrap?: boolean;
}) {
   const id = useId();

   return (
      <div
         className={cn(
            'flex min-w-0',
            inline
               ? cn(
                    'items-center gap-x-3 gap-y-2',
                    nowrap ? 'flex-nowrap' : 'flex-wrap'
                 )
               : 'flex-col',
            className
         )}
      >
         <span id={id} className={cn('lab shrink-0', hideLabel && 'sr-only')}>
            {label}
         </span>

         <div
            role="group"
            aria-labelledby={id}
            className={cn(
               'flex gap-2',
               nowrap ? 'flex-nowrap' : 'flex-wrap',
               !inline && 'mt-1.5'
            )}
         >
            {options.map((option) => (
               <button
                  key={option.value}
                  type="button"
                  aria-pressed={option.on}
                  onClick={option.onToggle}
                  className={cn(
                     'g-tracked inline-flex items-center border transition-colors duration-150 [transition-timing-function:var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
                     size === 'sm'
                        ? 'h-10 px-3 text-[15px]'
                        : 'h-11 px-3.5 text-[16px]',
                     option.on
                        ? 'border-ink bg-ink text-background'
                        : 'border-line text-ink-2 hover:border-ink hover:text-ink'
                  )}
               >
                  {option.label}
               </button>
            ))}
         </div>
      </div>
   );
}

/*
 * A distance, by dragging.
 *
 * A native range input under our own drawing, so the thumb drags on a phone,
 * steps with the arrow keys and reads to a screen reader as what it is. The
 * stops are the distances anyone actually means; the thumb snaps between
 * them and the value sits over it. The dashed track is the product's
 * fishing line, which is what a radius is drawn with.
 */
export function RangeField({
   label,
   stops,
   value,
   onChange,
   onCommit,
   format,
   hint,
   className,
}: Common & {
   stops: ReadonlyArray<number>;
   value: number;
   onChange: (next: number) => void;
   /** When the drag ends, for anything that costs a request. */
   onCommit?: (next: number) => void;
   format: (value: number) => string;
}) {
   const id = useId();
   const index = Math.max(0, stops.indexOf(value));
   const last = stops.length - 1;
   const pct = last > 0 ? (index / last) * 100 : 0;

   return (
      <div className={cn('flex min-w-0 flex-col', className)}>
         <div className="flex items-baseline justify-between gap-4">
            <label htmlFor={id} className="lab">
               {label}
            </label>
            <output htmlFor={id} className="g num text-[24px] leading-none">
               {format(value)}
            </output>
         </div>

         <div className="range mt-3">
            <span
               aria-hidden="true"
               className="range-fill"
               style={{ width: `${pct}%` }}
            />
            {stops.map((stop, i) => (
               <span
                  key={stop}
                  aria-hidden="true"
                  className={cn('range-tick', i <= index && 'range-tick-on')}
                  style={{ left: `${(i / last) * 100}%` }}
               />
            ))}
            <input
               id={id}
               type="range"
               min={0}
               max={last}
               step={1}
               value={index}
               aria-valuetext={format(value)}
               onChange={(event) => {
                  const next = stops[Number(event.target.value)];
                  if (typeof next === 'number') onChange(next);
               }}
               onPointerUp={() => onCommit?.(value)}
               onKeyUp={() => onCommit?.(value)}
               onBlur={() => onCommit?.(value)}
            />
         </div>

         <div
            aria-hidden="true"
            className="num mt-1.5 flex justify-between text-[12px] text-ink-3"
         >
            {stops.map((stop) => (
               <span key={stop}>{format(stop)}</span>
            ))}
         </div>

         {hint ? <p className="mt-1.5 text-[14px] text-ink-3">{hint}</p> : null}
      </div>
   );
}
