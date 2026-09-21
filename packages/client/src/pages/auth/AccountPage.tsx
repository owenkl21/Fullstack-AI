import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { authClient, signOut, useSession } from '@/lib/auth-client';
import { useDocumentTitle } from '@/lib/title';
import { AuthForm, AuthShell, Field } from './AuthShell';
import { SendConfirmation } from './SendConfirmation';

const MIN_PASSWORD = 8;

export function AccountPage() {
   useDocumentTitle('Account');

   return (
      <RequireSignIn what="your account">
         <AccountPanel />
      </RequireSignIn>
   );
}

/*
 * What a change of address can fail on, each said plainly. None of them gives
 * away whether the new address has an account: the server answers that case
 * as if it had worked.
 */
function changeProblem(failed: {
   status: number;
   code?: string;
   message?: string;
}) {
   /* The limit here is counted by the hour, so a minute is not enough. */
   if (failed.status === 429) {
      return 'Too many tries. Wait a while and try again.';
   }

   /* better-auth gives this one a message and no code. */
   if (failed.message === 'Email is the same') {
      return 'That is already your address.';
   }

   if (failed.code === 'VALIDATION_ERROR') {
      return 'That does not look like an email address.';
   }

   if (failed.status === 401) {
      return 'You have been signed out. Sign in again to change it.';
   }

   return 'The link could not be sent. Try again in a minute.';
}

/*
 * What saving a new password can fail on. Only INVALID_PASSWORD is about the
 * current one; it used to be the answer to everything, which told somebody
 * held back by the rate limit that a right password was wrong.
 */
function passwordProblem(failed: { status: number; code?: string }) {
   if (failed.status === 429) {
      return 'Too many tries in a row. Wait a minute and try again.';
   }

   if (failed.status === 401) {
      return 'You have been signed out. Sign in again to change it.';
   }

   if (failed.code === 'INVALID_PASSWORD') {
      return 'That current password is not right.';
   }

   if (failed.code === 'PASSWORD_TOO_LONG') {
      return 'That new password is too long.';
   }

   return 'The password could not be saved. Try again in a minute.';
}

/*
 * The address the account answers to, and whether mail has been shown to
 * reach it. A reset link goes there either way, so an unconfirmed one gets a
 * way to confirm it, and one that cannot take mail at all gets a way out.
 */
function YourEmail({
   email,
   verified,
   onConfirmed,
}: {
   email: string;
   verified: boolean;
   onConfirmed: () => void;
}) {
   const [newEmail, setNewEmail] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [note, setNote] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);

   const change = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setNote(null);

      const wanted = newEmail.trim();

      if (!wanted.includes('@')) {
         setError('That does not look like an email address.');
         return;
      }

      if (wanted.toLowerCase() === email.toLowerCase()) {
         setError('That is already your address.');
         return;
      }

      setBusy(true);

      try {
         const { error: failed } = await authClient.changeEmail({
            newEmail: wanted,
            /*
             * Marked, so the verify page knows a failed link is part of a
             * change and does not offer to send one to the old address.
             */
            callbackURL: '/verify-email?change=1',
         });

         if (failed) {
            setError(changeProblem(failed));
            return;
         }

         setNewEmail('');
         /*
          * A confirmed address has to agree to the change first, so its link
          * goes there and the one to the new address follows from it. An
          * unconfirmed one may not even be theirs, so the link goes straight
          * to the new address.
          */
         const steps = verified
            ? `To be sure it is you, a link is on its way to ${email}. Open it, then open the one it sends to ${wanted} in a browser where you are signed in.`
            : `A link is on its way to ${wanted}. Open it in a browser where you are signed in, and the change happens then. Until then you sign in with ${email}.`;
         /*
          * The same answer when the new address already has an account: the
          * server sends nothing then and says nothing about it. The last
          * sentence is said to everybody, so it gives nothing away and still
          * leaves a way out.
          */
         setNote(
            `${steps} If nothing arrives, ${wanted} may already have an account. Sign in with it, or reset its password.`
         );
      } catch {
         setError(
            'The link could not be sent. Check your connection and try again.'
         );
      } finally {
         setBusy(false);
      }
   };

   return (
      <section>
         <h2 className="g text-[30px] md:text-[36px]">Your email</h2>
         <p className="mt-4 max-w-[52ch] text-[17px] text-ink-2">
            <span className="text-ink">{email}</span>
            {verified ? ' is confirmed.' : ' is not confirmed yet.'}
         </p>
         {verified ? null : (
            <SendConfirmation
               email={email}
               label="Send confirmation"
               onConfirmed={onConfirmed}
            />
         )}
         <div className="mt-6">
            <AuthForm onSubmit={change} error={error} note={note}>
               <Field
                  label="New email"
                  type="email"
                  value={newEmail}
                  onChange={setNewEmail}
                  autoComplete="email"
                  hint="Nothing changes until the new address is confirmed."
               />
               <Button
                  type="submit"
                  variant="outline"
                  disabled={busy}
                  className="justify-self-start"
               >
                  {busy ? 'Sending' : 'Change email'}
               </Button>
            </AuthForm>
         </div>
      </section>
   );
}

function AccountPanel() {
   const { data, refetch } = useSession();
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

      try {
         const { error: failed } = await authClient.changePassword({
            currentPassword: current,
            newPassword: next,
            /* Everything else gets signed out, which is the point of changing it. */
            revokeOtherSessions: true,
         });

         if (failed) {
            setError(passwordProblem(failed));
            return;
         }

         setCurrent('');
         setNext('');
         setNote('Saved. Anything else signed in has been signed out.');
      } catch {
         setError(
            'The password could not be saved. Check your connection and try again.'
         );
      } finally {
         setBusy(false);
      }
   };

   /*
    * No lead. The address used to sit here on its own; it now opens its own
    * section, where it can say whether it is confirmed, and saying it twice
    * forty pixels apart reads as a mistake.
    */
   return (
      <AuthShell title="Account">
         <div className="grid gap-10">
            {/*
             * Keyed on the address, so a change finished in another tab
             * clears a note that still says it is on its way.
             */}
            {user ? (
               <YourEmail
                  key={user.email}
                  email={user.email}
                  verified={user.emailVerified}
                  onConfirmed={() => void refetch()}
               />
            ) : null}

            <section>
               <h2 className="g text-[30px] md:text-[36px]">
                  Change your password
               </h2>
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

            {/*
             * No heading here. The section holds one button that already says
             * what it does, and a 30px heading reading Sign out directly above
             * a button reading Sign out scans as a copy mistake.
             */}
            <section>
               <Button
                  type="button"
                  variant="outline"
                  className="justify-self-start"
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
