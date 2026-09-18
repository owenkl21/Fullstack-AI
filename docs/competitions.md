# Competitions in Fishtagram

**Summary.** A competition is a named, dated contest that any signed-in angler can start from the Competitions page. It has a window (`startsAt` to `endsAt`), an optional single target species, one of three rules (total, biggest fish, most species), one measure (length or weight), and one of three scopes (public, group, private/invitation only). Standings are never stored: every time somebody opens a board the server re-reads the entrants' catches inside the window and recomputes the table, so editing or deleting a catch corrects the result rather than leaving a stale score behind. What is actually scored is simpler than the research documents describe: the competition board sums raw centimetres or raw kilograms, it does not award SASAA points per kilogram, and it does not apply the minimum qualifying mass, the closed season or the minimum legal size. Those rules live in `scoring.ts` and are used only by the species Boards, the rivals board, the group boards and the profile stats. The one piece of `scoring.ts` a competition does use is `massKgFor`, the FishBase `W = a x L^b` conversion, and only as a fallback when a weight competition meets a catch that carries no weight.

## Read this first

These five files are the whole feature. Everything else is a caller.

| File | Why it matters |
|---|---|
| `packages/server/services/competitions.service.ts` | Every rule the feature actually enforces: create, invite, accept, join, leave, and the standings computation. 564 lines, no other file duplicates any of it. |
| `packages/server/services/scoring.ts` | The FishBase length-to-mass conversion and the SASAA points model. Read it to learn what a competition does **not** do, which is most of it. |
| `packages/server/prisma/schema.prisma` | Lines 32 to 151 (the enums) and 644 to 821 (`Competition`, `CompetitionEntrant`, `CompetitionInvite`). |
| `packages/client/src/pages/social/CompetitionsPage.tsx` | The only screen. List, create, invite, accept, enter, leave, standings, results, all of it. |
| `packages/client/src/components/fishing/CompetitionEntry.tsx` | The photo reader panel on the catch form, and the only place `ANTHROPIC_API_KEY` changes what an angler sees. |

---

## 1. What a competition is, in plain words

An angler signs in, opens `/competitions`, presses "Start one", and fills in a short form: a name, an optional line of blurb, a start and an end, whether fish are judged on length or on weight, how the winner is decided, whether anyone can enter or only invited followers, and optionally a single species the competition is restricted to. That creates the competition and enters the creator into it in the same write (`competitions.service.ts:152-171`, `entrants: { create: { userId } }`).

**Who can create one.** Any authenticated user. There is no group membership requirement, no role, no quota, no rate limit. `POST /api/competitions` is behind `requireApiAuth` and nothing else (`routes.ts:240`).

**Who can join.**

- **PUBLIC**: anyone signed in, by pressing Enter. `join` does no scope check for PUBLIC at all (`competitions.service.ts:369-414`).
- **PRIVATE**: only somebody holding an `ACCEPTED` invite, or the organiser (`competitions.service.ts:380-390`). Invites can only be sent to people who follow the organiser.
- **GROUP**: only a live member of `competition.groupId` (`competitions.service.ts:393-405`). Note that no client screen can create a GROUP competition today, so this branch is unreachable in practice (see section 7).

**How long it runs.** Exactly from `startsAt` to `endsAt`, both stored as UTC instants. The zod schema refuses `endsAt <= startsAt` twice, once in the schema and once again in the service (`competition.schema.ts:33-36`, `competitions.service.ts:148-150`). There is no maximum length and no minimum. The default the form offers is now to one week from now (`NewCompetitionForm.tsx:71-72`).

**What it is scored on.** Two orthogonal choices.

- `measure` is what one fish is worth: its **length in centimetres**, or its **weight in kilograms**.
- `rule` is how those per-fish values become a position: **SPECIES_POINTS** (sum them), **BIGGEST_FISH** (take the largest single one), or **SPECIES_VARIETY** (count distinct species, which ignores the measure entirely).

The client writes this as one sentence (`competitions-api.ts:99-111`): "Total length of every fish that counts", "Biggest single fish by weight", "Most different species".

**A competition never closes itself.** `state` is set to `'OPEN'` on creation and is never written again anywhere in the codebase. "Finished" is derived on every read by comparing `endsAt` to the clock (`competitions.service.ts:356-362`). See section 5.

---

## 2. The rules, stated precisely

### 2.1 What one fish is worth

This is `valueOf` in `competitions.service.ts:102-144`, and it is the whole of competition scoring.

```ts
const valueOf = (row: CatchRow, measure: CompetitionMeasure): number | null => {
   if (measure === 'LENGTH') {
      return row.length ?? null;
   }

   if (row.weight !== null) {
      return row.weight;
   }
   ...
```

For a **LENGTH** competition the value is `Catch.length` verbatim, in centimetres, as a float. It is **not** floored to the whole centimetre. The SASAA round-down rule quoted in `research/social.md:72` and implemented in `scoring.ts:116` (`Math.floor(entry.lengthCm)`) does not apply on a competition board. A 44.7 cm fish contributes 44.7.

For a **WEIGHT** competition:

1. If `Catch.weight` is non-null, that number is the value, in kilograms. `weightSource` is **not consulted**. A weight the angler guessed by eye (`weightSource = 'EYE'`) counts at face value on a competition board, while `scoring.ts:107` on the species Boards would ignore it and derive mass from length instead. This is a real inconsistency between the two scoring paths, not a documented decision.
2. If `Catch.weight` is null and the catch has a species, the service calls `massKgFor` with a synthetic `ScoringSpecies` whose `sizeClass` is hardcoded `'EDIBLE'` and whose `minLegalCm`, `closedFrom` and `closedTo` are hardcoded `null` (`competitions.service.ts:121-141`). The comment says why: "Neither matters here: this competition is not scoring by size class."
3. If the catch has no species, or the species has no `lwA`/`lwB`, the value is `null` and the catch is left out of the standings entirely.

A value of `null` or `<= 0` is skipped (`competitions.service.ts:496-499`). Nothing is ever counted as zero.

### 2.2 The FishBase model, W = a x L^b

The conversion lives in `scoring.ts:103-120`:

```ts
if (entry.weightSource === 'SCALE' && entry.weightKg != null) {
   return { massKg: entry.weightKg, from: 'scale' };
}

if (entry.lengthCm == null || species.lwA == null || species.lwB == null) {
   return null;
}

/* SASAA rounds length down to the whole centimetre before converting. */
const length = Math.floor(entry.lengthCm);
const grams = species.lwA * Math.pow(length, species.lwB);

return { massKg: grams / 1000, from: 'length' };
```

