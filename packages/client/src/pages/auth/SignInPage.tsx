import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth-client';
import { useDocumentTitle } from '@/lib/title';
import { AuthForm, AuthShell, Field } from './AuthShell';
import { SendConfirmation } from './SendConfirmation';

/*
 * What went wrong, from the status and code better-auth answers with.
 *
 * Only a 401 is about the address and the password, and that one stays a
 * single sentence. The rest used to share it too, which told somebody held
 * back by the rate limit to check a password that was right all along.
 */
function problem(failed: { status: number; code?: string }) {
   if (failed.status === 401) {
      /*
       * Deliberately the same sentence for a wrong password and an unknown
       * address. Telling them apart tells a stranger which addresses have
       * accounts.
       */
      return 'That email and password do not match an account.';
   }

   if (failed.status === 429) {
      return 'Too many tries in a row. Wait a minute and try again.';
   }

   /*
    * Only sent once the password has matched, so it tells nobody without the
    * password that the account exists.
    */
   if (failed.status === 403 && failed.code === 'EMAIL_NOT_VERIFIED') {
      return 'Confirm your address first. The link is in the mail sent when you signed up.';
   }

   if (failed.code === 'INVALID_EMAIL' || failed.code === 'VALIDATION_ERROR') {
      return 'That does not look like an email address.';
   }

   return 'Signing in did not work just now. Try again in a minute.';
}

export function SignInPage() {
   useDocumentTitle('Sign in');
   const navigate = useNavigate();
   const [params] = useSearchParams();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [error, setError] = useState<string | null>(null);
   /* The address that was turned away unconfirmed, not whatever is typed now. */
   const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);

   /* Where the angler was headed before being asked to sign in. */
   const next = params.get('next') || '/';

   const submit = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setUnconfirmed(null);
      setBusy(true);

      try {
         const { error: failed } = await signIn.email({ email, password });

         if (failed) {
            setError(problem(failed));
            if (failed.status === 403 && failed.code === 'EMAIL_NOT_VERIFIED') {
               setUnconfirmed(email);
            }
            return;
         }

         navigate(next);
      } catch {
         setError(
            'Signing in did not work just now. Check your connection and try again.'
         );
      } finally {
         setBusy(false);
      }
   };

   return (
      <AuthShell
         title="Sign in"
         lead="Your catches, your spots and your gear are where you left them."
         footer={
            <p className="inline-flex min-h-11 items-center gap-1.5 text-[17px] text-ink-2">
               No account yet?{' '}
               <Link
                  to="/sign-up"
                  className="inline-flex min-h-11 items-center text-teal-text"
               >
                  Start your log
               </Link>
            </p>
         }
      >
         <>
            <AuthForm onSubmit={submit} error={error}>
               <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
               />
               <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
               />
               <div className="flex flex-wrap items-center gap-4">
                  <Button type="submit" size="lg" disabled={busy}>
                     {busy ? 'Signing in' : 'Sign in'}
                  </Button>
                  <Link
                     to="/forgot-password"
                     className="inline-flex min-h-11 items-center text-[17px] text-ink-2"
                  >
                     Forgotten your password?
                  </Link>
               </div>
            </AuthForm>
            {unconfirmed ? (
               <SendConfirmation
                  key={unconfirmed}
                  email={unconfirmed}
                  label="Send the link again"
               />
            ) : null}
         </>
      </AuthShell>
   );
}
