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
            `${greeting(user.name)}this confirms that ${user.email} is yours. It is also where a reset link goes if you ever lose the password.`,
            'The link works once and expires in an hour.',
         ],
         button: { label: 'Verify my email', url },
         footnote: [
            'If you did not sign up for Fisherfeed, ignore this. Nothing happens until the link is used, and it expires on its own.',
         ],
      }),
   };
}

/*
 * The last step of a change of address, sent to the NEW one. Not the sign-up
 * mail: that one tells the reader to ignore it if they never signed up, which
 * is wrong for somebody who has had an account for a year.
 */
export function verifyNewAddressEmail({
   user,
   url,
}: {
   user: MailPerson;
   url: string;
}) {
   return {
      subject: 'Confirm your new address for Fisherfeed',
      ...renderEmail({
         preheader: 'One tap and your log moves to this address.',
         kicker: 'Change of address',
         heading: 'Use this address',
         body: [
            `${greeting(user.name)}this makes ${user.email} the address for your Fisherfeed log. Sign-in and reset links will come here from now on.`,
            'The link works once and expires in an hour.',
         ],
         button: { label: 'Use this address', url },
         footnote: [
            'If you did not ask for this, ignore it. Nothing changes until the link is used, and it expires on its own.',
         ],
      }),
   };
}

/*
 * The first step of a change of address, sent to the CURRENT one, and only
 * for an account whose address is confirmed. It is what stops somebody with a
 * borrowed session moving the account to an address the owner cannot follow.
 */
export function changeEmailConfirmationEmail({
   user,
   newEmail,
   url,
}: {
   user: MailPerson;
   newEmail: string;
   url: string;
}) {
   return {
      subject: 'Approve the new address for your Fisherfeed log',
      ...renderEmail({
         preheader: `Somebody asked to move your log to ${newEmail}.`,
         kicker: 'Change of address',
         heading: 'Approve the change',
         body: [
            `${greeting(user.name)}somebody signed in to your log asked to move it from ${user.email} to ${newEmail}.`,
            `Open this to approve it. A second link then goes to ${newEmail}, and the change happens when that one is opened. Both expire in an hour.`,
         ],
         button: { label: 'Approve the change', url },
         footnote: [
            'If that was not you, do not open the link, and change your password: somebody has been in your account.',
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
