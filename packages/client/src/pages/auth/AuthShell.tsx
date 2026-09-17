import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { useRef } from 'react';
import { useRevealIn } from '@/components/brand/Reveal';
import { TextField } from '@/components/ui/field';

/*
 * One column, the same shape on every auth screen, so signing in and resetting
 * a password do not feel like two different products.
 *
 * Copy rules apply here as everywhere: errors are sentences, nothing is a dash
 * or an invented zero, and no vendor is named in the interface.
 */

export function AuthShell({
   title,
   lead,
   children,
   footer,
}: {
   title: string;
   lead?: string;
   children: ReactNode;
   footer?: ReactNode;
}) {
   /* One arrival, staggered down the column, and nothing moves after it. */
   const root = useRef<HTMLElement>(null);
   useRevealIn(root);

   return (
      <section
         ref={root}
         className="mx-auto w-full max-w-[720px] px-4 py-12 md:px-8"
      >
         <h1 className="g rv text-[40px] md:text-[52px]">{title}</h1>
         {lead ? (
            <p
               className="rv mt-3 max-w-[52ch] text-[17px] text-ink-2"
               style={{ '--i': 1 } as CSSProperties}
            >
               {lead}
            </p>
         ) : null}
         <div className="rv mt-8" style={{ '--i': 2 } as CSSProperties}>
            {children}
         </div>
         {footer ? (
            <div
               className="rule-dashed rv mt-10 pt-4"
               style={{ '--i': 3 } as CSSProperties}
            >
               {footer}
            </div>
         ) : null}
      </section>
   );
}

/*
 * The auth pages' field, which is now the product's field.
 *
 * It had its own spacing, a grid gap of 2 where the rest of the app used a top
 * margin, so sign in and the profile settings did not line up with each other
 * even though they sit one click apart. The signature stays, because five pages
 * call it; only the thing it renders has changed.
 */
export function Field({
   label,
   type = 'text',
   value,
   onChange,
   autoComplete,
   required = true,
   hint,
}: {
   label: string;
   type?: string;
   value: string;
   onChange: (value: string) => void;
   autoComplete?: string;
   required?: boolean;
   hint?: string;
}) {
   return (
      <TextField
         label={label}
         type={type}
         value={value}
         required={required}
         autoComplete={autoComplete}
         hint={hint}
         onChange={(event) => onChange(event.target.value)}
      />
   );
}

export function AuthForm({
   onSubmit,
   error,
   note,
   children,
}: {
   onSubmit: (event: FormEvent<HTMLFormElement>) => void;
   error?: string | null;
   note?: string | null;
   children: ReactNode;
}) {
   return (
      <form onSubmit={onSubmit} className="grid max-w-[420px] gap-5" noValidate>
         {children}
         {error ? (
            <p role="alert" className="text-[15px] text-destructive">
               {error}
            </p>
         ) : null}
         {note ? <p className="text-[15px] text-ink-2">{note}</p> : null}
      </form>
   );
}
