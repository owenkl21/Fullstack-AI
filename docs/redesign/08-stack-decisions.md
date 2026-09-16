# Stack decisions

Decided 16 September 2026 by the owner, on the evidence in [research/](research/). Each entry says what was chosen, what was rejected and why, so the next agent does not reopen a settled question.

The single fact that unlocks several of these: **this product is not commercial and will not be.** No subscription, no advertising. That makes several free tiers legitimately available that would otherwise be off limits.

---

## 1. Hosting: Vercel for the frontend, Railway for the backend and database

The client deploys to Vercel as static output. The Express server and a MySQL database run on Railway in one project, talking over Railway's private networking (`MYSQL_URL`).

The browser never sees the Railway domain. A Vercel rewrite forwards `/api/*` to Railway, which means:

- **No client changes.** All 18 API call sites already use relative paths (`/api/catches`, `/api/sites/${id}`) with no `baseURL` anywhere.
- **No CORS.** The server has no CORS middleware and `cors` is not a dependency. It does not need to become one.
- **First-party cookies**, which is what makes the self-hosted session auth in decision 3 work without `SameSite=None` and without running into Safari's third-party cookie blocking.

The config lives at [`packages/client/vercel.json`](../../packages/client/vercel.json). It carries `x-vercel-enable-rewrite-caching: 0`, because for projects created on or after 6 April 2026 Vercel honours upstream `cache-control` on external rewrites by default, and an API response cached on a CDN is a bug waiting to happen.

**Rejected: everything on Vercel.** Vercel's marketplace has one MySQL option, TiDB Cloud, which is MySQL-*compatible* rather than MySQL: auto-increment ids are not sequential, stored procedures and triggers are unsupported, and its documentation does not confirm foreign key constraints, which all 16 models rely on. The Postgres route (Neon) was real and cheap, since the schema has no MySQL-specific native types and no raw SQL anywhere, but it also forced the 4.5 MB serverless body cap and cold starts for no gain.

**Rejected: everything on Railway.** Workable, but gives up Vercel's CDN for the SPA.

**Cost:** Railway Hobby, $5/month including $5 of usage. Vercel Hobby is free. Use the private `MYSQL_URL` between services, never the public TCP proxy, or egress is billed.

**Caveat to act on:** Railway's database templates are *unmanaged*. Backups are yours to arrange.

---

## 2. Weather and almanac: Open-Meteo, keyless

Replaces the Google Weather API entirely. See [research/weather.md](research/weather.md).

| Need | Endpoint |
|---|---|
| Conditions now, and up to about 60 days back | `https://api.open-meteo.com/v1/forecast` with `past_days` |
| Older than that | `https://historical-forecast-api.open-meteo.com/v1/forecast` |
| Sea surface temperature, wave and swell height | `https://marine-api.open-meteo.com/v1/marine` |
| Sunrise, sunset, moon phase and illumination | `suncalc@2.0.2`, BSD-2-Clause, computed locally, no API |

The important change is not the price, it is **reading the hour that brackets `caughtAt`** instead of "now". A fish logged from the car park at 21:00 currently stores 21:00's weather; it should store the conditions at 18:40 when it was caught. That single change also makes the pressure-since-your-last-trip line possible and fills the thirteen columns that `mapWeatherSnapshotToCatchData` hard-codes to `null` in its success branch.

**Licence:** the free tier is non-commercial only, in Open-Meteo's words. This product qualifies. Data is CC BY 4.0, so the attribution line is replaced rather than deleted: **"Weather data by Open-Meteo.com"**.

**Rejected:** the ERA5 archive endpoint (`archive-api`), which returns `null` for visibility, UV index and precipitation probability, sits on a 25 km grid and lags five days. WeatherAPI.com, which permits commercial use but gives only one day of history on its free plan.

**Measured, not assumed:** `past_days` is documented as accepting up to 92 but returned leading nulls at 92 in live testing, while 7, 31 and 60 were fully populated. Route on 60.

---

## 3. Auth: better-auth, replacing Clerk

See [research/auth.md](research/auth.md). All data is test data, so this is a clean break with no user migration.

`better-auth@1.7.5` with its Prisma adapter against the existing MySQL, mounted at `/api/auth` inside the same Express app, httpOnly cookie sessions, email and password, with Resend for verification and password reset. It is the only maintained option whose published peer dependencies name both Prisma 7 and React 19.

better-auth maps onto the **existing `users` table** rather than creating a second one, which also deletes the per-request network call to Clerk that every authenticated request currently makes.

