# Groups, competitions, leaderboards, rivalries, dashboard and profile stats

**Recommendation:** Ship one scoring rule, not a menu: a species points table where length is converted to mass with published FishBase parameters (W = a x L^b) and points are awarded per kilogram, because that is exactly how South African shore angling championships already score and it is the only method that is fair across a 35 cm galjoen and a 90 cm kob without a scale. Build it in four rings, each useful alone: species with scoring parameters, then personal bests and profile stats, then the mutual-follow rivalry board (no new machinery, it reads catches), then groups and competitions with denormalised standings rows. Never print the word "verified": print what the app actually observed, which is the in-app photo, the stamped clock, the fix accuracy, the measurement source and who confirmed it.

**Effort:** L. Rings 1 to 3 (species scoring parameters, personal bests and profile stats, the rivalry board) are roughly a fortnight on top of the appendix E first-release set, and each ships value alone. Rings 4 to 7 (groups, competitions with one rule, the evidence model and the other two rules, notifications) are the real project: eleven new models, four new services, four controllers, about 25 endpoints and seven new screens, plus a moderation surface that did not previously exist. The unavoidable dependency is A1 species, which appendix E already sizes at L and priority 1, so nothing here starts until that lands.

# The social and competitive layer

## What exists today

### The server

`packages/server` is Express 5 on Bun, TypeScript, Prisma `^7.4.2` with `@prisma/adapter-mariadb` (constructed directly in `lib/prisma.ts`, so `mysql2` is a dependency that the Prisma path does not use), zod `^4.3.6`, axios. `DATABASE_URL` is `mysql://…@127.0.0.1:3306/fishing_app`. The generator is `prisma-client-js` with `engineType = "binary"`.

There is **no `prisma/migrations` directory**. `bun run dev` runs `prisma db push && prisma generate && bun run --watch index.ts`, so schema changes land by push, not by migration.

`routes.ts` has 34 routes. Everything authenticated goes through `requireApiAuth`, which calls `getAuth(req)` then `userService.syncAuthenticatedUser(auth.userId)` and swallows sync failures with a warning. Services are thin over Prisma; controllers parse with zod and return `{ code, message }` on failure.

What already exists that this layer needs:

| Thing | Where | State |
|---|---|---|
| `Follow` (followerId, followingId, unique pair) | `schema.prisma:205-216` | Works. `POST/DELETE /api/users/:userId/follow` at `routes.ts:149-158`. Mutual follow is never detected. |
| `Species` (commonName, scientificName, aliases Json, regionTags Json) | `schema.prisma:106-115` | Table exists, one seeded row, and it is a Californian halibut (`prisma/seed.ts:44-48`). No write path, no read route. |
| `Catch.speciesId` | `schema.prisma:123-124` | Readable in `catchDetailInclude`, not settable: `catchPayloadSchema` has no `speciesId` (`fishing.schema.ts:54-67`). |
| `Catch.length`, `weight`, `count` | `schema.prisma:129-131` | Stored in cm and kg. No source word, no entry unit. |
| Denormalised counters | `FishingSite.catchCount`, `likeCount`, `reviewCount`; `Catch.likeCount`, `commentCount` | The pattern is already in the codebase and is maintained inside `prisma.$transaction` (`fishing.service.ts:396`, `:534`, `:541`, `:592`). |
| Soft deletes | `deletedAt` on User, Catch, FishingSite, FeedPost, Review, Comment | Used. Gear is a hard delete (`gear.service.ts:208`). |
| Profile read | `userService.buildProfileView` | Returns follower and following counts and up to 12 gallery images. No stats beyond that. |

`listConnectionsByClerkId` uses `mode: 'insensitive'` in its `contains` filters. That is a PostgreSQL-only Prisma option; on MySQL it is either ignored or rejected depending on version. Worth checking while you are in this file, it is not my area but it sits directly under the followers dialog.

### The client

`packages/client` is React 19, Vite 7, Tailwind v4, react-router 7, Clerk, Heroicons, axios. Branch `redesign-theme` has the whole redesign built and uncommitted.

The vocabulary I am designing into is real and specific, in `src/index.css`:

- Tokens `--bg`, `--bg-2`, `--ink`, `--ink-2`, `--ink-3`, `--line`, `--teal`, `--teal-text`, `--black`, `--paper`, `--paper-2`, day on `:root`, night on `:root[data-theme='night']`.
- Utility classes `.g` (League Gothic, uppercase), `.g-tracked`, `.lab` (12px tracked uppercase, the only small type), `.num` (tabular), `.blk` (black block with the 36px teal corner tab, which also remaps ink and line tokens for a dark ground), `.rule-dashed`, `.rule-dashed-left`, `.rule-dashed-v`, `.torn`, `.contour`, `.rv`, `.input-line`, `.fixline`.
- Shared components I will reuse rather than invent: `Row` / `RowNumber` / `RowList` (`components/fishing/rows/Row.tsx`, a 52px photo, League Gothic 22 title, one Jost subline, the number on the right, hairline above), `ChipRadioGroup` (`components/feed/ChipRadioGroup.tsx`, a real radiogroup with arrow keys), `PlainState` / `EmptyState` / `NoMatchState` / `InlineError` / `ListSkeleton`, `Contours`, `TornEdge`, `Reveal`, `CountIn`.
- `rows/format.ts` owns the display grammar: `formatDateTime` (`Tue 15 Sep, 06:42`), `plural`, `formatLength` (`44 cm`), `formatWeight` (`1.9 kg`), `metaLine` (one middle dot then commas).

The capture receipt the owner wants to lean on for legitimacy already exists and is honest about itself. `components/fishing/quicklog/useFix.ts` runs `navigator.geolocation.watchPosition` with `enableHighAccuracy: true`, keeps the best reading, calls a fix "sharp" at 30 m or better, gives up at 25 s, and never blocks the save. `Receipt.tsx` stamps the clock at mount and draws the dashed teal fix line. `QuickLogPage.tsx` holds `stampedAt` from `useState(() => new Date())` and sends `caughtAt: stampedAt.toISOString()`. `PhotoBlock.tsx` uses `<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment">`.

Three `TODO(api)` comments in that path matter to me: the fix is shown but **not stored** (`QuickLogPage.tsx`, A2.1), species is saved as the record's title (`quicklog/species.ts`), and blank trips are not kept (`home/summary.ts`, `QuickLogPage.nothingCaught`).

The bottom bar (`components/shell/BottomBar.tsx`) has exactly five slots, fixed by the brief at section 6.1: `Feed · Catches · [Log] · Spots · Gear`. The header (`AppHeader.tsx`) carries the same four words on desktop. **There is no free navigation slot on a phone**, and that constrains where groups can live.

### The agreed gap list

`docs/redesign/05-functionality-gaps.md` already rules on several things this layer depends on, and I am building on those rulings rather than around them:

