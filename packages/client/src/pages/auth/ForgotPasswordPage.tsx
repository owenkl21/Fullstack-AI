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
   const [busy, setBusy] = useState(false);

   const submit = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setBusy(true);

      await authClient.requestPasswordReset({
         email,
         redirectTo: '/reset-password',
      });

      setBusy(false);
      /*
       * Always the same answer, sent or not. Confirming that an address has an
       * account is the whole of the leak this screen could cause.
       */
      setSent(true);
   };

   if (sent) {
      return (
         <AuthShell
            title="Check your email"
            lead="If that address has an account, a link to set a new password is on its way. The link works once, and for an hour."
            footer={
               <p className="inline-flex min-h-11 items-center text-[17px] text-ink-2">
                  <Link
                     to="/sign-in"
                     className="inline-flex min-h-11 items-center text-teal-text"
                  >
                     Back to sign in
                  </Link>
               </p>
            }
         >
            <p className="max-w-[52ch] text-[17px] text-ink-2">
               Nothing arriving? The address may not have an account, or the
               mail may be sitting in a spam folder.
            </p>
         </AuthShell>
      );
   }

   return (
      <AuthShell
         title="Reset your password"
         lead="Give the address you signed up with and we will send a link to set a new one."
         footer={
            <p className="inline-flex min-h-11 items-center text-[17px] text-ink-2">
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
         <AuthForm onSubmit={submit}>
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
