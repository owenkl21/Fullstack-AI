# Brief for Claude Design: rework the log, the feed card and competitions

Paste everything below this line into Claude Design. The screenshots to drag
in with it are in `docs/redesign/brief-pages/` (current state, phone at 390
and desktop at 1440, day theme). Redesign in preserve mode: the look is
decided, the pages are not.

---

You are reworking pages of **Fishtagram**, a fishing log for South African
rock, surf and dam anglers, used on a phone on the water and on a desktop at
home. An angler taps Log, and the app stamps the minute, the position and the
conditions before the sheet has finished opening. Around that sit a feed, spots
on a satellite map, gear, profiles, and competitions between mates. The fish
in a photo is named by a model on the owner's own machine; the angler confirms
the name, never the other way round.

The current pages work but look assembled rather than designed: too many
labels, too much explaining, controls that wrap, metadata strung together.
The owner's words: cluttered, and it looks like AI slop. Your job is calm,
confident pages in the existing language, with nothing on them that is not
doing work.

## The look, which is fixed

Do not propose a palette, a typeface or a radius. Use exactly these.

- **Display: League Gothic**, always uppercase, letter-spacing 0.02em large and
  0.06 to 0.08em on nav words and buttons, line-height 0.95. Big numbers
  (readouts, measurements, the clock) are League Gothic too.
- **Body: Jost** 400/500/600. 16px/1.6 reading, 15 in cards, 14 helper text.
  Labels are 11 to 13px uppercase, tracked 0.14 to 0.18em, and are the only
  small type. Nothing else below 14px. No third family, no serif, no mono.
- **Colour, day:** bg `#FFFFFF`, bg-2 `#F4F4F2`, ink `#0B0909`, ink-2
  `#4E4A46`, ink-3 `#8A8580`, hairline `rgba(11,9,9,.14)`, teal `#34ADBD`,
  teal as text `#17727F`, always-black blocks `#0B0909` / `#151212` with paper
  text `#F4F1EC` / `#B9B3AC`. **Night:** bg `#0B0909`, bg-2 `#151212`, ink
  `#F4F1EC`, ink-2 `#B9B3AC`, ink-3 `#7E7873`, teal as text `#5FC6D3`. The
  header, the bottom bar and the black cards stay black in both themes.
- **Teal is rationed.** It is the one primary action, thin rules under labels,
  dashed lines (input underlines, the fishing line), the corner tab on a black
  card, the active word in the bottom bar, and teal-as-text for the one link
  that matters in a block. Never a wash, a hover fill, a border on everything.
- **Radius 0 everywhere.** Icon-only controls (theme switch, close) are circles.
  No shadows on flat UI, no blur, no gradients except a scrim over a photograph.
- **The signature moves:** photographs full bleed with a scrim and League
  Gothic over them; the painted torn edge between a photo or black band and
  the page (the "waterline"); the dashed teal line; contour line art on the
  black plate behind page titles; black blocks with a teal corner tab; dashed
  underlines on inputs that go solid on focus; big League Gothic numerals with
  a unit chip for measurements.
- **Icons:** Heroicons outline only, 1.5 stroke, and only where a word would
  not fit. Never beside a word on a button or a heading.
- **Motion** answers the person: 150ms state, 300ms reveal, 500ms position,
  `cubic-bezier(.4,0,.2,1)`. Nothing idles or pulses. Reduced motion respected.
- **Copy:** plain South African English, sentence case, short. No em dashes.
  One middle dot at most in a metadata line. No exclamation marks. Labels name
  fields and readouts only, never sentences. One label per intent across a page
  ("Log", "Save catch", "Start one").

## The pages to rework, and what each must carry

Everything listed exists today and must survive. Reorder, group, hide behind
a tap, resize, but do not remove a capability. Phone first at 390px, then
desktop at 1440px as its own composition, not a stretched phone.

### 1. Log a catch, the quick log (`/log`)

Three phone steps today: the catch, size and gear, sharing. Desktop is one
card in two columns with a sticky Save. Must carry:

- Photo (the hero of the log): take or choose, change, remove. The picture is
  cropped to a 4:3 frame for the feed with a drag-to-place when it does not fit.
