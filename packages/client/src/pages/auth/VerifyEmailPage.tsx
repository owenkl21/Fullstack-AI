import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authClient, useSession } from '@/lib/auth-client';
import { useDocumentTitle } from '@/lib/title';
import { AuthShell } from './AuthShell';

/*
 * A second copy of the verification mail, for the one that never arrived.
 *
 * Until now the only way to get another was to sign in again, which is no help
 * at all to somebody already signed in and looking at this page. It only shows
 * when there is a session, because that is the only time the address is known
 * without asking for it again.
 */
function SendAgain() {
   const { data: session } = useSession();
   const email = session?.user?.email ?? null;
   const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>(
      'idle'
   );

   if (!email) return null;

   if (state === 'sent') {
      return (
         <p className="mt-4 max-w-[52ch] text-[17px] text-ink-2">
            Sent again to {email}. Give it a minute, then look in the spam
            folder.
         </p>
      );
   }

   const send = async () => {
      setState('sending');
      const { error } = await authClient.sendVerificationEmail({
         email,
         callbackURL: '/verify-email',
      });
      setState(error ? 'failed' : 'sent');
   };

   return (
      <div className="mt-4 flex flex-col gap-1.5">
         <button
            type="button"
            onClick={() => void send()}
            disabled={state === 'sending'}
            className="g-tracked inline-flex min-h-11 items-center self-start text-[19px] text-teal-text transition-opacity duration-150 [transition-timing-function:var(--ease)] hover:opacity-80 disabled:opacity-60 motion-reduce:transition-none"
         >
            {state === 'sending' ? 'Sending' : 'Send it again'}
         </button>
         {state === 'failed' ? (
            <p className="text-[15px] text-ink-2">
               That did not send. Try again in a minute.
            </p>
         ) : null}
      </div>
   );
}

/*
 * better-auth verifies the address on its own route and redirects here, so this
 * screen only ever reports. It never holds a token itself.
 */
export function VerifyEmailPage() {
   useDocumentTitle('Verify your email');
   const [params] = useSearchParams();

   if (params.get('error')) {
      return (
         <AuthShell
            title="That link will not work"
            lead="It may have expired, or been opened already. Signing in sends a fresh one."
            footer={
               <p className="inline-flex min-h-11 items-center text-[17px] text-ink-2">
                  <Link
                     to="/sign-in"
                     className="inline-flex min-h-11 items-center text-teal-text"
                  >
                     Go to sign in
                  </Link>
               </p>
            }
         >
            <SendAgain />
         </AuthShell>
      );
   }

   if (params.get('sent')) {
      return (
         <AuthShell
            title="Check your email"
            lead="A link to confirm your address is on its way. You can start logging before you open it."
            footer={
               <p className="inline-flex min-h-11 items-center text-[17px] text-ink-2">
                  <Link
                     to="/"
                     className="inline-flex min-h-11 items-center text-teal-text"
                  >
                     Go to your log
                  </Link>
               </p>
            }
         >
            <>
               <p className="max-w-[52ch] text-[17px] text-ink-2">
                  Confirming the address is what lets you reset a forgotten
                  password later, so it is worth doing before you need it.
               </p>
               <SendAgain />
            </>
         </AuthShell>
      );
   }

   return (
      <AuthShell
         title="Your email is confirmed"
         lead="That is the last of the paperwork."
         footer={
            <p className="inline-flex min-h-11 items-center text-[17px] text-ink-2">
               <Link
                  to="/"
                  className="inline-flex min-h-11 items-center text-teal-text"
               >
                  Go to your log
               </Link>
            </p>
         }
      >
         <span />
      </AuthShell>
   );
}
