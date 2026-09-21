import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { signUp } from '@/lib/auth-client';
import { useDocumentTitle } from '@/lib/title';
import { LEGAL_VERSION } from '@/pages/legal/legal-content';
import { AuthForm, AuthShell, Field } from './AuthShell';

/* better-auth's own floor. Saying it up front beats failing on submit. */
const MIN_PASSWORD = 8;

export function SignUpPage() {
   useDocumentTitle('Start your log');
   const navigate = useNavigate();
   const [name, setName] = useState('');
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [agreed, setAgreed] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);

   const submit = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      if (password.length < MIN_PASSWORD) {
         setError(`A password needs at least ${MIN_PASSWORD} characters.`);
         return;
      }

      if (!agreed) {
         setError('Tick the box to agree to the Terms and the Privacy Policy.');
         return;
      }

      setBusy(true);

      /*
       * A request that never gets there throws rather than answering, and
       * without the finally the button would stay on its busy label.
       */
      try {
         const payload = {
            email,
            password,
            name,
            /*
             * Where the link in the mail lands once it is opened. Left out,
             * better-auth sends the reader to the home page, and a dead link to
             * /?error=, which nothing reads, so an expired link looked like
             * nothing at all. A relative path passes its origin check as it is.
             */
            callbackURL: '/verify-email',
            /*
             * Which words were agreed to. The server refuses a sign-up
             * without it, so the box cannot be skipped by calling the API
             * directly, and it is not a column better-auth stores.
             */
            acceptTerms: LEGAL_VERSION,
         };
         const { error: failed } = await signUp.email(payload);

         if (failed) {
            setError(
               failed.message ||
                  'That did not go through. Check the address and try again.'
            );
            return;
         }

         navigate('/verify-email?sent=1');
      } catch {
         setError(
            'That did not go through. Check your connection and try again.'
         );
      } finally {
         setBusy(false);
      }
   };

   return (
      <AuthShell
         title="Start your log"
         lead="A record of what you caught, where, and what the weather was doing."
         footer={
            <p className="inline-flex min-h-11 items-center gap-1.5 text-[17px] text-ink-2">
               Already logging?{' '}
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
               label="Your name"
               value={name}
               onChange={setName}
               autoComplete="name"
            />
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
               autoComplete="new-password"
               hint={`At least ${MIN_PASSWORD} characters.`}
            />
            {/*
             * Named in the box itself: agreeing to the training use should not
             * be something found later in the policy.
             */}
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px] leading-snug text-ink-2">
               <input
                  type="checkbox"
                  required
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-teal"
               />
               <span>
                  I agree to the{' '}
                  <Link
                     to="/terms"
                     target="_blank"
                     className="text-teal-text underline underline-offset-4"
                  >
                     Terms and Conditions
                  </Link>{' '}
                  and the{' '}
                  <Link
                     to="/privacy"
                     target="_blank"
                     className="text-teal-text underline underline-offset-4"
                  >
                     Privacy Policy
                  </Link>
                  , including Fisherfeed using my photographs and catches to
                  train its models.
               </span>
            </label>
            <Button
               type="submit"
               size="lg"
               disabled={busy}
               className="justify-self-start"
            >
               {busy ? 'Creating your log' : 'Start your log'}
            </Button>
         </AuthForm>
      </AuthShell>
   );
}