- `a` is `Species.lwA`, `b` is `Species.lwB`. Both are `Float?` on the species row (`schema.prisma:263-264`). The units are FishBase's own: total length in centimetres in, **grams** out, which is why the result is divided by 1000.
- They come from the seed, `packages/server/prisma/species.seed.ts`. The seed comment states they were "retrieved per species from its summary pages on 17 September 2026", are Bayesian estimates rather than measured studies, and are recorded with `lwSource = 'FishBase Bayesian length-weight, TL cm to g, retrieved 2026-09-17'`. `lwSource` is only written when `lwA` is present (`species.seed.ts`, the `lwSource: entry.lwA ? LW_SOURCE : null` line in both the update and create branches).
- **Coverage today: 10 of the 24 seeded species carry `lwA`/`lwB`.** The other 14, including white musselcracker, black musselcracker, zebra, Cape stumpnose, red roman, santer, Cape gurnard, smooth-hound shark, sharptooth catfish, common carp, smallmouth bass, rainbow trout, Clanwilliam yellowfish and yellowtail, have nulls.
- **A species an angler creates never gets parameters.** `POST /api/species` writes only `commonName` (`fishing.service.ts:726-727`), so every angler-added species has `lwA = null`, `lwB = null` and `sizeClass = 'EDIBLE'` by column default.
- **When a species has no published parameters**, `massKgFor` returns `null`. On a competition board the catch simply does not appear. On the species Boards the catch appears in `loggedButUnscored` with the reason string "No published length to weight figures for <name> yet, so it cannot be scored." (`scoring.ts:150`), which the client prints (`BoardsPage.tsx:307-313`). A competition board has no equivalent. It says nothing about the fish it dropped.

### 2.3 Points per kilogram: where it is and is not applied

`scoring.ts` implements the full SASAA model:

```ts
/* SASAA: 0.5 kg for edible species, 1.0 kg for non-edible. */
const MIN_QUALIFYING_KG: Record<SizeClass, number> = { EDIBLE: 0.5, NON_EDIBLE: 1.0 };

/* SASAA: 2 points per kg edible, 1 point per kg non-edible. */
const POINTS_PER_KG: Record<SizeClass, number> = { EDIBLE: 2.0, NON_EDIBLE: 1.0 };
```

and `scoreCatch` (`scoring.ts:130-191`) applies, in order: no species -> not scored; in closed season -> not scored; no derivable mass -> not scored; mass under the class minimum -> does not qualify; under `minLegalCm` **and not released** -> does not qualify; otherwise `points = round(pointsPerKg * massKg * 10) / 10`.

**None of this runs on a competition board.** `competitions.service.ts` imports exactly two things from `scoring.ts` (line 3): `massKgFor` and the `ScoringSpecies` type. `scoreCatch` is never called from the competition path. The consequences, all verified:

| SASAA rule | Species Boards, rivals, group boards, profile stats | Competition standings |
|---|---|---|
| Length floored to whole cm | Yes (`scoring.ts:116`) | No |
| 0.5 kg / 1.0 kg minimum qualifying mass | Yes | No |
| Closed season excludes the fish | Yes (`scoring.ts:138-142`) | No |
| Undersized fish scores only if released | Yes (`scoring.ts:166-179`) | No |
| 2.0 / 1.0 points per kg by size class | Yes | No, the board sums raw cm or raw kg |
| `NON_EDIBLE` treated differently | Yes | No, `sizeClass` is forced to `'EDIBLE'` and then never read |

So the answer to "are points awarded per kilogram" is: **in a competition, no.** A weight competition's total is a sum of kilograms and the client prints it as `12.40 kg` (`units.ts:55-68`, via `formatMeasure` at `units.ts:77-85`). The per-kilogram points table is the Boards page, which is a different product surface reached at `/boards`.

This directly contradicts `research/social.md:3` ("points are awarded per kilogram") and `HANDOFF.md:102` ("One scoring rule: species points via FishBase W = a x L^b, points per kilogram"). Trust the code.

### 2.4 How a catch qualifies to be entered

There is no entry step. A catch qualifies for a competition board if, at the moment somebody reads the standings, **all** of these hold:

1. `Catch.deletedAt IS NULL`.
2. `Catch.createdById` is one of the competition's entrants with `leftAt IS NULL`.
3. `startsAt <= Catch.caughtAt <= endsAt` (an inclusive interval on both ends, `gte`/`lte`).
4. If the competition sets `speciesId`, `Catch.speciesId` equals it.
5. `valueOf` returns a number greater than zero.
6. The catch survives the per-species-per-day cap (section 2.5).

That is the entire query (`competitions.service.ts:465-485`). Three things are notably absent:

- **`Catch.competitionId` is never read.** The column exists (`schema.prisma:305-306`), the catch form writes it (`fishing.service.ts:828-830`), the edit form carries it (`EditCatchPage.tsx:149`), and the standings query ignores it completely. Choosing a competition on the catch form has no effect whatsoever on any board. Its only observable effect is to unlock the photo-reader panel in the form.
- **`Catch.visibility` is never checked.** A catch marked `PRIVATE` still contributes to a competition board, including its owner's total and the `best` figure other entrants can see. Compare `groups.service.ts:230`, which explicitly filters `r.visibility !== 'PRIVATE'` and reports `excludedPrivate` so members know something was withheld. Competitions do not do this.
- **`CompetitionEntrant.joinedAt` is never checked.** Catches logged before an angler entered still count, as long as `caughtAt` is inside the window. `research/social.md:743` raises this as open question 4 and assumes the answer is no. The code answers yes.

### 2.5 The per-species-per-day cap

`Competition.maxPerSpeciesPerDay` defaults to 3 (`schema.prisma:677`, `competition.schema.ts:31`, allowed range 1 to 20). It is applied in `competitions.service.ts:494-518`:

```ts
const day = row.caughtAt.toISOString().slice(0, 10);
const key = `${row.createdById}|${row.speciesId ?? 'none'}|${day}`;
...
for (const list of perDay.values()) {
   list.sort((a, b) => b.value - a.value);
   for (const entry of list.slice(0, competition.maxPerSpeciesPerDay)) {
```

Two details that matter and that differ from the other implementation in `scoring.ts:229-259`:

- The **largest** fish of the day are the ones kept here (sorted descending, then sliced). `buildStandings` in `scoring.ts` keeps the **earliest** instead ("Oldest first, so the capped entries kept are the earliest of a day", `scoring.ts:229`). Two functions in the same codebase resolve the same cap in opposite directions.
- The day boundary is the **UTC** calendar day, not the competition's `timeZoneId`. In Africa/Johannesburg (UTC+2) the cap therefore rolls over at 02:00 local, not midnight. A three-fish day that includes a fish at 00:30 SAST spends that fish on the previous day's quota.
- A catch with no species falls into a shared `'none'` bucket, so up to `maxPerSpeciesPerDay` unidentified fish a day count, and for `SPECIES_VARIETY` that bucket counts as one "species" in `distinctSpecies` (`competitions.service.ts:515`, `540-543`). Logging one unidentified fish adds one to your variety score.

### 2.6 Does a fish have to be kept, or weighed?

No to both, and this is deliberate.

- **Kept or released is irrelevant on a competition board.** `Catch.released` is not in the standings `select` (`competitions.service.ts:474-484`) and cannot be, because `valueOf` never looks at it. The `released` flag only matters on the Boards path, where an undersized kept fish is refused (`scoring.ts:166-179`).
- **Weighed is optional.** A length competition never touches weight. A weight competition falls back to the length conversion. `NewCompetitionForm.tsx:181-186` tells the angler this: "A fish with no scale reading is converted from its length, and a species with no published figures cannot be counted."

### 2.7 Per-species versus overall boards

There are two separate ideas that share the word "board", and one of them shares a URL prefix with competitions, which is worth knowing before reading `routes.ts`.

