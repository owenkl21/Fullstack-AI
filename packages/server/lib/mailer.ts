import { Resend } from 'resend';
import {
   passwordChangedEmail,
   resetPasswordEmail,
   verifyEmail,
   welcomeEmail,
   type MailPerson,
} from './mail/templates';

/*
 * Email, through Resend.
 *
 * This was a stub that printed the link to the log because there was no
 * verified sending domain. The domain exists now, so the two functions the auth
 * config already imports send real mail, and the printing stays as the fallback
 * for a developer with no key in their .env: sign-up still completes locally
 * without anybody needing a Resend account.
 *
 * Nothing in here ever throws. A mail that fails to send must not take a
 * sign-up or a password reset down with it; it is logged loudly instead, and
 * the caller carries on.
 */

type Recipient = MailPerson;

export type SentMail = {
   kind: 'verify' | 'reset' | 'password-changed' | 'welcome';
   to: string;
   /* Only the two mails that carry a link have one. */
   url?: string;
   sentAt: string;
   /* What became of it: sent by Resend, printed to the log, or refused. */
   state: 'sent' | 'logged' | 'failed';
};

const KEEP = 20;
const recent: SentMail[] = [];

export const recentMail = (): SentMail[] => recent.slice();

const record = (mail: SentMail) => {
   recent.unshift(mail);
   recent.length = Math.min(recent.length, KEEP);
};

const apiKey = process.env.RESEND_API_KEY?.trim();

/*
 * The address the mail comes from. It has to be on the domain verified in
 * Resend, and it should be one a reply can actually reach: a product this size
 * is better off reading the replies than bouncing them.
 */
const from =
   process.env.MAIL_FROM?.trim() || 'Fisherfeed <hello@fisherfeed.com>';
const replyTo = process.env.MAIL_REPLY_TO?.trim() || undefined;

const resend = apiKey ? new Resend(apiKey) : null;

/** True while there is no key, so callers can say so rather than lie. */
export const mailIsMocked = !resend;

if (!resend) {
   console.warn(
      '[mail] RESEND_API_KEY is not set. Links will be printed to this log instead of sent.'
   );
}

/*
 * Loud on purpose: with no provider this is the only way to finish a sign-up,
 * so it should be impossible to miss when scrolling the log.
 */
const announce = (label: string, to: string, url?: string) => {
   console.log('');
   console.log(`  ${label}`);
   console.log(`  to:   ${to}`);
   if (url) console.log(`  open: ${url}`);
   console.log('  No mail was sent. RESEND_API_KEY is not set.');
   console.log('');
};

async function deliver({
   kind,
   label,
   to,
   subject,
   html,
   text,
   url,
}: {
   kind: SentMail['kind'];
   label: string;
   to: string;
   subject: string;
   html: string;
   text: string;
   url?: string;
}) {
   const sentAt = new Date().toISOString();

   if (!resend) {
      announce(label, to, url);
      record({ kind, to, url, sentAt, state: 'logged' });
      return;
   }

   try {
      const { data, error } = await resend.emails.send({
         from,
         to,
         subject,
         html,
         text,
         replyTo,
      });

      if (error) {
         console.error(`[mail] ${kind} to ${to} refused:`, error.message);
         record({ kind, to, url, sentAt, state: 'failed' });
         return;
      }

      console.log(`[mail] ${kind} sent to ${to} (${data?.id ?? 'no id'})`);
      record({ kind, to, url, sentAt, state: 'sent' });
   } catch (cause) {
      /* A network blip, a dead key, Resend having a bad morning. Never fatal. */
      console.error(`[mail] ${kind} to ${to} failed:`, cause);
      record({ kind, to, url, sentAt, state: 'failed' });
   }
}

export async function sendVerificationEmail({
   user,
   url,
}: {
   user: Recipient;
   url: string;
}) {
   const mail = verifyEmail({ user, url });
   await deliver({
      kind: 'verify',
      label: 'VERIFY EMAIL',
      to: user.email,
      url,
      ...mail,
   });
}

export async function sendResetPassword({
   user,
   url,
}: {
   user: Recipient;
   url: string;
}) {
   const mail = resetPasswordEmail({ user, url });
   await deliver({
      kind: 'reset',
      label: 'RESET PASSWORD',
      to: user.email,
      url,
      ...mail,
   });
}

/* After a reset completes. A notice, not a link to act on. */
export async function sendPasswordChanged({ user }: { user: Recipient }) {
   const mail = passwordChangedEmail({ user });
   await deliver({
      kind: 'password-changed',
      label: 'PASSWORD CHANGED',
      to: user.email,
      ...mail,
   });
}

/* Once the address is verified and the account is really open. */
export async function sendWelcome({ user }: { user: Recipient }) {
   const mail = welcomeEmail({ user });
   await deliver({
      kind: 'welcome',
      label: 'WELCOME',
      to: user.email,
      ...mail,
   });
}
