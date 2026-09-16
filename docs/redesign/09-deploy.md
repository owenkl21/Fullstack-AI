# Deploying: Vercel and Railway

This is work queue item 5.1 from [HANDOFF.md](HANDOFF.md), written out in full. The hosting decision itself is settled in [08-stack-decisions.md](08-stack-decisions.md) section 1 and is not reopened here.

Everything below was checked against the code on 16 September 2026, on branch `redesign-theme`. File and line references are real, so a claim can be verified rather than trusted.

---

## 1. The shape of it

The browser only ever talks to Vercel. Vercel forwards `/api/*` to Railway. Railway runs the Express server and the MySQL database, talking to each other over Railway's private network.

```
browser  ->  <project>.vercel.app          (static SPA, Vercel CDN)
                 |  /api/*  rewrite
                 v
             <service>.up.railway.app      (Express 5 on Bun)
                 |  private network
                 v
             MySQL                         (Railway)
```

Two facts make this work with no client changes at all:

- **Every API call in the client is a relative path.** There are 41 `/api/...` literals across `packages/client/src` and no `axios.create`, no `baseURL`, no `VITE_API_URL` anywhere. The built bundle contains only relative literals too, so there is no host baked in.
- **The server has no CORS middleware and does not need one.** `cors` is not a dependency. Because the browser sees `/api/...` on its own origin, the request is same-origin and never triggers a preflight. This is also what keeps auth cookies first-party, which matters for the better-auth work in queue item 5.2.

The cost of that design is the one thing that makes ordering matter: **the Railway domain has to be hardcoded in `vercel.json`.** Vercel does not expand environment variables inside rewrite destinations. So Railway gets deployed first, and its domain gets committed into the repo.

---

## 2. Before you start

Neither the `vercel` nor the `railway` CLI is installed on this machine, and neither is needed. Both platforms deploy from the GitHub repository, which is also the better answer: the deploy is reproducible from the repo rather than from whatever state a laptop happens to be in.

You will need:

1. A Railway account. Hobby is $5/month and includes $5 of usage.
2. A Vercel account. Hobby is free.
3. The branch pushed to GitHub. **`redesign-theme` is committed but has never been pushed**, and the remote's newest branch is six months old. Neither platform can see a local branch, only a pushed one.

---

## 3. What was already changed in the repo for this

Seven changes were made so that a deploy is possible at all. The first three were hard blockers; 3.4 to 3.7 are the problems the deploy audit confirmed.

### 3.1 `railway.json` at the repo root (new file)

There was no Railway configuration of any kind, and the root `package.json` has no `start` script, so Railway had nothing to run.

```json
{
   "build": {
      "builder": "NIXPACKS",
      "buildCommand": "bun install && cd packages/server && bun run prisma:generate"
   },
   "deploy": {
      "startCommand": "cd packages/server && bun run start",
      "healthcheckPath": "/api/hello"
   }
}
```

It sits at the **root**, not in `packages/server`, because that is where `bun.lock` and the `workspaces` array live, so that is where `bun install` has to run.

**This format is deprecated.** Railway CLI 5.57 warns that Config as Code (`railway.json`) is superseded by Infrastructure as Code at `.railway/railway.ts`, and that existing files keep working until **1 December 2026**. `railway config migrate` translates this file cleanly; it was run as a dry run and the output is faithful. It has deliberately not been applied yet, because a first deploy is the wrong moment to introduce an untested config format. Migrate once a deploy is known good.

`/api/hello` ([routes.ts:47](../../packages/server/routes.ts)) is the health check rather than `/` ([routes.ts:43](../../packages/server/routes.ts)) because it exercises the same `/api` prefix that Vercel proxies. Both are trivial handlers that touch no database, which is what a health check needs.

### 3.2 `prisma db push` no longer runs on every boot

`packages/server/package.json` previously had:

```
"start": "bun run prisma:db:push && bun run prisma:generate && bun run index.ts"
```

That ran a schema push against the production database on every container start, including every restart and every redeploy. `prisma db push` with no flags will drop columns to make the database match the schema, and it prompts before doing so, which a container has no way to answer. It is now:

```
"start": "bun run prisma:generate && bun run index.ts"
```

`prisma generate` stays because it is idempotent and never touches the database. `dev` is unchanged, so local behaviour is exactly as it was.