| Surface | Route | What it ranks |
|---|---|---|
| Species boards | `GET /api/competitions/species` (public, no auth) -> `statsController.speciesBoards` -> `statsService.speciesBoards` -> `buildSpeciesBoards` | One table per species, over **every catch in the database**, using the full SASAA points model. Nothing to do with the `Competition` table. Registered before the `/:competitionId` routes so the literal segment wins (`routes.ts:138`, and the comment at `:217-218`). |
| Group boards | `GET /api/groups/:groupId/boards` (members only) | Overall standings plus per-species boards over the group's members' non-private catches. |
| A competition's standings | `GET /api/competitions/:competitionId/standings` | One table, the entrants, the window, the optional single species. |

A competition itself has **one** board and no per-species breakdown. A "target species" competition is expressed by setting `speciesId`, which filters the query, rather than by producing separate tables (`schema.prisma:665-666`, "Set, and it is a target-species competition rather than a fourth rule").

`scoring.ts` exports `buildStandingsForSpecies` (`:409-414`) and `isJoint` (`:298-301`). Neither is imported anywhere. They are dead code.

### 2.8 Ties

Competition standings sort on one line (`competitions.service.ts:551-560`):

```ts
const rank = (s: CompetitionStanding) =>
   competition.rule === 'BIGGEST_FISH'
      ? s.best
      : competition.rule === 'SPECIES_VARIETY'
        ? s.distinctSpecies
        : s.total;

const standings = [...byAngler.values()].sort(
   (a, b) => rank(b) - rank(a) || b.best - a.best
);
```

So: primary key is the rule's figure, single tie-break is the best single fish. For `BIGGEST_FISH` the tie-break is the same value as the primary key, so it does nothing and tied anglers fall back to `Map` insertion order, which is the order `prisma.competitionEntrant.findMany` happened to return. The order is not deterministic across reads.

The four-step SASAA ladder (most qualifying fish, then highest total mass, then earliest, then stated as joint) that `research/social.md:219-223` specifies **is** implemented, but only in `scoring.ts:288-294`, for the Boards. The competition page never says "joint" and never shares a position number: `CompetitionsPage.tsx:525` prints `{index + 1}`, a bare row index. The Boards page does handle joint positions properly (`StandingsTable.tsx:95-110`).

A `CompetitionStanding` row is created for **every** entrant, including anglers with no qualifying catch, who appear with `total: 0, best: 0, entries: 0, distinctSpecies: 0` (`competitions.service.ts:520-531`). So a running competition's table is never empty once anyone has entered, and the client's "Nobody has entered yet" message only appears when the entrant list itself is empty.

### 2.9 Privacy and invitations

**Who can see a competition in the list** (`competitions.service.ts:326-334`):

```ts
const where = {
   deletedAt: null as null,
   state: { not: 'DRAFT' as const },
   OR: [
      { scope: 'PUBLIC' as const },
      { entrants: { some: { userId, leftAt: null } } },
      { invites: { some: { userId, state: 'PENDING' as const } } },
   ],
};
```

A PRIVATE competition is invisible unless you are a live entrant or hold a pending invite. A GROUP competition is invisible to a group member who has not entered it, which means there is no way to discover one. The pending-invite branch does not check `expiresAt`, so a lapsed invite keeps the competition on your list forever.

**Who can read standings** (`competitions.service.ts:441-451`): only PRIVATE is gated. The organiser or a live entrant may read them; anyone else gets `null` and therefore a 404. **PUBLIC and GROUP standings are readable by any signed-in user who knows the id.** A GROUP competition's board is not restricted to its group, which contradicts the intent stated in `groups.controller.ts:94` ("a group board is not a public leaderboard") for the other kind of board.

**Invitations** (`competitions.service.ts:184-223`):

- Only the organiser can send them: the lookup is `{ id, deletedAt: null, createdById: userId }`.
- Only for PRIVATE competitions: `if (!competition || competition.scope !== 'PRIVATE') return null;`
- Only to **people who follow the organiser**. The check is `prisma.follow.findMany({ where: { followingId: userId, followerId: { in: userIds } } })`, so the invitee must be a follower of the organiser. It is not mutual and it is not "people the organiser follows". Ids that do not pass are silently dropped and are not counted in the returned `sent` figure.
- Self-invites are dropped (`inviteeId === userId`).
- **An invitation lasts 7 days.** `const INVITE_DAYS = 7;` (`competitions.service.ts:45`), `expiresAt = new Date(Date.now() + INVITE_DAYS * 86400000)`.
- Re-inviting the same person **resets** the invite: the upsert's `update` branch writes `{ state: 'PENDING', expiresAt, answeredAt: null }`, so an organiser can revive a declined or expired invitation and push the deadline out, without limit.
- Every send writes an `INVITE` notification whose `body` is the competition name.

**Answering** (`competitions.service.ts:251-293`): the invite must be yours and `PENDING`. If `expiresAt` has passed, the service returns `{ state: 'EXPIRED' }` and **does not change the row**, so the invite stays `PENDING` in the database forever, invisible to `invitesFor` but still matching the `list` visibility clause. Accepting upserts a `CompetitionEntrant` with `leftAt: null`. Either answer writes an `INVITE_ANSWER` notification back to the inviter with a pipe-delimited body, `accepted|<name>` or `declined|<name>`, which `NotificationsPage.tsx:52` splits on `|`.

---

## 3. The data model

All in `packages/server/prisma/schema.prisma`. The datasource is MySQL and there is **no `prisma/migrations` directory**; schema changes land by `prisma db push`.

### 3.1 Enums

| Enum | Values | Lines |
|---|---|---|
| `CompetitionRule` | `SPECIES_POINTS`, `BIGGEST_FISH`, `SPECIES_VARIETY` | 32-36 |
| `CompetitionMeasure` | `LENGTH`, `WEIGHT` | 63-66 |
| `CompetitionScope` | `PUBLIC`, `GROUP`, `PRIVATE` | 72-80 |
| `CompetitionState` | `DRAFT`, `OPEN`, `CLOSED` | 88-92 |
| `InviteState` | `PENDING`, `ACCEPTED`, `DECLINED` | 82-86 |
| `SizeClass` | `EDIBLE`, `NON_EDIBLE` | 94-97 |
| `WeightSource` | `LENGTH`, `SCALE`, `EYE` | 103-107 |
| `LengthSource` | `EYE`, `TAPE` | 112-115 |
| `NotificationKind` | `FOLLOW`, `COMMENT`, `LIKE`, `INVITE`, `INVITE_ANSWER` | 145-151 |
| `Visibility` | `PRIVATE`, `GROUPS`, `PUBLIC` | 14-18 |
| `GroupRole` | `OWNER`, `ADMIN`, `MEMBER` | 20-24 |
| `GroupJoinMode` | `OPEN`, `INVITE_ONLY`, `CODE` | 26-30 |

Note the TypeScript types in `competitions.service.ts:23-28` and `scoring.ts:34` narrow `WeightSource` to `'LENGTH' | 'SCALE'` and cast the Prisma rows to that shape (`competitions.service.ts:485`, `as CatchRow[]`). A row with `weightSource = 'EYE'` will flow through those functions typed as something it is not. It is harmless in `massKgFor` (the `=== 'SCALE'` test simply fails) but it is a lie the compiler cannot catch.

### 3.2 `Competition` (`competitions` table, schema.prisma:644-685)