- **A1 species** is Priority 1, size L, and is called "the biggest one in the product". Without it nothing is comparable. My whole scoring design is blocked on it and I am not going to pretend otherwise.
- **B13** says the follow button today "changes nothing the angler will ever see" and that this, not a shortage of features, is why the room is dead.
- **B2** bans personal bests as a trophy panel: "emphasis on the number already on the page", never a dashboard of tiles.
- **C5 notifications** is Priority 3 and conditional, in-app only, "Email is a deliverability and consent project and does not belong in this list". I am partially reopening that and I say where and why.
- **C2a** says every catch and spot currently publishes to a GLOBAL feed with no consent and site posts carry exact coordinates. A group is a new audience, so this gets worse before it gets better.
- Section 3.6 of the brief refuses badges, crests, rubber stamps, bento grids and big-number dashboards outright. A competition layer is the single most likely place for all of those to come back.

---

## Options considered

### 1. How a fishing competition is scored, fairly, when the fish goes back

**Option A: raw length, biggest fish wins.** Rejected as the only rule. A 40 cm galjoen is a good fish and legal (35 cm minimum). A 40 cm kob is an undersized fish that is illegal to keep (40 cm minimum, so it is exactly at the line). Ranking them on the same axis rewards whoever targets the biggest-growing species, which on the South African shore means everybody fishes for sharks and nobody fishes.

**Option B: points per kilogram, with length converted to mass.** This is what South African shore angling already does, and the rules are explicit. From the SASAA Bylaw (B) championship rules, section B.5:

> "All measurements to be converted to mass for the purpose of calculating weight-points."
> "All measurements shall be rounded off to the lowest centimetre. Example, 80.6 cm = 80cm."
> "Minimum qualifying weight for edible fish will be five hundred (500) grams. Points shall be awarded on the base of two (2) points per kilogram and shall be calculated to a portion of a point. Eg: 750g = 1.5 points or 1,6 kg = 3,2 points"
> "Minimum qualifying weight for Non-edible fish will be one (1) kilogram. Points shall be awarded on the base of one (1) point per kilogram… Eg: 13.5 kg = 13,5 points"

Evidence: https://wpangling.co.za/wp-content/uploads/2020/09/Bylaw-B-Championship-Rules.pdf (SASAA Bylaw B to the 2020 Constitution, version 18, last updated 25 July 2020, pages 4 to 5)

The same document gives a tie-break ladder that has been used in national championships, which is worth more than anything I would invent:

> "In the event of two or more teams or anglers having the same score in any competition, the team or angler with the most number of fish shall be the winner."
> "In the event of more than one team or angler catching the same number of fish in any competition, the one with the highest mass score, shall be the winner."
> "In the event of a tie in respect of both mass score and number of fish, such teams or anglers shall be the joint winners."

And two rules that map directly onto legitimacy and legality:

> "Each catch must be recorded and certified before an angler may resume angling."
> "Species listed as endangered or, for which a closed season is stipulated in the Regulations (MLRA), shall not count in any Championship. Catches smaller than the stipulated minimum legal size, may be measured and released without harm. Providing these catches comply with the Championship minimum weight requirement, they shall qualify to score."

**The conversion itself.** FishBase publishes length-weight parameters for the form W = a x L^b.

> "W = a x L^b" … "The units of length and weight in FishBase are centimeter and gram, respectively." … the table "presents the a and b values of over 5,000 length-weight relationships … pertaining to about over 2,000 fish species."

Evidence: https://www.fishbase.se/manual/FishbaseThe_LENGTH_WEIGHT_table.htm

One caveat the same page raises and that I will carry into the UI: "published length-weight relationships are sometimes difficult to use, as they may be based on a length measurement type (e.g., fork length) different from one's length measurements". The South African regulation settles which length we store:

> "Fish must be measured in a straight line along the side from the tip of the snout to the extreme end of the tail or caudal fin."

Evidence: https://faolex.fao.org/docs/pdf/saf73164.pdf (Marine Recreational Fishing, Regulations For Linefishing, under the Marine Living Resources Act 1998, amended regulations R24 of 14 January 2000)

So: store total length, seed a and b for total length, and say "total length" on the field.

**Option C: percentage of a species benchmark** (your fish as a fraction of the biggest of that species). Elegant, and wrong to ship first, because the benchmark has to come from somewhere and the app has no data yet. Keep it as a *display line* later ("that is 78% of the biggest kob in the log"), never as the score.

**Recommendation: B**, with C as a later read-only line.

### 2. Making an entry credible with no weigh-in

**Option A: force the camera.** Not possible on the web. MDN on the `capture` attribute:

> "When set on a file input type, operating systems with microphones and cameras will display a user interface allowing the selection from an existing file or the creating of a new one."

and its support is "Limited availability — not Baseline because it does not work in some of the most widely-used browsers".

Evidence: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture

So the `capture="environment"` already in `PhotoBlock.tsx` is a hint, not a guarantee. A library photo satisfies it.

**Option B: an in-app camera via `getUserMedia`.** This does work, and it is the honest version of "taken inside the app":

> "This feature is available only in secure contexts (HTTPS)" … "getUserMedia() must always get user permission before opening any media gathering input" … "Baseline: Widely available … It's been available across browsers since September 2017."

Evidence: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

If the app draws the frame from a `<video>` onto a canvas itself, the bytes never came from a library. It still cannot stop someone photographing a photograph, so the claim is "taken in the app", not "genuine".

**Option C: EXIF cross-check.** `exifr` 7.1.3, MIT, reads EXIF in the browser including DateTimeOriginal and GPS. Evidence: https://registry.npmjs.org/exifr/latest (version 7.1.3, license MIT). Useful as a *downgrade* signal only, because a canvas frame has no EXIF at all and many phones strip GPS from web-supplied files, so absence proves nothing.

**Option D: the measuring device and a token in the photo.** This is what catch-photo-release tournaments do: the fish on a bump board with a tournament identifier in frame. The identifier practice is documented in the CPR community rather than in a standards body, and I am flagging it as a secondary source: "The tournament identifier is something unique provided on tournament day to prove the picture was taken during the tournament period", usually written on a hand or a card in the photo. Evidence: https://www.kayakfishingfocus.com/five-catch-photo-release-cpr-tournament-protips/ and the bump-board requirement at https://tourneyx.com/app/lib/rules/1622914248_BBB_Rules._Short_and_Full._Tourney_X.pdf ("use a digital camera or smart phone to take a photo of the fish on the standard measuring device").

**Option E: peer or admin confirmation.** SASAA's actual answer, and it is social rather than technical: a witness list, cards checked daily against the witness, and any suspicious weigh checked the same way (B.5 points 15 to 17 of the same Bylaw). This is the cheapest strong signal we have, because a group is by definition people who know each other.

**Option F: the governing-body benchmark.** IGFA keeps an All-Tackle Length category precisely for released fish:

> "All-Tackle Length World Records are kept for the longest fish of each eligible species caught according to the IGFA International Angling Rules in any Line Class up to 60 kilograms (130 pounds) and released alive."

and requires "Photographs showing the full length of the fish, the rod and reel used to make the catch, and the scale used to weigh the fish". Evidence: https://igfa.org/world-record-requirements/

Note the contradiction with my own recommendation and I am saying so: IGFA still wants a scale in the photo. We are not IGFA, we cannot ask a man on a rock at Rooi-Els for a certified scale, and our badge must therefore claim less than theirs does.

**Recommendation: B + D + E together, with C as a quiet signal and A dropped.** Three named levels, and the word "verified" never appears.

