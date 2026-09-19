# Functionality gap analysis (final)

Checked against `packages/server/prisma/schema.prisma`, `packages/server/routes.ts`, `packages/server/schemas/*.ts`, `packages/server/services/*.ts`, the client pages under `packages/client/src/pages`, `docs/fishing-app-phase-plan.md`, the surface digests, the audit and the measured reference research.

Every item carries: the angler job in one line, evidence at `file:line`, the dependency (UI only / API / schema), a size (S, M, L) and a priority (1 to 3). Verdicts are **confirmed**, **revised** (the gap is real but the draft described it wrongly) or **removed**.

Three structural notes before the list:

1. **The draft's Tier A premise is half wrong.** It reads "data model and API already exist, the UI does not use them". For several of its items the *model* exists but the *write path* does not, so they are API work, not UI work. Species is the clearest case: the API can read a species but has no way to set one.
2. **There is a fourth class of gap the draft has no home for**, and it is the most damaging one: the angler supplies a fact, the UI collects it, and the write path throws it away. Eleven of the twenty-five weather columns are hard-coded `null` on save. Catch coordinates are captured and discarded. Editing a catch silently truncates it. That is a new group, **Tier A2**, below.
3. **The social layer is not thin, it is disconnected.** `FeedScope` is `GLOBAL | NEARBY` only (`schema.prisma:32-35`) and `listFeed` has no author filter (`feed.service.ts:150-165`). Following somebody changes nothing the angler will ever see. That single fact, not a shortage of features, is why the room is dead.

---

## Tier A. The data model and the API already support it, the UI ignores them

### A1. Species on every catch
*Verdict: **revised**. The gap is real and is the biggest one in the product, but it is not UI-only.*

- **Job:** answer "what did I catch", which is the fact that makes the log searchable and every measurement comparable to another.
- **Evidence:** `Species` model at `schema.prisma:106-115` with `aliases` and `regionTags` Json columns; `Catch.speciesId` at `:123-124`. The **read** path exists (`fishing.service.ts:85`, `:119`). The **write** path does not: `catchPayloadSchema` has no `speciesId` field (`fishing.schema.ts:54-67`), and since `updateCatchSchema = catchPayloadSchema` (`:73`) neither create nor edit can set one. There is no species endpoint anywhere in `routes.ts`. The seed contains exactly one species row (`prisma/seed.ts:44-48`). So the UI reads `CatchDetailPage.tsx:194` "Not specified" and `SiteDetailPage.tsx:141` "Unknown species" forever, and the free-text title has to carry the fish.
- **Local note:** the picker must be seeded with South African common names and aliases (kob, galjoen, garrick, elf, geelbek) rather than a US bass list. The `aliases` and `regionTags` columns exist for exactly this and are unused.
- **Dependency:** API (zod + controller + a `GET /api/species` search route) and seed data, plus UI. No schema change.
- **Size L · Priority 1**

### A2. Site reviews
*Verdict: **confirmed**, with a precondition the draft did not state.*

- **Job:** let a stranger decide whether a public spot is worth the drive.
- **Evidence:** `Review` model with `rating`, `body` and a one-per-user-per-site unique key at `schema.prisma:175-189`; `FishingSite.reviewCount` at `:76`. No route in `routes.ts`, no UI on site detail (`SiteDetailPage.tsx:8`). The phase plan promised it in Phase 2 and Slice 3 (`docs/fishing-app-phase-plan.md:24, 128`).
- **Precondition the draft missed:** every spot today is created by the angler reading the page, and rating your own spot out of five is meaningless. Reviews only pay off once spots are discoverable by people who did not create them. Build it when that is true, not before.
- **Dependency:** API + UI. No schema change.
- **Size M · Priority 3**

### A3. Decide one social object: the catch, not the feed post
*Verdict: **confirmed**, and the draft's "do not ship two" is the right call. Sharpened.*

- **Job:** let a reaction stay attached to the fish, so it survives an edit and is there when the catch is opened from a shared link.
- **Evidence:** `CatchLike` (`schema.prisma:218-227`), `Comment` on catch (`:191-203`), `Catch.likeCount/commentCount` (`:161-162`), all with no route in `routes.ts`. Meanwhile `FeedLike` and `FeedComment` have five routes (`routes.ts:115-130`). Catch detail has no like or comment affordance at all.
- **Which way to decide it, with evidence:** the feed post is a *copy*. Its `content` is snapshotted from `input.notes` at creation (`fishing.service.ts:443-451`) and never updated. So the feed post is the worse candidate for a durable social object, and choosing the catch also fixes A5 structurally rather than with patches.
- **Dependency:** API (like and comment routes on catch and spot; the feed read joins them) + UI. No schema change, both tables exist.
- **Size L · Priority 2**

