# Redesign brief: the fishing log

You are redesigning and rebuilding the client of a fishing log web app so that it is premium out of the box, mobile first, in day and night modes, with motion, and with none of the tells of generated design. This document is the whole brief. Read it in order. The appendices at the end carry the evidence: the measured reference, the prototype source, the functionality gap list, the surface digests, the slop inventory, the UX problems and every copy string in the current build.

## 0. How to work

1. Read sections 1 to 4 before touching code. Section 3 is the visual language and it is not negotiable; section 4 is the prototype that shows it working.
2. Open the prototype (appendix G, `prototype/index.html`) in a browser at 375px and 1440px, in both themes, and tap Log inside the phone. That is the bar for feel and motion. Match it, then exceed it.
3. Build in the existing stack: React 19, Vite, Tailwind CSS v4, shadcn/Radix primitives, react-router 7, Clerk. Restyle the primitives through the tokens in `src/index.css`; do not fork them. Frontend talks to the existing REST API; where a feature needs API or schema work, appendix E says which and in what order.
4. Work surface by surface in the order of section 6. After each surface, screenshot it at 375, 768 and 1440 in both themes and check it against section 9. Do not move on with a failed check.
5. Never invent a product name, a user count, a rating or a testimonial. The wordmark reads `Name` until a name is supplied. Sample data is fine inside the app and must be South African (kob, galjoen, garrick, elf, yellowtail, steenbras; Kalk Bay, Strandfontein, Kogel Bay, Rooi-Els, Muizenberg, Buffels Bay, Theewaterskloof, Lakenvlei).
6. No em dashes anywhere a person reads. No exclamation marks in system messages. No vendor or stack words in the interface (no R2, Clerk, MIME types, enum values, database ids).

## 1. The product

A personal fishing log with a light social layer, used on a phone on the water and on a desktop at home. First users are anglers in South Africa. It stores catches (species, length and weight in both systems, photos, time, place, gear, a conditions snapshot), spots (name, pin, water type, access notes, photos, history), gear, trips (a session at a spot, with or without fish), a feed, and profiles with following. Every value on a record says in words where it came from (`4.2 kg (9 lb 4 oz) by eye`), so a shared link needs no legend.

What exists today is a working but unstyled scaffold: stock shadcn, a blue and teal palette, glass headers, a floating dock, walls of cards, a bobbing loader, placeholder marketing copy with fabricated stats, and about 270 usability faults (appendix C). Fourteen routes: `/`, `/profile`, `/catches/new`, `/catches/me`, `/catches/:id`, `/catches/:id/edit`, `/sites/new`, `/sites/me`, `/sites/:id`, `/sites/:id/edit`, `/gear/new`, `/gear/me`, `/gear/:id/edit`, `/feed`. The URL vocabulary stays; the user-facing words change (section 7).

## 2. What the owner asked for, in his words and ours

- "Premium out of the box, no AI slop, outdoor fishing log." Premium comes from photography, motion and precision, not from cards and gradients.
- "Mobile first is a big thing." Design the 375px column first; the desktop is the phone layout with room added. Every interactive element is at least 48px on its short axis with 8px between targets.
- "I want a light and dark mode." Day and night, both designed, neither an inversion of the other. Night is for 5am on the rocks.
- "Don't like the wording light and dark for a toggle." The theme switch is a sun and moon icon button with an accessible label (`Switch to night`, `Switch to day`). No text label.
- "Use Heroicons." Heroicons outline, 24px grid, 1.5 stroke, `currentColor`. Nothing hand-drawn except the wordmark's fish, no emoji, no other icon set.
- "I like the animations and the lines like mountain and water stuff from cotwtheangler.com." That site is the reference, measured in appendix A. Take its mechanisms (below), never its scenes, logo or copy.
- Motion and creativity are required. A page with no motion fails the brief.

## 3. The visual language

Derived from the reference (appendix A) and proven in the prototype (appendix G). Copy these values exactly.