| Column | Type | Null? | Meaning when null |
|---|---|---|---|
| `id` | String cuid | no | |
| `name` | String | no | 2 to 120 chars, enforced by zod only |
| `blurb` | VarChar(280) | **yes** | no description written |
| `groupId` | String | **yes** | not a group competition. FK to `Group`, `onDelete: Cascade`, so deleting a group hard-deletes its competitions |
| `createdById` | String | no | the organiser |
| `rule` | `CompetitionRule` | no | default `SPECIES_POINTS` |
| `measure` | `CompetitionMeasure` | no | default `LENGTH` |
| `scope` | `CompetitionScope` | no | **column default is `GROUP`**, but the zod default is `PUBLIC` and `create` always supplies a value, so the column default never applies |
| `speciesId` | String | **yes** | any fish counts. FK `onDelete: SetNull`, so deleting a species silently turns a target-species competition into an open one |
| `startsAt` / `endsAt` | DateTime | no | UTC instants |
| `timeZoneId` | String | no | default `"Africa/Johannesburg"`. Selected and returned to the client, never used by any code on either side |
| `state` | `CompetitionState` | no | column default `DRAFT`; `create` always writes `OPEN`; nothing ever writes `CLOSED` |
| `maxPerSpeciesPerDay` | Int | no | default 3 |
| `createdAt` / `updatedAt` | DateTime | no | |
| `deletedAt` | DateTime | **yes** | not deleted. Every read filters `deletedAt: null`, but **nothing ever writes it**: there is no delete endpoint |

Relations: `entrants CompetitionEntrant[]`, `invites CompetitionInvite[]`, `catches Catch[]` (the unread back-reference), `species Species?`, `group Group?`, `createdBy User`.
Indexes: `[groupId, startsAt desc]`, `[scope, startsAt desc]`. Neither matches the query the list actually runs, which orders by `endsAt desc`.

### 3.3 `CompetitionEntrant` (`competition_entrants`, schema.prisma:788-800)

| Column | Type | Null? | Meaning when null |
|---|---|---|---|
| `id` | String cuid | no | |
| `competitionId` | String | no | FK, `onDelete: Cascade` |
| `userId` | String | no | FK, `onDelete: Cascade` |
| `joinedAt` | DateTime | no | never read by anything |
| `leftAt` | DateTime | **yes** | **still in the competition** |

`@@unique([competitionId, userId])` is what makes `join` and `answerInvite` upsertable. `@@index([userId, leftAt])`.

A leave is a soft leave: `leftAt` is stamped (`competitions.service.ts:416-422`) and rejoining clears it. The row is never deleted, which is why the `_count.entrants` figure described in section 7 is wrong.

### 3.4 `CompetitionInvite` (`competition_invites`, schema.prisma:802-821)

| Column | Type | Null? | Meaning when null |
|---|---|---|---|
| `id` | String cuid | no | |
| `competitionId` | String | no | FK, cascade |
| `userId` | String | no | the invitee, FK cascade, relation name `CompetitionInvitesReceived` |
| `invitedById` | String | no | the organiser, FK cascade, relation `CompetitionInvitesSent` |
| `state` | `InviteState` | no | default `PENDING` |
| `expiresAt` | DateTime | no | set to now + 7 days on every send and re-send |
| `createdAt` | DateTime | no | the list orders by this, desc |
| `answeredAt` | DateTime | **yes** | **not answered yet** (or reset by a re-invite) |

`@@unique([competitionId, userId])`, `@@index([userId, state])`.

### 3.5 Columns on `Catch` the feature touches (schema.prisma:277-395)

`competitionId String?` with `competition Competition? @relation(..., onDelete: SetNull)` at lines 305-306, plus four reader columns at 307-310:

| Column | Type | Null? | Meaning when null |
|---|---|---|---|
| `competitionId` | String | **yes** | not logged for a competition. Written but never read by any board |
| `readMeasure` | Float | **yes** | nothing was read off a photograph |
| `readMeasureUnit` | String | **yes** | one of `cm`, `in`, `kg`, `lb` when present (enforced by zod, not by the column) |
| `readConfidence` | Float | **yes** | 0 to 1 when present |
| `readNote` | VarChar(280) | **yes** | the reader's one-sentence explanation |

None of the four `read*` columns is read back by any server code or displayed on any screen. They are a write-only audit trail.

Also consumed by scoring: `length Float?` (centimetres), `weight Float?` (kilograms), `weightSource WeightSource` (default `LENGTH`), `lengthSource LengthSource` (default `EYE`), `released Boolean` (default false), `caughtAt DateTime`, `speciesId String?`, `visibility Visibility` (default `PUBLIC`), `deletedAt DateTime?`.

### 3.6 `Species` scoring columns (schema.prisma:255-275)

`lwA Float?`, `lwB Float?`, `lwSource String?`, `sizeClass SizeClass @default(EDIBLE)`, `minLegalCm Int?`, `closedFrom String?` (MM-DD), `closedTo String?`, `limitsSource String?`. Null on `lwA`/`lwB` means "no published figures, cannot be converted"; the schema comment says so explicitly. Null `minLegalCm` means no size limit is on record. Null `closedFrom`/`closedTo` means no closed season; `inClosedSeason` returns false if **either** is null (`scoring.ts:79-81`).

### 3.7 `Notification` (`notifications`, schema.prisma:740-756)

`competitionId String?` is carried but is **not a foreign key**, and neither the server nor the client resolves it: `NotificationsPage.tsx` sends every `INVITE` and `INVITE_ANSWER` to the flat `/competitions` route (`:49`, `:55`). `actorId` is nullable with `onDelete: SetNull` so a notification survives its actor's account.

### 3.8 `Group` and `GroupMember` (schema.prisma:609-642)

Only `GroupMember` is read by the competition path, in `join`, to check `{ groupId, userId, leftAt: null }`. Roles are never consulted: an ordinary `MEMBER` has exactly the same competition rights as an `OWNER`.

---

## 4. The API

Eight endpoints, all registered in `routes.ts:217-255`, all behind `requireApiAuth`. The literal-segment routes are deliberately registered before `/:competitionId` (`routes.ts:138` and the comment at `:217-218`).

### `GET /api/competitions`

**Auth:** required. **Query** (`listCompetitionsSchema`, `competition.schema.ts:46-50`): `page` int >= 1 default 1, `size` int 5 to 50 default 20. A query that fails to parse silently falls back to `{ page: 1, size: 20 }` rather than erroring (`competitions.controller.ts:76-77`).

**Response:** `{ competitions: Competition[], total, page, size }`, where each item is the `COMPETITION_SELECT` shape (`competitions.service.ts:47-65`) plus `entrantCount`, `youEntered`, `youOrganise` and a derived `status` of `'upcoming' | 'running' | 'finished'`.

**Errors:** 401 only.

### `GET /api/competitions/invites`

**Auth:** required. No input. **Response:** `{ invites: [{ id, expiresAt, invitedBy: { id, displayName, username }, competition: {...COMPETITION_SELECT, entrantCount} }] }`, `PENDING` and unexpired only, newest first. **Errors:** 401 only.

### `POST /api/competitions/invites/:inviteId`

