import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth-client';
import { useDocumentTitle } from '@/lib/title';
import { AuthForm, AuthShell, Field } from './AuthShell';

export function SignInPage() {
   useDocumentTitle('Sign in');
   const navigate = useNavigate();
   const [params] = useSearchParams();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);

   /* Where the angler was headed before being asked to sign in. */
   const next = params.get('next') || '/';

   const submit = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setBusy(true);

      const { error: failed } = await signIn.email({ email, password });

      setBusy(false);

      if (failed) {
         /*
          * Deliberately the same sentence for a wrong password and an unknown
          * address. Telling them apart tells a stranger which addresses have
          * accounts.
          */
         setError('That email and password do not match an account.');
         return;
      }

      navigate(next);
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
      </AuthShell>
   );
}
