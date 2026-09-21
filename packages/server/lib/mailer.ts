import { Resend } from 'resend';
import {
   changeEmailConfirmationEmail,
   passwordChangedEmail,
   resetPasswordEmail,
   verifyEmail,
   verifyNewAddressEmail,
   welcomeEmail,
   type MailPerson,
} from './mail/templates';

/*
 * Email, through Resend.
 *
 * With no key in a developer's .env the link is printed to the log instead, so
 * sign-up still completes locally without anybody needing a Resend account. In
 * production that fallback is a fault, not a convenience, and it says so.
 *
 * The mails that carry a link throw when they did not go out. better-auth
 * catches that on sign-up, reset and change of address and logs it without
 * failing the request. auth.ts lets it reach the page only on a signed-in
 * "send it again", the one place a person is waiting to hear and the answer
 * gives nothing away. The two notices never throw: they run after the change
 * they describe is already saved.
 */

type Recipient = MailPerson;

/*
 * Railway sets RAILWAY_ENVIRONMENT_NAME on every deploy and nothing sets
 * NODE_ENV there, so NODE_ENV alone would call production a laptop.
 */
const inProduction =
   Boolean(process.env.RAILWAY_ENVIRONMENT_NAME?.trim()) ||
   process.env.NODE_ENV === 'production';

export type SentMail = {
   kind:
      | 'verify'
      | 'verify-new-address'
      | 'approve-new-address'
      | 'reset'
      | 'password-changed'
      | 'welcome';
   /* Masked. The domain is what tells a dead address from a live one. */
   to: string;
   sentAt: string;
   /* What became of it: sent by Resend, printed to the log, or refused. */
   state: 'sent' | 'logged' | 'failed';
};

/*
 * The last few, newest first, without their links: a reset link is a live
 * key to the account and has no business sitting in memory after it is sent.
 */
const KEEP = 20;
const recent: SentMail[] = [];

export const recentMail = (): SentMail[] => recent.slice();

const record = (mail: SentMail) => {
   recent.unshift(mail);
   recent.length = Math.min(recent.length, KEEP);
};

/* "o***@gmail.com". Enough to find a mail in the log, not enough to harvest. */
const mask = (email: string) => {
   const at = email.lastIndexOf('@');
   return at > 0 ? `${email[0]}***${email.slice(at)}` : '***';
};

const apiKey = process.env.RESEND_API_KEY?.trim();

/*
 * The address the mail comes from. It has to be on a domain verified in the
 * same Resend team the key belongs to, or every send is refused with a 403.
 */
const from =
   process.env.MAIL_FROM?.trim() || 'Fisherfeed <info@fisherfeed.com>';
const replyTo = process.env.MAIL_REPLY_TO?.trim() || undefined;

/* "fisherfeed.com" out of "Fisherfeed <info@fisherfeed.com>". */
const fromDomain = from.match(/@([^\s>]+)/)?.[1]?.toLowerCase() ?? null;

const resend = apiKey ? new Resend(apiKey) : null;

/** True while there is no key, so callers can say so rather than lie. */
export const mailIsMocked = !resend;

export type MailStatus = {
   transport: 'resend' | 'log';
   /*
    * What Resend says about the From domain for this key's team. 'unknown'
    * until the check at boot answers, and for good when the key is
    * sending-only and may not list domains.
    */
   domain: 'verified' | 'unverified' | 'missing' | 'unknown';
};

export const mailStatus: MailStatus = {
   transport: resend ? 'resend' : 'log',
   domain: 'unknown',
};

/*
 * Once, at boot. Every way this breaks (no key, a key from the wrong team, a
 * domain that never finished verifying) otherwise shows up only as a mail
 * nobody receives, which is how it went unnoticed.
 */