### 3.1 Colour

Two chassis, one accent. The accent is rationed.

| Token | Day | Night |
|---|---|---|
| `--bg` | `#FFFFFF` | `#0B0909` |
| `--bg-2` (secondary surface) | `#F4F4F2` | `#151212` |
| `--ink` (text) | `#0B0909` | `#F4F1EC` |
| `--ink-2` (secondary text) | `#4E4A46` | `#B9B3AC` |
| `--ink-3` (labels, faint) | `#8A8580` | `#7E7873` |
| `--line` (hairlines) | `rgba(11,9,9,0.14)` | `rgba(244,241,236,0.14)` |
| `--contour` (line art) | `rgba(11,9,9,0.16)` | `rgba(244,241,236,0.13)` |
| `--teal` (the accent) | `#34ADBD` | `#34ADBD` |
| `--teal-ink` (text on teal) | `#062A2F` | `#062A2F` |
| `--teal-text` (teal as text) | `#17727F` | `#5FC6D3` |
| `--black`, `--black-2` (always-dark blocks) | `#0B0909`, `#151212` | same |
| `--paper`, `--paper-2` (text on always-dark) | `#F4F1EC`, `#B9B3AC` | same |

Rules:
- The header, the bottom bar, feature cards, the record card and the signup box are always black (`--black`), in both themes, like the reference. Everything else follows the theme.
- Teal appears only as: the one primary action's fill, thin rules under labels, dashed lines (the fishing line, dividers, input underlines, measurement rules), corner tabs on black cards, the active indicator in the bottom bar, teal-as-text for the one link that matters in a block, and the full-bleed band behind the signup moment. Never as a background wash, a hover fill, a border on everything, or a gradient.
- Gradients exist only as scrims over photographs (dark to transparent) so text can sit on a photo. No gradient on any surface.
- No `backdrop-filter`. No box shadows except the one under the device frame on desktop. Depth is the black block on the page, the hairline, and the photograph.
- Contrast: body text at least 7:1 on its ground in both themes; labels at least 4.5:1; teal text uses `--teal-text`, never `--teal`, on light grounds.
- Theme mechanics: tokens on `:root` (day), redefined under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. Write the theme pre-paint from `localStorage` in an inline script so night users never see a white flash. `color-scheme` follows the theme. Pass the tokens into Clerk's `appearance` prop.

### 3.2 Type

Two families, both SIL OFL from Google Fonts, self-hosted as woff2 with a metrics-matched fallback stack.

- Display: **League Gothic**, always uppercase, letter-spacing 0.02em on large sizes and 0.06 to 0.08em on nav words and buttons, line-height 0.95. Sizes: 128/96/72 (hero, fluid with `clamp`), 84 to 44 (section headings), 64 (record title on a phone), 46 to 30 (card and block headings), 22 to 18 (nav, buttons, chips, row titles). The big numbers in the app (readouts, measurements, the clock) are League Gothic too: 48, 40, 36, 32, 24.
- Body and labels: **Jost** 400/500/600 at 16px/1.6 for reading, 15 for card paragraphs, 14 for helper text, and 13, 12, 11px letter-spaced (0.14 to 0.18em) uppercase for labels. Labels are the only small type; nothing else drops below 14px.
- Numerals: `font-variant-numeric: tabular-nums` on every number that sits in a column or changes live.
- No third family, no serif, no monospace. Tracked uppercase labels are a feature of this language (the reference uses them), so use them for labels only, never for sentences.

### 3.3 The moves that make it this product, not a template

Each is measured on the reference or built in the prototype.

