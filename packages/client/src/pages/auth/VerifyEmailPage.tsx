import { Link, useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '@/lib/title';
import { AuthShell } from './AuthShell';

/*
 * better-auth verifies the address on its own route and redirects here, so this
 * screen only ever reports. It never holds a token itself.
 */
export function VerifyEmailPage() {
   useDocumentTitle('Verify your email');
   const [params] = useSearchParams();

   if (params.get('error')) {
      return (
         <AuthShell
            title="That link will not work"
            lead="It may have expired, or been opened already. Signing in will send a fresh one."
            footer={
               <p className="text-[17px] text-ink-2">
                  <Link to="/sign-in" className="text-teal-text">
                     Go to sign in
                  </Link>
               </p>
            }
         >
            <span />
         </AuthShell>
      );
   }

   if (params.get('sent')) {
      return (
         <AuthShell
            title="Check your email"
            lead="A link to confirm your address is on its way. You can start logging before you open it."
            footer={
               <p className="text-[17px] text-ink-2">
                  <Link to="/" className="text-teal-text">
                     Go to your log
                  </Link>
               </p>
            }
         >
            <p className="max-w-[52ch] text-[17px] text-ink-2">
               Confirming the address is what lets you reset a forgotten
               password later, so it is worth doing before you need it.
            </p>
         </AuthShell>
      );
   }

   return (
      <AuthShell
         title="Your email is confirmed"
         lead="That is the last of the paperwork."
         footer={
            <p className="text-[17px] text-ink-2">
               <Link to="/" className="text-teal-text">
                  Go to your log
               </Link>
            </p>
         }
      >
         <span />
      </AuthShell>
   );
}
