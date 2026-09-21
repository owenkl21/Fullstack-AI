import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { useDocumentTitle } from '@/lib/title';
import { AuthForm, AuthShell, Field } from './AuthShell';

export function ForgotPasswordPage() {
   useDocumentTitle('Reset your password');
   const [email, setEmail] = useState('');
   const [sent, setSent] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);

   const submit = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setBusy(true);

      try {
         const { error: failed } = await authClient.requestPasswordReset({
            email,
            redirectTo: '/reset-password',
         });

         /*
          * The server answers an address with no account exactly as it answers
          * one with, so an error here is never about the account. It is the
          * rate limit, a malformed address, or a request that got nowhere, and
          * saying "check your email" over any of those sends somebody to wait
          * on a mail that is not coming.
          */
         if (failed) {
            if (failed.status === 429) {
               setError(
                  'Too many tries in a row. Wait a minute and try again.'
               );
            } else if (failed.code === 'VALIDATION_ERROR') {
               setError('That does not look like an email address.');
            } else {
               setError('The link could not be sent. Try again in a minute.');
            }
            return;
         }

         /*
          * The same answer, account or not. Confirming that an address has an
          * account is the whole of the leak this screen could cause.
          */
         setSent(true);
      } catch {
         setError(
            'The link could not be sent. Check your connection and try again.'
         );
      } finally {
         setBusy(false);
      }
   };

   if (sent) {
      return (
         <AuthShell
            title="Check your email"
            lead="If that address has an account, a link to set a new password is on its way. The link works once, and for an hour."
            footer={
               <p className="inline-flex min-h-11 items-center gap-1.5 text-[17px] text-ink-2">
                  <Link
                     to="/sign-in"
                     className="inline-flex min-h-11 items-center text-teal-text"
                  >
                     Back to sign in
                  </Link>
               </p>
            }
         >
            {/*
             * The last sentence is for an account whose address has died. It
             * is said to everybody, so it tells nobody that one exists.
             */}
            <p className="max-w-[52ch] text-[17px] text-ink-2">
               Nothing arriving? The address may not have an account, or the
               mail may be sitting in a spam folder. If the address on your
               account cannot take mail, sign in and change it from your
               account.
            </p>
         </AuthShell>
      );
   }

   return (
      <AuthShell
         title="Reset your password"
         lead="Give the address you signed up with and we will send a link to set a new one."
         footer={
            <p className="inline-flex min-h-11 items-center gap-1.5 text-[17px] text-ink-2">
               Remembered it?{' '}
               <Link
                  to="/sign-in"
                  className="inline-flex min-h-11 items-center text-teal-text"
               >
                  Sign in
               </Link>
            </p>
         }
      >
         <AuthForm onSubmit={submit} error={error}>
            <Field
               label="Email"
               type="email"
               value={email}
               onChange={setEmail}
               autoComplete="email"
            />
            <Button
               type="submit"
               size="lg"
               disabled={busy}
               className="justify-self-start"
            >
               {busy ? 'Sending' : 'Send the link'}
            </Button>
         </AuthForm>
      </AuthShell>
   );
}
