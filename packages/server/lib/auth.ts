import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './prisma';
import {
   sendPasswordChanged,
   sendResetPassword,
   sendVerificationEmail,
   sendWelcome,
} from './mailer';

/*
 * Self-hosted auth, replacing Clerk. Sessions are httpOnly cookies in the same
 * MySQL the rest of the app uses, so an authenticated request costs a local
 * query rather than a round trip to someone else's API.
 */

/*
 * The origin the BROWSER sees, not the port the server listens on. In
 * development that is the Vite dev server, because the client proxies /api to
 * the server; in production it is the Vercel domain, because Vercel rewrites
 * /api to Railway. Getting this wrong is what produces redirect mismatches.
 */
const baseURL =
   process.env.BETTER_AUTH_URL?.trim() ||
   process.env.APP_ORIGIN?.trim() ||
   'http://localhost:5173';

/*
 * A list, not one value. The same API serves the deployed site and a developer
 * running the client locally against it, and better-auth rejects an Origin it
 * does not know.
 */
const trustedOrigins = (process.env.APP_ORIGIN?.trim() || baseURL)
   .split(',')
   .map((origin) => origin.trim())
   .filter(Boolean);

/*
 * There is no mail provider yet, so requiring a verified address would lock
 * every new account out of the app. The verification mail is still sent, and
 * still logged, so the flow can be exercised; it just is not a gate until a
 * provider exists. Flip this with MAIL_PROVIDER_READY=true.
 */
const requireEmailVerification =
   process.env.MAIL_PROVIDER_READY?.trim() === 'true';

if (!process.env.BETTER_AUTH_SECRET?.trim()) {
   /*
    * Better to say so once at boot than to have sessions silently fail to
    * survive a redeploy, which is what an ephemeral generated secret does.
    */
   console.warn(
      '[auth] BETTER_AUTH_SECRET is not set. Sessions will not survive a restart.'
   );
}

export const auth = betterAuth({
   database: prismaAdapter(prisma, { provider: 'mysql' }),
   baseURL,
   secret: process.env.BETTER_AUTH_SECRET,
   trustedOrigins,

   emailAndPassword: {
      enabled: true,
      requireEmailVerification,
      sendResetPassword,
      /*
       * A password that changed is the one account event worth telling somebody
       * about unprompted: if they did not do it, this is how they find out.
       * It fires after the new password is saved, so it is a record of a thing
       * that happened rather than a request for anything.
       */
      onPasswordReset: async ({ user }) => {
         await sendPasswordChanged({
            user: { email: user.email, name: user.name },
         });
      },
   },

   emailVerification: {
      sendVerificationEmail,
      autoSignInAfterVerification: true,
      /*
       * Send it even though it is not a gate yet. Otherwise nothing is written
       * to the log at sign-up and the verification flow cannot be exercised at
       * all until a mail provider exists, which is the opposite of the point.
       */
      sendOnSignUp: true,
      /*
       * The address is confirmed and the log is really open, so this is the
       * moment the welcome is true rather than presumptuous.
       */
      afterEmailVerification: async (user) => {
         await sendWelcome({ user: { email: user.email, name: user.name } });
      },
   },

   /*
    * Mapped onto the existing users table rather than a second one, so every
    * catch, spot and follow keeps pointing at the same row it always did.
    */
   user: {
      /*
       * Lowercase. The Prisma adapter addresses models by their client
       * property, which is the model name with a lowercased first letter, so
       * 'User' is looked up as a table that does not exist. @@map does not
       * come into it.
       */
      modelName: 'user',
      fields: {
         name: 'displayName',
         image: 'avatarUrl',
      },
      additionalFields: {
         username: { type: 'string', required: false, input: false },
         bio: { type: 'string', required: false, input: false },
         storagePrefixId: { type: 'string', required: false, input: false },
      },
   },

   /*
    * In memory, which resets on every deploy. Fine for one instance; it would
    * need database storage behind more than one.
    */
   rateLimit: {
      enabled: true,
      customRules: {
         '/sign-in/email': { window: 60, max: 5 },
         '/sign-up/email': { window: 3600, max: 5 },
         '/forget-password': { window: 3600, max: 5 },
      },
   },

   databaseHooks: {
      user: {
         create: {
            /*
             * R2 keys are built from storagePrefixId, and the column is
             * required and unique, so a new user needs one before the row
             * lands. Their own id is the obvious stable choice.
             */
            before: async (user) => ({
               data: {
                  ...user,
                  storagePrefixId:
                     (user as { id?: string }).id ??
                     `u_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
               },
            }),
         },
      },
   },
});

export type AuthSession = typeof auth.$Infer.Session;
