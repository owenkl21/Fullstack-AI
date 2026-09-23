# Replacing Clerk with self-hosted auth

**Recommendation:** Adopt better-auth 1.7.5 with its Prisma adapter pointed at the existing MySQL database, mounted inside the same Express app at /api/auth, using httpOnly cookie sessions and email plus password with Resend for verification and reset. It is the only current option whose published peer dependencies name Prisma 7 and React 19, and the repo is already cookie authenticated through the Vite proxy, so there is no cross origin cookie problem to solve in development. Map better-auth's user model onto the existing users table rather than creating a second one, which also deletes the per request call to Clerk's API that every authenticated endpoint makes today.

**Effort:** L. Roughly 4 to 6 focused days: the server swap is about 1.5 days, but five new client screens (sign in, sign up, forgot, reset, verify) plus the account panel that Clerk's UserButton gave for free is the bulk of it, and importing real Clerk users adds about a day on top.

1. # Replacing Clerk with self-hosted auth

## What exists today

### Server

| File | What Clerk does there |
|---|---|
| `packages/server/index.ts:13-17` | Mounts `POST /api/webhooks/clerk` with `express.raw({type:'application/json'})` before the JSON parser, handled by `webhookController.handleClerkWebhook`. |
| `packages/server/index.ts:28` | `app.use(clerkMiddleware())` after `express.json()`. This is what populates the request so `getAuth()` works. |
| `packages/server/routes.ts:9,14-41` | `requireApiAuth` calls `getAuth(req)`, rejects when `!auth.isAuthenticated || !auth.userId`, then calls `userService.syncAuthenticatedUser(auth.userId)` and swallows failures. Applied to 28 of the 34 routes. |
| `packages/server/controllers/webhook.controller.ts` | `verifyWebhook(req)` from `@clerk/express/webhooks`, handles `user.created`, `user.updated`, `user.deleted`. Needs `CLERK_WEBHOOK_SIGNING_SECRET`, which the README documents at line 300 but `.env.example` never lists. |
| `packages/server/controllers/user.controller.ts` | `getAuth(req)` in all five handlers; passes `auth.userId` to `getProfileByClerkId`, `updateProfileByClerkId`, `followByClerkId`, `listConnectionsByClerkId`, `unfollowByClerkId`. |
| `packages/server/controllers/fishing.controller.ts` | `getAuth(req)` at 8 call sites. |
| `packages/server/controllers/feed.controller.ts` | `getAuth(req)` at 7 call sites. |
| `packages/server/controllers/gear.controller.ts` | `getAuth(req)` at 5 call sites. |
| `packages/server/controllers/uploads.controller.ts` | `getAuth(req)` at 3 call sites, and passes `clerkUserId: auth.userId` into the uploads service, which puts it into R2 object keys. |
| `packages/server/services/user.service.ts` | The deepest coupling. `clerkClient.users.getUser()` for the primary email and display name (`getPrimaryEmail`, line 362); avatar push to Clerk with a retry (`syncAvatarToClerk` / `syncAvatarToClerkWithRetry`, lines 101-168); the `clerk_fallback` storage mode that reads and writes `unsafeMetadata.appProfile` when the database is unreachable (lines 386-432, 513-539, 595-630); placeholder identities `clerk_<id>` and `<...>@placeholder.local` (lines 179-185). |
| `packages/server/services/fishing.service.ts:191-218` | Its own `buildPlaceholderIdentity` and `getUserByClerkId` helper. |
| `packages/server/services/feed.service.ts:106-124` | Its own `getUserId(clerkId)` helper. |
| `packages/server/services/gear.service.ts:30-46` | Its own `getUserByClerkId` helper. |
| `packages/server/services/uploads.service.ts:93-113, 163-170, 231-290` | Builds every storage key as `users/${clerkUserId}/...` and validates the prefix against the authenticated id on `getDirectUploadData` and `proxyUpload`. |
| `packages/server/prisma/schema.prisma:39` | `clerkId String @unique` on `User`. Every service reaches the app user through it. |
| `packages/server/prisma/seed.ts:9,20` | Seed users carry `clerkId: 'seed_angler_one'` and `'seed_angler_two'`. |

Two findings worth pulling out of that table.

