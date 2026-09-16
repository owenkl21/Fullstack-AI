# Handoff: the fishing log

Give this file to the agent picking the work up. It is written to stand alone. Everything it points at is in this repository.

---

## 1. What the product is

A fishing log for South African rock and surf anglers, used on a phone on the water and on a desktop at home. An angler taps **Log**, and the app stamps the minute, the position and the weather before the sheet has finished opening; the fish goes back, the record stays. Around that sit spots, gear, trips, a feed, profiles, and (next) competitions between anglers who follow each other and inside groups.

Three packages: `packages/client` (React 19, Vite 7, Tailwind v4, react-router 7), `packages/server` (Express 5, Prisma 7, MySQL, zod), and the Prisma schema at `packages/server/prisma/schema.prisma`.

**The product is not commercial and will not be.** Several free tiers depend on that.

---

## 2. Where things stand

Work is on branch **`redesign-theme`**, committed but never pushed. Nothing has been merged to `master`, and the remote's newest branch is six months old.

**Done.** The entire client has been rebuilt in a new visual language, foundation first and then every surface:

- Tokens for day and night in `src/index.css`, stamped before first paint from `index.html`, with a sun and moon toggle (never the words "light" and "dark").
- League Gothic and Jost self-hosted under `public/fonts`. Heroicons only.
- Brand pieces in `src/components/brand`: `TornEdge` (the painted edge under a photo band), `Contours` (line art traced from a noise field), `Thread` (the dashed teal line drawn by scroll), `Reveal`, `Wordmark`.
- One shell in `src/components/shell`: `AppLayout`, `AppHeader`, `BottomBar` (four words around a raised teal Log key), `RequireSignIn`, `ThemedClerk`.
- Surfaces: landing page with a live in-device demo, signed-in home, the fast log path at `/log`, the catch record, the three lists with shared rows and states, catch/spot/gear forms, the uploader, the map picker, the feed, the spot page, the profile, dialogs, toasts, a real not-found page.

**Gates pass.** `bunx tsc -b --noEmit`, `bunx eslint src` and `bun run build` are all clean from `packages/client`. `bunx tsc --noEmit` from `packages/server` is now clean too, which it had never been. Last run 16 September 2026.

**Deploy wiring is done on the repo side** (queue item 5.1, written out in [09-deploy.md](09-deploy.md)). `railway.json` exists at the root, `prisma db push` no longer runs on every container boot, and `DATABASE_URL` reaches the driver intact. The four problems a deploy audit confirmed are fixed: the OpenAI client is lazy, text columns are annotated, photos upload straight to R2, and `feed.service.ts` typechecks. What remains is the part that needs a Railway account, in section 8.

**Not done.** Everything else in section 5.

### Progress marker

Two commits on `redesign-theme`, neither pushed:

| | |
|---|---|
| `17b3fd1` | The client rebuild and this documentation |
| `c8b2c89` | The four deploy-audit fixes |

| Queue item | State |
|---|---|
| 5.1 Railway and deploy wiring | Repo side done. Owner actions in section 8 remain |
| 5.2 better-auth replacing Clerk | Not started. Needs a verified Resend domain first |
| 5.3 Species and Open-Meteo | Not started |
| 5.4 Seed data | Not started |
| 5.5 The social layer | Not started |
| 5.6 Leaflet, off Google | **In progress** |

5.6 was taken before 5.2 deliberately. It is self-contained and leaves the app working at every point, where a half-finished auth migration would not, since `Show` from `@clerk/react` gates most pages.

---

## 3. How to run it

```bash
bun install
cd packages/client && bun run dev -- --port 5173 --strictPort --host 127.0.0.1
```

The client proxies `/api` to `localhost:3000` in development (`vite.config.ts`), so the server is:

```bash
cd packages/server && bun run dev
```

**There is no database yet.** `DATABASE_URL` in `packages/server/.env` points at `127.0.0.1:3306/fishing_app` and nothing is listening; this Mac has no MySQL installed. The decision (section 4) is to use Railway's MySQL for both development and production. Until that connection string is in `.env`, the server cannot start and no signed-in screen can be seen in a browser.

The desktop preview tool cannot start this dev server (it ignores `cwd`, and `bun --cwd` hangs behind a helper process). Use a background shell.

---

## 4. Decisions already made

Read [08-stack-decisions.md](08-stack-decisions.md) in full before choosing anything. In short:

| Area | Decision |
|---|---|
| Hosting | Vercel (frontend) + Railway (Express and MySQL), with a Vercel rewrite of `/api/*` to Railway so cookies stay first-party and no CORS is needed |
| Weather | Open-Meteo, keyless, reading the hour that brackets `caughtAt`; `suncalc` for sun and moon; no tides |
| Auth | `better-auth@1.7.5` with the Prisma adapter, replacing Clerk entirely; all data is test data so there is no migration |
| Maps | Leaflet 1.9.4 direct (**not** `react-leaflet`, which is Hippocratic-licensed), raster tiles, OpenSeaMap overlay, no satellite layer |
| Competitions | One scoring rule: species points via FishBase `W = a × L^b`, points per kilogram |
| Seed data | ~50 Unsplash photographs committed to the repo under the plain Unsplash License |