### A4. Site likes
*Verdict: **removed as a like, kept as a save.***

- **Removed because:** a heart on somebody's spot does no angler job. It is the definition of a feature added because a table exists.
- **Kept because the same table does a real job:** you see a spot in the feed and you want it in your own list. `SiteLike` (`schema.prisma:229-238`) and `FishingSite.likeCount` (`:75`) are exactly the shape of a saved-spots list. Rename the job, keep the rows.
- **Job:** keep somebody else's spot where I can find it again.
- **Dependency:** API + UI.
- **Size M · Priority 3**

### A5. The feed shows deleted and stale records
*Verdict: **confirmed**, remedy revised.*

- **Job:** do not put a stranger's photos of a deleted catch on other people's screens.
- **Evidence:** feed posts are only ever created, never updated or hidden (`fishing.service.ts:443-451` for catches, `:634-644` for sites). Catch and site deletes are soft (`deletedAt` at `schema.prisma:169, 85`). The feed query filters only the post's own `deletedAt` and never checks the linked record (`feed.service.ts:155-157`). So a deleted catch keeps showing with its title and photos, an edited note leaves the old caption, and moving a spot's pin does not move it for Local filtering.
- **Revised remedy:** the draft asks for "update and hide" hooks on every mutation. The structural fix is A3's: make the feed row a pointer that reads the live catch or spot, and stop duplicating `content`. Then edit and delete are correct by construction and there is nothing to keep in sync.
- **Dependency:** API (and dropping `FeedPost.content` once nothing reads it).
- **Size M · Priority 1**

### A6. Gear detail, and the gear list leaks
*Verdict: **confirmed**, plus one finding the draft missed that is more urgent than the item itself.*

- **Job:** answer "which lure actually catches fish", which is the only reason to log tackle.
- **Evidence (detail page):** no `/gear/:gearId` route (`App.tsx:20-34` has only `/gear/:gearId/edit`), no `GET /api/gear/:gearId` (`routes.ts:132-136`), and My gear renders the name as plain text with no link. The join already exists: `Gear.catches` / `Catch.gears` many-to-many at `schema.prisma:98, 125`.
- **Evidence (the leak, new):** `listGear()` has no owner filter (`gear.service.ts:132-138`), so `GET /api/gear` returns every user's tackle, and both the Log catch and Edit catch gear pickers list strangers' gear. That is a privacy leak and a usability bug, and it is a one-line `where`.
- **Dependency:** gear detail is API + UI, size M, priority 2. The owner filter is API only, size S, **priority 1**.

### A7. Spot photos stop at one, and only the first is ever shown
*Verdict: **new**, and it is the cleanest Tier A case in the product.*

- **Job:** show what a spot actually looks like, which is most of why a spot page exists.
- **Evidence:** the API accepts twelve (`createFishingSiteSchema` at `fishing.schema.ts:87-89`) and `SiteImage` carries a `position` column for ordering (`schema.prisma:262-271`). The picker refuses the second file because `multiple` defaults to `scope === 'catch'` and Log site never passes it (`r2-image-picker.tsx:32`, `LogSitePage.tsx:175`). Even if it did, site detail renders only `images[0]` (`SiteDetailPage.tsx:84`) and so does the list. So the twelve-image API, the junction table and the position column are all dead.
- **Dependency:** UI, plus the update-path images in B4.
- **Size S · Priority 2**

### A8. A real not-found screen, and document titles
*Verdict: **confirmed**.*

- **Job:** tell the angler a link is dead instead of making it look like they were signed out.
- **Evidence:** `App.tsx:34` silently `Navigate`s every unknown URL to `/`. Four pages spin the bobber forever instead of reporting a 404 (`CatchDetailPage.tsx:59-64`, `SiteDetailPage.tsx:35`, `EditCatchPage.tsx:122-185`, `EditSitePage.tsx:126`). Nothing in `src` ever sets `document.title`, and `packages/client/index.html:5,7` still ships the Vite defaults (`<title>client</title>`, `/vite.svg`, no description, no OG tags), so every route, every bookmark and every shared link reads "client".
- **Dependency:** UI only (the OG half belongs with B8).
- **Size S · Priority 1**