**The consequence: schema changes are now yours to apply deliberately.** From the laptop, with `DATABASE_URL` pointing at Railway, run `bun run prisma:db:push`. This is also the first-deploy step that creates the tables. HANDOFF.md section 7 already flags that real migrations are needed before competition standings exist; this change does not solve that, it just stops the database being rewritten on every restart.

### 3.3 `DATABASE_URL` is passed through whole

`packages/server/lib/prisma.ts` took the connection string apart and rebuilt it from five fields:

```ts
const adapter = new PrismaMariaDb({
   host: parsed.hostname,
   port: parsed.port ? Number(parsed.port) : 3306,
   user: decodeURIComponent(parsed.username),
   password: decodeURIComponent(parsed.password),
   database: parsed.pathname.replace(/^\//, ''),
});
```

Every query parameter was silently discarded, which is exactly where a hosted MySQL puts `sslaccept`, `connectionLimit` and `connectTimeout`. A URL that works in a client would half work here, with no error to explain why. It now passes the string straight through:

```ts
const adapter = new PrismaMariaDb(databaseUrl);
```

The adapter accepts a string and rewrites the `mysql://` scheme itself. Typechecking is clean.

### 3.4 The OpenAI client is built on first use

`services/chat.service.ts` constructed its client at module load, and the OpenAI constructor throws when `OPENAI_API_KEY` is absent. That killed the whole process at boot, so a missing key took every route down and left Railway restart-looping, rather than failing the one endpoint that needs it. It now builds on first call, the same shape as `getS3Client` in `uploads.service.ts`.

### 3.5 Text columns are annotated

The schema had no `@db.` annotations at all, so every string column was `VARCHAR(191)`, free text included. Prose fields (`User.bio`, `FishingSite.description`, `FishingSite.accessNotes`, `Catch.notes`, `Review.body`, `Comment.body`, `FeedPost.content`, `FeedComment.body`) are now `@db.Text`.

`Image.url` and `Image.storageKey` are `@db.VarChar(512)` rather than `Text`, deliberately: `storageKey` is `@unique`, and MySQL cannot put a unique index on a `TEXT` column without a prefix length.

This changes the database, so it lands with the first `prisma db push` in step 4.3. Doing it now rather than later is the cheap moment, while the data is all test data.

### 3.6 Photos go straight to R2

Both uploaders called `/api/uploads/sign` and then pushed the file through `/api/uploads/proxy`, so every byte travelled through Express for no benefit. The sign endpoint already returned `uploadUrl` and `readUrl`; the client simply ignored them and typed the response as `{ storageKey }`.

`PhotoBlock.tsx` and `r2-image-picker.tsx` now PUT directly to the presigned URL. Nothing references `/api/uploads/proxy` in the client any more, though the route still exists on the server.

**This one has a prerequisite, and uploads fail without it.** See 4.5.

### 3.7 `feed.service.ts` typechecks

`listFeed` built its scope filter with `['GLOBAL', 'NEARBY'] as const`, a readonly tuple, where Prisma's `EnumFeedScopeFilter.in` wants a mutable `FeedScope[]`. It is now `as FeedScope[]`.

With that, `bunx tsc --noEmit` in `packages/server` reports zero errors, which it never did before. `packages/client` still passes all three of its gates: `tsc -b --noEmit`, `eslint src` and `build`.

---

## 4. Railway first

### 4.0 What already exists

Done on 16 September 2026, so do not create these again.

| | |
|---|---|
| Project | `fishlogger`, id `57064410-6d06-4111-a7e9-369790c758fd`, workspace "Owen Kleinhans's Projects" |
| Environment | `production` |
| MySQL | Online, on a volume |
| server | **Deployed and Online** at `https://server-production-a002.up.railway.app` |
| Schema | Pushed. Seeded with 24 species |

Ten variables are set on `server`: the four Cloudflare R2 keys, both Clerk keys, `OPENAI_API_KEY`, both Google weather values, and `DATABASE_URL`. `CLOUDFLARE_R2_PUBLIC_BASE_URL` and `PORT` are deliberately absent, for the reasons in 4.2.

`DATABASE_URL` is set to the reference `${{MySQL.MYSQL_URL}}` rather than a copied literal, so it follows the database and hardcodes no password.

