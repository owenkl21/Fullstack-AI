import type { FormEvent, ReactNode } from 'react';
import { useId } from 'react';

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
   return (
      <section className="mx-auto w-full max-w-[720px] px-4 py-12 md:px-8">
         <h1 className="g text-[40px] md:text-[52px]">{title}</h1>
         {lead ? (
            <p className="mt-3 max-w-[52ch] text-[17px] text-ink-2">{lead}</p>
         ) : null}
         <div className="mt-8">{children}</div>
         {footer ? (
            <div className="rule-dashed mt-10 pt-4">{footer}</div>
         ) : null}
      </section>
   );
}

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
   const id = useId();

   return (
      <div className="grid gap-2">
         <label className="lab" htmlFor={id}>
            {label}
         </label>
         <input
            id={id}
            type={type}
            value={value}
            required={required}
            autoComplete={autoComplete}
            onChange={(event) => onChange(event.target.value)}
            /* 16px so iOS does not zoom the page on focus. */
            className="input-line text-[16px]"
         />
         {hint ? <p className="text-[14px] text-ink-2">{hint}</p> : null}
      </div>
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
