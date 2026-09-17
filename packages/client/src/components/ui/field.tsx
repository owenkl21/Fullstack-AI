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
}: Common & {
   value: T;
   options: ReadonlyArray<{ value: T; label: string }>;
   onChange: (next: T) => void;
   size?: 'sm' | 'md';
}) {
   const id = useId();

   return (
      <div className={cn('flex min-w-0 flex-col', className)}>
         <span id={id} className={cn('lab', hideLabel && 'sr-only')}>
            {label}
         </span>

         <div
            role="radiogroup"
            aria-labelledby={id}
            className="mt-1.5 flex flex-wrap gap-2"
         >
            {options.map((option) => {
               const on = option.value === value;
               return (
                  <button
                     key={option.value}
                     type="button"
                     role="radio"
                     aria-checked={on}
                     tabIndex={on ? 0 : -1}
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