**Auth:** required. **Body:** read raw, not through zod: `const accept = req.body?.accept === true` (`competitions.controller.ts:51`). Anything that is not the boolean `true` is a decline, including `"true"`, `1` and a missing body.

**Response:** `{ state: 'ACCEPTED' | 'DECLINED' | 'EXPIRED' }`. **Errors:** 400 `invite_id_required`; 404 `invite_not_found` when the invite is not yours, not found, or already answered.

### `GET /api/users/me/followers`

Registered under `/api/users` but served by `competitionsController.myFollowers` because it exists for the invite picker (`routes.ts:230-234`). **Response:** `{ followers: [{ id, displayName, username, avatarUrl }] }`, the 200 most recent people who follow you, newest first. Avatar URLs are **not** signed here, unlike `notifications.service.ts:96`. **Errors:** 401 only.

### `POST /api/competitions/:competitionId/invite`

**Auth:** required. **Body** (`inviteSchema`, `competition.schema.ts:42-44`): `{ userIds: string[] }`, 1 to 100 non-empty trimmed strings.

**Response:** `{ sent: number }`, counting only the ids that were actually followers and not the organiser. **Errors:** 400 `bad_invite` (missing id or bad body); 404 `competition_not_yours`, which is also what you get when the competition exists and is yours but is not `PRIVATE`.

### `POST /api/competitions`

**Auth:** required. **Body** (`createCompetitionSchema`, `competition.schema.ts:10-40`):

| Field | Rule | Default |
|---|---|---|
| `name` | trimmed string, 2 to 120 | required |
| `blurb` | trimmed string 1 to 280, optional, nullable | null |
| `rule` | enum of the three rules | `SPECIES_POINTS` |
| `measure` | `LENGTH` or `WEIGHT` | `LENGTH` |
| `scope` | `PUBLIC`, `GROUP` or `PRIVATE` | `PUBLIC` |
| `inviteeIds` | array of strings, max 100 | `[]` |
| `speciesId` | trimmed string, optional, nullable | null |
| `groupId` | trimmed string, optional, nullable | null |
| `startsAt` | `z.coerce.date()` | required |
| `endsAt` | `z.coerce.date()` | required |
| `maxPerSpeciesPerDay` | int 1 to 20 | 3 |

Two refinements: `endsAt > startsAt` (path `endsAt`) and `scope !== 'GROUP' || groupId` (path `groupId`).

**Response:** 201 `{ competition }`, the raw `COMPETITION_SELECT` shape. Note that this shape carries `_count: { entrants }` and **not** `entrantCount`, `youEntered`, `youOrganise` or `status`, unlike every other competition payload. See section 7.

**Errors:** 400 with `parsed.error.format()` (the zod tree, not a `{ code, message }` object, so it does not match the house error shape); 500 `failed_to_create_competition`, which is what a `speciesId` or `groupId` that does not exist produces, because the service never validates them and the Prisma foreign key throws.

**Side effect:** when `scope === 'PRIVATE'` and `inviteeIds` is non-empty, `create` calls `this.invite(...)` after the competition row exists (`competitions.service.ts:173-175`). This is outside any transaction, so a failing invite leaves a created competition with no invitees, and the failure is swallowed by nothing: it propagates and the whole request 500s after the competition has already been written.

### `GET /api/competitions/:competitionId/standings`

**Auth:** required. **Response:** `{ competition, standings: CompetitionStanding[] }` where a standing is `{ anglerId, displayName, username, total, best, entries, distinctSpecies }`, all metric (centimetres or kilograms, never points). **Errors:** 400 `competition_id_required`; 404 `competition_not_found`, which also covers "this is private and you are not in it".

### `POST /api/competitions/:competitionId/join`

**Auth:** required. No body. **Response:** `{ joined: true }`. **Errors:** 400 `competition_id_required`; 404 `competition_not_open`, deliberately ambiguous so it does not leak whether a private competition exists (`competitions.controller.ts:154-160`).

There is **no window check**. The API will happily add you to a competition that ended last year, or one that has not started. The client hides the button when `status === 'finished'` (`CompetitionsPage.tsx:403`), which is the only thing stopping it.

### `DELETE /api/competitions/:competitionId/join`

**Auth:** required. **Response:** always `{ left: true }`, even for a competition id that does not exist or one you were never in, because the service runs an unconditional `updateMany` (`competitions.service.ts:417-421`). **Errors:** 400 `competition_id_required` only.

### Adjacent endpoints the feature depends on

| Method and path | Auth | Purpose |
|---|---|---|
| `GET /api/competitions/species` | **none** | The species boards. Nothing to do with the `Competition` table; it shares the prefix (`routes.ts:138`) |
| `POST /api/vision/read` | required | `{ imageUrl, measure }` -> `{ reading }`. 400 on a bad body, **503 `reader_off`** when `ANTHROPIC_API_KEY` is unset, 502 `reader_failed` on an upstream error |
| `POST /api/vision/identify` | required | The species namer. 503 `namer_off` when `FISHIAL_URL` is unset |
| `GET /api/species` | none | Populates the "One species only" select on the create form |
| `POST /api/catches`, `PUT /api/catches/:catchId` | required | Accept and persist `competitionId` and the four `read*` columns |

---

## 5. The lifecycle, with the exact code path

**1. Create.**
`NewCompetitionForm.save` (`NewCompetitionForm.tsx:104-137`) -> `createCompetition` (`competitions-api.ts:84-90`) -> `POST /api/competitions` -> `competitionsController.create` (`competitions.controller.ts:87-111`) -> `createCompetitionSchema.safeParse` -> `competitionsService.create` (`competitions.service.ts:147-178`). One `prisma.competition.create` writes the row with `state: 'OPEN'` and a nested `entrants: { create: { userId } }`, so the organiser is an entrant from the first millisecond.

**2. Invite.**
Either inline at creation (`competitions.service.ts:173-175`) or later from the list row's "Invite more" control (`CompetitionsPage.tsx:417-427`) -> `inviteToCompetition` -> `POST /api/competitions/:id/invite` -> `competitionsController.invite` -> `competitionsService.invite` (`:184-223`). Per invitee: an upsert on `CompetitionInvite` keyed by `[competitionId, userId]`, then `notificationsService.notify({ kind: 'INVITE', competitionId, body: competition.name })`.

**3. Accept or decline.**
`CompetitionsPage.answer` (`:109-117`) -> `answerInvite` -> `POST /api/competitions/invites/:inviteId` -> `competitionsService.answerInvite` (`:251-293`). Writes `state` and `answeredAt`, upserts a `CompetitionEntrant` on accept, and notifies the inviter with `kind: 'INVITE_ANSWER'`. The client removes the invite optimistically and, on accept, bumps `attempt` so the list refetches.

**4. Enter (the competition).**
`CompetitionsPage.toggleEntry` (`:119-152`) -> `enterCompetition` / `leaveCompetition` -> `POST` or `DELETE /api/competitions/:id/join` -> `competitionsService.join` (`:369-414`) or `leave` (`:416-422`). The client updates the row optimistically and reverses it on failure.

