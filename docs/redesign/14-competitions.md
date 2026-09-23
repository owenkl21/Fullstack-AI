# Competitions: the flow, with verification (19 September 2026)

Owen brought a prototype of the competition flow he wants
(fisherfeed-competitions.brandondarker.chatgpt.site, a single page whose other
screens live in its bundle). This document is that flow rebuilt in this
product's own language and look, with the AI verification the prototype left
out ("AI verification is not active in this prototype") worked in. The eight
decisions below were put to Owen and are his.

## The decisions

| Question | Owen's answer |
|---|---|
| Which engine reads the tape or scale and checks the species | Claude Haiku 4.5 reads the figure (the reader already written, needs `ANTHROPIC_API_KEY` on Railway). The fish namer on the hub checks the species. |
| Does an entry count when the checks pass | Yes: counted straight away when every check passes; **any flag holds it** as Awaiting review for the organiser. The organiser can exclude a counted entry. |
| What photo an entry carries | **Two photos**: a hero photo for the board and a photo of the fish on the tape or scale for the reader. Most-species competitions need only the hero. |
| How the area is checked | The catch's own position against the waterbody or province when there is one; the exact spot is never shown. No position: the angler confirms the area, and that is noted. |
| Which checks hold an entry | Species disagrees; figure does not match or cannot be read; photo outside the window or the area; duplicate fish. |
| Whose figure goes on the board | **The reader's**, when it could read one. The angler's typed figure is kept beside it. |
| Where a catch is entered | Both: **Submit a catch** on the competition page (opens the log preset for it), and a running competition offered from the log. |
| Can entrants flag an entry | Yes: one tap with a reason holds it for the organiser. |

Standing rules: the font and the theme do not change; no em dashes in
anything a reader sees; mobile first, desktop deliberate.

## The flow, screen by screen

Copy in quotes is the prototype's where it fits this product; the rest is ours.

### 1. `/competitions`, the list

Page head: **Competitions**. "Run a session with your fishing mates." and a
**Start one** button. Tabs: **All competitions**, **Mine**, **Invites** with a
count. Each competition is a card:

- Status chip: **Running**, **Upcoming**, **Results**. Scope chip: **Open to
  all**, **Invite only**.
- Name, then the rule in words ("Biggest single fish by weight", "Total
  length", "Most different species"), the area ("Vaal River", "Western Cape",
  "Anywhere in South Africa"), the dates ("25 Sept to 27 Sept").
- **Leading catch**: angler and figure, when there is a counted entry.
- "6 anglers", **You organise** when it is yours.
- One action: **Enter** (open, not entered), **Entered · View**, **Accept
  invite** with **Decline invitation** beside it, **View results** (finished).

Footer line: "Your exact fishing spot is never shown on these boards."

### 2. `/competitions/new`, starting one

A stepped form on one route, a step bar under the title, Back and Continue
in the footer, the phone pattern the catch form already uses.

1. **Choose your competition**: name (at least 2 characters), a line about
   it, **Judged on** (Weight "from a scale" or Length "from a tape"), the
   rule: **Biggest fish** "Your single best fish decides your position.",
   **Total** "Add up the best 3 fish per species, per day.", **Most species**
   "Each identified species counts once. No measurement required." **Eligible
   species**: Any species, or one. A most-species competition needs Any
   species. **Keep it simple** jumps to the last look with the defaults.
2. **Rules and area**: **Where**: Anywhere in South Africa, a **Waterbody**
   (place search, the one the map and forecast use, with how far from it
   still counts, 25 km by default), or a **Region or province**. Start and
   end in SAST; the end must be after the start and after now.