**Every authenticated request makes a network call to Clerk.** `requireApiAuth` calls `syncAuthenticatedUser`, which calls `getPrimaryEmail`, which calls `clerkClient.users.getUser(clerkUserId)`. That is a round trip to Clerk's Backend API plus a `prisma.user.upsert` on every single authenticated API call, before the handler does any work. Then most handlers do a second lookup, because `fishing.service.ts`, `feed.service.ts` and `gear.service.ts` each re-resolve `clerkId` to `user.id`. Leaving Clerk removes that round trip entirely, which is a latency argument independent of cost or ownership.

**The Clerk user id is baked into Cloudflare R2 object keys.** `buildStorageKey` writes `users/${clerkUserId}/avatar/...` and `users/${clerkUserId}/catches/temp/...`, and `getDirectUploadData` and `proxyUpload` both throw `'Storage key does not match authenticated user and scope.'` when the key does not start with the authenticated id. If the authenticated identifier changes, every existing object's prefix stops matching. This is the one part of the migration that is not obvious from the schema.

### Client

| File | What Clerk does there |
|---|---|
| `packages/client/src/main.tsx` | Reads `VITE_CLERK_PUBLISHABLE_KEY`, throws if missing, wraps the whole tree in `ThemedClerk`. |
| `packages/client/src/components/shell/ThemedClerk.tsx` | `ClerkProvider` with a full `appearance` object mapping the redesign tokens (teal `#34adbd`, night/day backgrounds, `borderRadius: '0px'`, Jost and League Gothic) onto Clerk's modals. |
| `packages/client/src/components/shell/AppHeader.tsx` | `Show when="signed-in"` gates the four destination links, `SignInButton mode="modal"`, `SignUpButton mode="modal"`, and `UserButton` for the avatar and account menu. |
| `packages/client/src/components/shell/BottomBar.tsx` | `Show` for the signed-in five slot bar versus the signed-out two slot bar, and `SignInButton`. |
| `packages/client/src/components/shell/RequireSignIn.tsx` | `Show` plus `SignInButton`. Used by 7 pages: ProfilePage, MySitesPage, MyCatchesPage, EditGearPage, HomeNowPage, EditCatchPage, EditSitePage. |
| `packages/client/src/pages/HomePage.tsx` | `Show`. |
| `packages/client/src/pages/fishing/FeedPage.tsx` | `Show`, `useAuth().isSignedIn`, `useUser().user`. |
| `packages/client/src/pages/fishing/CatchDetailPage.tsx:93`, `SiteDetailPage.tsx:164,210`, `EditGearPage.tsx:43` | `useAuth().isSignedIn`. |
| `packages/client/src/components/feed/CommentThread.tsx`, `FeedPostBlock.tsx` | `SignInButton`. |
| `packages/client/src/components/landing/LandingHero.tsx`, `LandingJoin.tsx` | `SignUpButton`. |
| `packages/client/src/components/profile/ProfileSettingsPanel.tsx:101,317` | `useClerk().openUserProfile()` behind the `Manage your account` control. |
| `packages/client/package.json` | `@clerk/react ^6.0.1` and `@clerk/nextjs ^7.0.1`. Nothing in `src` imports `@clerk/nextjs`, so that dependency is dead weight. |

### The thing that makes this migration easy

`grep -rn "Authorization" packages/client/src` returns nothing, and every axios call is a relative path (`/api/catches/me`, `/api/users/me`, `/api/uploads/sign`). `packages/client/vite.config.ts` proxies `/api` to `http://localhost:3000`. So the app is **already cookie authenticated, same origin, through the dev proxy**. The browser only ever sees `localhost:5173`. Any cookie the API sets through that proxy is a first party cookie on the client origin. The classic self-hosted auth headache, cross site cookies between `:5173` and `:3000`, does not exist in this repo as long as the auth routes are mounted under `/api` and the client keeps using relative URLs.

### Other facts