**5. Enter a catch (optional, cosmetic).**
`LogCatchPage` renders `<CompetitionEntry>` at the end of section 01 (`LogCatchPage.tsx:1260-1310`). Choosing a competition sets `competitionId` in form state; pressing "Read the length off the photo" posts to `/api/vision/read`; a reading of sufficient quality writes the value back into the Length or Weight field and flips `lengthSource` to `TAPE` or `weightSource` to `SCALE` (`LogCatchPage.tsx:817-818`). Saving posts `competitionId`, `readMeasure`, `readMeasureUnit`, `readConfidence` and `readNote` (`:819-827`), which `fishing.service.createCatch` persists at `:828-838` and `updateCatch` at `:1131-1141`.

**None of this affects any standing.** It is a provenance record and a convenience for filling in the measurement field.

**6. Score and standings.**
`CompetitionRow` expands -> `fetchStandings` -> `GET /api/competitions/:id/standings` -> `competitionsController.standings` -> `competitionsService.standings` (`:431-563`), in this order: load the competition (404 if gone); gate PRIVATE; load live entrants; if none, return an empty board; one `prisma.catch.findMany` over all entrants inside the window; `valueOf` per row; bucket by `angler|species|UTC-day` and keep the largest `maxPerSpeciesPerDay`; accumulate `total`, `best`, `entries` and `distinctSpecies` per angler; sort by the rule.

**7. Close.**
There is no close. Nothing writes `state = 'CLOSED'`, there is no scheduled job, no cron, no `close()` function, and no `POST /api/competitions/:id/close`. A competition becomes "finished" purely because `new Date() > endsAt` when somebody reads the list (`competitions.service.ts:356-362`). The `CLOSED` and `DRAFT` enum values are unreachable.

**8. Results.**
The same standings call. When `status === 'finished'` the client prints a winner line above the table: `<name> won it with <figure>` (`CompetitionsPage.tsx:491-501`), taking `standings[0]` with no tie handling. If two anglers are level, one of them is silently declared the winner. No notification, no email and no archive is produced when a competition ends.

---

## 6. The client

### Routes and navigation

`/competitions` -> `CompetitionsPage` and `/boards` -> `BoardsPage`, both lazy (`App.tsx:126-132`, `:169-170`). The desktop header carries `Boards` and `Comps` (`AppHeader.tsx:17-18`). The phone bottom bar has five fixed slots and none of them is competitions, so on a phone the way in is the link at the top of the Boards page: "Competitions anglers are running" (`BoardsPage.tsx:109-116`, with the comment explaining exactly that).

### `CompetitionsPage.tsx`

One screen, no detail route. Composition:

- `CompetitionsScreen` holds `items`, `page`, `total`, `size`, `invites`, `status`, `attempt`, `starting`, `open` (the id of the expanded row) and `units` read once from local storage.
- Infinite scroll via `useLoadOnScroll`; page 1 replaces, later pages append with an id-based dedupe (`:80-89`).
- An invitations block appears above the list when `invites.length`, listing the competition name, who sent it, the dates and the answer-by date, with Accept and Decline (`:186-228`).
- Each `CompetitionRow` shows the name as a disclosure button, the rule sentence plus ", <species> only" when scoped, the dates, a live "N days left" that reticks once a minute while running (`:300-306`, `timeLeft` at `competitions-api.ts:167-176`), an "Invitation only" chip, the blurb, a Running / Not started / Results chip, the entrant count, and an Enter / Entered toggle.
- Expanding fetches the standings once and caches them in row state. There is no refresh, so a board opened and left open goes stale.
- The figure column is chosen by the rule: `best` for biggest fish, `distinctSpecies` for variety, `total` otherwise, and length or mass formatting by `formatMeasure` (`CompetitionsPage.tsx:331-336`, `units.ts:77-85`). The reader's unit preference is applied on the screen; the wire is always metric.
- The organiser of a private, unfinished competition gets an "Invite more" control that opens a multi-select `Picker` of their followers.

### `NewCompetitionForm.tsx`

Local state only, no form library. Fields: name, blurb, starts, ends (both `datetime-local`, converted with `new Date(value).toISOString()` at `:128-129`), measure, rule, scope, invitees, species. Client-side validation is two checks, name length and end-after-start (`:105-112`). On success the parent prepends the returned competition to the list.

**The form cannot set `groupId` or `maxPerSpeciesPerDay`, and the scope choice is only `PUBLIC` or `PRIVATE`** (`:79`, `:200-203`). So every competition created through the UI has `maxPerSpeciesPerDay = 3` and is never a group competition.

### `CompetitionEntry.tsx`

The panel on both catch forms. Behaviour:

- Collapsed to a single "Enter it in a competition" button until pressed.
- On open it calls `fetchCompetitions(signal, 1)` and filters to `c.youEntered && (c.status === 'running' || c.id === competitionId)` (`:69-76`). **Only page 1 is read**, so an angler with more than 20 competitions on their list may not see a running one they are in.
- Picking a competition shows an instruction written for its measure, then a "Read the length/weight off the photo" button, disabled until a photograph exists.
- The reader posts `{ imageUrl, measure }`. A reading is rejected and turned into an error sentence if the value is null, the unit does not match the measure (`cm`/`in` for length, `kg`/`lb` for weight), or confidence is below `SURE_ENOUGH = 0.6` (`:36`, `:99-107`).
- A 503 sets `off`, which replaces the button with: "The photo cannot be read yet. The entry still saves and the organiser checks the picture." That sentence describes a review process that does not exist.
- An accepted reading is converted to the angler's display unit and written into the measurement field by `LogCatchPage`'s `onReading` handler (`LogCatchPage.tsx:1269-1310`), and the field becomes read-only for that measure (`:1150`, `:1171`).

### `BoardsPage.tsx`

Not a competition screen. Two views, "By species" and "Your rivals", both rendered by `StandingsTable` with a shared order-by control (points, weight, longest, bag). Species boards start empty until the reader picks a species from the multi-select (`:193-197`). This is where the SASAA points model is visible to an angler, and it is the only place the phrase "points" appears with a number behind it.

### What the angler sees, step by step

| Step | What is on screen |
|---|---|
| Opens `/competitions` signed out | `RequireSignIn` gate |
| Opens it signed in with nothing running | "No competitions yet. Start one and anyone can enter it." |
| Presses Start one | The form, with dates prefilled now to a week from now |
| After creating | The new row at the top of the list, always chipped "Running" even if it starts next month, and with a blank entrant count |
| Invited | An "You are invited" block above the list with Accept and Decline |
| Enters a public one | The button flips to "Entered" immediately |
| Expands a row | "Counting.", then the table, or "Nobody has entered yet." |
| Logs a catch and picks the competition | The reader panel, with the instruction and the Read button |
| After the end date | Chip reads "Results" and, above the table, "<name> won it with 12.40 kg." |

---

## 7. What is not built, and what is stubbed

### The photo reader is off unless a key is set

`visionService.available()` is `Boolean(process.env.ANTHROPIC_API_KEY)` (`vision.service.ts:61`), and the client is created lazily (`:20-25`). With no key:

- `POST /api/vision/read` returns **503 `reader_off`** with "The photo reader is not switched on for this server." (`vision.controller.ts:29-34`).
- `CompetitionEntry` catches the 503, sets `off`, and shows the "the organiser checks the picture" sentence.
- The catch still saves, with `competitionId` set and all four `read*` columns null.
- Nothing else changes, because no board reads any of it.