### 3. Where the leaderboard is computed

**Option A: compute from catches on every read.** For a 40-member group over three months that is a join across catches, species and images per read, repeated for every member opening the board on a Saturday evening. Rejected.

**Option B: a denormalised standings row per (competition, angler), recomputed on write.** The codebase already does exactly this with `FishingSite.catchCount` inside `prisma.$transaction` (`fishing.service.ts:396`), so it is the house pattern.

**Option C: SQL window functions for ranking.** MySQL 8.0 has them, and the semantics are the ones a leaderboard wants:

> RANK(): "Returns the rank of the current row within its partition, with gaps. Peers are considered ties and receive the same rank."
> DENSE_RANK(): "Returns the rank of the current row within its partition, without gaps."

Evidence: https://dev.mysql.com/doc/refman/8.0/en/window-function-descriptions.html

Two reasons not to depend on it yet. First, I could not verify the server version: the local database refused the connection (`ECONNREFUSED` on 127.0.0.1:3306), so I do not know whether production is MySQL 8.x or a MariaDB. Second, Prisma raw access is `$queryRaw` / `$executeRaw` and "All methods in the above list can only run one query at a time" (https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries), which is fine but means the ranking pass is a separate statement anyway. Ranking 200 rows in Node costs microseconds.

**Recommendation: B, ranked in application code.** Move to C only once somebody confirms the production server version, and only if a group ever exceeds a few hundred members.

Also worth knowing before this schema lands: `prisma` on npm currently publishes `latest` as `8.0.0-rc.15`, with `prev` at `7.10.0`. The repo is on `^7.4.2`. Evidence: https://registry.npmjs.org/-/package/prisma/dist-tags. For MySQL, "Prisma maintains one adapter: the mariadb driver adapter", which is what `lib/prisma.ts` uses. Evidence: https://www.prisma.io/docs/orm/overview/databases/database-drivers

### 4. Notifications

**Option A: web push.** Not for the first release on a phone. WebKit:

> "Now with iOS and iPadOS 16.4, we are adding support for Web Push to Home Screen web apps."
> "A web app that has been added to the Home Screen can request permission to receive push notifications as long as that request is in response to direct user interaction."

Evidence: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

On iOS that means the angler must add the site to the Home Screen first. Fine later, not a v1 dependency.

**Option B: in-app only**, which is what appendix E's C5 already rules.

**Option C: in-app plus two emails.** Resend is already connected to the owner's tooling. Free plan is "limited to 100 emails per day" with 3,000 monthly transactional. Evidence: https://resend.com/pricing

I am partially reopening C5 here, and the reason is narrow: a competition invitation is the one message that must reach a person who is not currently in the app, and a final result is the one message worth an interruption. Everything else stays in-app.

**Recommendation: C**, exactly two email types, both with an unsubscribe and neither of them marketing.

---

## Recommendation

**One scoring rule for the first release: a species points table with length converted to mass.** Copy SASAA's arithmetic, including the minimum qualifying mass, the round-down-to-the-centimetre rule, fractional points and the tie-break ladder. Add two more rules only after the first one has run a real month: biggest fish (which doubles as "target species" when scoped to one species) and species variety.

**Two more decisions that carry the design:**

1. **A leaderboard between strangers is a lying machine.** Competitions are scoped to a group or to a mutual-follow pair. `OPEN` exists in the enum so the shape is right, and the first release does not expose it. This is not caution, it is the only way the evidence model above means anything: a confirmation is worth something from a person who was on the same beach.

2. **The badge describes, it never certifies.** Three levels named in plain words (`Logged`, `Measured`, `Confirmed`), rendered as a sentence in Jost under the measurement, never as a shield, a crest or a tick. Section 3.6 of the brief refuses badges and rubber stamps and this is the exact place that rule will get broken if it is not written down now.

### The scoring formulas, exactly

Given a catch with total length `L` cm, optional scale weight `W` kg, species `S` with seeded `a`, `b` (cm to grams), size class `edible | nonEdible`, minimum legal length `minLegalCm`, closed season `[from, to]`:

```
lengthForScoring = floor(L)                       // SASAA: round down to the whole cm
massKg  = W                 when weightSource = SCALE
        = a * lengthForScoring^b / 1000           otherwise, labelled "from length"

qualifies = massKg >= minQualifyingKg(class)      // 0.5 edible, 1.0 non-edible
          && species not in closed season on caughtAt
          && (lengthForScoring >= minLegalCm || released == true)
```

**Rule SPECIES_POINTS (default).**
```
points(entry) = pointsPerKg(class) * massKg        // 2.0 edible, 1.0 non-edible
              rounded to 1 decimal
score(angler) = sum of points over qualifying entries in the period
```
Plus one setting SASAA does not need and an app does: `maxEntriesPerSpeciesPerDay`, default 3, so one shoal of small hottentot does not decide a month.

**Rule BIGGEST_FISH.** `score = max(lengthForScoring)` over qualifying entries, optionally filtered to one species. That filter is the "target species" competition; it is not a fourth rule.

**Rule SPECIES_VARIETY.** `score = count of distinct species with at least one qualifying entry`.

**Ties, in this order, for every rule:**
1. Most qualifying fish.
2. Highest total mass.
3. Earliest timestamp of the entry that produced the current score. (My addition. SASAA is content with joint winners because there is a trophy in a room; a list has to render in some order. The list sorts deterministically by who got there first, and the copy still says "Joint first".)
4. Joint, stated in words: `Joint first with Riaan Botha.`

**Why the two rules I was asked about are not in the set:**

- **Longest session** rewards being able to stay on the beach, which is a measure of free time and nothing else, and it is self-reported with nothing to check it against.
- **Most blank trips survived** inverts the whole point of C1. The moment a blank trip earns a point, the honest record becomes a currency and people will log blank mornings they never had. Blank trips must stay free to log and worth nothing, or they stop being true, and the conditions analysis that depends on them dies with them.

**Handling the fact that the fish is released:** the scoring path never requires a weight. Mass is derived from length by default, and "On a scale" only changes the provenance word on the record, not the arithmetic. This is why the mass conversion is the right primary rule rather than a nice-to-have.

**Handling legality:** an entry for a species inside its closed season scores zero and says so. Following the regulation above: Elf/Shad closed 1 September to 30 November; Galjoen closed 15 October to the last day of February; Chokka closed 25 October to 22 November. Size limits from the same document include 40 cm for Kob and White steenbras, 35 cm for Galjoen, 70 cm for Garrick/Leervis, 30 cm for Elf/Shad. An undersized fish scores only if it is marked released, which is stricter than SASAA (who allow it because every championship fish is released) and looser than banning it, and it is the only version that does not create an incentive to keep an undersized fish for points.

---

## How it works in this repo

### Schema, as Prisma fragments

All of this goes in `packages/server/prisma/schema.prisma`.

```prisma
enum GroupRole      { OWNER ADMIN MEMBER }
enum GroupJoinMode  { INVITE_ONLY CODE }
enum CompetitionScope { GROUP RIVALRY OPEN }
enum CompetitionRule  { SPECIES_POINTS BIGGEST_FISH SPECIES_VARIETY }
enum CompetitionState { DRAFT OPEN RUNNING CLOSED }
enum EntryState     { COUNTED UNDER_MINIMUM CLOSED_SEASON FLAGGED EXCLUDED WITHDRAWN }
enum MeasureSource  { EYE TAPE BOARD SCALE }
enum SizeClass      { EDIBLE NON_EDIBLE }
```