- The namer: while it looks, a quiet "Naming the fish" state; then its two best
  names with a confidence each, one tap to take a name, and a way to say
  neither and type. A name the table does not know is offered too and becomes a
  species when taken. This block must never wrap into a ragged row.
- Species: search or add.
- Caught at: the stamped time and where it came from ("From the photograph",
  "When you tapped Log"), editable.
- Where: a small map with the pin on whatever is known, and one line saying
  which: "Phone fix, within 12 m", "From the photograph", "Pinned by you". The
  pin drags; search, locate and base switch live on the map. A photograph's own
  GPS moves the pin off the phone's fix; a pin placed by hand stands and the
  photograph's place is offered beside it. A photo with no position says so.
- Filed under a nearby spot (within 600 m) with "Not this spot", or "Add this
  as a spot" with a name and private/public.
- Conditions at the hour, one line: wind, pressure, air. The time in its label.
- Length and weight with unit and how measured (by eye, on a tape, on a scale).
- Kept or released. Gear and bait pickers, add a piece of gear, notes.
- Sharing: seen by everyone or only me; exact spot hidden or shown; one
  sentence stating what will be published.
- Save catch; Save draft; close. In competition mode (opened from a
  competition) a banner names the competition, a second photo block asks for
  the fish on the tape or scale, the relevant figure is required, a sentence
  about the area must be ticked, and the button reads "Submit and update
  standings" or "Submit for review".

### 2. Log a catch, the full form (`/catches/new`)

The long form: several photos, species, length, weight, kept or released, how
many, depth and water temperature under More, enter it in a competition; Where
as three choices (the spot I am at, a saved spot, a new spot) with the map;
When; gear by kind with a search, bait, notes; conditions at that hour with a
refresh; who sees this; show the spot or keep it to myself. It reads as a wall
today. Group it, fold what is rare, and give it the same calm as the quick log
without losing a field.

### 3. The feed card (`/`)

A black card with a teal corner tab: the angler (avatar, name, handle), the
4:3 photo, the species as the heading, its size straight under, where and when
as one line ("Caught at Mimosa OD, Fri 18 Sept, 17:47 · 21 h ago"), the
angler's own title when it says more, notes, then like, comment, keep and
follow, with counts. Comments open inside the card and load four at a time.
Keep the card; make the hierarchy and the action row deliberate.

### 4. Competitions: the list (`/competitions`), a competition
(`/competitions/:id`), starting one (`/competitions/new`)

- List: "Run a session with your fishing mates" with Start one; tabs All,
  Mine, Invites; cards with status (Running, Upcoming, Results) and scope
  (Open to all, Invite only), the name, the rule in words ("Biggest single fish
  by weight"), where and when, the leading catch, "6 anglers", one action
  (Enter, Entered · View, Accept invite, View results).
- A competition: rules and area, actions (Submit a catch, Enter, Invite,
  Leave), provisional standings or the winner, and the entries with their
  state (Counted, Awaiting review, Not counted), each opening to six check
  lines (fish in the photo, species, figure, window, area, not entered twice)
  and the tape or scale photo. The organiser accepts or excludes; an entrant
  can flag with a reason.
- Starting one: five steps (the competition, rules and area, who can enter and
  entry checks, invite followers, one last look) or fewer if you can fold them
  honestly.

## What is wrong now, so you do not repeat it

- Explanatory sentences under controls ("Optional. You can add one later",
  "Drag the pin to move it", "You can put the phone away now"). Say it once or
  not at all.
- Rows of chips that wrap unevenly on a phone. Use rows or a grid.
- Three or four facts strung with middle dots. One dot, or two lines.
- Section numbers on things that are not steps.
- Labels above things that explain themselves.
- Everything the same weight. Choose the one thing on each screen.

## What I need from you

For each page: the phone frame at 390 wide (every step, every state that
changes the layout: empty, filled, the namer asking, the namer's names, a held
entry, results), and the desktop frame at 1440. Day theme first, then night
for the quick log and the feed card. Name the components you use so they can
be mapped to the code (PageHead, PhotoBlock, MeasureField, Segment, Picker,
Fold, MapLocationPicker, SpeciesGuess, CompetitionEntryFields).

Show your work as frames, not prose. Where you drop or fold a field, say so in
one line beside the frame.
