import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

/*
 * The search field the three list pages share.
 *
 * It used to be a bare grey rectangle under a tracked-out caps label, which read
 * as an unstyled box rather than somewhere to type. The magnifying glass says
 * what it is without a label, and the placeholder says what can go in it, so the
 * label is kept for screen readers only.
 */
export function SearchField({
   id,
   label,
   placeholder,
   value,
   onChange,
}: {
   id: string;
   label: string;
   placeholder: string;
   value: string;
   onChange: (next: string) => void;
}) {
   return (
      <div className="relative max-w-[420px]">
         <label htmlFor={id} className="sr-only">
            {label}
         </label>
         <MagnifyingGlassIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-3"
         />
         <input
            id={id}
            type="search"
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            className="input-line h-11 !pl-10 text-base"
         />
      </div>
   );
}