3. **Who can enter**: **Anyone** ("Any signed-in angler can enter") or
   **Invite followers** (invitation only). **Entry checks**: **Casual**
   ("Photo and the reading. Entries count as soon as the checks pass.") or
   **Organiser review** ("New entries wait for you to accept them before
   they affect the standings."). Under both: "Every entry is checked: the
   fish is named from the photo, the figure is read off the tape or scale,
   the time and the area are checked, and the same fish cannot be entered
   twice. Anything that does not add up waits for the organiser."
4. **Invite your followers** (invitation only): the follower list with a
   toggle each.
5. **One last look**: the summary, then **Create competition**.

### 3. `/competitions/:id`, the competition

Head: name, the two chips, the dates and **time left** or **Ends** or
**Results**. **The rules and area** as a short block. Actions by state:
**Submit a catch**, **Enter competition**, **Accept invitation** and
**Decline**, **Invite** (organiser, invite only), **Leave**.

**Standings**: "Provisional standings · Equal scores share a place." while
running; **Winner** or **Joint winners** with the figure once finished. A
row: place, angler, species of the best catch, the score. Then **Entries**,
newest first: hero photo, angler, species, the figure, when, the note, the
state chip (**Counted**, **Awaiting review**, **Not counted**), and
"Waterbody shown; exact spot hidden." Opening an entry shows the checks, one
line each with a tick, a flag or "not checked", and the photo of the fish on
the tape or scale. The organiser sees **Accept entry** and **Exclude** on
every entry; an entrant sees **Not right?** which asks for a reason and holds
the entry. A held entry says who flagged it and why.

### 4. Submit a catch

**Submit a catch** opens `/log?competition=<id>`: the quick log with a
banner ("Entering Vaal weekend · judged on weight from a scale"), the hero
photo, a second photo block **The fish on the scale, figure readable**
(required unless most-species), species (locked to the target species when
there is one), the required measurement with its unit, when, the note, and
the sentence to tick: "I confirm this catch was made in the eligible area and
share this entry with the competition. My exact spot stays private." The
button reads **Submit and update standings** (casual) or **Submit for
review**. Saving writes the catch as it always does, then the entry, then
returns to the competition with "Catch submitted. Standings updated." or
"Catch submitted for organiser review." The entry shows **Checking** until
the checks finish (a few seconds; the page polls it).

The full catch form keeps its competition panel, rebuilt on the same fields:
pick a running competition you are in, add the tape or scale photo, tick the
sentence; the entry is written after the catch.

## Verification: what is checked, and by what

Each entry carries a report of six checks. **Pass on all, and it counts. Any
flag, and it is held.** A check that could not run (the reader has no key,
the hub is off) is recorded as **not checked** and counts as a flag on the
two checks that matter most, species and figure, so nothing counts unseen.

| Check | How | Flag when |
|---|---|---|
| **Fish in the photo** | The hub namer's detector on the tape or scale photo (the hero photo for most-species) | No fish found |
| **Species** | The namer's two best names, learned ones included, against the species on the catch; against the competition's target species when it has one | The namer is at least 50% sure of a different fish and neither of its names is the declared one; or the declared species is not the target |
| **Figure** | Claude Haiku reads the tape or scale; inches and pounds are converted | No tape or scale seen, under 60% sure, or the reading differs from the typed figure by more than 5% (and more than 1 cm or 0.1 kg) |
| **Window** | The catch's time, and the photo's own timestamp when the phone wrote one, against the competition dates; the submission time against the end | Outside the dates (an hour's grace on the photo time); submitted more than a day after the end |
| **Area** | Anywhere: always passes. Waterbody: the catch position within the radius of the place. Province: the position reverse geocoded and the province compared. No position: the ticked sentence, noted as unconfirmed | Outside the radius or province; no position and the sentence not ticked |
| **Duplicate** | The same stored photo in another entry of this competition; or the fish's embedding (from the namer) at least 0.93 cosine to another entry's fish, any angler | Either |

The board uses the reader's figure when it read one, else the typed one.
Entries are frozen at submission: editing the catch later does not move a
result (the biggest gap the competitions review found). Deleting the catch
excludes its entries.

## Data

New on `Competition`: `areaType` (ANYWHERE, WATERBODY, REGION), `areaName`,
`areaLatitude`, `areaLongitude`, `areaRadiusKm`, `checks` (CASUAL, REVIEW).

New `CompetitionEntry`: competition, catch, angler; `state` (PENDING,
COUNTED, HELD, EXCLUDED); `measure`; frozen `speciesId`, `speciesName`,
`declaredValue`, `readValue`, `readConfidence`, `readNote`, `value` (what the
board uses), `caughtAt`, `latitude`, `longitude` (never sent to a client),
`areaConfirmed`, `photoTakenAt`, `heroImageKey`, `heroImageUrl`,
`measureImageKey`, `measureImageUrl`, `note`, `fingerprint` (the embedding),
`report` and `flags`, `flaggedById`, `flagReason`, `flaggedAt`,
`reviewedById`, `reviewedAt`, `reviewNote`. One entry per catch per
competition. Reaches the database through the existing `prisma db push`
pre-deploy; nothing is dropped.

## API

Everything under `requireApiAuth`.

- `GET /api/competitions?page&tab=all|mine|invites` returns
  `{ competitions, total, page, size }`. A competition:
  `{ id, name, blurb, rule, measure, scope, checks, areaType, areaName,
  startsAt, endsAt, timeZoneId, maxPerSpeciesPerDay, speciesId, species,
  createdBy, entrantCount, entryCount, youEntered, youOrganise, status
  ('upcoming'|'running'|'finished'), leading: { displayName, value,
  speciesName } | null, invite: { id, expiresAt } | null }`.
- `POST /api/competitions` takes the create form (`areaType, areaName,
  areaLatitude, areaLongitude, areaRadiusKm, checks` added) and returns
  `{ competition }` in the same shape as the list.
- `GET /api/competitions/:id` returns `{ competition, standings, entries,
  you: { entered, organise, invite } }`.
  A standing: `{ place, joint, anglerId, displayName, username, score,
  bestValue, bestSpeciesName, entries, distinctSpecies }`.
  An entry: `{ id, anglerId, displayName, username, speciesName, value,
  declaredValue, readValue, readConfidence, state, flags, report, caughtAt,
  note, heroUrl, measureUrl, areaConfirmed, flaggedBy, flagReason,
  reviewNote, yours, canReview, canFlag, createdAt }`.
  A report line: `{ code: 'fish'|'species'|'figure'|'window'|'area'|'duplicate',
  status: 'pass'|'flag'|'skip', detail }`.
- `POST /api/competitions/:id/entries` with `{ catchId, measureImage:
  { storageKey, url } | null, declaredValue, areaConfirmed, photoTakenAt,
  note }` returns `{ entry }` in state PENDING; the checks run after the
  response. `GET /api/competitions/:id/entries/:entryId` returns `{ entry }`
  for polling. `DELETE` withdraws your own.
- `POST /api/competitions/:id/entries/:entryId/review` with `{ action:
  'accept'|'exclude', note }`, organiser only.
- `POST /api/competitions/:id/entries/:entryId/flag` with `{ reason }`,
  any entrant, holds the entry.
- Unchanged: join, leave, invite, invites, answer invite, followers.
- Hub: `POST /identify` takes `returnEmbedding: true` and adds `embedding`.

## Where it stands (19 September 2026, evening)

Shipped and checked on the live deploy, phone and desktop, with the test
account (`audit/comps.mjs` takes the screenshots): the list with its tabs,
starting one in five steps, the competition page with provisional standings,
the entries and their six checks, accept and exclude, "Not right?", and the
quick log in competition mode with both photos and the sentence to tick. The
server side ran end to end: an entry with the namer agreeing on the species,
held as unverified because the reader has no key, accepted onto the board,
then excluded. A private "Namer test (ignore)" competition on the test
account is left over; there is no delete for a competition yet.

**Still needs Owen:** `ANTHROPIC_API_KEY` on the Railway `server` service.
Until it is set the figure check is "not checked" and every entry in a
weight or length competition is held for the organiser.

## Order of work

1. Schema and server: the entry model, submit and verify, standings from
   entries, the four new routes, the list and create shapes.
2. Hub: the embedding on identify.
3. Client: list, new, detail, submit from the quick log, the full form's
   panel, review and flag.
4. Railway: `ANTHROPIC_API_KEY` on the server service (Owen).
5. Test on the live app with the test account: start one, submit with two
   photos, read the report, accept and exclude, flag, results.