The design language itself is not open for reinterpretation: it is in [00-prompt.md](00-prompt.md) sections 3 and 3.7, and the working reference implementation is [prototype/index.html](prototype/index.html).

---

## 5. The work queue, in order

Each item says what "done" means. The order matters: later items are blocked by earlier ones.

### 5.1 Railway database and deployment wiring
**Written out in full in [09-deploy.md](09-deploy.md). Read that rather than this paragraph.** The repo side is done: `railway.json` exists at the root, `prisma db push` no longer runs on every container boot, `DATABASE_URL` reaches the driver intact, and the four problems a deploy audit confirmed are fixed. What is left is the part that needs a Railway account.

Create the MySQL service on Railway, reference its connection string rather than pasting it, and run `bun run prisma:db:push` once from the laptop. Put the Railway API domain into [`packages/client/vercel.json`](../../packages/client/vercel.json), which still contains a **placeholder that will 404 if deployed as is**.

Two settings decide whether it works at all, both in 09-deploy.md section 5.1: the Vercel root directory must be `packages/client`, and `vercel.json` has to be tracked by git to reach Vercel. The question this paragraph used to leave open, whether to move the file up, is answered: leave it where it is and set the root directory.

Done when: the server starts, `/api/feed` answers, and a deployed frontend reaches the API through the rewrite.

### 5.2 Replace Clerk with better-auth
Follow [research/auth.md](research/auth.md), which lists all 43 files. Mount the handler **before** `express.json()`, and use `/api/auth/*splat` on Express 5. Map better-auth onto the existing `users` table. Delete `requireApiAuth`'s per-request call to Clerk. Wire Resend for verification and reset (the domain needs verifying first, so start that early).

Watch for: `uploads.controller.ts` uses `clerkId` as the R2 storage key prefix. Add `User.storagePrefixId` and set it to `User.id` for new users, or every upload path changes meaning.

Done when: sign up, sign in, sign out, verification and password reset work; no `@clerk/*` import remains in either package; the client's `Show`, `SignInButton`, `SignUpButton` and `UserButton` usages are replaced.

### 5.3 Species, and conditions from Open-Meteo
Two things, both prerequisites for everything after them.

**Species** (appendix E item A1): `speciesId` on the catch write path, a `GET /api/species` search route, seed the species table with South African common names and aliases (kob, galjoen, garrick or leervis, elf or shad, yellowtail, steenbras), and the searchable picker on the log and edit forms. The client already has `SpeciesField` scaffolding with `// TODO(api)` markers.

**Conditions**: new `packages/server/clients/open-meteo.client.ts`, the server reads conditions for `caughtAt` rather than trusting a client-supplied snapshot, fill the thirteen columns currently nulled, add sea surface temperature from the marine endpoint, and add `suncalc`. Replace the four hard-coded `Source: Includes weather data from Google` strings with `Weather data by Open-Meteo.com`.

Done when: a catch logged hours late stores the conditions at the time of the catch, the pressure delta on a spot has real numbers behind it, and no Google weather key is needed.

### 5.4 Seed data
Follow [research/seed.md](research/seed.md). Idempotent, guarded so it can never run against production.

Done when: opening the app signed in shows a believable season of catches, spots, gear, a mutual follow and a group, with photographs.

### 5.5 The social layer
In this order, because each ring is useful alone: personal bests and profile stats → the mutual-follow rivalry board → groups, competitions and standings → the dashboard that sits over all of it. Design and schema fragments are in [research/social.md](research/social.md).

Ship the per-record privacy switch **with** the group feature, not after it.

### 5.6 Maps off Google
Leaflet, per decision 4. Replaces `GoogleMapLocationPicker.tsx`, the embed iframes on the record and spot pages, and adds the all-spots map that `MySitesPage` currently stubs.

---

## 6. Rules that must not be broken

These are in [00-prompt.md](00-prompt.md) but they are the ones agents get wrong:

- **Design tokens only.** No hex literals in components, no `backdrop-filter`, no `box-shadow` outside the device frame, no `rounded-*` except `rounded-full` on avatars and round icon controls. Radius is 0.
- **Heroicons outline only**, stroke 1.5. Never an icon next to a text label in nav, on buttons with words, on headings or as bullets.
- **The black surface class is `.blk`**, not `.block`, which collides with Tailwind's display utility. Inside `.blk` and dialogs the ink, line, ground and red tokens are remapped for a dark ground.
- **Copy**: spot, catch, gear, trip, conditions. You log a catch and add a spot or gear. No em dashes, no exclamation marks in system messages, no vendor words (R2, Clerk, MIME types, enum values, database ids) in the interface.
- **Missing values are sentences** (`Not measured`, `Species not recorded`, `No position recorded`), never a dash, `N/A` or an invented zero.
- **Never invent data.** No fabricated user counts, ratings or testimonials. If the app knows GPS accuracy, forecast distance or snapshot lag, it prints them.
- **Never the word "verified"** on a catch or a competition entry.
- Mobile first: build the 375 px column first, 44 px minimum targets, 16 px inputs so iOS does not zoom.