- Installed `@clerk/express` is `2.0.1`; the client is on `@clerk/react ^6.0.1`.
- Server env keys actually present in `packages/server/.env`: `OPENAI_API_KEY`, `DATABASE_URL`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLOUDFLARE_*`, `GOOGLE_WEATHER_API_KEY`, `GOOGLE_WEATHER_API_REFERER`. There is no `CLERK_WEBHOOK_SIGNING_SECRET` in it, so the webhook route cannot be verifying anything today.
- The database is `fishing_app` on `127.0.0.1:3306`. There is no `mysql` client on this machine, so I could not count how many real user rows exist. That number decides which of the two migration orders below applies.
- There is no `prisma/migrations` directory. The workflow is `prisma db push` (`package.json` `dev` and `start` scripts both run it), so adding tables is a push, not a migration.
- `docs/redesign/00-prompt.md:59` currently instructs "Pass the tokens into Clerk's `appearance` prop", and line 12 bans vendor words in the interface. Owning the auth screens makes that instruction moot and makes the sign-in surfaces properly ours.

---

## Options considered

### better-auth 1.7.5

The published package metadata is the strongest single piece of evidence for this repo. Its `peerDependencies` name `"prisma": "^5.0.0 || ^6.0.0 || ^7.0.0"`, `"@prisma/client": "^5.0.0 || ^6.0.0 || ^7.0.0"`, `"react": "^18.0.0 || ^19.0.0"` and `"mysql2": "^3.0.0"`. That is Prisma 7, React 19 and mysql2, which is exactly this stack. Evidence: https://registry.npmjs.org/better-auth/latest

The Prisma adapter's shipped type definition confirms MySQL is a first class provider, which the documentation page does not (it only demonstrates PostgreSQL, so I checked the type):

```typescript
interface PrismaConfig {
  provider: "sqlite" | "cockroachdb" | "mysql" | "postgresql" | "sqlserver" | "mongodb";
  ...
}
```

Evidence: https://cdn.jsdelivr.net/npm/@better-auth/prisma-adapter@1.7.5/dist/index.d.mts and https://www.better-auth.com/docs/adapters/prisma (the docs page states "This guide uses Prisma 7 and PostgreSQL").

Express integration is documented, and the docs carry the two warnings that matter here. Mount path for Express 5 is `"/api/auth/*splat"` rather than `"/api/auth/*"`, and: "Mount the Better Auth handler before body-parsing middleware such as `express.json()`. Body parsers consume the incoming request stream before passing control to the next handler." Server side session reads use `getSession` with `fromNodeHeaders(req.headers)`. CommonJS is not supported, which is fine because both packages are already `"type": "module"`. Evidence: https://www.better-auth.com/docs/integrations/express

Email and password: `emailAndPassword: { enabled: true }`, `requireEmailVerification: true` means "users must verify their email before they can log in", passwords are "at least 8 characters long and max 128 by default", and the default hash is scrypt: "Better Auth uses `scrypt` to hash passwords." Client methods are `signUp.email`, `signIn.email`, `requestPasswordReset` and `resetPassword`, with `sendResetPassword` and `sendVerificationEmail` taking `{ user, url, token }`. Evidence: https://www.better-auth.com/docs/authentication/email-password

Security: sameSite is "lax" by default, cookies are httpOnly, "Each request's `Origin` header is verified", there is Fetch Metadata protection using `Sec-Fetch-Site`, and `trustedOrigins` supports wildcards and custom schemes. Evidence: https://www.better-auth.com/docs/reference/security

Sessions: 7 days by default with a 1 day `updateAge`, stored in a database table with `id`, `token`, `userId`, `expiresAt`, `ipAddress`, `userAgent`, plus `revokeSession`, `revokeOtherSessions`, `revokeSessions` and `listSessions`. Evidence: https://www.better-auth.com/docs/concepts/session-management

Rate limiting: production default is a 60 second window and 100 requests, "In development mode, rate limiting is disabled by default", `customRules` take the shape `"/path": { window: 10, max: 3 }`, storage can be memory, database (needs a `rateLimit` table) or secondary storage. Evidence: https://www.better-auth.com/docs/concepts/rate-limit

Schema remapping exists, which is what lets better-auth adopt the existing `users` table instead of creating a rival one: `user.modelName`, `user.fields` ("Map fields to different column names"), `user.additionalFields`, the same for session, account and verification, plus `advanced.database.generateId`, `advanced.cookiePrefix`, `basePath` (default `/api/auth`) and `trustedOrigins`. Evidence: https://www.better-auth.com/docs/reference/options

There is a written Clerk migration guide. It states plainly: "This migration will invalidate all active sessions", and on hashes, "Clerk uses bcrypt to hash passwords, while Better Auth uses `scrypt` by default. To ensure migrated users can sign in with their existing passwords, you'll need to configure Better Auth to use bcrypt for password verification." Evidence: https://www.better-auth.com/docs/guides/clerk-migration-guide

Adoption is 6,206,585 downloads in the week of 5 to 11 September 2026, against 268,926 for `@clerk/express` in the same week. Evidence: https://api.npmjs.org/downloads/point/last-week/better-auth and https://api.npmjs.org/downloads/point/last-week/@clerk/express

Honest negatives. The CLI generates a Prisma schema but cannot apply it: "The migrate command applies the Better Auth schema directly to your database. This is available if you're using the built-in Kysely adapter. For other adapters, you'll need to apply the schema using your ORM's migration tool" (https://www.better-auth.com/docs/concepts/cli). The Express integration has a history of NOT_FOUND reports when the handler is mounted or ordered wrongly, for example https://github.com/better-auth/better-auth/issues/2975 (closed, Express 4.21.2, no fix recorded in the thread), which is why the mount path and ordering above must be followed exactly. And Prisma's own guide warns that a Prisma 8 version "is not yet available because Better Auth's `prismaAdapter` requires Prisma Client, which Prisma ORM 8 replaces with the `@prisma/orm-postgres` runtime" (https://www.prisma.io/docs/guides/authentication/better-auth/nextjs), so this pins the repo to Prisma 7 for now.

### Lucia

Not an option. The project's own site says: "Lucia was deprecated in March 2025." It is now a learning resource and a single file reference implementation rather than a maintained package. It still pulls 261,521 downloads a week, which is inertia, not maintenance. Evidence: https://lucia-auth.com/ and https://api.npmjs.org/downloads/point/last-week/lucia

### Auth.js (`@auth/express`)

The reference page states: "`@auth/express` is currently experimental. The API _will_ change in the future." It mounts as `app.use("/auth/*", ExpressAuth({...}))` and reads sessions with `getSession(req)`, but the page gives no credentials (email plus password) provider example for Express, and Auth.js's credentials support has always been the weak part of its model. 15,273 downloads in the week of 5 to 11 September 2026, roughly 1/400th of better-auth. Evidence: https://authjs.dev/reference/express and https://api.npmjs.org/downloads/point/last-week/@auth/express

Verdict: taking on an explicitly experimental API to own our auth is the wrong trade.

### Passport with express-session

`passport` is at `0.7.0` and has sat there since late 2023 per the registry metadata; `express-session` is at `1.19.0`; a Prisma backed session store exists as `@quixo3/prisma-session-store@3.1.21` with peers `@prisma/client >=2.16.1` and `express-session >=1.17.1`. Evidence: https://registry.npmjs.org/passport/latest, https://registry.npmjs.org/express-session/latest, https://registry.npmjs.org/@quixo3/prisma-session-store/latest

This works, and it is the conservative choice, but it is a kit rather than a solution. Passport gives you strategies. It does not give you sign-up, email verification tokens, password reset tokens, token expiry, rate limiting, account linking, session revocation or a typed client. All of that is code we write and then own forever. For one developer shipping a consumer app, that is the expensive path.

### Rolling our own with argon2id and database sessions

Entirely feasible and about 400 to 600 lines. OWASP's current guidance ranks Argon2id first, then scrypt, then bcrypt for legacy only, with Argon2id at "m=19456 (19 MiB), t=2, p=1" minimum. Evidence: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

Package options are `@node-rs/argon2@2.2.1` (Rust binding, prebuilt binaries for darwin-arm64 and linux-x64-gnu among others, so no compiler needed) or `argon2@0.45.1` (requires `node-gyp-build` native compilation). Evidence: https://registry.npmjs.org/@node-rs/argon2/latest and https://registry.npmjs.org/argon2/latest

Verdict: the hashing is the easy part and is not where hand rolled auth goes wrong. The failures are in token entropy and expiry, timing safe comparison, reset token single use, enumeration through differing error messages and response times, session fixation on privilege change, and the ten small correctness details around email change. better-auth has all of those already written and under 6 million weekly downloads of scrutiny. Writing them ourselves buys nothing except the ability to say we did.

---

## Recommendation

**better-auth 1.7.5, Prisma adapter, provider `"mysql"`, mounted at `/api/auth` inside the existing Express app, cookie sessions, email and password with Resend, and better-auth's `user` model mapped onto the existing `users` table.**

One line of reasoning: it is the only maintained option whose own published peer dependencies name Prisma 7 and React 19, and mapping it onto the existing `users` table deletes both the `clerkId` indirection in four services and the per request Clerk API call in `requireApiAuth`, so the migration makes the codebase smaller rather than larger.

Two decisions inside that recommendation, each with its reason:

**Map onto `users`, do not create a second user table.** The alternative (better-auth owns its own `user` table, and `User.clerkId` becomes `User.authUserId`) is about a day less work and touches almost no service code. Reject it anyway: it keeps two rows per person, two emails that can drift, and keeps the double lookup on every request. The whole point of this exercise is to own the identity, and owning it in two tables is not owning it.

**Skip the username plugin.** The plugin adds its own `username` and `displayUsername` fields with lowercase normalisation (https://www.better-auth.com/docs/plugins/username), but this repo already has `User.username @unique`, a zod rule in `schemas/user.schema.ts` allowing `[a-zA-Z0-9_]` 3 to 40 characters, and a working collision resolver in `findAvailableUsername`. Sign in by email, keep username as a profile field the existing `PATCH /api/users/me` owns.

---

## How it works in this repo

### Schema

`packages/server/prisma/schema.prisma`. Generate the starting point with `npx auth@latest generate`, which for Prisma writes into `prisma/schema.prisma` (https://www.better-auth.com/docs/concepts/cli), then hand edit it to fit. Apply with `bun run prisma:db:push`, consistent with the repo's existing push workflow.

`User` gains:

- `emailVerified Boolean @default(false)` (required by better-auth's core user model)
- `sessions Session[]`, `accounts Account[]`
- `legacyClerkId String? @unique` (renamed from `clerkId`, kept only if there are real users to import; dropped entirely otherwise)
- `storagePrefixId String @unique` (see the R2 note below)
- `username String?` becomes nullable, because a new sign-up has no username until the angler picks one

`User` mapping in the better-auth config rather than in the schema, so the existing column names survive:

```ts
user: {
  modelName: "User",
  fields: { name: "displayName", image: "avatarUrl" },
  additionalFields: {
    username: { type: "string", required: false, input: false },
    bio:      { type: "string", required: false, input: false },
  },
}
```

Three new models, with the fields better-auth documents at https://www.better-auth.com/docs/concepts/database:

- `Session`: `id`, `expiresAt`, `token`, `createdAt`, `updatedAt`, `userId`, `ipAddress?`, `userAgent?`
- `Account`: `id`, `userId`, `accountId`, `providerId`, `accessToken?`, `refreshToken?`, `idToken?`, `accessTokenExpiresAt?`, `refreshTokenExpiresAt?`, `scope?`, `password?`, `createdAt`, `updatedAt`
- `Verification`: `id`, `identifier`, `value`, `expiresAt`, `createdAt?`, `updatedAt?`

Add `RateLimit` only if rate limit storage is set to `database`. For a single instance, memory is fine, with the caveat that it resets on every deploy.

Note on ids: existing `User.id` values are cuids and better-auth's default id generation is "random base62". Both are strings, so mixed formats coexist without trouble. Do not force `generateId` unless the owner wants visual consistency.

### The R2 storage key problem, and its fix

`services/uploads.service.ts` builds keys as `users/${clerkUserId}/...` and rejects any key not starting with the authenticated id. Once the authenticated id becomes `User.id`, every pre-existing object fails that check.

Fix: add `User.storagePrefixId`, set it to the old `clerkId` for imported users and to `User.id` for new ones, and change the four call sites in `uploads.controller.ts` to pass that value instead of the auth id. The parameter in `uploads.service.ts` renames from `clerkUserId` to `storagePrefixId` and nothing else in that file changes. Old objects keep resolving, new ones get clean keys, and no R2 data has to move.

### Server

New `packages/server/lib/auth.ts`:

```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { sendVerificationEmail, sendResetPassword } from "./mailer";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "mysql" }),
  baseURL: process.env.BETTER_AUTH_URL,        // the browser visible origin
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.APP_ORIGIN!],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword,
  },
  emailVerification: { sendVerificationEmail, autoSignInAfterVerification: true },
  user: { /* mapping above */ },
  rateLimit: {
    enabled: true,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: 5 },
      "/forget-password": { window: 3600, max: 5 },
    },
  },
});
```

`baseURL` must be the origin the browser sees, which is `http://localhost:5173` in development because of the Vite proxy, not `:3000`. Getting this wrong is what produces `redirect_uri_mismatch` on Google sign in (https://www.better-auth.com/docs/authentication/google).