**The database is private only.** `MYSQL_URL` resolves to `mysql.railway.internal:3306` and no public TCP proxy is exposed, which is what decision 1 asked for and means no egress billing. The consequence is in 4.3.

### 4.1 Create the project and the database

New project, then **Add MySQL**. Railway provisions it and exposes `MYSQL_URL` on the database service.

Two things from the stack decisions worth repeating here, because both cost money or data if missed:

- **Use the private `MYSQL_URL`, never the public TCP proxy.** Public proxy traffic is billed as egress. The two services are in the same project and can reach each other privately.
- **Railway's database templates are unmanaged.** Backups are yours to arrange. Nothing takes them for you.

### 4.2 Add the server service

Point a new service at the GitHub repo and the branch. It will pick up `railway.json` from the root automatically.

Set these variables on the **server** service:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Reference the MySQL service's `MYSQL_URL`, do not paste a literal |
| `CLERK_PUBLISHABLE_KEY` | From `packages/server/.env` |
| `CLERK_SECRET_KEY` | From `packages/server/.env` |
| `OPENAI_API_KEY` | From `packages/server/.env` |
| `CLOUDFLARE_ACCOUNT_ID` | From `packages/server/.env` |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | From `packages/server/.env` |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | From `packages/server/.env` |
| `CLOUDFLARE_R2_BUCKET` | From `packages/server/.env` |


**Do not set `PORT`.** Railway injects it and the server already reads it ([index.ts:71](../../packages/server/index.ts), `process.env.PORT || 3000`).

**Do not set `CLOUDFLARE_R2_PUBLIC_BASE_URL`.** It is in `.env.example` as `https://media.example.com`, which is a placeholder, and pasting it verbatim breaks every image on the site. Left unset, `uploads.service.ts` presigns a short-lived read URL per fetch against a private bucket, which is free and correct for this app.

**There are no Google variables left.** The weather moved to Open-Meteo, which is keyless, and `weather.client.ts` is deleted, so the fallback that silently billed the Maps key is gone with it. Both were removed from the Railway service as well as from `.env.example`.

### 4.3 Generate the domain, then create the tables

On the server service, **Settings, Networking, Generate Domain**. You get something shaped like `<name>-production.up.railway.app`. Write it down, section 5 needs it.

Then create the schema. **This cannot be done from the laptop**, which an earlier draft of this document got wrong. `mysql.railway.internal` only resolves inside Railway's private network, so a `prisma db push` from here cannot reach it.

Run it from inside the network instead, once the server service has deployed:

```bash
railway ssh --service server "cd packages/server && bunx prisma db push --accept-data-loss"
railway ssh --service server "cd packages/server && bun run prisma/seed.ts"
```

`railway ssh` needs two things first, both one-off. A key registered with
`railway ssh keys add` (it reads the SSH agent; passing a path to the `.pub`
file fails with "Key not found"), and `ssh.railway.com` in `known_hosts`, or the
connection dies on "Host key verification failed" with no hint as to why.

Note that `--skip-generate` is not a flag Prisma 7 accepts on `db push`; passing
it silently prints the help text instead of doing anything.

The alternative, exposing a public TCP proxy on the database so the laptop can reach it, works but bills egress and puts the database on the public internet for the sake of one command. Not worth it.

This is a deliberate step because `start` no longer does it (3.2).

### 4.4 Check it

```bash
curl https://<your-railway-domain>/api/hello
```

Expect `{"message":"Hello from the API!"}`. This proves the process is up, the port binding is right and `/api` routing works, without involving the database or Vercel. Do this before touching Vercel at all.

---

### 4.5 Give the R2 bucket a CORS policy

**Do this before testing an upload, or every upload fails.** Since 3.6 the browser PUTs the file straight to R2 rather than through the API, and a cross-origin PUT from a page needs the bucket to allow it. There is no CORS policy on the bucket today.

In the Cloudflare dashboard, on the bucket, under Settings, CORS policy:

```json
[
   {
      "AllowedOrigins": [
         "https://<your-project>.vercel.app",
         "http://localhost:5173"
      ],
      "AllowedMethods": ["PUT", "GET"],
      "AllowedHeaders": ["content-type"],
      "MaxAgeSeconds": 3600
   }
]
```

