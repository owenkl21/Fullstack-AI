import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';
import { useDocumentTitle } from '@/lib/title';
import { AuthShell } from './AuthShell';
import { SendConfirmation } from './SendConfirmation';

type Failure = { title: string; lead: string; fresh: boolean };

/*
 * The codes better-auth puts in ?error= when a link fails, each in the
 * reader's terms. A link for an address that is confirmed already is not one
 * of them: it lands on the confirmed screen again.
 *
 * `fresh` is whether another copy of the same link is the way out. For the
 * other two it is not: the address has moved on, or the wrong person is
 * signed in.
 */
const failures: Record<string, Failure> = {
   TOKEN_EXPIRED: {
      title: 'That link has expired',
      lead: 'Links last an hour.',
      fresh: true,
   },
   INVALID_TOKEN: {
      title: 'That link will not work',
      lead: 'It may have been cut short when it was copied.',
      fresh: true,
   },
   USER_NOT_FOUND: {
      title: 'That link will not work',
      lead: 'The address it was for is no longer on an account. If you were changing your address, the change may have gone through already.',
      fresh: false,
   },
   INVALID_USER: {
      title: 'That link is for another account',
      lead: 'You are signed in to a different one. Sign out, then open the link again.',
      fresh: false,
   },
   /*
    * Ours, not better-auth's. A change of address only lands in a browser that
    * is signed in to the account, so the link alone is never a way in.
    */
   SIGN_IN_REQUIRED: {
      title: 'Sign in first',
      lead: 'A change of address only goes through in a browser that is signed in to the account. Sign in with your password, then open the link again.',
      fresh: false,
   },
};

const unknownFailure: Failure = {
   title: 'That link will not work',
   lead: 'It may have expired, or been cut short when it was copied.',
   fresh: true,
};

/*
 * The code comes from the address bar, so it is looked up as the table's own
 * key only. A plain index would find ?error=constructor on the prototype.
 */
function failureFor(code: string) {
   return Object.prototype.hasOwnProperty.call(failures, code)
      ? failures[code]
      : unknownFailure;
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
   return (
      <p className="inline-flex min-h-11 items-center text-[17px] text-ink-2">
         <Link
            to={to}
            className="inline-flex min-h-11 items-center text-teal-text"
         >
            {children}
         </Link>
      </p>
   );
}

/*
 * better-auth verifies the address on its own route and redirects here, so this
 * screen only ever reports. It never holds a token itself.
 *
 * Another copy of the mail is offered only to a session, because that is the
 * only time the address is known without asking for it again. Signed out, the
 * way to one is signing in: the account page sends it, and so does sign in
 * when an unconfirmed address is what turned it away.
 */
export function VerifyEmailPage() {
   useDocumentTitle('Verify your email');
   const [params] = useSearchParams();
   const { data: session, isPending, isRefetching, refetch } = useSession();
   const user = session?.user ?? null;
   const unconfirmed = user && !user.emailVerified ? user.email : null;

   const code = params.get('error');
   /* Set by the account page on a change of address, and kept on an error. */
   const change = params.has('change');

   /*
    * Nothing until the session is known, rather than one answer then another.
    * It also holds the shell back until then, so its one arrival plays on the
    * settled answer and not on a guess that is swapped a moment later.
    *
    * Only the first fetch, though. Signed out, better-auth marks the session
    * pending again on every refetch when the tab regains focus, which is
    * exactly when somebody comes back from their mail, and the page would
    * blank and replay its arrival.
    */
   if (isPending && !isRefetching) return null;

   /* Sending found the address confirmed already, so the session is stale. */
   const refresh = () => void refetch();

   const toAccount = user ? (
      <FooterLink to="/account">Go to your account</FooterLink>
   ) : (
      <FooterLink to="/sign-in?next=/account">Go to sign in</FooterLink>
   );

   if (code) {
      const failure = failureFor(code);

      /*
       * A change of address never offers the mail again from here. It would
       * go to the address the account has now, which may be the very one
       * that cannot take mail. The account page asks for the change afresh.
       */
      if (change) {
         return (
            <AuthShell
               title={failure.title}
               lead={
                  failure.fresh
                     ? `${failure.lead} Ask for a new link from your account.`
                     : failure.lead
               }
               footer={toAccount}
            >
               <span />
            </AuthShell>
         );
      }

      const next = !failure.fresh
         ? ''
         : !user
           ? ' Sign in and ask for a fresh one.'
           : unconfirmed
             ? ' Ask for a fresh one below.'
             : ' If it was for a change of address, ask again from your account.';

      return (
         <AuthShell
            title={failure.title}
            lead={`${failure.lead}${next}`}
            footer={toAccount}
         >
            {failure.fresh && unconfirmed ? (
               <SendConfirmation email={unconfirmed} onConfirmed={refresh} />
            ) : (
               <span />
            )}
         </AuthShell>
      );
   }

   /*
    * A change of address that worked, at either of its steps. Both land here
    * the same way, so the page cannot say which one this was. The address the
    * account has now settles it for the reader.
    */
   if (change) {
      return (
         <AuthShell
            title="That link worked"
            lead={user ? `Your account uses ${user.email}.` : undefined}
            footer={toAccount}
         >
            <p className="max-w-[52ch] text-[17px] text-ink-2">
               If it came to the address you are moving from, a second link is
               on its way to the new one. The change happens when that one is
               opened.
            </p>
         </AuthShell>
      );
   }

   if (params.get('sent')) {
      /*
       * Sign-up only opens a session when a confirmed address is not required.
       * When it is, there is no log to start yet. The link never signs anybody
       * in: it confirms the address, and the password does the rest.
       */
      const after = user
         ? ' You can start logging before you open it.'
         : ' Once it is opened, sign in with your password.';

      return (
         <AuthShell
            title="Check your email"
            lead={`A link to confirm your address is on its way.${after}`}
            footer={<FooterLink to="/">Go to your log</FooterLink>}
         >
            <>
               {/*
                * Not a condition of resetting a password: a reset goes to the
                * address whether it is confirmed or not. Which is the reason
                * to know that mail reaches it.
                */}
               <p className="max-w-[52ch] text-[17px] text-ink-2">
                  It is also the address a password reset goes to, so it is
                  worth knowing that mail reaches it.
               </p>
               {unconfirmed ? (
                  <SendConfirmation email={unconfirmed} onConfirmed={refresh} />
               ) : null}
            </>
         </AuthShell>
      );
   }

   /*
    * Reached without a link as well, by typing the address or going back. A
    * session that is still unconfirmed says so rather than being told it is
    * done.
    */
   if (unconfirmed) {
      return (
         <AuthShell
            title="Your email is not confirmed yet"
            lead={`Open the link in the mail sent to ${unconfirmed}, or ask for another.`}
            footer={<FooterLink to="/">Go to your log</FooterLink>}
         >
            <SendConfirmation email={unconfirmed} onConfirmed={refresh} />
         </AuthShell>
      );
   }

   /* The link confirms the address and opens no session, so signed out stays so. */
   return (
      <AuthShell
         title="Your email is confirmed"
         lead={
            user
               ? 'That is the last of the paperwork.'
               : 'Sign in with your password to carry on.'
         }
         footer={
            user ? (
               <FooterLink to="/">Go to your log</FooterLink>
            ) : (
               <FooterLink to="/sign-in">Go to sign in</FooterLink>
            )
         }
      >
         <span />
      </AuthShell>
   );
}