New `packages/server/lib/mailer.ts`: a `Resend` client (`resend@6.28.1`) exporting `sendVerificationEmail` and `sendResetPassword`, both receiving `{ user, url, token }`. House rule applies to the email copy: no em dashes.

`packages/server/index.ts`, exact ordering, because better-auth's handler needs the raw request stream:

```ts
app.all("/api/auth/*splat", toNodeHandler(auth));   // 1. before any body parser
app.use("/api/uploads/proxy", express.raw({ ... })); // 2. unchanged
app.use(express.json());                             // 3. unchanged
// clerkMiddleware() deleted
// the /api/webhooks/clerk mount deleted
```

Add a small origin check middleware in front of the router for the app's own mutating endpoints. better-auth validates `Origin` on its own routes, but `/api/catches`, `/api/feed` and the rest become cookie authenticated and are not covered by it. In practice every mutating call from the client is `application/json`, which is a non simple request and therefore preflighted, but an explicit allowlist against `APP_ORIGIN` is four lines and removes the argument.

`packages/server/routes.ts`, the whole of `requireApiAuth` becomes:

```ts
const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
if (!session) return res.status(401).json({ code: 'unauthorized', message: 'Authentication required.' });
req.userId = session.user.id;
req.storagePrefixId = session.user.storagePrefixId;
next();
```