**Rejected:** Lucia (no longer a library), Passport with express-session (sat at 0.7.0 since late 2023), Auth.js (poor fit for Express plus a separate SPA), and rolling our own (no reason to hand-write password reset and verification).

**Two sharp edges, both from better-auth's own docs:** the handler must mount **before** `express.json()`, and on Express 5 the path is `/api/auth/*splat`, not `/api/auth/*`.

---

## 4. Maps: Leaflet, not MapLibre

**The owner chose Leaflet over the research recommendation.** [research/maps.md](research/maps.md) argued for MapLibre GL, and its reasoning is worth knowing before anyone reopens this: MapLibre has native `cooperativeGestures` (the brief asks for it by name), and vector styles let the map wear the product's own tokens.

Leaflet wins on the thing the brief opens with. **Leaflet 1.9.4 is 42,736 bytes gzipped against MapLibre's 283,322**, on a product whose first rule is mobile first. Raster basemaps are styled by choosing a styled tile set, which covers day and night perfectly well.

Rules for the implementation:

- **Leaflet 1.9.4 direct, via refs. Do not install `react-leaflet`.** Version 5.0.0 is licensed `Hippocratic-2.1`, which is not an OSI licence and is not a question worth having in this codebase. Leaflet itself is BSD-2-Clause.
- **Tiles:** Stadia Maps' free tier (Alidade Smooth and Alidade Smooth Dark) is the styled day and night pair, and its free tier is for non-commercial use, which this is. It needs a free account and a registered domain. Keyless fallback is the OpenStreetMap standard layer, which is best-effort with no SLA and cannot be restyled. CARTO now requires an API key, watermarks requests without one, and forbids the caching you would want.
- **`gestureHandling: cooperative` in the brief is a Google option name.** In Leaflet the equivalent is `scrollWheelZoom: false` plus two-finger drag, or the `leaflet-gesture-handling` plugin. Keep the behaviour, not the option name.
- **Add the OpenSeaMap seamark overlay** (`https://t2.openseamap.org/seamark/{z}/{x}/{y}.png`), transparent and free. Beacons, buoys and port detail are exactly what a rock and surf angler reads.
- **No satellite layer.** Nothing free is licensed at a resolution that shows coastal structure: Esri World Imagery is under the Esri Master License Agreement, EOX Sentinel-2 cloudless is CC BY-NC-SA. "Open in Maps" stays as the one-tap escape to imagery.
- **OSM attribution is a licence condition**, visible and not hidden behind a toggle.
- Leaflet takes `[lat, lng]`, the same order as Google, so the coordinate-flip bug that the maps report warned about does not apply here.

---

## 5. Competitions: one scoring rule

See [research/social.md](research/social.md). Species points, where length converts to mass using published FishBase parameters (`W = a × L^b`) and points are awarded per kilogram. That is how South African shore angling championships already score, and it is the only fair way to compare a 35 cm galjoen with a 90 cm kob when the fish is released and never weighed.

Built in four rings, each useful on its own: species with scoring parameters → personal bests and profile stats → the mutual-follow rivalry board (no new tables, it reads catches) → groups and competitions with denormalised standings.

**The whole layer is blocked until a catch can carry a species.** That is appendix E item A1 and it is the first thing to build.

**Two rules that are not details:**

1. **Never ship the word "verified".** Nothing the app can observe proves a fish was that long, on that day, caught by that angler. The first disputed catch turns the badge into a liability. Show the evidence (the photo, the capture receipt, the stamped position and accuracy) and let people judge it.
2. **A group is a new audience for a spot.** Every catch and spot currently publishes a `GLOBAL` feed post unconditionally, with exact coordinates on site posts. The per-record privacy switch has to ship with the group feature, not after it.

---

## 6. Seed data: photographs in the repo

See [research/seed.md](research/seed.md). About 50 Unsplash photographs downloaded once into the repo under the plain Unsplash License, which requires no attribution and permits redistribution. Not the Unsplash API, which would bind the project to hotlinking and attribution obligations permanently.

Eight anglers, fifteen verified Western Cape spots, ten species with real size ranges, conditions consistent with each date and place, follows in both directions so a mutual pair exists, and a group running a competition.

**Three caveats to honour:** seeded feed posts will be visible to every real signed-in user, because `listFeed` has no author filter. Dusky kob and white steenbras are both IUCN Endangered, so seed them released rather than kept. And the photographs are stand-ins: not these anglers, not these species, and mostly not this coastline.
