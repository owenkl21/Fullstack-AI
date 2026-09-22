import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import {
   APIError,
   createAuthMiddleware,
   getSessionFromCtx,
} from 'better-auth/api';
import { isAdmin, isAdminEmail, settleAdminRole } from './admin';
import { LEGAL_VERSION } from './legal';
import { prisma } from './prisma';
import { nameHasTick, nameIsBrand } from '../schemas/user.schema';
import {
   sendChangeEmailConfirmation,
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
 * Requiring a verified address before mail is seen to arrive would lock every
 * new account out of the app. The verification mail is still sent, so the
 * flow can be exercised; it just is not a gate until then. Flip this with
 * MAIL_PROVIDER_READY=true once a real inbox has received one.
 *
 * Move every account whose address cannot take mail first. Once this is on, an
 * unconfirmed account cannot sign in, so it cannot reach Change email, and
 * every link that would rescue it goes to the dead address.
 *
 * Exported because the angler search follows the same rule: while this is off
 * an unconfirmed account is a real angler using the app, and once it is on
 * that account cannot sign in, so it is nobody to find.
 */
export const requireEmailVerification =
   process.env.MAIL_PROVIDER_READY?.trim() === 'true';

/*
 * The claims inside one of better-auth's email tokens, read without checking
 * the signature. Only used where better-auth has already checked it, or to
 * pick a mail's wording, never to decide who may do what. A change of address
 * is the one that carries updateTo.
 */
const tokenClaims = (
   token?: string | null
): { updateTo?: string; requestType?: string } => {
   try {
      const payload = token?.split('.')[1];
      return payload
         ? JSON.parse(Buffer.from(payload, 'base64url').toString())
         : {};
   } catch {
      return {};
   }
};

const tokenInRequest = (request?: Request) => {
   try {
      return request ? new URL(request.url).searchParams.get('token') : null;
   } catch {
      return null;
   }
};

/*
 * A verification mail that did not go out reaches the page only when a real
 * session asked for it. Signed out, better-auth sends only for an account that
 * exists and is unconfirmed, so a failure there would be the one answer that
 * differs, and anybody could ask about any address. The mailer has already
 * logged it either way. Checked by session, not by cookie, because a cookie is
 * trivially invented.
 */
async function sendVerification(
   data: {
      user: { email: string; name?: string | null };
      url: string;
      token: string;
   },
   request?: Request
): Promise<void> {
   try {
      await sendVerificationEmail({
         user: { email: data.user.email, name: data.user.name },
         url: data.url,
         newAddress: Boolean(tokenClaims(data.token).updateTo),
      });
   } catch (cause) {
      const session = request
         ? await auth.api
              .getSession({ headers: request.headers })
              .catch(() => null)
         : null;
      if (session) throw cause;
   }
}

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

   /*
    * Warn is better-auth's default. Named so nobody lowers it: at info it
    * prints the full address of every sign-up that meets an existing account.
    * A refused request is recorded, with its status, by the request log in
    * index.ts.
    */
   logger: { level: 'warn' },

   hooks: {
      before: createAuthMiddleware(async (ctx) => {
         /*
          * No account without agreeing to the Terms and the Privacy Policy,
          * which is where the use of photographs for training is set out.
          * The box on the sign-up page sends the version it showed; checked
          * here so the endpoint cannot be called without it, and so a page
          * left open across a change of words has to be reloaded first.
          */
         if (ctx.path === '/sign-up/email') {
            const body = ctx.body as
               | { acceptTerms?: unknown; name?: unknown; email?: unknown }
               | undefined;
            if (body?.acceptTerms !== LEGAL_VERSION) {
               throw new APIError('BAD_REQUEST', {
                  code: 'TERMS_NOT_ACCEPTED',
                  message:
                     'Agree to the Terms and the Privacy Policy to start a log. If you did, reload the page and try again.',
               });
            }
            /*
             * The name is set here, not by the profile endpoint, so the two
             * rules the profile endpoint keeps have to be stated here as
             * well. A tick is refused to everybody, the admin address
             * included: the real mark is drawn from a column and nobody has
             * to type one.
             */
            if (typeof body.name === 'string' && nameHasTick(body.name)) {
               throw new APIError('BAD_REQUEST', {
                  code: 'DISPLAY_NAME_TICK',
                  message: 'A display name cannot use a tick mark.',
               });
            }
            /*
             * Only the admin address may sign up as Fisherfeed anything, and
             * even then the tick waits on the confirmation link.
             */
            if (
               typeof body.name === 'string' &&
               nameIsBrand(body.name) &&
               !isAdminEmail(typeof body.email === 'string' ? body.email : null)
            ) {
               throw new APIError('BAD_REQUEST', {
                  code: 'DISPLAY_NAME_RESERVED',
                  message: 'That display name is reserved. Pick another one.',
               });
            }
         }

         /*
          * better-auth's own endpoint for changing a name, which exists
          * whether or not a page calls it. Without this the rule above could
          * be walked around by signing up plainly and renaming afterwards.
          */
         if (ctx.path === '/update-user') {
            const body = ctx.body as { name?: unknown } | undefined;
            /* A tick is refused to everybody, so this one costs no lookup:
               there is nobody it would be allowed for. */
            if (typeof body?.name === 'string' && nameHasTick(body.name)) {
               throw new APIError('BAD_REQUEST', {
                  code: 'DISPLAY_NAME_TICK',
                  message: 'A display name cannot use a tick mark.',
               });
            }
            if (typeof body?.name === 'string' && nameIsBrand(body.name)) {
               const session = await getSessionFromCtx(ctx);
               const actor = session?.user?.id
                  ? await prisma.user.findUnique({
                       where: { id: session.user.id },
                       select: { role: true },
                    })
                  : null;
               if (!isAdmin(actor)) {
                  throw new APIError('BAD_REQUEST', {
                     code: 'DISPLAY_NAME_RESERVED',
                     message: 'That display name is reserved.',
                  });
               }
            }
         }

         /*
          * A change of address asks for the current password, as a change of
          * password already does. Without it, anybody at a device the owner
          * left signed in could move the account to their own address, reset
          * the password there, and keep it. better-auth's endpoint takes no
          * password, so it is checked here, against the same hash sign-in
          * uses, before the endpoint runs at all.
          */
         if (ctx.path === '/change-email') {
            const session = await getSessionFromCtx(ctx);
            /* Signed out, the endpoint answers 401 on its own. */
            if (!session) return;
            const body = ctx.body as { password?: unknown } | undefined;
            const password =
               typeof body?.password === 'string' ? body.password : '';
            const account =
               await ctx.context.internalAdapter.findCredentialAccount(
                  session.user.id
               );
            const right =
               password.length > 0 &&
               !!account?.password &&
               (await ctx.context.password.verify({
                  hash: account.password,
                  password,
               }));
            if (!right) {
               throw new APIError('BAD_REQUEST', {
                  code: 'INVALID_PASSWORD',
                  message: 'Invalid password',
               });
            }
            return;
         }

         /*
          * No link in a mail ever opens a session. Only a password does.
          *
          * better-auth's change-of-address link signs in whoever opens it
          * when nobody is signed in, and there is no option to stop it, so
          * the link is refused here unless the account is already signed in
          * on that browser. The approval step, which only sends the next mail,
          * needs no session. The redirect is fixed rather than the link's own
          * callbackURL: this runs before better-auth has checked the token,
          * and a forged one must not turn this into an open redirect.
          */
         if (ctx.path === '/verify-email') {
            const token = ctx.query?.token;
            const claims = tokenClaims(
               typeof token === 'string' ? token : null
            );
            if (!claims.updateTo) return;
            if (claims.requestType === 'change-email-confirmation') return;
            if (await getSessionFromCtx(ctx)) return;
            throw ctx.redirect('/verify-email?change=1&error=SIGN_IN_REQUIRED');
         }
      }),
   },

   emailAndPassword: {
      enabled: true,
      requireEmailVerification,
      /*
       * A reset signs out every session, this browser's included. Otherwise
       * whoever was already in, the owner or somebody who should not be,
       * stays in on the old password, and the reset lands the owner straight
       * back in the account without typing the new one.
       */
      revokeSessionsOnPasswordReset: true,
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
      sendVerificationEmail: sendVerification,
      /*
       * Off. On, opening the link signs in whoever opened it, with no
       * password, which makes a forwarded or intercepted mail a key to the
       * account. Confirming an address confirms it and nothing more.
       */
      autoSignInAfterVerification: false,
      /*
       * Send it even though it is not a gate yet. Otherwise nothing is written
       * to the log at sign-up and the verification flow cannot be exercised at
       * all until a mail provider exists, which is the opposite of the point.
       */
      sendOnSignUp: true,
      /*
       * The address is confirmed and the log is really open, so this is the
       * moment the welcome is true rather than presumptuous. A change of
       * address lands here too, and an angler with a year of catches does not
       * need telling to log the first one.
       */
      afterEmailVerification: async (user, request) => {
         /*
          * The address is now confirmed, which is the only thing the admin
          * grant waits for. Settled here as well as at sign-in so the owner
          * does not have to sign out and back in after opening the link.
          *
          * A change of address may withdraw the role as well as grant it, and
          * it is the only place that may: the row's own address has just
          * moved, so an account that has left info@fisherfeed.com has to leave
          * the tick behind with it.
          */
         const changed = Boolean(tokenClaims(tokenInRequest(request)).updateTo);
         await settleAdminRole(user.id, { withdraw: changed });
         if (changed) return;
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
      /*
       * An account made with an address that cannot take mail could never
       * reset its password, so it needs a way to move.
       *
       * A confirmed account must approve from its current address first,
       * which is what stops a borrowed session moving it somewhere the owner
       * cannot follow. An unconfirmed one has no working address to ask, so
       * its link goes straight to the new address, and the change lands only
       * when that is opened.
       */
      changeEmail: {
         enabled: true,
         sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
            await sendChangeEmailConfirmation({
               user: { email: user.email, name: user.name },
               newEmail,
               url,
            });
         },
      },
      fields: {
         name: 'displayName',
         image: 'avatarUrl',
      },
      additionalFields: {
         username: { type: 'string', required: false, input: false },
         bio: { type: 'string', required: false, input: false },
         storagePrefixId: { type: 'string', required: false, input: false },
         /* Which words the account agreed to, and when. Set on create only. */
         termsVersion: { type: 'string', required: false, input: false },
         termsAcceptedAt: { type: 'date', required: false, input: false },
         /*
          * So the menu can show the admin panel's link without a second
          * request, and so a name can carry its tick wherever the session is
          * already to hand. input: false is the important word on both: it is
          * what stops a sign-up body carrying role: 'ADMIN' and being believed.
          * Every admin route still reads the role from the database itself.
          */
         role: { type: 'string', required: false, input: false },
         verified: { type: 'boolean', required: false, input: false },
      },
   },

   /*
    * In memory, which resets on every deploy. Fine for one instance; it would
    * need database storage behind more than one.
    *
    * Reset and verification mail fall under better-auth's own rule, three a
    * minute. There was a '/forget-password' rule here, but that path is the
    * email-otp plugin's, which this app does not use, so it matched nothing.
    *
    * A change of address mails any address it is given, so it gets the same
    * ceiling as sign-up. better-auth's default, three every ten seconds, would
    * let one account spray the sending domain's reputation away.
    */
   rateLimit: {
      enabled: true,
      customRules: {
         '/sign-in/email': { window: 60, max: 5 },
         '/sign-up/email': { window: 3600, max: 5 },
         '/change-email': { window: 3600, max: 5 },
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
                  /*
                   * Email sign-up is the only way a user is made, and the
                   * before hook above has already refused one that did not
                   * agree, so every row made here agreed to this version now.
                   */
                  termsVersion: LEGAL_VERSION,
                  termsAcceptedAt: new Date(),
               },
            }),
            /*
             * A sign-up with the admin address is still an ordinary angler
             * here, because an address nobody has confirmed proves nothing.
             * Settled anyway so the rule is stated at the one moment a row
             * comes into being; it grants only if the row already arrived
             * confirmed, which email sign-up never does.
             */
            after: async (user) => {
               await settleAdminRole(user.id);
            },
         },
      },
      /*
       * Every sign-in, and every other moment better-auth opens a session.
       * The grant is re-stated rather than remembered, so the owner does not
       * have to be signed in at the moment an address is added to the list.
       *
       * It grants and never takes back: taking an address out of ADMIN_EMAILS
       * does not undo a role that was already written, because settling is
       * not policing. Removing somebody is a deliberate act on the row.
       */
      session: {
         create: {
            before: async (session) => {
               await settleAdminRole(session.userId);
            },
         },
      },
   },
});

export type AuthSession = typeof auth.$Infer.Session;