No Clerk API call, no upsert, no swallowed error. The route table itself does not change at all: 28 routes keep `requireApiAuth`, the 6 public ones stay public.

The new endpoints are all provided by the mounted handler under `/api/auth/*`: `sign-up/email`, `sign-in/email`, `sign-out`, `get-session`, `verify-email`, `forget-password`, `reset-password`, `change-password`, `change-email`, `list-sessions`, `revoke-session`, and `callback/google` if Google is enabled.

Services: `services/user.service.ts` loses roughly 250 lines (`syncAuthenticatedUser`, `getPrimaryEmail`, `getFallbackProfileFromClerk`, `persistFallbackProfileToClerk`, `syncAvatarToClerk`, `syncAvatarToClerkWithRetry`, `buildPlaceholderEmail`, `buildDefaultUsername`, the whole `clerk_fallback` branch and the `storage: 'database' | 'clerk_fallback'` union in the response). `fishing.service.ts`, `feed.service.ts` and `gear.service.ts` each lose their `getUserByClerkId` / `getUserId` helper and take `userId` directly, which removes one query per request from each.

One decision the owner should confirm: the `clerk_fallback` path exists so the profile screen still works when MySQL is unreachable. Self-hosted auth cannot offer that, because the session lives in MySQL. I would delete it. It is a fallback that returns a profile with zero followers and no gallery, which is arguably worse than an honest error.