async function checkSetup() {
   if (!resend) {
      if (inProduction) {
         console.error('');
         console.error('  [mail] RESEND_API_KEY is not set in production.');
         console.error('  No account mail can be sent: no verification, no');
         console.error('  password reset. Set it on the Railway service.');
         console.error('');
      } else {
         console.warn(
            '[mail] RESEND_API_KEY is not set. Links will be printed to this log instead of sent.'
         );
      }
      return;
   }

   if (!fromDomain) {
      console.error(`[mail] MAIL_FROM "${from}" has no address in it.`);
      return;
   }

   try {
      const { data, error } = await resend.domains.list();

      if (error) {
         if (error.name === 'restricted_api_key') {
            console.log(
               `[mail] sending from ${from}. The key is sending-only, so the domain was not checked.`
            );
            return;
         }
         console.error(
            `[mail] could not check the sending domain: ${error.name} (${error.statusCode ?? 'no status'}) ${error.message}`
         );
         return;
      }

      const domain = data?.data.find(
         (candidate) => candidate.name.toLowerCase() === fromDomain
      );

      if (!domain) {
         mailStatus.domain = 'missing';
         console.error(
            `[mail] ${fromDomain} is not a domain in this key's Resend team. Every send will be refused. The key is from the wrong team, or the domain was never added to it.`
         );
         return;
      }

      if (domain.status === 'partially_verified') {
         mailStatus.domain = 'unverified';
         console.warn(
            `[mail] ${fromDomain} is only partially verified in Resend. It may still send, but check its records in the dashboard.`
         );
         return;
      }

      if (domain.status !== 'verified') {
         mailStatus.domain = 'unverified';
         console.error(
            `[mail] ${fromDomain} is ${domain.status} in Resend, not verified. Sends will be refused until it is.`
         );
         return;
      }

      mailStatus.domain = 'verified';
      console.log(`[mail] sending from ${from}, domain verified.`);
   } catch (cause) {
      console.error(
         '[mail] could not reach Resend to check the domain:',
         cause
      );
   }
}

void checkSetup();

/*
 * Loud on purpose. Locally this is the only way to finish a sign-up, so the
 * link is printed. In production it is not: a log is no place for a live key
 * to somebody's account.
 */
const announce = (label: string, to: string, url?: string) => {
   console.log('');
   console.log(`  ${label}`);
   console.log(`  to:   ${inProduction ? mask(to) : to}`);
   if (url && !inProduction) console.log(`  open: ${url}`);
   console.log('  No mail was sent. RESEND_API_KEY is not set.');
   console.log('');
};

/* True when the mail left, or when printing it is the arrangement. */
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
}): Promise<boolean> {
   const sentAt = new Date().toISOString();
   const shown = mask(to);

   if (!resend) {
      announce(label, to, url);
      record({ kind, to: shown, sentAt, state: 'logged' });
      return !inProduction;
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
         console.error(
            `[mail] ${kind} to ${shown} refused: ${error.name} (${error.statusCode ?? 'no status'}) ${error.message}`
         );
         record({ kind, to: shown, sentAt, state: 'failed' });
         return false;
      }

      console.log(`[mail] ${kind} sent to ${shown} (${data?.id ?? 'no id'})`);
      record({ kind, to: shown, sentAt, state: 'sent' });
      return true;
   } catch (cause) {
      /* A network blip or Resend having a bad morning. */
      console.error(`[mail] ${kind} to ${shown} failed:`, cause);
      record({ kind, to: shown, sentAt, state: 'failed' });
      return false;
   }
}

/*
 * Both the sign-up link and the last step of a change of address. `newAddress`
 * picks the wording; the link is better-auth's either way.
 */
export async function sendVerificationEmail({
   user,
   url,
   newAddress = false,
}: {
   user: Recipient;
   url: string;
   newAddress?: boolean;
}) {
   const mail = newAddress
      ? verifyNewAddressEmail({ user, url })
      : verifyEmail({ user, url });
   const sent = await deliver({
      kind: newAddress ? 'verify-new-address' : 'verify',
      label: newAddress ? 'VERIFY NEW ADDRESS' : 'VERIFY EMAIL',
      to: user.email,
      url,
      ...mail,
   });
   if (!sent) throw new Error('The verification email was not sent.');
}

/* To the CURRENT address, before a confirmed account may move. */
export async function sendChangeEmailConfirmation({
   user,
   newEmail,
   url,
}: {
   user: Recipient;
   newEmail: string;
   url: string;
}) {
   const mail = changeEmailConfirmationEmail({ user, newEmail, url });
   const sent = await deliver({
      kind: 'approve-new-address',
      label: 'APPROVE NEW ADDRESS',
      to: user.email,
      url,
      ...mail,
   });
   if (!sent) throw new Error('The change of address approval was not sent.');
}

export async function sendResetPassword({
   user,
   url,
}: {
   user: Recipient;
   url: string;
}) {
   const mail = resetPasswordEmail({ user, url });
   const sent = await deliver({
      kind: 'reset',
      label: 'RESET PASSWORD',
      to: user.email,
      url,
      ...mail,
   });
   if (!sent) throw new Error('The password reset email was not sent.');
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
