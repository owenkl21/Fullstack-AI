import type { ReactNode } from 'react';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

/*
 * The three small controls the start flow is built out of, so the five steps
 * are drawn from one set of parts rather than five.
 *
 * A field on a rule: the label above, the answer on a line under it. The
 * line is solid ink once it has been answered and a dashed hairline while it
 * is still empty, which is how the frames tell an answered field from a
 * waiting one without a word of help.
 */
export function LineField({
   id,
   label,
   value,
   onChange,
   placeholder,
   size = 16,
   maxLength,
}: {
   id: string;
   label: string;
   value: string;
   onChange: (value: string) => void;
   placeholder?: string;
   /* The name is a size bigger than the line about it. */
   size?: 16 | 18;
   maxLength?: number;
}) {
   return (
      <div className="flex min-w-0 flex-col gap-2">
         <label className="lab" htmlFor={id}>
            {label}
         </label>
         <input
            id={id}
            name={id}
            type="text"
            autoComplete="off"
            value={value}
            maxLength={maxLength}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            className={cn(
               'h-12 w-full border-b bg-transparent text-ink outline-none placeholder:text-ink-3 focus:border-ink',
               value
                  ? 'border-solid border-ink'
                  : 'border-dashed border-line-2',
               size === 18 ? 'text-[18px]' : 'text-[16px]'
            )}
         />
      </div>
   );
}

/*
 * A row that opens something: the label over the answer, a chevron on the
 * right, on a dashed rule. The same object the Picker draws in its line
 * variant, for the one field whose choices are searched rather than listed.
 */
export function LineRow({
   label,
   value,
   onClick,
   className,
}: {
   label: string;
   value: ReactNode;
   onClick: () => void;
   className?: string;
}) {
   return (
      <button
         type="button"
         onClick={onClick}
         className={cn(
            'flex h-[60px] w-full items-center justify-between gap-2 border-b border-dashed border-line-2 text-left transition-colors duration-150 hover:border-ink',
            className
         )}
      >
         <span className="flex min-w-0 flex-col leading-none">
            <span className="lab">{label}</span>
            <span className="mt-[5px] truncate text-[16px] leading-none text-ink">
               {value}
            </span>
         </span>
         <ChevronDownIcon
            aria-hidden="true"
            strokeWidth={1.5}
            className="size-[18px] shrink-0 text-ink-2"
         />
      </button>
   );
}

/*
 * The square mark: filled ink with a tick when it is on, an empty hairline
 * box when it is not. A statement on the checks list, a control on the
 * follower list.
 */
export function TickBox({ on }: { on: boolean }) {
   return (
      <span
         aria-hidden="true"
         className={cn(
            'grid size-5 shrink-0 place-items-center border',
            on
               ? 'border-ink bg-ink text-background'
               : 'border-line-2 bg-transparent'
         )}
      >
         {on ? <CheckIcon strokeWidth={2.5} className="size-3.5" /> : null}
      </span>
   );
}

/* A row of the same height as a check or a follower, ruled underneath. */
export function ChoiceRow({
   children,
   onClick,
   height = 48,
}: {
   children: ReactNode;
   onClick?: () => void;
   height?: 48 | 60;
}) {
   const shape = cn(
      'flex w-full items-center gap-3 border-b border-line text-left',
      height === 48 ? 'h-12' : 'h-[60px]'
   );
   if (!onClick) return <div className={shape}>{children}</div>;
   return (
      <button type="button" onClick={onClick} className={shape}>
         {children}
      </button>
   );
}

/* The circle on a Where row: a ring of ink once it is the chosen one. */
export function RadioDot({ on }: { on: boolean }) {
   return (
      <span
         aria-hidden="true"
         className={cn(
            'box-border size-5 shrink-0 rounded-full border',
            on ? 'border-[6px] border-ink' : 'border-line-2'
         )}
      />
   );
}