Species grows the columns scoring needs. The `aliases` and `regionTags` Json columns already exist and are unused; A1 will fill them.

```prisma
model Species {
  id             String    @id @default(cuid())
  commonName     String
  scientificName String?
  aliases        Json?
  regionTags     Json?
  // new, all optional so an unseeded species still logs
  lwA            Float?    // FishBase a, total length in cm to grams
  lwB            Float?    // FishBase b
  lwSource       String?   // "FishBase, Dichistius capensis, TL, 2026-09"
  sizeClass      SizeClass @default(EDIBLE)
  minLegalCm     Int?      // DFFE minimum size
  closedFrom     String?   // "10-15", day-of-year as MM-DD, no year
  closedTo       String?   // "02-28"
  limitsSource   String?   // the brochure and its date, printed in the UI
  catches        Catch[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  @@index([commonName])
}
```

Groups.

```prisma
model Group {
  id          String        @id @default(cuid())
  name        String
  blurb       String?       @db.VarChar(280)
  createdById String
  createdBy   User          @relation("GroupsCreated", fields: [createdById], references: [id])
  joinMode    GroupJoinMode @default(INVITE_ONLY)
  joinCode    String?       @unique          // 8 chars, rotatable
  imageId     String?
  image       Image?        @relation(fields: [imageId], references: [id])
  memberCount Int           @default(0)      // denormalised, written in the same transaction
  members     GroupMember[]
  competitions Competition[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  deletedAt   DateTime?
  @@index([createdById])
}

model GroupMember {
  id        String    @id @default(cuid())
  groupId   String
  group     Group     @relation(fields: [groupId], references: [id])
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  role      GroupRole @default(MEMBER)
  joinedAt  DateTime  @default(now())
  leftAt    DateTime?
  @@unique([groupId, userId])
  @@index([userId, leftAt])
}

model GroupInvite {
  id         String    @id @default(cuid())
  groupId    String
  group      Group     @relation(fields: [groupId], references: [id])
  invitedById String
  email      String?                          // for the one email that must leave the app
  userId     String?                          // when the person is already here
  token      String    @unique
  acceptedAt DateTime?
  expiresAt  DateTime
  createdAt  DateTime  @default(now())
  @@index([groupId])
}
```

Competitions. The period is a closed interval in UTC plus the zone it was written in, because a South African competition that ends "on Sunday" ends at 23:59 in Africa/Johannesburg and nowhere else.

```prisma
model Competition {
  id          String           @id @default(cuid())
  name        String
  scope       CompetitionScope
  groupId     String?
  group       Group?           @relation(fields: [groupId], references: [id])
  rivalryId   String?
  rivalry     Rivalry?         @relation(fields: [rivalryId], references: [id])
  createdById String
  createdBy   User             @relation("CompetitionsCreated", fields: [createdById], references: [id])
  rule        CompetitionRule  @default(SPECIES_POINTS)
  speciesId   String?          // set = a target-species competition
  species     Species?         @relation(fields: [speciesId], references: [id])
  startsAt    DateTime
  endsAt      DateTime
  timeZoneId  String           @default("Africa/Johannesburg")
  state       CompetitionState @default(DRAFT)
  minQualifyingKgEdible    Float @default(0.5)
  minQualifyingKgNonEdible Float @default(1.0)
  maxPerSpeciesPerDay      Int   @default(3)
  requireInAppPhoto        Boolean @default(true)
  requireConfirmation      Boolean @default(false)  // an entry needs one peer or an admin
  entryCount  Int              @default(0)          // denormalised
  anglerCount Int              @default(0)          // denormalised
  entries     CompetitionEntry[]
  standings   CompetitionStanding[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  deletedAt   DateTime?
  @@index([groupId, startsAt(sort: Desc)])
  @@index([state, endsAt])
}
```

The entry is the join between a catch and a competition, and it is where the evidence lives. The scored values are **frozen on the entry**, not read live from the catch, so that correcting a catch in March does not silently rewrite a January result. A correction creates a visible adjustment instead.

```prisma
model CompetitionEntry {
  id             String     @id @default(cuid())
  competitionId  String
  competition    Competition @relation(fields: [competitionId], references: [id])
  catchId        String
  catch          Catch      @relation(fields: [catchId], references: [id])
  userId         String
  user           User        @relation(fields: [userId], references: [id])
  speciesId      String?
  species        Species?    @relation(fields: [speciesId], references: [id])

  // frozen scoring inputs
  lengthCm       Int?                        // floored, SASAA rule
  massKg         Float?
  massSource     MeasureSource @default(EYE) // SCALE = weighed, otherwise derived from length
  points         Float       @default(0)
  state          EntryState  @default(COUNTED)
  stateReason    String?                     // "Under the 40 cm size limit for kob."

  // evidence, all observed facts, none of them proof
  photoInApp     Boolean     @default(false) // the frame came from the in-app camera
  measureSource  MeasureSource @default(EYE)
  fixAccuracyM   Float?
  captureLagS    Int?                        // caughtAt to createdAt, in seconds
  exifNote       String?                     // "Photo taken 06:39, 3 minutes before the log."
  confirmCount   Int         @default(0)
  reviewedById   String?
  reviewedAt     DateTime?

  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  @@unique([competitionId, catchId])
  @@index([competitionId, userId])
  @@index([competitionId, state, points(sort: Desc)])
}

model EntryConfirmation {
  id        String   @id @default(cuid())
  entryId   String
  entry     CompetitionEntry @relation(fields: [entryId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  wasThere  Boolean  @default(true)   // "I was on the beach" vs "I have seen the photo"
  note      String?  @db.VarChar(280)
  createdAt DateTime @default(now())
  @@unique([entryId, userId])
}
```

The leaderboard row. This is the denormalisation, and it is deliberate.

```prisma
model CompetitionStanding {
  id             String      @id @default(cuid())
  competitionId  String
  competition    Competition @relation(fields: [competitionId], references: [id])
  userId         String
  user           User        @relation(fields: [userId], references: [id])
  score          Float       @default(0)
  fishCount      Int         @default(0)
  totalMassKg    Float       @default(0)
  speciesCount   Int         @default(0)
  bestEntryId    String?
  bestValue      Float?
  firstAchievedAt DateTime?  // tie-break 3
  rank           Int         @default(0)
  isJoint        Boolean     @default(false)
  previousRank   Int?        // so the board can say what moved, without storing history
  updatedAt      DateTime    @updatedAt
  @@unique([competitionId, userId])
  @@index([competitionId, rank])
}
```

The rivalry. Not a competition row per mutual follow: with n followers that is n-squared rows almost all of which are never opened. A row is created lazily the first time either angler opens the board.