`localhost:5173` is there so uploads still work in development. Add any custom domain to `AllowedOrigins` when you add one, and remember preview deployments get their own `*.vercel.app` hostnames, which this does not cover.

The failure mode is worth recognising: the upload fails in the browser with an opaque CORS error and nothing appears in the Railway logs at all, because the request never reached the server.

## 5. Then Vercel

### 5.1 The two settings that decide whether it works

**Root Directory must be `packages/client`.** This is the one that quietly ruins a deploy. `packages/client/vercel.json` is the only `vercel.json` in the repo. If Vercel builds from the repo root it never reads that file, and you lose both rewrites at once: the `/api` proxy *and* the SPA fallback that makes deep links work. The symptom is a site that loads on `/` and 404s on every other route, with no error explaining it.

**`packages/client/vercel.json` is currently untracked.** `git status` shows it as `??`. Vercel builds from the repository, so an untracked file does not exist as far as Vercel is concerned, no matter what it says on disk. It has to be committed.

### 5.2 Put the Railway domain in

In [`packages/client/vercel.json`](../../packages/client/vercel.json), replace `REPLACE-WITH-YOUR-RAILWAY-DOMAIN.up.railway.app` with the real host from step 4.3.

Keep `/api/:path*` on **both** sides. The server mounts its router bare (`app.use(router)` at [index.ts:53](../../packages/server/index.ts)) and every route carries its own `/api` prefix, so a destination with `/api` stripped would 404 everything.

Leave the `x-vercel-enable-rewrite-caching: 0` header alone. Vercel honours upstream cache headers on external rewrites for projects created after 6 April 2026, and a cached API response is a bug that is miserable to diagnose.

Because rewrite destinations do not expand environment variables, this value lives in the file. Changing the Railway domain later means editing this file and redeploying.

### 5.3 Environment variables

| Variable | Required | Notes |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | **Yes** | Without it the site is a blank white page |

That is the only one. `VITE_GOOGLE_MAPS_API_KEY` used to be listed here and is now read nowhere: the maps are Leaflet on keyless tiles, so there is no browser key to set, restrict by referrer, or leak.

`VITE_*` variables are **inlined into the bundle at build time**, not read at runtime. Two consequences:

- Missing `VITE_CLERK_PUBLISHABLE_KEY` gives a **successful green build and a white screen**, because `main.tsx` throws above `createRoot(...).render(...)`. The Vercel dashboard will show the deploy as fine.
- Adding or changing one of these after a deploy does nothing until you **rebuild**. Redeploy from the Deployments tab with the build cache disabled.

### 5.4 Check it

1. The site loads and is not blank. Blank means `VITE_CLERK_PUBLISHABLE_KEY`.
2. `curl https://<project>.vercel.app/api/hello` returns the same JSON as step 4.4. That proves the rewrite.
3. Load a deep link such as `/feed` directly. A 404 means Root Directory is wrong.
4. A signed-in screen returns data. That proves the database.

---

## 6. What is still outstanding

The four problems the audit confirmed have been fixed, in 3.4 to 3.7. What follows is what genuinely remains, and none of it blocks a first deploy.

**The client ships as one chunk.** 661 kB raw, 198 kB gzipped, with no code splitting, and the build says so on every run. It is not a deploy blocker, but HANDOFF.md section 7 is right that route-level `React.lazy` wants doing before the maps work, or Leaflet lands in an eager bundle and undoes the reason it was chosen over MapLibre.

**There are still no migrations.** `prisma/migrations` does not exist, and schema changes are now applied by hand (3.2). That is the correct trade for test data, and the wrong one the moment competition standings are real. HANDOFF.md section 7 already flags the crossover point.

**`/api/uploads/proxy` still exists on the server** even though no client calls it. Harmless, and worth keeping until direct uploads have been exercised against a real bucket with the policy from 4.5 in place. Delete it after that, not before.

## 7. What still needs you

From HANDOFF.md section 8, the two that gate this item:

1. The **Railway MySQL connection string**, via a service reference rather than a pasted literal.
2. The **Railway API domain**, committed into `packages/client/vercel.json`.

And one that is new here: **the branch has to be pushed.** `redesign-theme` is local and uncommitted, and 116 files are modified. Neither platform can deploy a working tree.