The model is `claude-haiku-4-5` (`vision.service.ts:18`), called with a single forced tool `report_reading`. **`ANTHROPIC_API_KEY` is not in `packages/server/.env.example`,** and neither is `FISHIAL_URL` or `FISHIAL_TOKEN`. `docs/redesign/11-queue.md:355-356` lists "Switch the readers on" as the next task, so the feature is written and not yet enabled.

### Not built at all

- **Closing a competition.** No endpoint, no job, no state transition. `CompetitionState.CLOSED` and `.DRAFT` are dead enum values.
- **Deleting or editing a competition.** No `PATCH` or `DELETE`. `Competition.deletedAt` is read on every query and written by nothing. A competition created with the wrong dates is permanent.
- **A competition detail route.** Everything happens inside an expandable list row. There is no shareable URL for a board, which is exactly the feature `research/social.md:719` argues for.
- **Group competitions from the UI.** The scope exists, the join check exists, but `NewCompetitionForm` offers only `PUBLIC` and `PRIVATE`, and a group competition is invisible in `list` to a member who has not already joined it, so there is no discovery path either.
- **The whole evidence model** from `research/social.md:367-414`: `CompetitionEntry` as a table, `EntryConfirmation`, peer confirmation, flagging, admin review, `EntryState`, `photoInApp`, `fixAccuracyM`, `captureLagS`, `exifNote`. None of these tables or columns exists.
- **`CompetitionStanding` as a table.** The research specified a denormalised standings row recomputed on write (`research/social.md:419-439`, and option B at `:147` explicitly rejects computing from catches on read). The code does the opposite and says so in its header comment: "Standings are worked out from the catches themselves every time, never stored." The code is right for correctness; the research is right that it will not scale. Trust the code about what happens today.
- **Frozen scoring inputs.** `research/social.md:365` requires that a catch corrected in March must not rewrite a January result. Because standings are derived live, **editing a catch silently rewrites every finished competition it falls inside, forever.** There is no adjustment line, no audit and no notification. This is the single largest gap between the documents and the code.
- **Rivalry-scoped competitions.** `CompetitionScope.RIVALRY` from the research draft was never added to the enum.
- **Team competitions, leagues, prizes, live standings, catch-and-release scoring, length-only divisions.** None of these exist in any form.
- **Notifications about a competition itself**: started, ending soon, result, lead lost. Only `INVITE` and `INVITE_ANSWER` are written (`notifications.service.ts:4-9`). The two emails the research recommends (`research/social.md:179`) are not implemented; there is no mail provider wired at all (`MAIL_PROVIDER_READY=false`).
- **Tests.** There is no test file anywhere in the repository. `scoring.ts` was specified as "pure functions... no Prisma import, so it is unit-testable" (`research/social.md:635`) and it is pure, and untested.
- **Migrations.** No `prisma/migrations` directory. `HANDOFF.md:205` flags this as "dangerous the moment competition standings are real".

### Documented as deferred

`research/social.md:677`: "open competitions (no verification is possible between strangers), web push, team competitions (SASAA's real shape, but it doubles every scoring path), club season imports." Note that open competitions were deferred and then shipped anyway: `PUBLIC` is the default scope on the create form.

### Where the docs and the code disagree

| Claim in the docs | What the code does |
|---|---|
| `research/social.md:3`, `HANDOFF.md:102`: points awarded per kilogram | Competition boards sum raw cm or kg. Points per kg exist only on `/boards` |
| `research/social.md:198`: `lengthForScoring = floor(L)` | Competitions use the unfloored float |
| `research/social.md:202-204`: qualifying needs minimum mass, no closed season, legal size or released | Competitions apply none of these three |
| `research/social.md:189`: "Competitions are scoped to a group or to a mutual-follow pair. `OPEN` exists in the enum so the shape is right, and the first release does not expose it" | `PUBLIC` is the default and the form's first option |
| `research/social.md:219-223`: four-step tie-break, joint winners stated in words | Competitions have one tie-break that is a no-op for `BIGGEST_FISH`, and never say "joint" |
| `research/social.md:245`: `CompetitionScope { GROUP RIVALRY OPEN }` | `{ PUBLIC GROUP PRIVATE }` |
| `research/social.md:365`: entry values frozen so a correction does not rewrite a past result | Everything is derived live; corrections rewrite past results |
| `research/social.md:511`: `syncEntriesForCatch` called inside the catch transaction | No such function. `Catch.competitionId` is written and never read |
| `research/social.md:743` (open question 4): assumes a catch logged before joining does not count | It counts |
| `05-functionality-gaps.md` | Contains no mention of competitions, boards or scoring at all. It predates the feature and rules on nothing here |
| `11-queue.md:130-133` | Accurate: invitation only with follower invites, a week to accept, time left, results with the winner, paging, and the Haiku reader gated on `ANTHROPIC_API_KEY` |

### Bugs and self-contradictions found while reading

1. **`entrantCount` counts anglers who left.** `COMPETITION_SELECT` uses `_count: { select: { entrants: true } }` (`competitions.service.ts:64`) with no `leftAt` filter, while `standings` and `list`'s `youEntered` both filter `leftAt: null`. A competition everyone has left still advertises its original headcount.
2. **The create response is a different shape from every other competition payload.** `competitionsController.create` returns the raw `COMPETITION_SELECT` object, which has `_count` and lacks `entrantCount`, `youEntered`, `youOrganise` and `status`. `NewCompetitionForm` hands it straight to the list, which then renders a blank entrant count, and `toggleEntry`'s `row.entrantCount + 1` produces `NaN` on that row (`CompetitionsPage.tsx:129`, `176-179`). The client also hardcodes `status: 'running'` for the new row regardless of `startsAt`.
3. **Paging reorders wrongly.** `list` orders by `endsAt desc` in SQL, then sorts the **current page only** by status in JavaScript (`competitions.service.ts:338`, `364-365`). A running competition on page two therefore renders below finished ones from page one, and the list's apparent ordering changes as you scroll.
4. **The daily cap resolves ties in opposite directions in the two implementations.** `competitions.service.ts:510` keeps the largest fish of a day; `scoring.ts:229` keeps the earliest.
5. **The cap's day boundary is UTC, not the competition's `timeZoneId`.** In South Africa that puts the boundary at 02:00 local.
6. **`timeZoneId` is stored, selected, shipped to the client, and used by nothing** on either side, despite existing precisely so "a South African competition that ends on Sunday ends at 23:59 in Africa/Johannesburg" (`schema.prisma:671-674`).
7. **A weight competition trusts an eyeballed weight.** `valueOf` returns `row.weight` without checking `weightSource` (`competitions.service.ts:107-109`), while `massKgFor` only trusts `SCALE`.
8. **Private catches count on competition boards.** No `visibility` filter, unlike the group boards which filter and report the exclusion.
9. **A group competition's standings are readable by anyone signed in.** Only `PRIVATE` is gated in `standings` (`:442`).
10. **An expired invite is never marked.** `answerInvite` returns `EXPIRED` without writing the row (`:263-265`), so it stays `PENDING` and keeps satisfying the `list` visibility clause forever.
11. **`leave` cannot fail.** `updateMany` plus an unconditional `{ left: true }` means a caller cannot tell a successful leave from a nonexistent competition.
12. **`join` ignores the window.** The API will enter you into a competition that ended months ago.
13. **Catches with no species share one bucket and inflate `SPECIES_VARIETY`.** `row.speciesId ?? 'none'` is treated as a species in `distinctSpecies` (`:515`, `:540-543`).
14. **`progress.service.ts` awards 50 points per competition entered and never checks `leftAt`**: `prisma.competitionEntrant.count({ where: { userId } })` (`:162-164`, `WORTH.competition = 50` at `:49`). Join, collect, leave, repeat, and the rank keeps rising. It is also blind to whether the competition was public, private, real or finished.
15. **`isJoint` and `buildStandingsForSpecies` in `scoring.ts` are exported and never imported.**
16. **`MAX_ENTRIES_PER_SPECIES_PER_DAY = 3` in `scoring.ts:212` is a second, unrelated hard-coded cap** that the `Competition.maxPerSpeciesPerDay` column does not influence. The Boards always cap at 3.
17. **`create` is not transactional across the invite step.** A competition can exist with none of its intended invitees and the request still 500s.
18. **`speciesId` and `groupId` are never validated** before the insert, so a bad id surfaces as a 500 rather than a 400.
19. **`POST /api/competitions` returns a raw zod tree on a 400**, not the `{ code, message }` shape every other error in the codebase uses.
20. **The "the organiser checks the picture" sentence in `CompetitionEntry.tsx:199-202` describes a review process that does not exist.** There is no organiser review surface anywhere.