```prisma
model Rivalry {
  id         String   @id @default(cuid())
  userAId    String                        // always the lexicographically smaller id
  userA      User     @relation("RivalryA", fields: [userAId], references: [id])
  userBId    String
  userB      User     @relation("RivalryB", fields: [userBId], references: [id])
  startedAt  DateTime                      // when the follow became mutual
  lastSeenA  DateTime?
  lastSeenB  DateTime?
  competitions Competition[]
  createdAt  DateTime @default(now())
  @@unique([userAId, userBId])
  @@index([userBId])
}
```

Personal bests, which the profile, the record screen (appendix E B2) and the rivalry board all read.

```prisma
model PersonalBest {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  speciesId  String?
  species    Species? @relation(fields: [speciesId], references: [id])
  lengthCm   Float?
  massKg     Float?
  catchId    String
  catch      Catch    @relation(fields: [catchId], references: [id])
  achievedAt DateTime
  updatedAt  DateTime @updatedAt
  @@unique([userId, speciesId])
  @@index([userId, lengthCm(sort: Desc)])
}
```

Notifications.

```prisma
enum NotificationKind {
  COMPETITION_STARTED COMPETITION_ENDING COMPETITION_RESULT
  LEAD_LOST ENTRY_CONFIRMED ENTRY_FLAGGED
  GROUP_INVITE RIVAL_PERSONAL_BEST
}

model Notification {
  id        String           @id @default(cuid())
  userId    String
  user      User             @relation(fields: [userId], references: [id])
  kind      NotificationKind
  body      String           @db.VarChar(280)  // the finished sentence, written at creation
  href      String                             // the one place it goes
  groupId   String?
  competitionId String?
  entryId   String?
  readAt    DateTime?
  emailedAt DateTime?
  createdAt DateTime         @default(now())
  @@index([userId, readAt, createdAt(sort: Desc)])
}
```

And on `Catch`, the columns this layer needs that appendix E already asked for: `latitude`, `longitude`, `fixAccuracyM` (A2.1), `released Boolean?` (B12), `lengthSource` and `weightSource` as `MeasureSource` (B5), plus `photoInApp Boolean @default(false)`.

### How a leaderboard stays fast

1. A catch is saved. Inside the existing `prisma.$transaction` in `fishing.service.createCatch` (`fishing.service.ts:372-462`), after the catch row exists, `competitionService.syncEntriesForCatch(tx, catch)` finds every `RUNNING` competition whose window contains `caughtAt` and in which the angler is a live member. Typically zero, occasionally one or two. It upserts a `CompetitionEntry` with the frozen scored values.
2. For each touched competition, `recomputeStanding(tx, competitionId, userId)` reads that one angler's entries in that one competition (indexed by `[competitionId, userId]`, tens of rows) and writes the single standings row.
3. `reRank(tx, competitionId)` reads the standings rows ordered by the rule's sort, assigns `rank`, `isJoint` and `previousRank` in JavaScript, and writes them back in one `updateMany` per distinct rank or a small batched loop. Capped at 200 members per group in the first release, which keeps this under a millisecond of work and a handful of statements.
4. Reading the board is one `findMany` on `CompetitionStanding` ordered by `rank`, with the user and the best entry's photo included. No catch scan, no species join, no aggregation.

Editing and deleting a catch go through the same three steps from `updateCatch` (`:504-570`) and `deleteCatch` (`:571-598`). A catch that leaves the window, changes species or is soft-deleted sets its entry to `WITHDRAWN` and triggers the recompute. The frozen values mean a late correction shows as an adjustment line on the board ("Riaan's 64 cm kob was corrected to 61 cm on 3 June") rather than history quietly changing under everyone.

### Endpoints

All under `packages/server/routes.ts`, all behind `requireApiAuth` unless marked public, all validated by new zod schemas in `schemas/group.schema.ts` and `schemas/competition.schema.ts`.

**Groups**

| Method and path | Body or query | Returns |
|---|---|---|
| `POST /api/groups` | `{ name, blurb?, joinMode }` | `{ group }`, creator becomes OWNER |
| `GET /api/groups/me` | | `{ groups: [{ id, name, memberCount, liveCompetition?, myRank? }] }` |
| `GET /api/groups/:groupId` | | `{ group, members, competitions }`, 404 unless a member |
| `PATCH /api/groups/:groupId` | `{ name?, blurb?, joinMode?, imageId? }` | `{ group }`, OWNER or ADMIN |
| `POST /api/groups/:groupId/invites` | `{ emails?: string[], userIds?: string[] }` | `{ invites }`, sends one email each |
| `POST /api/groups/join` | `{ token }` or `{ joinCode }` | `{ group }` |
| `DELETE /api/groups/:groupId/members/:userId` | | `{ removed: true }`, self or ADMIN |
| `PATCH /api/groups/:groupId/members/:userId` | `{ role }` | `{ member }`, OWNER only |

**Competitions**

| Method and path | Body or query | Returns |
|---|---|---|
| `POST /api/competitions` | `{ groupId, name, rule, speciesId?, startsAt, endsAt, timeZoneId, requireInAppPhoto?, requireConfirmation?, maxPerSpeciesPerDay? }` | `{ competition }` in DRAFT |
| `POST /api/competitions/:id/open` | | `{ competition }`, DRAFT to OPEN, notifies members |
| `GET /api/competitions/:id` | | `{ competition, myStanding, rule: { explained } }` |
| `GET /api/competitions/:id/leaderboard` | `?limit=50&offset=0` | `{ standings: [{ rank, isJoint, user, score, fishCount, bestEntry }] }` |
| `GET /api/competitions/:id/entries` | `?userId=&state=&limit=&offset=` | `{ entries }` with evidence fields |
| `POST /api/competitions/:id/entries/:entryId/confirm` | `{ wasThere, note? }` | `{ entry }` |
| `POST /api/competitions/:id/entries/:entryId/flag` | `{ reason }` | `{ entry }`, state FLAGGED, notifies admins |
| `PATCH /api/competitions/:id/entries/:entryId` | `{ state, reason }` | `{ entry }`, ADMIN only, recomputes |
| `GET /api/competitions/me` | | `{ live: [], upcoming: [], finished: [] }` for the dashboard strip |

**Rivalry**

| Method and path | Returns |
|---|---|
| `GET /api/rivals` | `{ rivals: [{ user, sinceAt, headline }] }`, every mutual follow |
| `GET /api/rivals/:username` | `{ since, period, mine, theirs, mineOnlySpecies, theirsOnlySpecies, sharedSpots, sentence }` |
| `GET /api/rivals/:username?period=90d` | the same, over 90 days |

**Stats**

| Method and path | Returns |
|---|---|
| `GET /api/users/:username` (public) | the profile read view B13 already needs, plus `stats` |
| `GET /api/users/:username/stats` (public) | `{ totals, bestsBySpecies, speciesCaught, speciesTotal, topSpots, conditions }` |
| `GET /api/species` (public) | `?q=` search over commonName and aliases, A1's route, extended with `minLegalCm`, `closedFrom`, `closedTo`, `limitsSource` |
| `GET /api/notifications` | `{ notifications, unread }` |
| `POST /api/notifications/read` | `{ ids }` |

### Screens

Where they live in navigation: the phone bottom bar is full and the brief fixes its five slots, so **Groups does not get a bar slot**. It gets the fifth word in the desktop header, a `Feed / Groups` `ChipRadioGroup` at the top of the Feed screen on a phone, and a line on the signed-in home. That is the only placement that does not break section 6.1.