---

## 7. Gotchas that will bite

- **No `prisma/migrations` directory.** `dev` still runs `prisma db push`; `start` no longer does, so schema changes on a deployed database are applied deliberately rather than on every boot. That is fine now and dangerous the moment competition standings are real. Introduce migrations before that point.
- **`weather.client.ts` falls back to `GOOGLE_MAPS_API_KEY`.** Removing only `GOOGLE_WEATHER_API_KEY` does not disable it, it silently starts billing the Maps key.
- **The feed has no author filter**, so seeded posts are visible to every signed-in user, and a deleted or edited catch leaves a stale post because feed rows are snapshots rather than pointers (appendix E A5).
- **Photos now upload straight to R2.** Both uploaders PUT to the presigned URL that `/api/uploads/sign` already returned, so no image bytes pass through Express. `/api/uploads/proxy` still exists on the server but nothing calls it. The cost of this is a hard dependency: the bucket needs a CORS policy allowing PUT from the site's origin, or every upload fails with an opaque browser error and nothing reaches the server logs. See [09-deploy.md](09-deploy.md) section 4.5.
- **Editing a catch currently truncates it**: the update path writes nulls over humidity, UV and water temperature, and resets `count`. Fix with the partial-update work in appendix E item A2.3.
- **The catch time drifts two hours on every save** in Africa/Johannesburg, because the editor prefills a sliced UTC string and parses it back as local.
- **`Show` from `@clerk/react` gates most pages.** When auth changes, every one of those call sites changes with it.
- Open-Meteo `past_days` is documented to 92 but was measured to fail above ~60. Route older lookups to the historical-forecast endpoint.
- **The client ships as a single chunk with no code splitting**, and the build warns about it. On a product whose first rule is mobile first, and having just chosen Leaflet over MapLibre to save 240 KB, adding a map and a charting library to one eager bundle would undo that. Route-level `React.lazy` before the maps work, and load Leaflet only on the routes that draw a map.

| Client bundle, 16 September 2026 | Raw | Gzipped |
|---|---|---|
| JavaScript | 661.14 kB | 197.80 kB |
| CSS | 61.96 kB | 12.44 kB |

---

## 8. What needs the owner, not an agent

1. The **Railway MySQL connection string** in `packages/server/.env`. Step by step in [09-deploy.md](09-deploy.md) section 4.
2. The **Railway API domain** in `packages/client/vercel.json`. Step by step in [09-deploy.md](09-deploy.md) section 5.2.
3. A **CORS policy on the R2 bucket**, now that photos upload straight to R2 rather than through the API. Without it every upload fails with an opaque browser error and nothing reaches the server logs. The policy is in [09-deploy.md](09-deploy.md) section 4.5.
4. A **verified sending domain in Resend**, before email verification and password reset can work.
5. A **Stadia Maps account** if the styled day and night basemaps are wanted; otherwise the keyless OpenStreetMap layer works with no account.
6. A **product name**. Everything currently says `Name`, deliberately, including the wordmark and the page titles.

---

## 9. Where everything lives

| Path | What it is |
|---|---|
| [00-prompt.md](00-prompt.md) | The design brief. Sections 3 and 3.7 are the visual language, section 6 is every surface, section 7 the copy voice |
| [FULL-PROMPT.md](FULL-PROMPT.md) | The brief plus appendices A to E in one file, for pasting into an agent |
| [01-reference-design-language.md](01-reference-design-language.md) | The measured language of cotwtheangler.com, the agreed reference |
| [02-slop-inventory.md](02-slop-inventory.md) | Every generated-design tell found in the original build, by file and line |
| [03-ux-problems.md](03-ux-problems.md) | 266 usability and accessibility faults found in the original build |
| [04-copy-strings.md](04-copy-strings.md) | Every user-facing string in the original build |
| [05-functionality-gaps.md](05-functionality-gaps.md) | The checked gap list with evidence, dependencies, sizes and an order of work. Referenced everywhere as "appendix E" |
| [06-surface-digests.json](06-surface-digests.json) | Facts-only digest of every surface: what exists, what is broken, what to keep |
| [07-earlier-design-system.md](07-earlier-design-system.md) | A superseded system draft. Its visual rules are dead; its data display rules and copy rewrites are still valid |
| [08-stack-decisions.md](08-stack-decisions.md) | The decisions above, with evidence and what was rejected |
| [research/](research/) | The five investigations: weather, maps, auth, social, seed |
| [prototype/index.html](prototype/index.html) | The working reference for the visual language and its motion |