---

## Tier A2. The angler supplies it, the write path throws it away

New group. These are not bugs in the ordinary sense: the product collects a fact, shows a slot for it, and drops it. The record degrades quietly, which is the one thing a log may not do.

### A2.1 A catch has no location of its own
- **Job:** record where the fish was, which on a boat or a beach walk is not where the saved spot pin is.
- **Evidence:** `Catch` has `siteId` but no latitude or longitude (`schema.prisma:117-173`). "Use current location" is the **default** option in Log catch and it saves no location at all: the device fix only feeds the weather lookup, and the catch posts with `siteId` null (`LogCatchPage.tsx:204`). Downstream, catch feed posts are created with no coordinates (`fishing.service.ts:443-451`), which is why Local + Catch feed can never return a single result.
- **Dependency:** schema (lat, lng, and an accuracy value from the GPS fix) + API + UI.
- **Size M · Priority 1**

### A2.2 Eleven of twenty-five weather columns are hard-coded null
*This also refutes part of draft item 16, which claimed the pressure "the weather API already returns" is available today.*

- **Job:** make the conditions snapshot worth having, and let it say when and from what it was taken.
- **Evidence:** `mapWeatherSnapshotToCatchData` nulls, in the **success** branch, `weatherCurrentTime`, `weatherTimeZoneId`, `weatherFeelsLikeTemperature*`, `weatherDewPoint*`, `weatherAirPressureMeanSeaLevelMillibars`, `weatherWindDirectionDegrees`, `weatherVisibility*`, `weatherIsDaytime`, `weatherRelativeHumidity`, `weatherUvIndex` and `weatherThunderstormProbability` (`fishing.service.ts:158-186`). The client's own `weatherSnapshotSchema` does not carry them either (`fishing.schema.ts:25-52`). The upstream call is Google `currentConditions:lookup` (`clients/weather.client.ts:25`), which returns all of them. Catch detail renders humidity and UV tiles (`CatchDetailPage.tsx:124, 131`) that can therefore never appear. `weatherConditionType` is set to the same string as `weatherConditionText` (`fishing.service.ts:161-162`).
- **The snapshot also has no timestamp**, which kills the provenance the whole conditions block depends on, and it is always fetched for *now*: `caughtAt` is never passed to the lookup (`LogCatchPage.tsx:163`), so a catch logged from the car park at 21:00 stores 21:00 weather, and Edit catch's "Load latest conditions" overwrites the stored history with today's (`EditCatchPage.tsx:229`).
- **Dependency:** API only for the mapping (the columns, the provider call and the UI slots all exist). Historical lookup by `caughtAt` is a second, larger step.
- **Size S for the mapping · Priority 1**

### A2.3 Editing a catch truncates it
- **Job:** an edit corrects one field, it does not quietly delete the rest of the record.
- **Evidence:** every save writes `weatherRelativeHumidity` and `weatherUvIndex` null (`EditCatchPage.tsx:184-185`), resets `count` to 1 because the form never sends it, and nulls `waterTemp` (`fishing.service.ts:554-556`). Missing conditions are filled with invented zeros that are then written and shown as real tiles (`EditCatchPage.tsx:153, 159, 168, 174, 180`). The editor cannot touch species, count, depth or photos at all (`EditCatchPage.tsx:280, 322`).
- **Same class, fix as a bug not a feature:** the catch time moves two hours earlier on every save in Africa/Johannesburg, because the field is prefilled with a sliced UTC ISO string and parsed back as local (`EditCatchPage.tsx:294, 196-198`). A log whose dates drift on every correction is not a log.
- **Dependency:** API (partial update semantics) + UI.
- **Size M · Priority 1**

---

## Tier B. Small additions that make it a real log rather than a form

### B1. The fast path
*Verdict: **confirmed**, target restated.*

- **Job:** get the fish recorded with it still in the net, and lose nothing if the angler stops there.
- **Evidence for the gap:** the form is roughly fifteen controls in an order that does not match how an angler thinks (notes before location, read-only weather between gear and size, photos last), there is no draft or autosave anywhere (`LogCatchPage.tsx:361`), and the default location option saves no location (`LogCatchPage.tsx:204`).
- **Restated target:** not "under 30 seconds" but the Garmin mechanism the research measured: **position, time and the conditions pull are stamped before the form exists**, and everything else is optional enrichment afterwards. The NJ log's five-field minimum is the shape. Species cannot be on the fast path until A1 ships.
- **Dependency:** UI, plus the API allowance in A2.1 for a catch with coordinates and no spot.
- **Size L · Priority 1**