**`/groups` — Your groups** (`pages/compete/GroupsPage.tsx`)
`Your groups` in League Gothic with the count. One `Row` per group: the group photo at 52px, the name, a subline `14 anglers · June board ends Sunday`, and the angler's own position on the right as a `RowNumber` (`2nd`). Empty state: `You are not in a group yet. A group is a few people you already fish with.` with `Start a group`. No cards, hairlines only.

**`/groups/new` — Start a group**
The form grammar from 6.4: dashed teal underlines, labels above. Name, one line of blurb with a live counter, a photo, and the join mode as a `ChipRadioGroup` (`By invitation` / `With a code`). One teal `Start the group`. A plain sentence under the action, because C2a applies here too: `Anyone in this group sees the catches you enter into its competitions, including the spot you logged them at.`

**`/groups/:groupId` — the group**
Photo header with the torn edge and the name in League Gothic, exactly like the spot page (6.8). A line: `14 anglers · 3 competitions · 212 fish logged together`. Then the live competition as a black `.blk` block with the corner tab: the rule in one sentence, the days left, the top three as rows and `See the whole board`. Then past competitions as quiet rows with the winner named. Then members, 48px rows linking to profiles. Admin controls as text controls, never a red block: `Invite anglers`, `New competition`, `Group settings`.