---

## 8. Where to extend

Each entry names the seam, the files, and what in the current design will fight you.

### Freeze the score (do this before anything else)

**Why first:** every extension below is harder while a January result can be rewritten in March, and the moment there is a prize this becomes the product's first real dispute.

**Touch:** add a `CompetitionEntry` model to `schema.prisma` alongside `CompetitionEntrant` (the research's version is at `research/social.md:367-402` and is a good starting point); add `syncEntriesForCatch(tx, catchRecord)` to `competitions.service.ts` and call it from inside the existing `prisma.$transaction` in `fishing.service.createCatch` (`:813`), `updateCatch` (`:1094`) and `deleteCatch` (`:1172`); rewrite `standings` to read entries rather than catches.

**What fights you:** the standings function is built around "derive everything, store nothing" and its file header defends that choice at `competitions.service.ts:13-16`. Changing it means the `Catch.competitionId` column finally has to mean something, and you have to decide what happens to the catches already in flight that carry it. Also: no migrations directory, so this schema change needs `prisma migrate` adopted first.

### Close and results

**Touch:** a `close(competitionId)` in `competitions.service.ts` that writes `state = 'CLOSED'` and snapshots the final table, plus `POST /api/competitions/:id/close` in `routes.ts` and a controller method. A scheduled sweep is the alternative, and the codebase currently has no job runner of any kind.

**What fights you:** `list` already derives `status` from the clock and the client renders from that, so `state` and `status` would become two sources of truth that can disagree. Pick one and delete the other. `CompetitionState.DRAFT` should probably go at the same time.

### Live standings

**Touch:** `CompetitionRow`'s standings effect (`CompetitionsPage.tsx:320-328`) caches forever. The cheapest version is polling on the same pattern as `NotificationBell` (45 s). A real version needs the frozen-entry work above, otherwise every poll is a full catch scan per entrant.

**What fights you:** the standings query is `O(entrants x catches in window)` with no index on `[createdById, caughtAt]` scoped to a competition. There is an index `@@index([createdById, caughtAt(sort: Desc)])` on `Catch` (`schema.prisma:393`) that helps, but the scan still widens with every entrant.

### Team competitions

**Touch:** a `CompetitionTeam` model and a `teamId` on `CompetitionEntrant`; `standings` would need a second aggregation pass after the per-angler one (`competitions.service.ts:520-548`); the client's `figureOf` and the table in `CompetitionsPage.tsx:502-536` would need a team column.

**What fights you:** the per-species-per-day cap is applied per angler (`competitions.service.ts:501`), and SASAA's team rules cap per team. You have to decide which, and the answer changes the shape of `perDay`. `research/social.md:677` deferred this on exactly this ground: "it doubles every scoring path".

### Leagues (a competition of competitions)

**Touch:** a `League` model with `competitions Competition[]`, a `leagueId String?` on `Competition`, and a new service function that sums or ranks finished competition results.

**What fights you:** there are no finished competition results to sum, because nothing is stored. A league is the clearest argument for doing the freeze work first. Also `Competition` already carries a nullable `groupId` and a nullable `speciesId` and a nullable `leagueId` would make three mutually-interacting optional scopes on one row.

### Prizes

**Touch:** a `prize` field on `Competition` (text is enough for v1), rendered in `CompetitionRow` next to the blurb, and named in the winner line at `CompetitionsPage.tsx:491-501`.

**What fights you:** the moment a prize exists, the missing evidence model becomes the story. `research/social.md:683` calls moderation "the cost of the feature", and today there is no flag, no review, no exclusion and no audit trail. Also, the winner line takes `standings[0]` with no tie handling: fix `standings`'s tie-break before anything is won.

### Catch-and-release scoring

**Touch:** `valueOf` (`competitions.service.ts:102-144`) is the only place a fish's worth is decided; add `released` to the standings `select` at `:474-484` and to `CatchRow` at `:67-81`. A `releaseBonus` column on `Competition` would make it a per-competition rule.

**What fights you:** almost nothing. This is the cleanest extension point in the feature: one pure function, one select list. Note that `scoring.ts:166-179` already has a different opinion about `released` (it gates an undersized fish), so decide whether the two paths should finally agree.

### Length-only divisions, and per-species boards inside a competition

**Touch:** `standings` already groups by species in its cap map (`competitions.service.ts:501`); the grouping is thrown away at `:507-518`. Keeping it and returning `SpeciesBoard[]` alongside the flat table is a small change. `scoring.ts:343-406` (`buildSpeciesBoards`) is a working model for the shape, and `StandingsTable.tsx` already renders that shape on the Boards page.

**What fights you:** `CompetitionMeasure` is one value per competition, so "length division and weight division in the same competition" needs either two competitions or a new `divisions` concept. The `rule`/`measure` split was designed for exactly two axes and a third does not fit.

### Better invitations

**Touch:** `INVITE_DAYS` (`competitions.service.ts:45`) is the only knob; making it per-competition means a column. The follower-only restriction is one query at `:191-194`. An invite-by-link would need a `token` column on `CompetitionInvite`, as the research drafted for `GroupInvite` (`research/social.md:313-325`).

**What fights you:** the follower-only rule is load-bearing for the anti-spam claim in the comment at `:180-183`. Relaxing it to a link needs a rate limit that does not exist. And `answerInvite`'s expired branch leaves rows `PENDING`, so add the state write before building anything on top.

### Switching the photo reader on

**Touch:** set `ANTHROPIC_API_KEY` on the server. Add it, `FISHIAL_URL` and `FISHIAL_TOKEN` to `packages/server/.env.example`, which currently documents none of them.

**What fights you:** the reader writes four columns nothing reads. If the intent is that a read figure is more trustworthy than a typed one, something has to consult `readConfidence` when scoring, and today `valueOf` cannot see it. Also `CompetitionEntry` only fetches page 1 of the competitions list (`:61`), so fix that before anyone has more than 20 competitions in view.