### B2. Personal bests, as emphasis and not as a dashboard
*Verdict: **confirmed**, with a guard.*

- **Job:** the record-book job anglers already do on paper.
- **Guard:** the judged direction bans big-number stat tiles and bento grids outright. So this renders as *emphasis on the number already on the page* (the ECDIS safety-depth mechanism from the research: a value at or above the angler's own best renders at full weight, everything else recedes), never as a trophy panel. Write that constraint down or it will come back as a dashboard.
- **Dependency:** UI only if derived at read time from the angler's own catches. Needs A1 to be per-species.
- **Size M · Priority 2**

### B3. Search, filter and sort that reach the server
*Verdict: **confirmed**, one dimension dropped.*

- **Job:** find the fish I am thinking of, and answer "what works here in September".
- **Evidence:** `listMyCatches` takes no query parameters (`routes.ts:67`). My catches searches title and site name only, filters client-side over the page already loaded, and has no sort (`MyCatchesPage.tsx:94`); My sites is the same (`MySitesPage.tsx:85`); My gear has no filter by type at all (`MyGearPage.tsx:26`). Length and weight are fetched and never rendered in the row (`MyCatchesPage.tsx:16`).
- **Dropped:** filter by size. Sort by size covers the job; a size range filter is a control nobody uses. Keep month grouping, it is cheap.
- **Dependency:** API (server-side filter and paging) + UI. Species filter needs A1.
- **Size M · Priority 2**

### B4. Photos after logging, on catches and on spots
*Verdict: **confirmed**, and under-scoped by the draft.*

- **Job:** the photo is the point of the record, and today a missing or wrong one is permanent.
- **Evidence:** it is not just missing UI controls. `updateCatchSchema` is `catchPayloadSchema` with no `images` field (`fishing.schema.ts:73`), and `updateFishingSiteSchema` likewise (`:91`). So neither editor *could* send photos. Meanwhile Log catch toasts "You can add images later while we improve upload reliability" on any server 500 (`LogCatchPage.tsx:292-296`), a promise the product cannot keep, and the uploaded files stay orphaned in storage.
- **Dependency:** API (images on both update schemas and services) + UI.
- **Size M · Priority 1**

### B5. Both units on the record
*Verdict: **the problem is confirmed, the draft's remedy is removed.***

- **Job:** let the angler type in the unit they think in, and let any reader read the number correctly.
- **Evidence of the problem:** Log catch converts imperial to metric at two decimal places on save (5 lbs stored as 2.27 kg, `LogCatchPage.tsx:262, 268`), which then trips `step="0.1"` and blocks the next edit with a browser step-mismatch bubble (`EditCatchPage.tsx:447, 475`). The Edit catch unit selects do not convert what is already typed, so switching cm to ft on a 45 cm fish saves 1371.6 cm (`EditCatchPage.tsx:450-461, 202-213`). Catch detail is hard-coded metric regardless (`CatchDetailPage.tsx:252-276`). Negatives are accepted and stored (`LogCatchPage.tsx:188-189`).
- **Why the remedy changes:** the draft proposes a stored per-user unit preference applied everywhere. Two references reject that independently and for the same reason. A catch shared to the feed or opened from a link is read by somebody whose preference differs, and a signed-out reader has no preference at all. IGFA records both systems on the form rather than converting; the RIO spool label prints the native unit with the conversion in brackets at the same size on the same line. So: store one canonical unit, remember the *entry* unit per field so the angler keeps typing in theirs, and print both on the record (`2.27 kg (5 lb 0 oz)`). No preference table.
- **Dependency:** UI, plus one small API field if the raw entry is preserved (worth it: it is the IGFA raw-reading mechanism).
- **Size M · Priority 1**

### B6. One map of my spots
*Verdict: **confirmed**, scope fenced.*

- **Job:** find the spot I mean by pointing at it rather than reading a list of names.
- **Fence, because this is the item most likely to become a product of its own:** my spots only, pins linking to spot pages. Not a heatmap, not a discovery layer, not catch-level pins (catches have no coordinates until A2.1), not a dashboard.
- **Dependency:** UI only, the data is already in `GET /api/sites/me`.
- **Size M · Priority 3**

### B7. Sun, moon, pressure and tide
*Verdict: **split; one part refuted**.*

- **B7a. Finish the snapshot** so pressure and the capture time exist at all. This is A2.2. **API · S · Priority 1.** The draft's claim that pressure is "already returned" is wrong at the storage layer and the wrongness matters, because it made this look like UI work.
- **B7b. Sunrise, sunset, moon phase**, computed locally from the pin and the date. No API, no key, no cost, and dawn and dusk are when people fish. **UI only · S · Priority 2.**
- **B7c. Pressure as a delta**, not an absolute: "1013 hPa, down 6 since your last trip here". This is the aneroid set-hand mechanism from the research and it is the strongest single reason for spots to exist. It needs B7a plus C1 (blank trips) to have a prior reading. **UI + API · M · Priority 3.**
- **B7d. Tide: removed as a UI commitment.** There is no source wired and NOAA covers US stations only. South African tide data comes from the national hydrographic tables, which is a licensing and ingestion decision, not a build. Do not put a tide slot on a screen before that decision is made.

### B8. Share a catch by link, properly
*Verdict: **revised**. The job is right, the artefact is wrong for now.*

- **Job:** send a fish to the WhatsApp group, which in this market is how the product spreads.
- **Why the image card is not the first move:** `GET /api/catches/:catchId` is already public (`routes.ts:86`), so the shareable thing already exists. What is missing is everything that makes a link worth sending: no `document.title` anywhere in `src`, no meta description and no OG tags (`index.html:3-8`), no author on the page, no share or copy-link control, and no owner or visitor distinction (`CatchDetailPage.tsx:143-144`). A link pasted into WhatsApp today previews as "client".
- **Do first:** a good public catch read with a title, an OG image taken from the first photo, and a copy-link control. Note the real cost: the SPA has no SSR, so the meta tags need a small server-rendered route or a prerender step.
- **Later:** the rendered image card. **L · Priority 3.**
- **Dependency:** UI + a small server meta route.
- **Size M · Priority 2**

### B9. Undo, and the gear delete that is not soft
*Verdict: **confirmed**, and split. The second half is a data-loss path the draft treated as a UI nit.*

- **B9a. Undo on catch and spot delete.** Nearly free: both are already soft deletes (`deletedAt` at `schema.prisma:169, 85`; `fishing.service.ts:571-598`), so the row is still there. Today it is `window.confirm` with no pending state, no error handling and no undo (`MyCatchesPage.tsx:67`, `MySitesPage.tsx:68`). **API (an undelete route) + UI · S · Priority 2.**
- **B9b. Gear delete is a hard delete** that also detaches the item from every catch that used it (`gear.service.ts:208`, many-to-many at `schema.prisma:98, 125`), and the prompt only asks "Delete this gear item?" (`MyGearPage.tsx:73`). Deleting a rod silently rewrites the history of every fish caught on it. Either soft-delete gear or state the consequence. **Schema + API · S · Priority 1.**

### B10. Empty states that offer the next action
*Verdict: **confirmed**, improved.*

- **Job:** a new angler with nothing logged should be one tap from the thing that fixes that.
- **Evidence:** every empty state is a dead end and each one does double duty for "empty" and "no search match": `MyCatchesPage.tsx:103-104`, `MyGearPage.tsx:98`, `MySitesPage.tsx:93`. Log catch's gear empty state says "No gear found in the database yet." with no link to `/gear/new` (`LogCatchPage.tsx:514`). The signed-out landing page ships three dashed developer placeholder boxes as visible UI (`LandingHero.tsx:47-55, 66-71`).
- **Improvement from the research:** the Apple Journaling steal is a concrete candidate rather than a button. "You have three photos from Kalk Bay this morning" does the empty-state job and the capture job at once, and it costs no illustration.
- **Dependency:** UI only.
- **Size S · Priority 1**

### B11. A signed-in home, and owner controls on the detail pages
*Verdict: **new**, both UI only, both on the redesign's path anyway.*

- **Job:** land somewhere useful, and act on a record from the record.
- **Evidence:** `HomePage` has no auth branch (`HomePage.tsx:4-12`), so a signed-in angler lands on "Get early access" and three fabricated stat numbers. Catch detail has no Edit, no Delete, no back and no share (`CatchDetailPage.tsx:146`); site detail has none of those and no "Log a catch here" (`SiteDetailPage.tsx:81`), which is a spot page's obvious primary action. Editing is reachable only from a list row.
- **Guard:** the signed-in home is the log and the capture action, not a dashboard.
- **Dependency:** UI only.
- **Size S · Priority 1**

### B12. Released or kept
*Verdict: **confirmed for "released", the "method" half is removed.***

- **Job:** record whether the fish went back, which in South African waters is a size-limit and bag-limit fact, not a sentiment.
- **Removed:** a separate method field (bait / lure / fly). `GearType` already carries `BAIT` and `LURE` (`schema.prisma:17-25`), so a method field duplicates data the gear picker holds, and A6 (gear detail) is what makes that data pay off. One field, not two.
- **Dependency:** schema (one column) + API + UI.
- **Size S · Priority 2**

### B13. A public profile, and a following feed
*Verdict: **confirmed and enlarged**. The draft found half of it.*

- **Job:** follow an angler and then actually see their fishing.
- **Evidence (the draft's half):** `Follow` exists (`schema.prisma:205-216`) and follow and unfollow work (`routes.ts:149-158`), but there is no public profile route in `App.tsx:20-34` and no `GET /api/users/:id` or `/api/users/:id/catches` in `routes.ts`. So a name in the followers dialog leads nowhere, and feed cards do not link to their author either.
- **Evidence (the half the draft missed, and the bigger one):** `FeedScope` is `GLOBAL | NEARBY` only (`schema.prisma:32-35`, `feed.schema.ts:3`) and `listFeed` has no author filter (`feed.service.ts:150-165`). **Following somebody changes nothing the angler ever sees.** The follow button is a control with no consequence, and that is the reason the social layer is a dead room. The phase plan specified a following feed (`docs/fishing-app-phase-plan.md:105-106, 249`); it was never built.
- **Dependency:** API + UI for both halves.
- **Size M each · Priority 2**

### B14. The profile is a settings form, not a body of work
*Verdict: **new**.*

- **Job:** see what I have actually logged, as a run of work rather than four inputs.
- **Evidence:** display name, `@username` and bio exist only inside form inputs and are never rendered as text (`ProfileSettingsPanel.tsx:169, 293`). The gallery tiles link nowhere despite carrying `sourceId` (`:351-363`) and are capped at twelve, catches first, so spots get cut off. Saving redirects to the marketing home page, so the angler never sees the result (`:238`). The identity block shows an internal database "User ID".
- **Dependency:** UI, sharing B13's read API. Split the read view from `/profile/settings`.
- **Size M · Priority 2**

### B15. The weather attribution line
*Verdict: **new**, and it is a licence term rather than a preference.*

- **Job:** keep using Google weather data.
- **Evidence:** the app calls Google `currentConditions:lookup` on every catch (`clients/weather.client.ts:25`) and displays the result on catch detail. Google's Weather API policy requires the exact string "Source: Includes weather data from Google", on or next to the data, in the same visual container, at 12 to 16sp, in one of three permitted colours at 4.5:1, always visible and unmodified. Nothing in the client renders it.
- **Free side effect worth taking:** if that one line is the only 12px type in the product, it defines the entire micro-label register and no other wide-tracked small-caps label needs to exist.
- **Dependency:** UI only.
- **Size S · Priority 1**

---

## Tier C. New concepts that need schema work

### C1. Blank trips
*Verdict: **confirmed**, and it is the most valuable item in the tier. Scope trimmed.*

- **Job:** record the days that did not work, which is the only thing that makes the days that did mean anything.
- **Why it is not optional:** the app stores nine usable weather values per catch and has conditions for every success and none for any failure, so no pattern is recoverable from the data it is collecting. It is also the precondition for B7c (pressure as a delta): without a prior trip there is no prior reading. The NJ Striped Bass log makes the nil return compulsory for exactly this reason, and the judged direction already names it ("Log a blank trip", "184 catches, 22 blank trips").
- **Trimmed scope:** a `Trip` row (spot, time span, conditions) that a catch may optionally point at. Not a full session model that reparents every existing catch, which is a migration and a rewrite of every list.
- **Dependency:** schema + API + UI.
- **Size L · Priority 2**

### C2. Say what gets published, and let the angler opt out
*Verdict: **confirmed**, and more urgent than "design it, build later" implies. Split.*

- **Job:** anglers protect their spots, and a spot published by accident cannot be unpublished from the people who saw it.
- **Evidence:** every catch and every spot creates a `GLOBAL` feed post unconditionally (`fishing.service.ts:443-451, 634-644`), site posts carry the exact latitude and longitude (`:641-642`), and no form says so. The digest is explicit: Log site "never says that saving publishes the spot, with description and coordinates, to a public feed".
- **C2a, and it is not a schema project:** state plainly at save time that this will appear in the public feed, and offer a per-record public or private switch. One column, one sentence, one control. **Schema (one field) + API + UI · M · Priority 1.**
- **C2b:** the three-level precision model (exact, rounded to about 1 km, hidden). **M · Priority 3.**

### C3. Offline drafts
*Verdict: **confirmed**.*

- **Job:** log the 06:40 fish with no signal and still have it that evening.
- **Evidence:** no draft, no autosave, no unsaved-changes guard anywhere (`LogCatchPage.tsx:361`); a server 500 silently resubmits without images and orphans the uploaded files (`LogCatchPage.tsx:280-296`). The direction already treats offline as a first-class state with a queued count in the header.
- **Realistic scope:** local draft plus a sync pass is mostly client work. It needs no schema change if the create call takes an idempotency key, which also fixes the duplicate-site-on-retry path (`LogCatchPage.tsx:229-239`).
- **Dependency:** UI + a small API change (idempotency key).
- **Size L · Priority 2**

### C4. Ask
*Verdict: **confirmed as "leave a place for it", with one action to take now.***

- **Job:** "what did I catch at this spot in autumn", answered from the angler's own log.
- **Evidence and the reason to defer:** nothing mounts `ChatBot` (`ChatBot.tsx:22`) yet `POST /api/chat` is live, authenticated and calling OpenAI (`routes.ts:51`). It is a paid backend with no front door. More to the point, the facts it would need to cite (species, blank trips, method, released) do not exist in the data yet, so it would answer from general model knowledge dressed as the angler's own record, which is the opposite of the promise.
- **Action now:** close or gate the unused endpoint. **S · Priority 1.** The feature itself: **L · Priority 3.**

### C5. Notifications
*Verdict: **confirmed, conditional**.*

- **Job:** bring somebody back when another angler responds to them.
- **Condition:** there is nothing to notify about until B13 (following feed) and A3 (reactions on the record) exist. In-app only. Email is a deliverability and consent project and does not belong in this list.
- **Dependency:** schema + API + UI.
- **Size L · Priority 3**

---

## Removed or replaced, so they are not proposed again

| Item | Why |
|---|---|
| Site likes as a heart | Does no angler job. The same table is kept as saved spots (A4). |
| A separate "method" field | Duplicates `GearType`'s `BAIT` and `LURE` (`schema.prisma:17-25`). Gear detail (A6) is what makes that data pay off. |
| Per-user unit preference | A shared catch is read by somebody whose preference differs, and a signed-out reader has none. Both units go on the record instead (B5). |
| "The barometric pressure the weather API already returns" | Factually wrong. The column is hard-coded null on save in both branches (`fishing.service.ts:142, 174`), and the client snapshot schema does not carry it (`fishing.schema.ts:25-52`). It is API work, not UI work (A2.2). |
| A tide slot in the UI | No source is wired and NOAA is US-only. South African tide data is a licensing decision first. Do not ship a slot that cannot be filled. |
| Size as a filter dimension | Sort by size does the job. |
| Share-as-image-card as the first move | The public link is already there and unusable (no title, no OG, no share control). Fix the link first (B8). |
| Email notifications | Deliverability and consent project, out of scope for a functionality gap list. |

### Still correct: things to remove from the build, not add

Unchanged from the draft and all confirmed:

- The dormant `ChatBot` component set, plus the second icon library it drags in, until Ask is designed (`ChatBot.tsx`, `ChatMessages.tsx`, `ChatInput.tsx`, `TypingIndicator.tsx`, none of them mounted). Gate the live `/api/chat` endpoint at the same time.
- Marketing nav (Features, Use cases, FAQ) inside the app. It rides on all twelve in-app routes and does full page navigations back to the landing page (`LandingHeader.tsx:8-11, 37-45`).
- The fabricated stats and the three dashed placeholder boxes on the landing page (`LandingHero.tsx:47-55, 66-71`), two of which name features that do not exist ("Trip plans generated", "Smart insights shared").
- The R2 vendor language ("Uploading to R2...", "Could not upload image to Cloudflare R2.", raw MIME types), the bobbing loader, and the dashed box that is not a dropzone (`r2-image-picker.tsx:115, 159`, `ImageUploader.tsx:81, 129-132`).
- Add to the list: `App.css`, dead Vite starter CSS imported nowhere that holds the repo's only `prefers-reduced-motion` rule.

---

## Order of work

### First release, the non-negotiable set

These are the items without which the redesign is a new coat of paint on a log that loses data. Numbers 1 to 8 are the set; 9 to 11 ride along because they are UI-only and the redesign is already editing those files.

1. **Editing preserves the whole record, and the clock stops drifting** (A2.3). A log that quietly deletes fields and moves every date two hours earlier on each correction is not a log, and no visual work survives that.
2. **Species** (A1). Without it the record has no subject, nothing is comparable and no filter, personal best or Ask question can ever work.
3. **Catch coordinates plus the fast path** (A2.1, B1). The most common capture route in the product currently saves no place at all, and the fast path is the screen the whole redesign is judged on.
4. **Finish the weather write path, stamp the snapshot, add the Google attribution line** (A2.2, B15). The columns, the provider call and the UI slots already exist, so this is a mapping; the attribution is a term of the API being used.
5. **Both units on the record** (B5). Unit handling is corrupting values on save today, and a shared record has no reader preference to convert for.
6. **Photos after logging, catches and spots** (B4). The photo is the point of the record, the update API cannot carry one, and the app already promises otherwise in a toast.
7. **The feed row points at the live record** (A5 with A3's decision). Deleted catches are on strangers' screens right now, and this is a structural fix rather than a patch per mutation.
8. **Say what gets published, and let the angler opt out** (C2a). Silently publishing an exact pin is the one failure a spot-protective user never forgives.
9. **Real 404, document titles, owner controls on detail, empty states with a next action, signed-in home** (A8, B10, B11). All UI-only, all on the critical path, all currently making the app read as broken.
10. **Gear owner filter, and gear delete consequences** (A6 partial, B9b). A one-line privacy fix and a silent data-loss path, both cheap enough that leaving them is indefensible.
11. **Depth and water temperature wired up** (draft item 5, confirmed). The API already accepts both (`fishing.schema.ts:63, 65`); it is two fields on a form. Either wire fish count too or stop rendering "1 catches" (`MyCatchesPage.tsx:132`) for a value nothing can set.

### Second release, making the log and the room worth returning to

1. **Blank trips** (C1). Makes every conditions value the app collects earn its place, and unlocks the pressure delta.
2. **Public profile and a following feed** (B13). The follow button currently changes nothing the angler will ever see, which is the whole reason the social layer is dead.
3. **Reactions on the record** (A3). Once the feed points at live records, a like or a comment has somewhere durable to live.
4. **Server-side search, filter and sort** (B3). A personal log stops being usable somewhere around a hundred rows, and the first serious user will hit that in a season.
5. **Gear detail** (A6). The payoff for having logged tackle at all, and a two-table query once the owner filter is in.
6. **The shared catch link done properly** (B8). This is how the product actually spreads in this market, and today the link previews as "client".
7. **Personal bests as emphasis** (B2). Needs species, and it is the cheapest way to make a list of numbers have a point.
8. **Offline drafts** (C3). Patchy signal is the condition the app will most often meet, and today a failed request loses the form.
9. **Sun and moon** (B7b), **released or kept** (B12), **undo on soft deletes** (B9a), **spot photos beyond the first** (A7), **profile read view split from settings** (B14). Small, independent, no blockers.

### Later, and only when their precondition is true

1. **Site reviews** (A2). Needs spots that strangers visit; rating your own spot is meaningless.
2. **Saved spots** (A4). Needs a feed worth saving from, which is B13.
3. **One map of my spots** (B6). Useful, not urgent, and the item most at risk of becoming a product of its own.
4. **Pressure as a delta** (B7c). Needs blank trips plus the finished snapshot before there is a prior reading to compare against.
5. **Coordinate fuzzing levels** (C2b). The honest statement in C2a does most of the job; precision tiers are a refinement.
6. **Ask** (C4). Needs species, blank trips, method and released in the data first, or it answers from general knowledge while claiming to read the angler's log. Gate the live endpoint now regardless.
7. **Notifications** (C5). Nothing to notify about until the following feed and record-level reactions exist.
8. **Share as a rendered image card** (B8 later half). Only once the link itself is good.
9. **Tide** (B7d). A source and licensing decision, not a build. No UI slot before that is settled.
