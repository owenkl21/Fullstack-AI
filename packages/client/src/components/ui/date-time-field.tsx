import { useId, useRef, useState, type ReactNode } from 'react';
import { CalendarDaysIcon, ClockIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

/*
 * One date and time field, everywhere a day and an hour are asked for.
 *
 * It replaces four datetime-local inputs, which did not work in three ways.
 * In the competition form the input lay invisible over two lines of type, so
 * on a desktop a click landed on one of its hidden segments and nothing
 * opened; the only thing left to do was type, and the first digit made the
 * value empty for a moment, which the page then tried to read as a date and
 * fell over. On iOS a datetime-local ignores min and max, centres its text,
 * collapses when it is empty and offers a Reset that hands back an empty
 * string. And nowhere was there a button that opened the calendar.
 *
 * So this is two native inputs, a date and a time, which are the two iOS and
 * Android both draw proper wheels and clocks for. Each has a button that
 * calls showPicker() where the browser has it and falls back to focusing the
 * input where it does not, which on a phone opens the same picker. The
 * segments can still be typed into on a desktop.
 *
 * The value is local wall clock, "2026-09-26T06:00", the same string a
 * datetime-local spoke, so a form that kept one keeps it. It is empty while
 * either half is, and the halves are held here so a half typed day is not
 * wiped by the empty string it produces. Turning it into an instant is the
 * form's job, once, when it is sent: fromLocalValue in lib/local-time.ts
 * does it without leaning on how a browser parses a string with no zone.
 *
 * min and max are local strings too. They bound the calendar where the
 * browser honours them, and because iOS does not, a form still has to say so
 * in words when the value is out of range.
 */

const split = (value: string) => {
   const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
   return m ? { date: m[1]!, time: m[2]! } : { date: '', time: '' };
};

const join = (parts: { date: string; time: string }) =>
   parts.date && parts.time ? `${parts.date}T${parts.time}` : '';

/* Open the platform's picker, however this browser lets that be asked for. */
function openPicker(input: HTMLInputElement | null) {
   if (!input) return;
   try {
      if (typeof input.showPicker === 'function') {
         input.showPicker();
         return;
      }
   } catch {
      /* Not allowed here, or not for this type. Focus still opens it on a
         phone and puts a keyboard in the segments on a desktop. */
   }
   input.focus();
}

export function DateTimeField({
   label,
   value,
   onChange,
   min,
   max,
   hint,
   error,
   variant = 'box',
   dataField,
   onBlur,
   className,
}: {
   label: string;
   /* Local wall clock, "2026-09-26T06:00", or empty. */
   value: string;
   onChange: (next: string) => void;
   min?: string;
   max?: string;
   hint?: ReactNode;
   error?: string | null;
   /*
    * `box` is the house input. `line` is the same field in a form whose other
    * fields are lines: no box, a rule underneath, solid once it is answered.
    */
   variant?: 'box' | 'line';
   /* What a form looks for when it puts the cursor back in a broken field. */
   dataField?: string;
   /* Focus has left the field altogether, not moved from the day to the time. */
   onBlur?: () => void;
   className?: string;
}) {
   const id = useId();
   const dateRef = useRef<HTMLInputElement>(null);
   const timeRef = useRef<HTMLInputElement>(null);
   const [parts, setParts] = useState(() => split(value));

   /*
    * Follow the form when it sets a whole new value (the time off a
    * photograph, a start that pushed the end along). An empty value is this
    * field's own report of a half filled one, so it never wipes the half.
    */
   const [seen, setSeen] = useState(value);
   if (value !== seen) {
      setSeen(value);
      if (value && value !== join(parts)) setParts(split(value));
   }

   const change = (next: { date: string; time: string }) => {
      setParts(next);
      onChange(join(next));
   };

   /* A bound on the clock only means something on the bound's own day. */
   const minDate = min?.slice(0, 10);
   const maxDate = max?.slice(0, 10);
   const minTime = minDate && parts.date === minDate ? min?.slice(11, 16) : '';
   const maxTime = maxDate && parts.date === maxDate ? max?.slice(11, 16) : '';

   const described = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
   const line = variant === 'line';
   const control = cn(
      'when-input num w-full min-w-0 text-[16px]',
      line
         ? cn(
              'h-12 border-b bg-transparent pr-11 text-ink outline-none focus:border-teal',
              error
                 ? 'border-destructive'
                 : join(parts)
                   ? 'border-solid border-ink'
                   : 'border-dashed border-line-2'
           )
         : 'input-line pr-11'
   );
   const opener =
      'absolute top-0 right-0 grid h-full w-11 place-items-center text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal';

   return (
      <div
         role="group"
         aria-labelledby={`${id}-label`}
         onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) onBlur?.();
         }}
         className={cn('flex min-w-0 flex-col', className)}
      >
         <span id={`${id}-label`} className="lab">
            {label}
         </span>

         <div
            className={cn(
               'grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3',
               line ? 'mt-0.5' : 'mt-1.5'
            )}
         >
            <div className="relative min-w-0">
               <input
                  ref={dateRef}
                  type="date"
                  data-field={dataField}
                  aria-label={`${label}, date`}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={described}
                  value={parts.date}
                  min={minDate}
                  max={maxDate}
                  onChange={(event) =>
                     change({ ...parts, date: event.target.value })
                  }
                  className={control}
               />
               <button
                  type="button"
                  aria-label={`Open the calendar for ${label.toLowerCase()}`}
                  onClick={() => openPicker(dateRef.current)}
                  className={opener}
               >
                  <CalendarDaysIcon
                     aria-hidden="true"
                     strokeWidth={1.5}
                     className="size-5"
                  />
               </button>
            </div>
            <div className="relative min-w-0">
               <input
                  ref={timeRef}
                  type="time"
                  aria-label={`${label}, time`}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={described}
                  value={parts.time}
                  min={minTime || undefined}
                  max={maxTime || undefined}
                  onChange={(event) =>
                     change({ ...parts, time: event.target.value })
                  }
                  className={control}
               />
               <button
                  type="button"
                  aria-label={`Open the clock for ${label.toLowerCase()}`}
                  onClick={() => openPicker(timeRef.current)}
                  className={opener}
               >
                  <ClockIcon
                     aria-hidden="true"
                     strokeWidth={1.5}
                     className="size-5"
                  />
               </button>
            </div>
         </div>

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
