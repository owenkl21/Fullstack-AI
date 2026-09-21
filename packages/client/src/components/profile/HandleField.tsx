import type { Ref } from 'react';
import { TextField } from '@/components/ui/field';
import {
   describeHandle,
   normaliseHandle,
   type HandleCheck,
} from '@/components/profile/handle';

/*
 * The handle field, answering as it is typed: free, taken, reserved, or not
 * a handle at all. The caller owns the check, because the caller is the one
 * deciding whether Save may go ahead.
 */
export function HandleField({
   value,
   onChange,
   check,
   finished,
   serverError,
   onBlur,
   ref,
   autoFocus,
}: {
   /** Already normalised. */
   value: string;
   onChange: (next: string) => void;
   check: HandleCheck;
   /* Left or submitted, so a handle that is only short so far can be told
    * it is too short. */
   finished: boolean;
   /** What the server said on the last save, which outranks the live check. */
   serverError?: string;
   onBlur?: () => void;
   ref?: Ref<HTMLInputElement>;
   autoFocus?: boolean;
}) {
   const said = describeHandle(check, finished);
   const error = serverError || (said.tone === 'bad' ? said.text : '');

   return (
      <div className="min-w-0">
         <TextField
            label="Handle"
            ref={ref}
            value={value}
            onChange={(event) => onChange(normaliseHandle(event.target.value))}
            onBlur={onBlur}
            error={error}
            hint={
               said.tone === 'good' ? (
                  <span className="text-teal-text">{said.text}</span>
               ) : (
                  said.text
               )
            }
            autoFocus={autoFocus}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
         />
         {/* A refusal is already an alert. Good news is only a hint, which
             a screen reader would not hear arrive, so it is said here too. */}
         <p aria-live="polite" className="sr-only">
            {said.tone === 'good' ? said.text : ''}
         </p>
      </div>
   );
}
