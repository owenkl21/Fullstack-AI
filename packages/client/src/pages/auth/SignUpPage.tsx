import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { signUp } from '@/lib/auth-client';
import { useDocumentTitle } from '@/lib/title';
import { AuthForm, AuthShell, Field } from './AuthShell';

/* better-auth's own floor. Saying it up front beats failing on submit. */
const MIN_PASSWORD = 8;

export function SignUpPage() {
   useDocumentTitle('Start your log');
   const navigate = useNavigate();
   const [name, setName] = useState('');
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);

   const submit = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      if (password.length < MIN_PASSWORD) {
         setError(`A password needs at least ${MIN_PASSWORD} characters.`);
         return;
      }

      setBusy(true);
      const { error: failed } = await signUp.email({ email, password, name });
      setBusy(false);

      if (failed) {
         setError(
            failed.message ||
               'That did not go through. Check the address and try again.'
         );
         return;
      }

      navigate('/verify-email?sent=1');
   };

   return (
      <AuthShell
         title="Start your log"
         lead="A record of what you caught, where, and what the weather was doing."
         footer={
            <p className="inline-flex min-h-11 items-center text-[17px] text-ink-2">
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