1. **Cinematic photography, full bleed.** A hero is one photograph edge to edge with a scrim, type over it, one teal action. Sections that carry a photo band run the photo full bleed behind black cards. Inside the app, the spot header is a photograph with the spot name in League Gothic over its scrim. Catch photos are never cropped on the record itself (native ratio, contain on a black ground); they are cropped only in tiles and rows.
2. **The painted torn edge.** Every transition from a photo band to a solid section is a jagged, painted edge: two layers, a semi-transparent paper stroke and the next section's ground, generated procedurally (see `drawTorn` in the prototype). Height 90px on desktop, 56px on phones. This is the reference's brush edge; it also reads as a mountain silhouette, which the owner likes. Use it in the app under the spot header photo and under the record hero.
3. **The dashed fishing line that draws with scroll.** A 3px teal dashed path (dash 12, gap 10.5) runs down the left margin of long sections and is revealed by scroll progress through an SVG mask with `pathLength="1"` (see `#tmask` in the prototype). On phones it sits 2px from the left edge. In the app, the same dashed teal line is the receipt's progress rule when a position fix settles, the dividers between readouts, the rule above each measurement, and the marks for blank trips in the season strip.
4. **Contour line art.** Nested wobbly loops (a hill) plus flowing ridge lines, generated in code, never a stock topographic image, at `--contour` on the page ground behind headings, in the black footer, and faintly behind the readouts in the app. Drawn on when scrolled into view (`stroke-dashoffset` from 1 to 0 over 2.2s, staggered 80ms per line). Never over a photograph, never over body copy at full opacity.
5. **Black blocks with a teal corner tab.** Cards, the record, the "what your log says" block: black in both themes, a 28 to 44px teal triangle in the top right corner, a photo on top, League Gothic heading, Jost paragraph in `--paper-2`. Square corners. No border.
6. **Dashed underlines on inputs**, teal, becoming solid on focus. Field labels above, uppercase tracked. No boxed inputs anywhere except the numeric measurement fields, which are big League Gothic numerals with a unit chip beside them.
7. **Parallax on photo bands**, slower than the page (factor 0.18 to 0.28), `translate3d`, disabled under `prefers-reduced-motion`.
8. **The record builds itself.** See 3.4.

### 3.4 Motion

Durations and easing: `cubic-bezier(0.4, 0, 0.2, 1)` at 150ms (state), 300ms (reveal), 500ms (position) for UI, exactly as measured on the reference; `cubic-bezier(0.2, 0, 0, 1)` at 460ms for a sheet rising. Nothing idles: no pulse, no shimmer, no float. Everything below is triggered by the person or by scroll.

The signature sequence, on tapping Log (built in the prototype, copy its timing):
1. The sheet rises 460ms; the clock is already stamped.
2. The dashed teal fix line draws across the receipt over 2.6s (`cubic-bezier(0.1, 0.6, 0.2, 1)`) while the accuracy figure counts down from ±120 m to ±8 m and the coordinates appear once the fix is under 30 m.
3. Conditions arrive one line at a time, 260ms apart, each fading up 6px.
4. Take a photo: a 420ms white shutter flash, the photo fades in over 700ms while it settles from 104% to 100% over 1.4s.
5. Save: the sheet leaves, the record screen slides in, the hero photo settles from 105% over 1.8s, the measurement cells fade up staggered 100ms, the big numerals count into place over 1.1s (ease-out cubic), the provenance line fades in last.
6. Back to the list: the new row lands at the top with a 3px teal left rule for four seconds.

Also: numbers on the home screen count in (900ms) when the screen enters view; the spot photo drifts from 106% to 100% over 12s once on load (the one slow move); hover on media tiles scales the photo 4% over 600ms; buttons darken 6% on press. Under `prefers-reduced-motion: reduce` every duration becomes 0.01ms and counters set instantly; nothing is lost, only the travel.

### 3.5 Iconography and imagery