### Client

New `packages/client/src/lib/auth-client.ts`:

```ts
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient();   // same origin, no baseURL needed
```

The docs note "If the auth server is running on the same domain as your client, you can skip this step" (https://www.better-auth.com/docs/concepts/client). Through the Vite proxy it is the same origin, so no `baseURL` and no `credentials` juggling.

Replacements, one for one:

- `<Show when="signed-in">` becomes a `useSession()` check. Worth writing a tiny `<SignedIn>` / `<SignedOut>` pair in `src/components/shell/` so the 8 call sites stay one line each.
- `<SignInButton mode="modal">` and `<SignUpButton mode="modal">` become links to `/sign-in` and `/sign-up`. Clerk's modal is a real convenience being given up; a modal route is possible later but should not be in the first pass.
- `useAuth().isSignedIn` becomes `!!useSession().data`.
- `useUser().user` in FeedPage becomes `useSession().data?.user`.
- `<UserButton />` is the largest single loss and becomes our own avatar menu plus an account section on `/profile/settings`.
- `useClerk().openUserProfile()` in `ProfileSettingsPanel.tsx:317` becomes navigation to that account section.
- `ThemedClerk.tsx` is deleted, and with it the `appearance` mapping. The tokens now style our own forms directly, which is what `docs/redesign/00-prompt.md:12` wanted anyway.

Five new screens in the redesign's language, all of them plain 720px column pages with the existing `Button` and field styles: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`. Plus the account panel (change email, change password, sign out everywhere, delete account). This is the real cost of the migration and it is design work, not plumbing.

---

## Migration or build order

### If there are real users on Clerk

The long lead item is DNS, so it goes first, not last.

1. **Start the Resend domain verification now.** Resend requires a verified domain: "You must add and verify at least one domain to send emails with Resend", with an `MX` record on `send`, a TXT SPF record on `send`, and a TXT DKIM record on `resend._domainkey`, and "It may take up to 72 hours to complete the verification process (often much faster)" (https://resend.com/docs/dashboard/domains/cloudflare). Nothing else in the migration can be tested end to end until this is green.
2. **Export the users from Clerk.** The dashboard export produces "a CSV file containing a list of their application's users that _includes their hashed passwords_" and "The export is restricted to admins (or users in their personal workspace)" (https://clerk.com/docs/guides/development/migrating/overview, https://clerk.com/changelog/2024-10-23-export-users). Take the export late, immediately before cutover, because it is a snapshot and anyone who signs up after it is taken will be missing.
3. **Schema first, on a branch.** Rename `clerkId` to `legacyClerkId`, add `storagePrefixId` and backfill it from `legacyClerkId`, make `username` nullable, add `Session`, `Account`, `Verification`. `bun run prisma:db:push`.
4. **Server swap.** `lib/auth.ts`, `lib/mailer.ts`, `index.ts` mounting order, `requireApiAuth`, then the five controllers, then the four services. Delete `webhook.controller.ts`. Verify with the Bruno collections if they cover auth, otherwise by hand.
5. **Import script, run once against staging first.** For each CSV row: upsert the `User` by email, write an `Account` with `providerId: "credential"` and `password` set to Clerk's bcrypt digest, set `emailVerified` from the Clerk record, keep `legacyClerkId` and `storagePrefixId`. Then configure better-auth's `password.verify` to accept bcrypt, per its own guide: "Clerk uses bcrypt to hash passwords, while Better Auth uses `scrypt` by default. To ensure migrated users can sign in with their existing passwords, you'll need to configure Better Auth to use bcrypt for password verification." `bcryptjs@3.0.3` is the pure JavaScript option with no native build. Migrate anyone who signed up through Google or a magic link as a passwordless account, so they land on "reset your password" rather than a wrong password error.
6. **Client swap.** Auth client, the `SignedIn`/`SignedOut` pair, then the 14 files that import `@clerk/react`, then the five new screens, then the account panel.
7. **Cutover.** Announce it, because "This migration will invalidate all active sessions" (same source as step 5). Every angler signs in once more. Deploy server and client together; they cannot be split, because the cookie and the session live on both sides.
8. **After a clean week:** remove `@clerk/express`, `@clerk/react` and the already unused `@clerk/nextjs`, delete `CLERK_*` from `.env` and `.env.example`, update `packages/server/README.md` lines 278 and 293 to 303, and revoke the Clerk secret key.

Plan to keep `legacyClerkId` for at least one release. It is the only way back to a Clerk record if the import turns out to have dropped someone.

### If the database can be reset because it is all test data

Much shorter, and this is what the seed data suggests (`clerkId: 'seed_angler_one'`), though I could not count the real rows because there is no `mysql` client on this machine.

1. Start the Resend domain verification. Still first, still the long pole.
2. Edit the schema: delete `clerkId` outright, no `legacyClerkId`, add `storagePrefixId` (default it to `User.id` for new rows), make `username` nullable, add the three new models. `bun run prisma:db:push --force-reset`.
3. Update `prisma/seed.ts` so the two seed anglers have no `clerkId`, and give them credential accounts if signing in as them is useful.
4. Server swap, then client swap, exactly as steps 4 and 6 above.
5. Optionally empty the R2 `users/` prefix, since every object under it is keyed by a Clerk id that no longer means anything. Not required, the `storagePrefixId` approach tolerates them.
6. Delete the Clerk application.

No import script, no bcrypt dependency, no cutover announcement. Roughly two days off the total.

---

## What it costs and what we lose

### Money

**Clerk is currently free for this app, and would stay free for a long time.** The Hobby plan is $0 with a "50,000 MRU (monthly retained user) limit per app", Pro is "$25/mo ($20/mo billed annually)" and overage beyond the included users is "Additional $0.02/mo each" (https://clerk.com/pricing). A South African fishing log is not reaching 50,000 monthly retained users soon. So this migration saves nothing today and saves $25 a month plus overage at some future point.

Self-hosting is also effectively free at this size: Resend's free plan is "$0/mo", "3,000" emails a month, "100 emails per day", "3 domains", with Pro at "$20/mo" for "50,000" (https://resend.com/pricing). Verification and reset emails for a small app fit inside 100 a day comfortably, but that daily cap is the one to watch on a launch day.

The honest framing: **this is not a cost saving, it is an ownership and latency decision.** The real price is the 4 to 6 days of work.

### What we actually lose

- **The hosted sign-in and sign-up UI**, including its error states, its resend-code flows and its accessibility work. We rebuild five screens.
- **`UserButton`'s account panel**: change email with re-verification, change password, connected accounts, active sessions and devices, profile image upload. better-auth has APIs for all of it (`changeEmail`, `changePassword`, `listSessions`, `revokeOtherSessions`, `deleteUser`, per https://www.better-auth.com/docs/concepts/users-accounts) but zero UI. This is the largest hidden chunk of the estimate.
- **Bot and abuse protection on sign-up.** Clerk runs its own detection on its endpoints. We would be exposed to sign-up spam with only rate limiting in front of it, and that matters because every sign-up sends an email against a 100 per day cap.
- **Managed email deliverability.** Clerk sends verification and reset mail on its own infrastructure and reputation. We take on DKIM, SPF, DMARC, and the support load when a reset email lands in spam. This is the most underestimated cost of self-hosted auth.
- **MFA and production passkeys.** Worth noting these are excluded on Clerk's free plan anyway ("no multi-factor authentication (MFA)", "no production passkeys", https://clerk.com/articles/clerk-pricing-explained), so at this app's current plan we lose less than it first appears. Passkeys via better-auth would be a later plugin.
- **The user admin dashboard.** Looking up an angler, resetting their password, impersonating them to reproduce a bug. We would be doing that with SQL until someone builds a screen.
- **A vendor whose full time job is auth security**, watching for credential stuffing and breach lists, and patching without us noticing.

### What we gain

- **A network round trip removed from every authenticated request.** `requireApiAuth` currently calls Clerk's Backend API through `syncAuthenticatedUser` on every single call.
- **One user table and one id.** The `clerkId` indirection and its four duplicated resolver helpers disappear, along with the placeholder identity code and the `clerk_fallback` mode.
- **Sign-in screens that are ours**, styled by the same tokens as the rest of the redesign rather than through a vendor's `appearance` shim.
- **No vendor account that can change its pricing, its free tier, or its API.**

---

## Open questions for the owner

1. **Are there real users, or is this all test data?** There is no `mysql` client on this machine, so I could not run the count. The answer picks between the two migration orders and is worth about two days. Run `select count(*) from users where clerkId not like 'seed_%';` against `fishing_app` before anything else.
2. **Google sign in at launch, or email and password only?** It is roughly half a day extra (`socialProviders.google`, a client ID and secret, and `http://localhost:5173/api/auth/callback/google` plus the production equivalent registered as redirect URIs). For a consumer app in this market I would include it, but it changes the import story for anyone who used Google through Clerk.
3. **Which domain sends the mail, and is its DNS somewhere you can edit today?** This is the 72 hour item. If the sending domain is not decided, the migration cannot be scheduled.
4. **Same origin in production?** The recommendation assumes the SPA and the API sit behind one origin with `/api` proxied, matching the dev setup. If production splits them across domains, better-auth's own advice is a reverse proxy or a shared parent domain, because Safari's tracking prevention blocks the third party cookie (https://www.better-auth.com/docs/concepts/cookies). Worth settling before the first deploy rather than after.
5. **Delete the `clerk_fallback` database-outage path?** I recommend deleting it. It cannot work once sessions live in MySQL, and what it returns today (a profile with no followers and no gallery) is arguably worse than an error.
6. **Is the 7 day default session right for a fishing log?** Anglers use this a few times a month. I would push it to 30 days with a 7 day refresh, so people are not signed out between trips.
7. **Username at sign-up, or on first profile save?** The schema has `username` as required and unique today. Making it nullable and claiming it on an onboarding step is the smaller change and gives a better first run, but it means a brief window where a user has no handle.
8. **Do you want the Clerk export taken now regardless?** It is free, it is a snapshot, and having it on disk costs nothing even if the migration slips.
