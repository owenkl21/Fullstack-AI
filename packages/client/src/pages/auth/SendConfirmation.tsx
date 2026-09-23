import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

/*
 * Another copy of the confirmation mail, for the one that never arrived.
 *
 * Three screens offer it: the verify page and the account page to somebody
 * signed in, and sign in to somebody turned away for an unconfirmed address.
 * It works without a session, which is what lets sign in offer it. Signed out,
 * the server answers the same for any address, a send that failed included,
 * because it only logs that one. So nothing here says whether an account
 * exists, and "Sent" there means asked for rather than delivered.
 */

type State =
   | 'idle'
   | 'sending'
   | 'sent'
   | 'confirmed'
   | 'wait'
   | 'mismatch'
   | 'failed';

function sentence(state: State, email: string) {
   switch (state) {
      case 'sent':
         return `Sent to ${email}. Give it a minute, then look in the spam folder.`;
      case 'confirmed':
         return `${email} is already confirmed. There is nothing more to do.`;
      case 'wait':
         return 'Sent too many times in a row. Wait a minute and try again.';
      case 'mismatch':
         return 'You are signed in to a different account. Sign out, then try again.';
      case 'failed':
         return 'That did not send. Try again in a minute.';
      default:
         return null;
   }
}

export function SendConfirmation({
   email,
   label = 'Send it again',
   onConfirmed,
}: {
   email: string;
   label?: string;
   /* The session still says unconfirmed, so the page can fetch it again. */
   onConfirmed?: () => void;
}) {
   const [state, setState] = useState<State>('idle');

   const send = async () => {
      setState('sending');

      try {
         const { error } = await authClient.sendVerificationEmail({
            email,
            callbackURL: '/verify-email',
         });

         if (!error) {
            setState('sent');
            return;
         }

         if (error.status === 429) {
            setState('wait');
            return;
         }

         /*
          * Both only ever said to a session, about its own account, so they
          * tell nobody anything they could not already see.
          */
         if (error.code === 'EMAIL_ALREADY_VERIFIED') {
            setState('confirmed');
            onConfirmed?.();
            return;
         }

         if (error.code === 'EMAIL_MISMATCH') {
            setState('mismatch');
            return;
         }

         setState('failed');
      } catch {
         setState('failed');
      }
   };

   /* Once it has gone, or there is nothing left to confirm, a button is noise. */
   const done = state === 'sent' || state === 'confirmed';

   /*
    * One region that stays in the page and only changes its words, so a
    * screen reader hears the answer however it turns out.
    */
   return (
      <div className="mt-4 flex flex-col gap-1.5">
         {done ? null : (
            <button
               type="button"
               onClick={() => void send()}
               disabled={state === 'sending'}
               className="g-tracked inline-flex min-h-11 items-center self-start text-[19px] text-teal-text transition-opacity duration-150 [transition-timing-function:var(--ease)] hover:opacity-80 disabled:opacity-60 motion-reduce:transition-none"
            >
               {state === 'sending' ? 'Sending' : label}
            </button>
         )}
         <p
            aria-live="polite"
            className={cn(
               'max-w-[52ch] text-ink-2 empty:hidden',
               done ? 'text-[17px]' : 'text-[15px]'
            )}
         >
            {sentence(state, email)}
         </p>
      </div>
   );
}