- Heroicons outline only (`@heroicons/react/24/outline`), 20 or 24px, 1.5 stroke, `currentColor`. Icons appear where a word would not fit: the theme switch (sun, moon), close (x-mark), back (chevron-left), the photo control (camera), media markers (plus), map pin (map-pin), centre on me (viewfinder-circle). No icon beside a text label in the nav, on buttons that carry words, on section headings, on stats, or as bullets.
- The wordmark is `Name` in League Gothic with a small line-drawn fish (the prototype's mark), a placeholder until a name exists.
- Photographs are the only imagery. No illustration, no mascot, no line-art fish, no crest, no vintage badge. The contour art and torn edges are generated, not drawn.
- Every image declares `width`, `height` or `aspect-ratio`; the catch hero is `fetchpriority="high"`, everything else lazy.

### 3.6 What is refused

The current build's tells, all removed: glass headers and blur, the blue and teal token palette, radial glows, coloured glow shadows, icons in tinted rounded squares, the floating dock with hover magnification, rounded cards with soft shadows and cards inside cards, a lucide icon on every label, the bobbing bobber, dashed dropzones that accept no drops, untouched shadcn defaults, placeholder illustration slots, fabricated stats, `plan, log, and relive`, `Catch logged!`, em dashes as values, `No img`, `CATCH • GLOBAL`, `FRESHWATER`, vendor words.

The generic "premium outdoor" defaults, also refused: cream or parchment canvases, an editorial serif, one italic word in a headline, a rust or ochre accent, film grain and paper texture, rubber stamps and crests, forest green and khaki, bento grids, big-number dashboards, a purple gradient, Inter or Space Grotesk, everything centred, `rounded-lg` on everything, an accent rail on a rounded card, fade-up on every block, a marquee, a cursor follower. The reference's own scenes, renders, logo and copy are never reused.

### 3.7 Rules adopted from the taste pass

The prototype was run through `design-taste-frontend` (installed in this repo under `.agents/skills/`, symlinked into `.claude/skills/`; read it, it is the second checklist after section 9). Its design read for this product: a premium-consumer landing page with a live product demo, for anglers, in a cinematic outdoor language; dials variance 7, motion 7, density 3. The redesign of the app itself is outside that skill's scope (it is product UI), but these of its rules apply everywhere:

- One label per intent, page-wide. The sign-up action is `Start your log` in the header, the hero and the signup box; the demo control is `Watch it log`; inside the app the primary action is `Log`. Never two labels for one intent.
- A hero headline is at most two lines on desktop and its subtext at most twenty words. Plan type size with the photograph, never let the hero push its action below the fold.
- Never four identical cards in a row. The features section is a 3-column grid with two wide cards (photo beside text) and two tall ones; keep that rhythm.
- No raw scroll listeners. Scroll-linked motion uses CSS scroll-driven animations (`animation-timeline: view()`) with a single frame-throttled fallback where unsupported, or IntersectionObserver for reveals.
- Shape rule, stated so it is consistent: content blocks and text controls are square; icon-only controls (the theme switch, the media markers) are circles; the device frame is a device. Nothing else is rounded.
- Eyebrows (small tracked labels above a heading) at most one per three sections on the landing page; inside the app, tracked labels name fields and readouts only.
- Middle dots at most one per metadata line; hairlines between rows, never a border above and below every row.
- Both themes checked on screen before anything ships; Google Fonts are linked only in the prototype, the product self-hosts the two families.

The landing page shows the app inside a device frame (bezel, rounded screen, island) at a normal phone size on desktop, with the screen content scrolling inside it, and at full width on a phone.

## 4. The prototype

`prototype/index.html` (appendix G), also published at https://claude.ai/artifact/PBNn9VoYSy77bnsqNBLNAX. It is one page: a landing page in the language above with the app running live inside a phone in the second section, a features band, the record, the signup band and the footer, in day and night, phone first.

Copy exactly: the tokens, the type sizes, the torn edge and contour generators, the dashed line mask, the sheet and record motion timings, the bottom bar, the readouts, the black card with a corner tab, the input treatment. Treat as a demo: the sample data, the Unsplash photographs (the real product shows the angler's own), the single-file structure. The app screens in the prototype (home, log sheet, record) are the bar for those three surfaces; the rest of the app extends the same vocabulary.

## 5. Functional scope

Appendix E is the checked list, with evidence, dependencies, sizes and priorities. The first release is its "Order of work, first release" list, in that order. In short:

1. Editing preserves the whole record and the clock stops drifting (partial updates; local time round-trips).
2. Species on every catch: a searchable picker over South African common names and aliases, `Not sure` allowed, free text kept until matched. Needs a `GET /api/species` search route and `speciesId` on the catch write path.
3. Catch coordinates and the tap-to-stamp fast path: `Log` fires the fix, stamps the clock, pulls conditions, and writes the record locally before the sheet opens. Nothing on the fast path can block a save. A measurement left alone is `by eye`; `On a tape` and `On a scale` upgrade it.
4. Finish the conditions write path (eleven fields are currently nulled on save), stamp the snapshot with its time and distance, and show the Google attribution line inside the conditions block, always.
5. Both units on the record (`44 cm (17.3 in)`, `1.9 kg (4 lb 3 oz)`), the entry unit stored per measurement, pounds and ounces never decimal pounds, no `step` attributes, negatives rejected beside the field.
6. Photos editable after logging, on catches and spots; the picker accepts drops and paste on desktop, opens the camera on a phone, shows per-file progress as a 2px rule.
7. The feed row points at the live record, so edits and deletes propagate; one social object, the catch.
8. Say what gets published: a plain sentence at save time and a per-record public or private switch; spot position shown exact, about 1 km, or hidden.
9. A real not-found screen, document titles per route, owner controls on detail pages, empty states with the next action, a signed-in home that is the log and not the marketing page.
10. Gear owner filter (the API currently returns every user's gear) and honest gear delete.
11. Depth and water temperature wired up; fish count either captured or not displayed.

Second release: blank trips as records, public profiles and a following feed, reactions on the record, server-side search and sort, gear detail with the catches taken on it, the shared link done properly (title, Open Graph image, copy link), personal bests as sentences, offline drafts, sun and moon computed locally, released or kept, undo on soft deletes, spot photos beyond the first, the profile read view split from settings.

Deferred with reasons in appendix E: site reviews, saved spots, one map of all spots, pressure as a delta across trips, coordinate fuzzing levels, Ask, notifications, share-as-image, tide.

## 6. Surface by surface

Order of build. For each: what it is today (files in `packages/client/src`), what must change, and how it looks in the language. Appendix F carries the full digest of every surface with line-numbered faults; appendix C the UX problems; appendix D every string.

### 6.1 Shell, navigation, theme
Today: thirteen pages each mount `LandingHeader` (marketing anchors, glass, a dead hamburger) and `FishingActionBar` (a floating dock plus a bottom bar with mismatched names); no layout route, no auth guard, no page titles, no scroll reset, toasts that follow you between pages.
Build: one layout route with an `<Outlet/>`, one auth guard, one 60px black header (wordmark left, on desktop the four destination words in League Gothic, the sun/moon switch, the teal `Log a catch` action, the avatar), and on phones a 64px black bottom bar with five slots: `Feed · Catches · Spots · Gear · Log`, the last a teal block 124px wide, the active slot marked by a 3px teal top rule. Signed out, the bar shows `Feed` and `Sign in` only. Scroll resets and focus moves to the `h1` on navigation; `document.title` is set per route from the record; toasts are black with a teal left rule, cleared on route change, stack limit three. A persistent 48px offline bar (teal ground, dark text) when offline, with the queue count in the header.

### 6.2 Home, signed in
Today: `/` is the marketing page for everyone.
Build: the prototype's home. A 300px spot photograph with scrim and torn edge, the spot name in League Gothic 52, the date and sunrise line in teal labels; three readouts divided by dashed teal rules (wind, pressure with its change since the last trip in `--teal-text`, air), contour art faint behind them; the black `What your log says` block with a corner tab and one teal link; the season strip (each catch a photo tile scaled to its length, blank trips as dashed teal ticks, months as labels); recent rows. Numbers count in on first view.

### 6.3 Log a catch, the fast path
Today: a 760-line form with fifteen controls in the wrong order, no draft, a default location option that saves no location.
Build: the prototype's sheet, exactly. Header `Log a catch` with `Nothing caught?` and `Close`; the receipt (clock in League Gothic 40, the dashed fix line, coordinates and accuracy, `Stamped the moment you tapped Log.`); conditions arriving line by line with `Conditions taken 06:14. You can put the phone away now.`; the photo block with the camera control; species chips (recent first, `Not sure` last); length and weight as big numerals with unit chips and `On a tape` / `On a scale`; a 56px teal `Save catch` pinned to the bottom. The record exists from the tap; dismissing the sheet loses nothing.

### 6.4 The full path and edit forms
Today: log and edit diverge on every field; edit has no labels, no images, wipes fields it never showed.
Build: one component, prefilled when editing, in four groups divided by dashed teal rules: The fish (photos, species, length, weight, count, depth, water temp behind `More`), Where (three radios: `The spot I am at`, `A saved spot`, `A new spot` with the map), When and conditions (local time with the zone named, the conditions block read-only, `Refresh conditions` stating what it replaces), Gear and notes (own gear only, searchable, `Lure / Bait / Fly`, `Released / Kept`, notes with a counter). Inputs are dashed teal underlines; numerals are the big fields. Validation inline beside the field on blur; toasts confirm outcomes only. `Cancel` beside `Save changes`; the post-save redirect replaces history. Delete lives on the record behind one dialog with a 10 second undo.

### 6.5 Catch record
Today: `bg-white` hard-coded, stat tiles, an em dash printed for missing values, `Prev`/`Next` text buttons, no owner controls, spins forever on a missing id.
Build: the prototype's record screen. Hero photo at native ratio on black with scrim, the back control (chevron-left), the eyebrow date and spot, the species in League Gothic 64, the headline measurement `44 cm · 1.9 kg`; the rail of cells each with a dashed teal top rule (Length, Weight, Conditions, Position, and Species, Count, Depth, Water temp when recorded), the source word in each (`on a tape`, `by eye`, `±8 m`); the provenance paragraph with a dashed left rule; `Back to catches`, `Share`, `Edit`, `Delete` (text, no red block). Public and titled; a stranger sees the same record minus owner controls. Missing values are sentences: `Not measured`, `Species not recorded`, `Not reported`, `No spot recorded`, `No position recorded`. Never a dash, never a zero.

### 6.6 My catches
Today: identical bordered rows with `1 catches • 9/15/2026, 6:42:13 AM`, client-side search only, delete on every row.
Build: `My catches` in League Gothic with the count beside it (`184 catches · 22 blank trips`); filter chips (4px rectangles in the League Gothic chip style, `aria-pressed`, counts) with the state in the URL; the shared row: 52px photo, species in League Gothic 22, a Jost sub-line `Tue 15 Sep, 06:42 · Kalk Bay · 4.2 kg by eye`, the length in League Gothic 24 on the right; blank trips as quiet rows; incomplete captures above a rule with `Logged 06:42, no species yet.`; hairlines between rows, no cards; empty and no-match states with the next action. Desktop adds right-aligned tabular columns for length and weight.

### 6.7 Feed
Today: a glass panel wrapping stock cards, `CATCH • GLOBAL`, `No text`, a follow button on your own posts, `Near me` plus `Catches` permanently empty.
Build: one 720px column; a post is a black block with a corner tab: author row (avatar, name in Jost 600, handle), one sentence of context (`Caught at Kalk Bay · Tue 15 Sep, 06:42 · 4 h ago`), the photo full bleed to the block's edges with swipe and 48px chevrons, the measurement line with source words, the caption, `Like`/`Liked` and `Comment` as League Gothic text controls and the counts as a sentence. Trips post once per trip with their catches listed. Scope and Show as chip radiogroups in the URL; the radius slider with a live count. Optimistic like and follow; sign-in refetches.

### 6.8 Spot
Today: the map at the bottom under pagination with no heading, water type as `SALTWATER`, no owner controls, every log publishes the exact pin.
Build: photo header with torn edge and the name in League Gothic; a line `Saltwater · 43 catches logged here · best 91 cm kob`; description with line breaks kept; Position (a real heading, the map at 3:2 with `gestureHandling: cooperative`, the spot label outlined on the tiles, `Open in Maps`, the coordinates with their source word, and the privacy line `Shown to other anglers at about 1 km.`); Now (conditions as a delta since the last trip, then the trip history with pressure, wind and catches); Catches here with the shared row and a count; notes from anglers as a sentence and a paragraph, not stars; `Log a catch here` as the teal action, `Save this spot`, `Edit`, `Delete`.

### 6.9 My spots and the map view
Build: the same row grammar as catches (photo, name, `Saltwater · 43 catches · last fished 8 Sep`, the best fish on the right); `Add a spot` beside the heading and in the bottom bar; a `List` / `Map` toggle, the map plotting the angler's own spots with teal pins and saved spots in grey; sorted by last fished.

### 6.10 Gear and gear detail
Build: grouped by type with League Gothic headings and counts (`Rods (2)`), rows with a contained photo (a rod on a table is never cropped), `Daiwa · Reel · 41 catches, best 6.1 kg`; `Add gear` beside the heading; a gear detail route with the catches taken on it; delete names the consequence.

### 6.11 Profile and public profile
Build: `/u/:username` is a real route. A black header block with the avatar (64px), the display name in League Gothic, `@handle`, the bio in Jost, `Fishing since Mar 2025`, and figures as sentences (`184 catches at 18 spots.` `48 followers, following 31.` as links); `Follow` / `Following`; personal bests as sentences linking to their records; a photo grid of 1:1 tiles linking to records; recent rows. Settings on `/profile/settings`: labelled dashed-underline fields, live counters, the two preference switches (`Log button on the left`, default measurement source), `Manage your account`. No database ids, no vendor words.

### 6.12 Followers, comments, dialogs
Build: a bottom sheet on phones (full width, teal top rule) and a centred 480px black dialog on desktop; a count in the title; a labelled search field; 48px rows linking to profiles with a follow control; confirmation dialogs name the thing and the consequence; the confirm control is an outline, never a red block.

### 6.13 Image upload
Build: one component for every scope: a black block reading `Add photos` with the camera icon on phones (`capture="environment"`) and `Choose photos`; accepts drop and paste on desktop (border turns teal on dragover); `multiple` where the scope allows; a live count (`3 of 8`); tiles 4:3 with per-file 2px teal progress, retry and remove (x-mark), cover marker, reorder; single-image scopes replace in place; errors inline under the grid naming the file and the fix.

### 6.14 States
Loading: static content-shaped skeletons at the real geometry, never a spinner or a bobber; every skeleton times out at 5 seconds into an inline `Could not load your catches.` with `Try again`. Empty: one sentence plus the action. No match: a different sentence plus `Clear search`. Signed out on a private list: `Sign in to see your catches.` with the sign-in control. Not found: `That catch is not here. It may have been deleted.` with one route out. Offline: the teal bar. Saved: the toast with `Undo` where a delete is reversible.

### 6.15 Signed-out landing
Build: the prototype's landing page, in this order: the hero (photograph, headline, one line, one teal action, torn edge); `How it logs` with the dashed line and the live phone; the media tiles; `What it keeps` as four black cards on a photo band with torn edges; `The record` with contour art and the record card; the teal `Stay on the water` band with the black signup box; the black footer with contour texture. Meta layer complete: title, description, theme-color per theme, Open Graph image from a real record, favicon set, manifest. A signed-in person never sees this page.

## 7. Copy voice

One word per concept: a place is a **spot**, a fish is a **catch**, tackle is **gear**, a session is a **trip**, the stored weather is **conditions**. You **log** what happened and **add** what you keep. Messages name the thing and its state: `Catch saved. 78 cm, 06:42, Kalk Bay.` `Not saved. The title needs at least 2 characters.` (beside the field). Errors say what went wrong and what fixes it. No exclamation marks, no product cheer, no `unlock`, `elevate`, `seamless`, `effortless`, `discover`, `curated`, `crafted`, `journey`, no three-part lists, no `whether you are X or Y`, no `not just X but Y`. Every string in the current build is in appendix D; rewrite all of them. Section 13 of the earlier design system draft (appendix H) has 60 worked rewrites that remain valid.

## 8. Engineering notes

- Tokens live in `src/index.css` as CSS variables in both themes; Tailwind v4 `@theme inline` maps them; shadcn primitives are restyled through the variables and the `cva` variants, not replaced. Remove `App.css` (dead Vite starter CSS), the bobber loader, the chat components (`ChatBot`, `ChatInput`, `ChatMessages`, `TypingIndicator`), the marketing header from app pages, `react-icons`.
- Fonts: League Gothic and Jost from Google Fonts (SIL OFL), self-hosted as woff2 with `font-display: swap`, preloaded; two families only.
- Icons: `@heroicons/react/24/outline`.
- Motion: CSS transitions and a small amount of `requestAnimationFrame` for counters, the scroll-drawn line and parallax; no animation library is required. Honour `prefers-reduced-motion`.
- Maps: the existing Google Maps picker, restyled with a dark or light style matching the theme, `gestureHandling: cooperative`, never geolocating on mount, never centred on the United States.
- Performance: LCP under 2.5s on a mid-range phone, no layout shift on image load, JS under 300KB gzipped for the app shell.
- Accessibility: visible `<label>` on every field, 48px targets, a teal 2px focus ring with offset, `aria-pressed` on toggles and chips, `aria-current` on nav, labelled landmarks, a skip link, focus moved on navigation, dialogs and sheets trapping focus.

## 9. Acceptance checklist

A surface is done when all of these hold, in both themes, at 375, 768 and 1440:
1. It uses only the tokens in 3.1 and the type in 3.2; a grep finds no hex outside `index.css`, no `backdrop-filter`, no `box-shadow` outside the device frame, no `rounded-` beyond the two allowed radii (0 and the avatar), no `text-transform: uppercase` on a sentence.
2. Teal appears only in the places listed in 3.1.
3. At least one of the moves in 3.3 is present and one motion from 3.4 runs on interaction; nothing animates on a loop.
4. Every number carries its unit and its source word where one exists; no em dash, no invented zero, no `N/A`.
5. Every string reads as a sentence a person would say; the copy passes the tells in section 7.
6. Every interactive element is at least 48px on its short axis; every field has a visible label; focus is visible.
7. Loading, empty, error and signed-out states exist and carry a next action.
8. Screenshots of the surface in both themes at the three widths are attached to the change, and the fault list for that surface in appendix F is cleared.

## Appendices

- A. `01-reference-design-language.md`: the measured language of cotwtheangler.com.
- B. `02-slop-inventory.md`: every generated-design tell in the current build, by file and line.
- C. `03-ux-problems.md`: every usability and accessibility fault found, by file and line.
- D. `04-copy-strings.md`: every user-facing string in the current build, verbatim, to be rewritten.
- E. `05-functionality-gaps.md`: the checked gap list with evidence, dependencies, sizes, priorities and the order of work.
- F. `06-surface-digests.json`: facts-only digests of every current surface: what is there, what is broken, what to keep.
- G. `prototype/`: the interactive prototype (open `index.html`) and its photographs.
- H. `07-earlier-design-system.md`: an earlier, more austere system draft. Its visual rules (Atkinson Hyperlegible, a magenta accent, square everything) are superseded by section 3 and must not be used; its data display rules (units, dates, missing values, weather priority), copy rewrites and screen behaviours remain valid and are referenced above.
