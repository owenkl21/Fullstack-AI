import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { authClient, signOut, useSession } from '@/lib/auth-client';
import { useDocumentTitle } from '@/lib/title';
import { AuthForm, AuthShell, Field } from './AuthShell';

const MIN_PASSWORD = 8;

export function ResetPasswordPage() {
   useDocumentTitle('Set a new password');
   const navigate = useNavigate();
   const [params] = useSearchParams();
   const token = params.get('token');
   const [password, setPassword] = useState('');
   const [again, setAgain] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);
   const { data: session, isPending, isRefetching } = useSession();
   const signedIn = Boolean(session?.user);

   /*
    * A reset link opened in a browser that is signed in signs it out first.
    * Setting a new password is never something done from inside the account:
    * the reset ends every session anyway, and the form should not sit under
    * a header that says somebody is in.
    */
   useEffect(() => {
      if (token && signedIn) void signOut().catch(() => undefined);
   }, [token, signedIn]);

   /* The first answer only, and nothing while the sign-out goes through. */
   if (isPending && !isRefetching) return null;
   if (token && signedIn) return null;

   /* No token means the link was cut short, or has already been used. */
   if (!token) {
      return (
         <AuthShell
            title="That link will not work"
            lead="It may have been opened already, or copied without its whole address. Ask for a new one."
            footer={
               <p className="inline-flex min-h-11 items-center text-[17px] text-ink-2">
                  <Link
                     to="/forgot-password"
                     className="inline-flex min-h-11 items-center text-teal-text"
                  >
                     Send another link
                  </Link>
               </p>
            }
         >
            <span />
         </AuthShell>
      );
   }

   const submit = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      if (password.length < MIN_PASSWORD) {
         setError(`A password needs at least ${MIN_PASSWORD} characters.`);
         return;
      }

      if (password !== again) {
         setError('Those two do not match.');
         return;
      }

      setBusy(true);
      const { error: failed } = await authClient.resetPassword({
         newPassword: password,
         token,
      });
      setBusy(false);

      if (failed) {
         setError(
            'That link has expired or been used already. Ask for a new one.'
         );
         return;
      }

      /*
       * The server has signed out every session on the account, this one
       * included. Signing out here as well clears the page's own idea of who
       * is in, so the new password is the only way back.
       */
      await authClient.signOut().catch(() => undefined);
      navigate('/sign-in');
   };

   return (
      <AuthShell title="Set a new password">
         <AuthForm onSubmit={submit} error={error}>
            <Field
               label="New password"
               type="password"
               value={password}
               onChange={setPassword}
               autoComplete="new-password"
               hint={`At least ${MIN_PASSWORD} characters.`}
            />
            <Field
               label="Again"
               type="password"
               value={again}
               onChange={setAgain}
               autoComplete="new-password"
            />
            <Button
               type="submit"
               size="lg"
               disabled={busy}
               className="justify-self-start"
            >
               {busy ? 'Saving' : 'Save the password'}
            </Button>
         </AuthForm>
      </AuthShell>
   );
}