**`/competitions/new` — Set up a competition** (inside a group)
Four groups divided by dashed teal rules, mirroring 6.4's form:
1. *What counts*: rule as a `ChipRadioGroup` (`Points per kilogram` / `Biggest fish` / `Most species`), and if biggest fish, an optional species picker (A1's picker). Under each chip, one sentence of plain English: `Every fish scores two points a kilogram. The weight comes from the length unless you weighed it.`
2. *When*: start and end dates, the zone named in words (`Times are South African.`).
3. *What makes an entry count*: `Photo taken in the app` (on by default), `Another member has to confirm each fish` (off by default), and the per-species daily cap as a number field.
4. *Who*: the members, all ticked.
A 56px teal `Open the competition` pinned to the bottom, and above it the sentence that says what happens: `Everyone in Kalk Bay Ou Manne gets told when this opens.`

**`/competitions/:id` — the board** (`pages/compete/CompetitionPage.tsx`)
The one screen that will attract every refused design tell, so it is specified tightly.
- A black `.blk` header block with the corner tab: the competition name in League Gothic 44, the rule as one sentence, and the clock as a `.lab` line (`Ends Sunday 23:59 · 3 days left`).
- The angler's own position first, as a single wide row with a 3px teal left rule: `2nd · 41.6 points · 9 fish`. Not a tile, not a card.
- The board: `Row` and `RowNumber`, one per angler. 52px photo of their best fish, the name in League Gothic 22, a subline `9 fish · best 64 cm kob · 41.6 points`, the rank on the right as a League Gothic 24 numeral. A hairline between rows. The angler's own row carries the teal rule. A rank that moved shows a quiet `.lab` under the number (`was 4th`), and nothing at all when it has not moved.
- A `ChipRadioGroup` in the URL: `Board` / `Fish` / `Rules`. `Fish` is every entry as a catch row with its evidence line. `Rules` is the rule written out in full sentences with the tie-breaks, so nobody has to ask.
- Counters count in once on first view (`CountIn`, 900ms) and never again. Nothing idles.
- Empty: `Nothing landed yet. The board fills as people log.`

**Entry evidence, wherever an entry appears** (`components/compete/EvidenceLine.tsx`)
One Jost 14px line in `--ink-2` under the measurement, built from facts:
`Measured on a board. Photographed in the app at 06:42, ±8 m. Confirmed by Riaan Botha.`
or, when there is less to say:
`Logged at 06:42 from a photo added later.`
Never a shield, never a tick, never the word verified. A flagged entry reads `Flagged by a member. An admin is looking at it.` and its points render struck through with the reason beside it.

**`/rivals` and `/rivals/:username` — the rivalry board**
Reached from the followers dialog (`ConnectionsDialog.tsx`, where a mutual follow gets a `Rival` link) and from a profile.
- A black block: both avatars at 64px, both names in League Gothic, and the period as a `.lab` (`Since 12 June, when you both followed each other`), with a `ChipRadioGroup` for `Since then` / `Last 90 days`.
- Three comparisons, each divided by a dashed teal rule, each two columns on a phone:
  1. *The best fish*: their photo and yours, side by side, species and length under each, both linking to the records.
  2. *Species*: `You have galjoen, white steenbras and elf that Thabo does not.` and the mirror. This is the row that keeps the board alive, because it is a collection and not a number.
  3. *Where you both fish*: the shared spots as rows, with the better fish at each named.
- One live sentence in the black block, the only thing that moves: `Thabo has been three centimetres ahead on kob since 12 June.`
- Explicitly not present: total catch counts as the headline (it rewards free time), streaks, a score, a versus graphic.

**The signed-in home** (`pages/fishing/HomeNowPage.tsx`, extended)
Existing order preserved: `SpotHeader`, `Readouts`, `LogSays`, `SeasonStrip`, `RecentRows`. One new block between `Readouts` and `LogSays`: **Where you stand**, one line per live competition, `2nd in the June board, 4.2 points behind Riaan.` with a teal link. Nothing when there is no live competition. Not a tile, not a grid, no counters beyond the existing ones.

**The profile** (`components/profile/ProfileView.tsx`, extended, and `/u/:username`)
Additions, all as sentences following the existing pattern in that file:
- Bests: `Your biggest kob is 91 cm, at Kalk Bay on 3 May.` Each species that has a best gets a line, capped at the five most fished with `See all species`.
- The species list as a collection: `23 of the 61 species in the South African list.` Then the names caught in `--ink`, and the rest in `--ink-3`, as running text, not a grid of tiles.
- Totals: `184 catches at 18 spots, since Mar 2025.` (already there, extended).
- The spots that produce: `Kalk Bay gives you a fish on four trips in five. Strandfontein on one in three.` (needs C1 blank trips to be true; until then it says catches per spot and nothing about rate).
- The conditions that produce: `Your kob came on a falling glass, 1008 to 1013 hPa, with the wind between south and south east.` (needs A2.2 and C1; the block simply does not render until there is a pressure column with values in it).
- Competitions: `Won the June board in Kalk Bay Ou Manne.`

**Notifications**
A `.lab` count beside the avatar in `AppHeader`, and a sheet on a phone / 480px black dialog on desktop reusing the `ConnectionsDialog` shape. Rows are 48px, each a finished sentence and one destination. Five kinds in-app: competition opened, ends in 24 hours, final result, you lost the lead on a board you led (at most once an hour, and only when the lead actually changes hands), your entry was confirmed or flagged. Two by email through Resend: the group invite and the final result. Nothing for likes, nothing for comments, nothing for "somebody logged a catch", which is what the feed is.

### Files that change

| Path | Change |
|---|---|
| `packages/server/prisma/schema.prisma` | Every model and enum above; new columns on `Species` and `Catch` |
| `packages/server/prisma/seed.ts` | Replace the Californian halibut with the South African list: common name, aliases, scientific name, `lwA`, `lwB`, `sizeClass`, `minLegalCm`, closed season, `limitsSource` with its date |
| `packages/server/services/scoring.ts` (new) | Pure functions: `massFromLength`, `pointsFor`, `qualifies`, `rankStandings`. No Prisma import, so it is unit-testable |
| `packages/server/services/group.service.ts` (new) | Groups, members, invites, join codes |
| `packages/server/services/competition.service.ts` (new) | `syncEntriesForCatch`, `recomputeStanding`, `reRank`, confirm, flag, admin review, open and close |
| `packages/server/services/stats.service.ts` (new) | Profile stats, personal bests, the rivalry comparison |
| `packages/server/services/notification.service.ts` (new) | Creating notifications, the two Resend emails |
| `packages/server/services/fishing.service.ts` | `createCatch` (`:372-462`), `updateCatch` (`:504-570`), `deleteCatch` (`:571-598`): call `syncEntriesForCatch` and `syncPersonalBest` inside the existing transaction |
| `packages/server/services/user.service.ts` | `followByClerkId` (`:~560`) detects the reverse follow and creates or touches the `Rivalry`; add the public profile read for B13 |
| `packages/server/schemas/competition.schema.ts`, `group.schema.ts` (new) | zod, matching the house style in `fishing.schema.ts` |
| `packages/server/controllers/*.controller.ts` (new x4) | Same shape as `user.controller.ts` |
| `packages/server/routes.ts` | The routes above |
| `packages/client/src/App.tsx` | `/groups`, `/groups/new`, `/groups/:groupId`, `/competitions/new`, `/competitions/:id`, `/rivals`, `/rivals/:username`, `/u/:username` |
| `packages/client/src/components/shell/AppHeader.tsx` | A fifth destination word, `Groups` |
| `packages/client/src/pages/fishing/FeedPage.tsx` | A `Feed / Groups` chip group at the top on phones |
| `packages/client/src/pages/fishing/HomeNowPage.tsx` | The `Where you stand` block |
| `packages/client/src/components/profile/ProfileView.tsx` | Bests, species collection, producing spots and conditions, competitions |
| `packages/client/src/components/profile/ConnectionsDialog.tsx` | A `Rival` link on a mutual follow |
| `packages/client/src/components/compete/*` (new) | `Board.tsx`, `StandingRow.tsx`, `EvidenceLine.tsx`, `RuleSentence.tsx`, `CompetitionHeader.tsx`, `RivalryBoard.tsx`, `PeriodChips.tsx` |
| `packages/client/src/components/fishing/quicklog/PhotoBlock.tsx` | The in-app camera: `getUserMedia` with a `<video>` and a canvas grab, `capture` kept as the fallback, and `photoInApp` sent with the upload |
| `packages/client/src/components/fishing/quicklog/SpeciesField.tsx` | Once A1 lands, the size and closed-season line under the chosen species |

---

## Migration or build order

Everything here is `prisma db push`, because there is no `prisma/migrations` directory and `package.json` runs `prisma:db:push` on both `dev` and `start`. **Adopt `prisma migrate` before ring 4, not after**: once real competition results exist, a push that drops a column is unrecoverable, and a competition result is the one thing in this product a person will argue about.

**Ring 0, preconditions from appendix E.** Not negotiable and not mine to skip: A1 species (the whole layer is uncomparable without it), A2.1 catch coordinates and the fix accuracy, A2.3 partial updates so an edit stops truncating the record, B5 measurement source words, B12 released or kept. If A1 is not in, stop here.

**Ring 1, species with scoring parameters.** Add the columns to `Species`, seed the South African list with `a`, `b`, size class, minimum size and closed season, and extend `GET /api/species` to return them. Immediately useful on its own: the log sheet can say `Kob, 40 cm minimum` and `Galjoen is closed until 1 March` before a single competition exists. **S to M.**

**Ring 2, personal bests and profile stats.** `PersonalBest`, the write hook in `createCatch`, `GET /api/users/:username/stats`, and the profile additions. Ships value with no groups, no competitions and no new social surface, and it is what B2 needs. **M.**

**Ring 3, the rivalry board.** Mutual-follow detection in `followByClerkId`, the lazily created `Rivalry` row, `GET /api/rivals` and `/api/rivals/:username`, the board screen and the link in the connections dialog. No competition machinery at all: it reads catches and personal bests. This is the cheapest answer to B13's "the follow button changes nothing". **M.**

**Ring 4, groups.** `Group`, `GroupMember`, `GroupInvite`, the routes, the three group screens, and the Resend invite email. No scoring yet: a group at this point is a named room with people in it. **M to L.**

**Ring 5, competitions with one rule.** `Competition`, `CompetitionEntry`, `CompetitionStanding`, `scoring.ts`, `syncEntriesForCatch` wired into the three catch mutations, the board screen, the setup screen. `SPECIES_POINTS` only. Run one real month with the owner's own club before adding anything. **L.**

**Ring 6, the other two rules and the evidence model.** `BIGGEST_FISH`, `SPECIES_VARIETY`, the in-app camera in `PhotoBlock`, `photoInApp`, `EntryConfirmation`, flagging, admin review, the evidence line. **M to L.**

**Ring 7, notifications.** `Notification`, the header count, the sheet, the five in-app kinds, the two emails. **M.**

**Deferred, with the reason:** open competitions (no verification is possible between strangers), web push (iOS needs the site on the Home Screen), team competitions (SASAA's real shape, but it doubles every scoring path), club season imports.

---

## What it costs and what we lose

**A moderation surface that did not exist.** The moment there is a prize, somebody measures generously. Flagging, review and the audit trail are not polish, they are the cost of the feature, and they are why ring 6 exists as its own ring.

**A word we can never use.** If "verified" appears anywhere, the product is claiming something it cannot check and the first disputed 91 cm kob becomes the owner's problem. The evidence line is deliberately duller than what a competitor would ship.

**The strongest pull towards everything section 3.6 refuses.** Ranks, points, badges, tiers, streaks, confetti. The specification above deliberately renders a leaderboard with the same `Row` and `RowNumber` used for a list of catches, with hairlines and no cards, because that is the only way this survives contact with the design language.

**Denormalisation drift.** `CompetitionStanding`, `memberCount`, `entryCount` and `PersonalBest` can all go stale if a write path forgets them, exactly as `FishingSite.catchCount` can today. Mitigation: every one of them is written inside the same `prisma.$transaction` as its source row, and a `recomputeCompetition(id)` admin route exists from day one so a drifted board can be rebuilt without a deploy.

**Privacy gets worse before C2a lands.** A group is a new audience for a spot. Today every catch and spot already publishes a GLOBAL feed post unconditionally and site posts carry exact coordinates. Entering a catch into a competition shows its spot to fourteen people. That needs C2a's sentence and switch before ring 5, not after.

**Google Weather quota.** Nothing in this layer pulls conditions per entry, and it must stay that way. Entries read the snapshot already on the catch.

**What we lose by choosing the SASAA mass rule:** the board is less legible to somebody who has not fished a club competition. `41.6 points` means less at a glance than `64 cm`. The mitigation is the `Rules` tab written in full sentences and the subline on every row carrying the best fish in centimetres, so the number that means something to a person is always beside the number that scores.

**What we lose by scoping competitions to groups:** no growth loop. Nobody discovers the product through a global board. That is the correct trade, because a global board with no verification is a lying machine, and the actual growth loop in this market is a WhatsApp link (appendix E B8).

**Effort: L.** Rings 1 to 3 are a fortnight of focused work on top of ring 0. Rings 4 to 7 are the real project. The unavoidable dependency is A1 species, which appendix E already sizes at L and priority 1.

---

## Further features for a South African rock and surf angler

Each is one line on why an angler cares, one line on what it costs.

1. **Size limit and closed season at the moment of logging.** *Why:* it is a permit condition and a fine, and it makes "released" a decision instead of a checkbox. `Galjoen is closed until 1 March.` under the species chip, in teal text, before the fish goes back. *Cost:* S once ring 1 is done. The data is a published brochure, so it needs a `limitsSource` string with its date printed in the UI and a manual refresh; there is no API and I would not pretend otherwise. (Source: https://faolex.fao.org/docs/pdf/saf73164.pdf)

2. **An ORI tag number on a released fish.** *Why:* the ORI Cooperative Fish Tagging Project has been running since 1984 with over 345,000 fish tagged by recreational anglers, and the anglers who do it are exactly the ones who keep a careful log. *Cost:* S. One column, one field, one line on the record. A recapture lookup or an export for ORI is a later conversation with SAAMBR, not a build. (Source: https://saambr.org.za/ori-tag-release/ and https://www.oritag.org.za/)

3. **The swell window for a spot.** *Why:* rock and surf is decided by swell height and period far more than by anything the current conditions block shows, and a 4 m south west swell at Kogel Bay is the difference between a session and a drive home. *Cost:* M, plus a licence decision. Open-Meteo's marine API returns wave height, swell height, period and direction, under CC-BY 4.0, with "Less than 10'000 API calls per day" and "You may only use the free API services for non-commercial purposes". The non-commercial clause is a decision the owner has to make before this is built, not after. (Source: https://open-meteo.com/en/terms and https://open-meteo.com/en/docs/marine-weather-api)

4. **What produced fish at this spot.** *Why:* it is the entire payoff of the twenty-five weather columns, and it is the sentence an angler would pay for: `The last six fish here came on a falling glass between 1008 and 1013, with the wind between south and south east.` *Cost:* S in itself, L in dependencies. It needs A2.2 (eleven pressure and humidity columns currently written as null) and C1 (blank trips), so the failures are in the data too.

5. **A club day: a competition with a roll call.** *Why:* South African shore angling already works this way, with a start time, an area and cards handed in within ninety minutes of lines-up. *Cost:* S once competitions exist. A start and end time the competition already has, plus a "who is on the beach" list and a soft close that mirrors SASAA's "Scorecards must be handed to the designated or nominated person as soon as possible but not later than 90 minutes".

6. **A printable measuring strip, and a reference object in frame.** *Why:* "it needs scale photos to be legit" is the owner's own bar, and a bump board is R800 that most shore anglers do not own. A printed A4 strip, or a bank card at 85.6 mm in the frame, gives the photo a scale anybody can check by eye. *Cost:* M. A printable PDF and one overlay in the camera. Deliberately **not** automatic measurement from the photo, which is a computer vision project that will be wrong in a way nobody can argue with.

7. **The standings as a link that previews properly in WhatsApp.** *Why:* the club lives in a WhatsApp group, and the board only matters if it can be dropped into it. *Cost:* S on top of B8, which is already planned and already needs a server-rendered meta route because the SPA has no SSR.

8. **Kept and released totals against the bag limit.** *Why:* the recreational list is ten fish a day with a maximum of five of any one species, and an angler who keeps fish genuinely loses count. *Cost:* S. It is a sum over the day and one sentence, and it needs only B12's `released` column.

### The gamification clichés, and why they are refused

- **Streaks.** A streak punishes the angler who works, and in the Cape the weather decides whether anybody fishes at all. A person who does not fish for three weeks in July has done nothing wrong and the product should not say otherwise.
- **XP, levels and tiers for logging.** They reward logging rather than fishing, which is precisely backwards: the honest record becomes a currency and the log stops being true. This is the same argument that kills "most blank trips survived".
- **Badges, crests and trophy cabinets.** Section 3.6 of the brief refuses them by name ("rubber stamps and crests", "vintage badge", "no illustration, no mascot"). A badge is also a claim, and the legitimacy section is entirely about not making claims.
- **A global leaderboard.** No confirmation is possible between strangers, and an unverifiable global board is worse than nothing: it teaches the honest users that the numbers are fiction.
- **Daily challenges.** A fishing trip is not a daily activity anywhere, least of all on the South African south coast in winter.
- **Confetti, level-up sounds, animated counters that replay.** Section 3.4 is explicit: "Nothing idles: no pulse, no shimmer, no float." Counters count in once, on first view.
- **A "most catches" ranking of any kind.** It ranks free time. Every rule above is a rule about fish, not about frequency.

---

## Open questions for the owner

1. **What is a season?** The app currently means "the last twelve months" (`home/summary.ts`, `YEAR_MS`). South African shore angling is shaped by closed seasons rather than a single calendar. Is a season the calendar year, September to August, or does the word stay loose and mean "the last twelve months"? Everything on the profile and the season strip depends on the answer.

2. **How big can a group be?** I have specified a 200-member cap so the re-rank stays trivial. Is that a club (30 to 60) or a regional association (several hundred)? If it is the latter, the ranking pass moves into SQL and I need the production MySQL version.

3. **What server is production?** The local database refused a connection, so I could not read `SELECT VERSION()`. MySQL 8.0 or MariaDB decides whether window-function ranking is available later, and the adapter in use (`@prisma/adapter-mariadb`) speaks to both.

4. **Do catches logged before somebody joins a competition count?** I have assumed no: an entry is created only for a catch whose `caughtAt` falls inside the window while the angler is a live member. The opposite is defensible for a monthly board people join late.

5. **May an admin edit an entry, or only exclude it?** I have specified exclude with a reason, never edit, because an admin who can change a length can decide a competition. Confirm that is what you want.

6. **What happens to spot coordinates inside a group?** Entering a catch shows its spot to everybody in the group. C2a's consent sentence needs to cover this before ring 5 opens, and the group version may need its own answer (exact, about 1 km, or hidden inside a group).

7. **Open-Meteo's non-commercial clause.** If this product is ever going to charge, the swell feature needs a commercial licence. Worth settling before it is built, not after anglers rely on it.

8. **Is a public or open competition ever wanted?** The enum carries `OPEN` so the shape is right, but I have deliberately not exposed it. If you want it in year one, the evidence model has to get considerably heavier.

9. **Adopt `prisma migrate` before this lands?** There is no migrations directory today and both `dev` and `start` run `db push`. Competition results are the first data in this product that a person will dispute, and I would not want them on a push-only schema.

10. **Whose species list, and who owns the numbers?** The `a` and `b` values come from FishBase, the size limits from the DFFE brochure. Both need a named source and a date on the record, and somebody has to own refreshing them when the regulations change. FishBase itself notes that relationships may be based on a different length type from the one you measured, so each seeded row should say which.