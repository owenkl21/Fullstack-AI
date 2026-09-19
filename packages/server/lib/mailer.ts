/*
 * Email, with no email provider yet.
 *
 * Resend needs a verified sending domain, which takes up to 72 hours and is the
 * owner's to arrange. Until it exists this writes the link to the log and keeps
 * the last few in memory, so verification and password reset can be walked
 * through end to end rather than sitting untestable behind a DNS record.
 *
 * Swapping in Resend later is this one file: keep the two exported functions,
 * send the mail, drop the recorder.
 */

type Recipient = { email: string; name?: string | null };

export type SentMail = {
   kind: 'verify' | 'reset';
   to: string;
   url: string;
   /* When the link stops working, so a stale one in the log is obvious. */
   sentAt: string;
};

/*
 * The last few links, newest first. In memory on purpose: they are short lived
 * secrets and have no business outliving the process or reaching the database.
 */
const KEEP = 20;
const recent: SentMail[] = [];

export const recentMail = (): SentMail[] => recent.slice();

const record = (mail: SentMail) => {
   recent.unshift(mail);
   recent.length = Math.min(recent.length, KEEP);
};

/*
 * Loud on purpose. This is the only way to complete a sign-up right now, so it
 * should be impossible to miss when scrolling `railway logs`.
 */
const announce = (label: string, to: string, url: string) => {
   console.log('');
   console.log(`  ${label}`);
   console.log(`  to:   ${to}`);
   console.log(`  open: ${url}`);
   console.log('  No mail was sent. There is no provider configured yet.');
   console.log('');
};

export async function sendVerificationEmail({
   user,
   url,
}: {
   user: Recipient;
   url: string;
}) {
   announce('VERIFY EMAIL', user.email, url);
   record({
      kind: 'verify',
      to: user.email,
      url,
      sentAt: new Date().toISOString(),
   });
}

export async function sendResetPassword({
   user,
   url,
}: {
   user: Recipient;
   url: string;
}) {
   announce('RESET PASSWORD', user.email, url);
   record({
      kind: 'reset',
      to: user.email,
      url,
      sentAt: new Date().toISOString(),
   });
}

/** True once a real provider is wired up, so callers can stop apologising. */
export const mailIsMocked = true;
