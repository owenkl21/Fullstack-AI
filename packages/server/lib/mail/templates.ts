import { renderEmail } from './layout';

/*
 * The four mails the account itself sends. Nothing here is marketing: every one
 * of them is the consequence of something the reader just did, which is why
 * each says what happened, what to do, and what to do if it was not them.
 *
 * The voice is the product's. Short sentences, no exclamation marks, no
 * "Hi there!", and the first person only where the app already uses it.
 */

/* Where the app lives, for the links a mail makes on its own. */
const origin = () => {
   const list =
      process.env.APP_ORIGIN?.trim() || process.env.BETTER_AUTH_URL?.trim();
   const first = list?.split(',')[0]?.trim();
   return (first || 'http://localhost:5173').replace(/\/+$/, '');
};

/* "Riaan" out of "Riaan Adams", and nothing at all out of an empty name. */
const firstName = (name?: string | null) => {
   const first = name?.trim().split(/\s+/)[0];
   return first && first.length > 1 ? first : null;
};

const greeting = (name?: string | null) => {
   const first = firstName(name);
   return first ? `${first}, ` : '';
};

export type MailPerson = { email: string; name?: string | null };

export function verifyEmail({ user, url }: { user: MailPerson; url: string }) {
   return {
      subject: 'Verify your email for Fisherfeed',
      ...renderEmail({
         preheader: 'One tap and your address is confirmed.',
         kicker: 'Confirm your address',
         heading: 'Verify your email',
         body: [
            `${greeting(user.name)}this confirms that ${user.email} is yours, which is what lets you get back into your log if you ever lose the password.`,
            'The link works once and expires in an hour.',
         ],
         button: { label: 'Verify my email', url },
         footnote: [
            'If you did not sign up for Fisherfeed, ignore this. Nothing happens until the link is used, and it expires on its own.',
         ],
      }),
   };
}

export function resetPasswordEmail({
   user,
   url,
}: {
   user: MailPerson;
   url: string;
}) {
   return {
      subject: 'Reset your Fisherfeed password',
      ...renderEmail({
         preheader: 'Set a new password. The link lasts an hour.',
         kicker: 'Password reset',
         heading: 'Set a new password',
         body: [
            `${greeting(user.name)}somebody asked to reset the password for ${user.email}.`,
            'The link works once and expires in an hour.',
         ],
         button: { label: 'Set a new password', url },
         footnote: [
            'If that was not you, ignore this. Your password stays exactly as it is and your log is untouched.',
         ],
      }),
   };
}

export function passwordChangedEmail({ user }: { user: MailPerson }) {
   const stamp = new Date().toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      dateStyle: 'full',
      timeStyle: 'short',
   });

   return {
      subject: 'Your Fisherfeed password was changed',
      ...renderEmail({
         preheader: 'A record of a change to your account.',
         kicker: 'Account notice',
         heading: 'Your password was changed',
         body: [
            `${greeting(user.name)}the password for ${user.email} was changed on ${stamp}.`,
            'This is a record. There is nothing to do if it was you.',
         ],
         button: {
            label: 'Reset it again',
            url: `${origin()}/forgot-password`,
         },
         linkNote: 'If this was not you, reset the password now:',
         footnote: [
            'Changing a password does not sign anybody out on its own. If you think somebody else has been in the account, reset it and then sign out of every browser you do not recognise.',
         ],
      }),
   };
}

export function welcomeEmail({ user }: { user: MailPerson }) {
   return {
      subject: 'Your Fisherfeed log is open',
      ...renderEmail({
         preheader: 'Your address is confirmed. Log the first fish.',
         kicker: 'You are in',
         heading: 'Your log is open',
         body: [
            `${greeting(user.name)}${user.email} is confirmed, so the log is yours.`,
            'One tap stamps where you are, the minute and the weather. Photograph the fish and it names itself. The rest is optional, and anything left alone is recorded by eye.',
            'The first entry is the one that makes the rest worth having, so it is worth logging even a blank trip.',
         ],
         button: { label: 'Log your first catch', url: `${origin()}/log` },
         linkNote: 'Or start here:',
      }),
   };
}
