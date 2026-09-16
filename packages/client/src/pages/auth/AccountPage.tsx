import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { authClient, signOut, useSession } from '@/lib/auth-client';
import { useDocumentTitle } from '@/lib/title';
import { AuthForm, AuthShell, Field } from './AuthShell';

const MIN_PASSWORD = 8;

export function AccountPage() {
   useDocumentTitle('Account');

   return (
      <RequireSignIn what="your account">
         <AccountPanel />
      </RequireSignIn>
   );
}

function AccountPanel() {
   const { data } = useSession();
   const navigate = useNavigate();
   const [current, setCurrent] = useState('');
   const [next, setNext] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [note, setNote] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);

   const user = data?.user;

   const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setNote(null);

      if (next.length < MIN_PASSWORD) {
         setError(`A password needs at least ${MIN_PASSWORD} characters.`);
         return;
      }

      setBusy(true);
      const { error: failed } = await authClient.changePassword({
         currentPassword: current,
         newPassword: next,
         /* Everything else gets signed out, which is the point of changing it. */
         revokeOtherSessions: true,
      });
      setBusy(false);

      if (failed) {
         setError('That current password is not right.');
         return;
      }

      setCurrent('');
      setNext('');
      setNote('Saved. Anything else signed in has been signed out.');
   };

   return (
      <AuthShell title="Account" lead={user?.email ?? undefined}>
         <div className="grid gap-10">
            <section>
               <h2 className="lab lab-rule">Change your password</h2>
               <div className="mt-4">
                  <AuthForm onSubmit={changePassword} error={error} note={note}>
                     <Field
                        label="Current password"
                        type="password"
                        value={current}
                        onChange={setCurrent}
                        autoComplete="current-password"
                     />
                     <Field
                        label="New password"
                        type="password"
                        value={next}
                        onChange={setNext}
                        autoComplete="new-password"
                        hint={`At least ${MIN_PASSWORD} characters.`}
                     />
                     <Button
                        type="submit"
                        disabled={busy}
                        className="justify-self-start"
                     >
                        {busy ? 'Saving' : 'Save the password'}
                     </Button>
                  </AuthForm>
               </div>
            </section>

            <section>
               <h2 className="lab lab-rule">Sign out</h2>
               <Button
                  type="button"
                  variant="outline"
                  className="mt-4 justify-self-start"
                  onClick={async () => {
                     await signOut();
                     navigate('/');
                  }}
               >
                  Sign out
               </Button>
            </section>
         </div>
      </AuthShell>
   );
}
