import axios from 'axios';
import { type FormEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandleField } from '@/components/profile/HandleField';
import {
   HANDLE_MAX,
   HANDLE_MIN,
   blocksSave,
   handleSaveProblem,
   normaliseHandle,
   useHandleCheck,
} from '@/components/profile/handle';
import { Button } from '@/components/ui/button';
import { signOut, useSession } from '@/lib/auth-client';
import { forgetPushOnSignOut } from '@/lib/push';
import { useDocumentTitle } from '@/lib/title';
import { AuthForm, AuthShell } from '@/pages/auth/AuthShell';

/*
 * A first guess, from the name they signed up with, so most people only have
 * to read it and press Save. Owen Kleinhans is offered owen_kleinhans; a name
 * with nothing usable in it leaves the field empty rather than offering junk.
 */
const guessFrom = (name: string) => {
   const guess = normaliseHandle(name)
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, HANDLE_MAX);

   return guess.length >= HANDLE_MIN ? guess : '';
};

/*
 * The one thing a new account still owes: a handle. Sign-up does not ask for
 * one, so the first signed-in page asks instead, and nothing else is in the
 * way. Saving hands the angler straight on to the page they were opening.
 */
export function HandleStep() {
   useDocumentTitle('Pick your handle');
   const navigate = useNavigate();
   const { data, refetch } = useSession();
   const inputRef = useRef<HTMLInputElement>(null);

   const [handle, setHandle] = useState(() => guessFrom(data?.user.name ?? ''));
   const [finished, setFinished] = useState(false);
   const [serverError, setServerError] = useState('');
   const [failed, setFailed] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);

   const check = useHandleCheck(handle, null);

   const save = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFinished(true);
      setFailed(null);

      if (blocksSave(check)) {
         inputRef.current?.focus();
         return;
      }

      setBusy(true);

      try {
         await axios.patch('/api/users/me', { username: handle });
         /*
          * The gate reads the session, so once the session carries the
          * handle this step is replaced by the page it was standing in for.
          * No redirect: the address never changed.
          */
         await refetch();
      } catch (error) {
         const problem = handleSaveProblem(error);

         if (problem) {
            setServerError(problem);
            inputRef.current?.focus();
            return;
         }

         setFailed('Not saved. Check your connection and try again.');
      } finally {
         setBusy(false);
      }
   };

   const leave = async () => {
      /* This device stops ringing for the account that is leaving it. */
      await forgetPushOnSignOut();
      await signOut();
      navigate('/');
   };

   return (
      <AuthShell
         title="Pick your handle"
         lead="Other anglers find you by it, and it sits under your name on every post. You can change it later on your profile."
         footer={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
               <p className="min-w-0 text-[15px] break-words text-ink-2">
                  Signed in as {data?.user.email}.
               </p>
               <Button type="button" variant="ghost" onClick={leave}>
                  Sign out
               </Button>
            </div>
         }
      >
         <AuthForm onSubmit={save} error={failed}>
            <HandleField
               ref={inputRef}
               value={handle}
               onChange={(next) => {
                  setHandle(next);
                  setServerError('');
               }}
               onBlur={() => setFinished(true)}
               check={check}
               finished={finished}
               serverError={serverError}
            />
            <Button
               type="submit"
               size="lg"
               disabled={busy}
               className="justify-self-start"
            >
               {busy ? 'Saving' : 'Save handle'}
            </Button>
         </AuthForm>
      </AuthShell>
   );
}
