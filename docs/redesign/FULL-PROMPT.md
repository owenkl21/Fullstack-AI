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


---

# Measured design language of the reference: cotwtheangler.com (Call of the Wild: The Angler)

Read from the live DOM and bundles on 16 September 2026. Mechanisms, not adjectives. Nothing here is copied: the product's own photos, copy and marks are never reused; the contour art and torn edges are regenerated by code.

## Stack
Gatsby 4, Tailwind utilities, GSAP (commons bundle), Lottie for the animated dashed line, react-scroll-parallax for photo bands. Fonts from Typekit (Countach) plus League Gothic and ITC Avant Garde served locally.

## Palette (computed)
- Chassis near-black, warm: `rgb(11, 9, 9)` = `#0B0909`. Used for the header, dark sections, footer, feature cards.
- One accent, teal: `rgb(52, 173, 189)` = `#34ADBD`. Used for: the primary button fill (dark text on it), the dashed fishing line, thin rules under labels, corner tabs on cards, a full-bleed band behind the signup card, dashed input underlines, vertical dashed dividers in the footer.
- White sections `#FFFFFF` with grey cards `rgb(102,102,102)`-ish and `#F4F4F4` gradient tiles.
- Overlays: `rgba(11,9,9,0.4 / 0.5 / 0.8)` scrims over photos; `linear-gradient(0deg, #0B0909, transparent)` fading a photo into the chassis.
- Contour line art: light grey `rgb(218,218,218)` at 0.5 to 1.4px strokes, opacity 0.75, on white; a darker version on the black footer.

## Type (computed)
- Display: League Gothic Regular 400, always uppercase, letter-spacing 0.45px to 1.5px, sizes 18/28, 20/28, 24/32, 30/36, 36/40, 48/48. Line-height near 1.0 at large sizes.
- Body and labels: ITC Avant Garde Std Book 400 at 14/24 and 16/24; labels uppercase at 20/28 with 2px letter-spacing and 0.5px.
- Countach loaded via Typekit (condensed) for select headings.
- Free equivalents with the same mechanisms: League Gothic (Google Fonts, SIL OFL) for display; Jost (Google Fonts, SIL OFL) for the geometric body in place of Avant Garde.

## Layout and section grammar
1. Header 60px, black, condensed uppercase nav words left, wordmark centre, support links and a teal `PLAY NOW` right.
2. Hero `calc(100vh - 60px)`: one cinematic full-bleed scene (mountain lake, angler on a rock, mist), a single teal CTA centred low, a painted torn edge (white brush stroke then black) cutting the photo into the next section, platform logos row at the very bottom.
3. Dark intro section: a paragraph at 16/24, a `WATCH TRAILER` label with a thin teal rule, a video thumbnail, a media grid with `+` markers, a League Gothic heading at 48px. A dashed teal fishing line (3px, dash 12 gap 10.5) runs down the left margin and draws on as you scroll.
4. Features band: a full-bleed sky and mountain photo with torn edges top and bottom, four tall black cards over it, each a photo, a League Gothic heading, a Jost-style paragraph.
5. News section: white, `NEWS & UPDATES` in black League Gothic, light-grey topographic contour art in the bottom-left corner behind the content, grey cards with a teal corner tab and a teal `READ MORE` button, a torn painted edge from the photo band above.
6. Signup: a full-bleed teal band with a black card on it (photo left, form right), inputs drawn as dashed teal underlines, a white `SUBSCRIBE` button.
7. Footer: black with dark-grey contour texture, columns of uppercase links, a dashed teal vertical divider, platform and rating marks.

## Motion (measured)
- Transitions: `cubic-bezier(0.4, 0, 0.2, 1)` at 0.15s, 0.3s, 0.5s on colour, opacity and transform; `opacity 0.25s / 0.5s linear` for image fades.
- The dashed line is a Lottie animation driven by scroll progress (the drawn length follows the scroll).
- Photo bands use scroll parallax (react-scroll-parallax).
- One keyframe animation: `pulse` on the live-stream badge (box-shadow ring, 1.5s).
- Media tiles carry a `+` marker and a hover reveal.

## What to take for the fishing log
- Take: the torn painted edge between a photo band and a solid section; the dashed teal line drawn by scroll as the connective thread; contour line art as texture in two densities (light on white, dark on black); condensed uppercase display with tracked uppercase labels; one teal accent rationed to the primary action, thin rules, corner tabs and dashed underlines; tall photo-led cards; a full-bleed accent band for the one signup moment; alternating dark and white sections, which is exactly what a light and dark mode wants.
- Never take: the game's scenes, renders, logo, copy, the platform logo row, the Twitch badge.


---

# Appendix B. Slop inventory of the current build (file:line)

## ../index.html
- :7 Vite starter template leftovers never replaced. Evidence: `<title>client</title>` and favicon `/vite.svg` (line 5); App.css lines 1-42 are the Vite starter styles (`.logo` spin, `.read-the-docs { color: #888 }`) and are imported nowhere

## components/ChatInput.tsx
- :32 Stock ChatGPT-clone chat UI. Evidence: `border-2 p-4 rounded-3xl` composer, placeholder 'Ask anything' (41), round `rounded-full w-9 h-9` send button with FaArrowUp (44-48); bubbles `bg-blue-600 text-white` vs `bg-gray-200 text-black` (ChatMessages.tsx:32)

## components/ChatMessages.tsx
- :32 Hard-coded Tailwind demo colours that bypass theme tokens and dark mode. Evidence: `bg-blue-600`, `bg-gray-200 text-black`; TypingIndicator.tsx:3,16 `bg-gray-200`, `bg-gray-800`; ChatBot.tsx:62-64 `border-red-300 bg-red-100 text-red-500`; ImageUploader.tsx:145 `text-red-500`

## components/ImageUploader.tsx
- :132 Generic dashed upload tile that looks like a dropzone but does not accept drops. Evidence: `rounded-xl border-dashed border-border/80 bg-muted/40 px-4 py-6` with centered ImagePlus icon and 'Select image'; no onDrop/onDragOver anywhere in the file

## components/fishing/FishingActionBar.tsx
- :14 Lucide icon on every nav label, with a duplicated glyph for different actions. Evidence: `Plus` used for both `Log catch` (line 14) and `Add gear` (line 18); every item in both arrays carries an icon
- :27 Glassmorphism navigation dock with an oversized soft shadow. Evidence: `rounded-full border border-border/70 bg-background/95 ... shadow-[0_8px_30px_rgb(0_0_0_/_0.12)] backdrop-blur` floating pill; the mobile bar repeats `bg-background/95 ... backdrop-blur` at line 54
- :34 Floating frosted pill dock with macOS-style hover magnify, a decorative motion flourish. Evidence: rounded-full border border-border/70 bg-background/95 ... shadow-[0_8px_30px_rgb(0_0_0_/_0.12)] backdrop-blur (27) and hover:-translate-y-1 hover:scale-110 focus-visible:scale-110 (34)
- :54 Translucent blurred mobile bottom bar. Evidence: border-t border-border/70 bg-background/95 ... backdrop-blur md:hidden

## components/landing/LandingFaq.tsx
- :7 FAQ is developer or design-review Q&A, not user questions. Evidence: "Can we swap in real illustrations later?", "Does this visual design support both dark and light mode?" (:12), "Is the layout still easy to scale?" (:17); intro :38 "Built to feel like a polished SaaS landing page"
- :45 Walls of identical default shadcn cards with primary-tinted borders. Evidence: Card className="border-primary/15" repeated three times; the same Card rounded-xl border py-6 shadow-sm (ui/card.tsx:10) is used for 3 stat, 4 feature and 2 use-case cards with border-primary/10, /15 and /20 variants

## components/landing/LandingFeatures.tsx
- :18 Rainbow per-card gradient washes, including blue-to-teal and purple. Evidence: tone 'from-sky-500/20 to-cyan-400/10', 'from-emerald-500/20 to-lime-400/10' (:25), 'from-indigo-500/20 to-violet-400/10' (:32), 'from-fuchsia-500/20 to-rose-400/10' (:39)
- :49 Section heading and intro describe the landing page rather than the product. Evidence: h2 "A landing page designed like a modern product showcase"; :52 "reusable content blocks inspired by premium component systems"
- :64 Hover animation on cards that are not interactive. Evidence: absolute gradient layer opacity-60 transition-opacity group-hover:opacity-90 on static feature cards
- :67 Icon-in-a-tinted-rounded-square feature grid. Evidence: div.rounded-md.bg-background/80.p-2.text-primary.shadow-sm wrapping Smartphone/Map/Fish/CalendarDays above each title in a 2x2 card grid; the logo chip does the same at LandingHeader.tsx:22
- :94 Uppercase wide-tracked micro-labels used as decoration. Evidence: text-xs uppercase tracking-[0.2em] text-primary/80 on placeholder boxes; also LandingHero.tsx:48 and :26, LandingFaq.tsx:30

## components/landing/LandingHeader.tsx
- :8 Marketing landing header (Features, Use cases, FAQ anchors) reused inside the logged-in app screens, plus a repo-style product name. Evidence: navItems = [{ label: 'Features', href: '/#features' }, { label: 'Use cases' ... }, { label: 'FAQ' ... }] with wordmark 'Fullstack AI Angler' (25); mounted at CatchDetailPage.tsx:140 and EditCatchPage.tsx:274
- :16 Glassmorphism / backdrop-blur chrome on every site page. Evidence: header 'bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60'; also dock FishingActionBar.tsx:27 'rounded-full border border-border/70 bg-background/95 ... backdrop-blur' and mobile bar FishingActionBar.tsx:54 'bg-background/95 ... backdrop-blur'
- :22 Icon in a tinted rounded square with a coloured glow as the brand mark; glow shadow on the CTA. Evidence: `rounded-xl bg-primary/15 p-2 text-primary shadow-sm shadow-primary/30` around lucide Fish; Sign in button `shadow-sm shadow-primary/30` at line 53; same tinted-circle icon pattern on ProfilePage.tsx:17 `rounded-full bg-primary/10 p-3 text-primary`
- :25 Dev project name and Vite defaults as brand. Evidence: wordmark "Fullstack AI Angler"; document title "client" and /vite.svg favicon (index.html:5,7)
- :53 Coloured glow shadows. Evidence: Sign in button shadow-sm shadow-primary/30; logo chip shadow-primary/30 (:22); hero CTA shadow-lg shadow-primary/35 (LandingHero.tsx:40)

## components/landing/LandingHero.tsx
- :5 AI sparkle iconography. Evidence: imports Sparkles and WandSparkles; Sparkles on stat "Smart insights shared" (:15), WandSparkles in the pill (:27)
- :12 Fabricated stat tiles for the sake of it. Evidence: hardcoded statCards "1,200+" Mapped locations, "4,800+" Trip plans generated, "12k+" Smart insights shared, rendered as three glass cards at :76-95
- :26 Pill badge above heading, uppercase and wide-tracked, with a sparkle icon. Evidence: rounded-full border-primary/30 bg-primary/10 text-xs uppercase tracking-[0.2em] with WandSparkles, "Inspired by modern UI libraries"; repeated in LandingFaq.tsx:30-33 with HelpCircle "FAQ"
- :31 Generic SaaS marketing phrasing and verb triplets. Evidence: "Plan, log, and relive"; "Get early access" / "View product tour" (:41, :44); "Smart insights shared" (:15); "without clutter" (LandingFeatures.tsx:110); "Designed for modern outdoor products." (LandingFooter.tsx:7); FAQ answers opening "Yes." / "It does." / "Absolutely." (LandingFaq.tsx:9, 14, 19)
- :35 Self-referential template copy about the redesign itself, shown to end users. Evidence: "We redesigned the landing experience with richer color, glassy surfaces, and modular sections ready for your illustrations..."; also h1 at :31 ends "with a premium UI."
- :40 Hero with two CTAs (primary with glow plus outline), neither wired up. Evidence: Button size=lg shadow-lg shadow-primary/35 "Get early access" and Button variant=outline "View product tour" (:43-45)
- :47 Placeholder illustration slots shipped as visible UI. Evidence: dashed box "Hero illustration slot" / "Drop a 16:10 fishing scene..." (:47-55), "Illustration slot A" / "Illustration slot B" (:66-71); LandingFeatures.tsx:94-96 and :112-114 "Placeholder for tactical illustration / dashboard image", "Placeholder for lifestyle art / photo"
- :63 Lucide icon attached to every card title and label, including a decorative arrow on a non-link. Evidence: ArrowUpRight beside "Live activity panel" though nothing is clickable; stat cards each carry an icon (:86); use case titles prefixed with Radar and Waves (LandingFeatures.tsx:85, :103)

## components/landing/LandingPage.tsx
- :9 Decorative gradient backgrounds with a hardcoded sky-blue radial glow. Evidence: [background-image:radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_36%)]; plus hero bg-gradient-to-b from-primary/10 (LandingHero.tsx:22) and footer bg-gradient-to-b from-muted/40 (LandingFooter.tsx:3)

## components/landing/LandingThemeToggle.tsx
- :38 More glass on the theme toggle. Evidence: rounded-full border-primary/30 bg-background/80 shadow-sm backdrop-blur

## components/profile/ProfileSettingsPanel.tsx
- :255 Default shadcn page-header pattern left untouched. Evidence: h1 `text-2xl font-semibold tracking-tight` + p `text-sm text-muted-foreground` inside default `Card` (`rounded-xl border py-6 shadow-sm`, card.tsx:10); same pairing on ProfilePage.tsx:20-26
- :292 Lucide icon glued onto metadata labels, applied inconsistently. Evidence: `<Database className="size-3.5" />` before 'User ID:' and `<CalendarDays className="size-3.5" />` before 'Joined:' (296), but 'Last profile update:' (303) has no icon
- :321 Stat tiles for the sake of it (uppercase micro-label over a big number). Evidence: Two bordered tiles: `text-xs uppercase tracking-wide text-muted-foreground` 'Followers' / 'Following' over `mt-1 text-2xl font-semibold` count (lines 313-342)
- :428 Over-labelled form, with filler copy that restates what is on screen. Evidence: 'Editable fields: display name, username, bio, and avatar image.' directly under those exact four fields; subtitle 'Manage the account fields saved in your app database.' (259)

## components/r2-image-picker.tsx
- :115 Infrastructure and vendor jargon in user-facing copy. Evidence: 'Could not upload image to Cloudflare R2.'; 'Uploading to R2...' (159); 'Saved to Clerk fallback profile' / 'Database is unavailable, so your profile was saved to Clerk metadata.' (ProfileSettingsPanel.tsx:229-233); 'Save app profile' (434); 'Manage account / delete in Clerk' (441); raw 'User ID' (293)
- :141 Boxes nested in boxes, all with the same rounded, bordered, soft-shadow look. Evidence: Picker card `rounded-xl border bg-card p-4 shadow-sm` sits inside the profile Card (`rounded-xl border shadow-sm`), next to bordered summary box `rounded-lg border bg-muted/20` (ProfileSettingsPanel.tsx:267), bordered stat tiles (315, 330), bordered gallery tiles (354), bordered preview tiles (r2-image-picker.tsx:166)
- :143 Over-labelled single image field (four lines of instruction) while the text fields above have no labels at all. Evidence: label 'Gear image' + 'Upload one image.' + 'Image keeps its original framing.' (ImageUploader.tsx:140) + 'Accepted: image/jpeg, image/png, image/webp • Max size: 10MB' (ImageUploader.tsx:81), vs LogGearPage.tsx:64-88 with placeholders only

## components/ui/button.tsx
- :7 Default shadcn primitives left untouched, including unused scaffolding. Evidence: Stock new-york v4 cva with unused `secondary`/`link` variants and `xs`/`icon-xs`/`icon-sm`/`icon-lg` sizes; card.tsx:10 stock `rounded-xl border py-6 shadow-sm`; index.css:33-45 and 68-80 unused chart-* and sidebar-* tokens; components.json baseColor `neutral`
- :8 Default shadcn Button left untouched; the rest of the form is unstyled raw HTML. Evidence: stock new-york cva classes; form inputs are bare `rounded border p-2` (LogCatchPage.tsx:374, 385, 394) with native select, checkbox and datetime pickers
- :12 Default shadcn new-york Button variants left untouched as the only styled controls. Evidence: default: 'bg-primary text-primary-foreground hover:bg-primary/90', outline: 'border bg-background shadow-xs hover:bg-accent...', destructive: 'bg-destructive text-white...' used verbatim for Save gear, Edit, Delete, Previous, Next

## components/ui/fishing-bobber-loader.tsx
- :28 Infinite floating decorative loader animation. Evidence: `bobber-float` (translateY -4px, rotate ±4deg, 1.3s infinite) and blurred `bg-sky-400/50 blur-[1px] bobber-ripple` (line 29), keyframes at index.css:130-160; used for both the full profile load and inline uploads

## index.css
- :56 Blue-to-teal palette (primary blue, aqua accent, cyan in dark). Evidence: `--primary: oklch(0.59 0.17 244)` (#0083d9) with `--accent: oklch(0.79 0.12 181)` (#4dd4bf) at line 62; dark `--primary: oklch(0.75 0.14 214)` (#00c4e4) at line 90 and `--accent: oklch(0.74 0.1 181)` at line 96
- :62 Blue plus teal palette, with teal used as the generic hover fill. Evidence: Primary is `oklch(0.59 0.17 244)` blue (line 56) and accent is `oklch(0.79 0.12 181)` teal. Ghost and outline buttons hover to `bg-accent` (button.tsx:16,19), so Like, Comment, Follow and the filter chips flash teal on hover
- :84 Dark mode is the light palette with lightness inverted (same hues), plus untouched stock shadcn dark sidebar and chart tokens. Evidence: `--background: oklch(0.2 0.03 244)`, `--foreground: oklch(0.95 0.02 220)`, card `oklch(0.26 0.03 242)`; lines 102-114 are stock shadcn values (`--chart-1: oklch(0.488 0.243 264.376)`, `--sidebar-primary: oklch(0.488 0.243 264.376)`) that nothing uses

## pages/ProfilePage.tsx
- :17 Icon in a tinted circle above a centered heading, subtitle and single CTA card. Evidence: `rounded-full bg-primary/10 p-3 text-primary` with Fish icon, then h1 `text-2xl font-semibold tracking-tight`, muted p, Button, all `items-center text-center` in a `max-w-xl` card (lines 16-30)

## pages/fishing/CatchDetailPage.tsx
- :146 Scaffold palette that bypasses the theme: hardcoded white and slate on a themed app, so the card ignores dark mode. Evidence: article className="overflow-hidden rounded-xl border bg-white"; tiles bg-slate-50 / text-slate-500 / text-slate-900 (239-244); text-slate-300 (155)
- :161 Default shadcn look left untouched: stock primary text buttons dropped onto a photo as carousel controls instead of a designed gallery. Evidence: <Button type="button" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2">Prev</Button> and the same for Next (173-184)
- :239 Stat tiles for the sake of it: identical bordered tiles with tiny uppercase tracking-wide micro-labels, including a Size group whose tiles show only a dash when there is no data. Evidence: li className="rounded-lg border bg-slate-50 p-3" + p className="text-xs font-medium uppercase tracking-wide text-slate-500" repeated for 8 condition tiles (235-248) and 2 always-rendered size tiles (254-275)
- :262 Em dash in user-facing copy used as an empty value. Evidence: data.length !== null ? `${data.length} cm` : '—' (also line 272 for weight)

## pages/fishing/EditCatchPage.tsx
- :285 Unfinished scaffold form: raw unlabeled HTML inputs mixed with stock shadcn buttons, and a uniform gap-3 stack with no grouping. Evidence: <input name="title" className="rounded border p-2" required /> and datetime/textarea/select with the same class and no labels (285-314), next to <Button variant="outline"> (368) and <Button type="submit"> (493)
- :321 Developer-facing scaffold copy left in the UI. Evidence: No gear found in the database yet.

## pages/fishing/FeedPage.tsx
- :289 Glassmorphism on the main content panel. Evidence: `rounded-2xl border bg-card/70 p-4 shadow-sm backdrop-blur-sm` wraps the whole feed, even though nothing sits behind it to blur
- :292 Default shadcn look left untouched for controls. Evidence: The filter chips are stock `Button`s swapping `variant` between `default` and `outline` (292-321). The dialog is stock shadcn (dialog.tsx:38). Leftover neutral `--sidebar-*` template tokens sit unused in index.css:73-80
- :349 Over-explaining system note placed above the content. Evidence: A bordered box reading `Your feed posts are created when you log a catch or log a fishing site.` shows on every visit for signed-in users
- :366 Uniform rounded cards with soft shadows, nested card-in-card. Evidence: Every post is a shadcn `Card` (`rounded-xl border shadow-sm`, card.tsx:10) inside the `rounded-2xl ... shadow-sm` panel at line 289, so there are double borders and double shadows
- :413 Developer enum values leaked into the UI as a meta line. Evidence: `{post.type} • {post.scope}` renders CATCH • GLOBAL
- :449 Placeholder filler copy. Evidence: `{post.content ?? 'No text'}` prints the literal text No text as a post caption
- :451 Walls of identical cards: catch and site posts use one template. Evidence: Catch and site posts render the same card. The only differences are the text `Catch: {title}` (453) or `Site: {name}` (458) and a raw enum meta line (413). No catch data (species, weight, length) and no site data is shown
- :471 Lucide icon attached to every action label. Evidence: `ThumbsUp` + Like (471), `MessageCircle` + Comment (482), `UserPlus` + Follow (406), `Check` + Following (393), `SlidersHorizontal` + Local radius (328)

## pages/fishing/LogCatchPage.tsx
- :277 Exclamation-mark celebratory toast titles. Evidence: `toast({ title: 'Catch logged!', variant: 'success' })`; LogSitePage.tsx:47 `'Fishing site logged!'`
- :363 Walls of identical bordered boxes and identical headings across every page. Evidence: `grid gap-3 rounded-lg border p-4` form wrapper repeated in 6 pages (EditGearPage:96, EditSitePage:131, LogSitePage:69, EditCatchPage:282, LogGearPage:61); `text-2xl font-semibold` h1 repeated 12 times; `rounded border p-2` on 44 controls
- :373 Over-labelled form: placeholder repeats the visible label. Evidence: label "Catch title" + placeholder "Catch title"; "Notes"/"Notes" (390/393); "Length"/"Length" (687/691); "Weight"/"Weight" (712/716)
- :553 Bullet glyph separators as decoration. Evidence: "• {brand} • {type}"; also ImageUploader.tsx:81 "... • Max size: 10MB"

## pages/fishing/LogSitePage.tsx
- :47 Exclamation-mark success toast filler. Evidence: toast title 'Fishing site logged!'
- :69 Default shadcn scaffold left untouched: every page is a bordered box with a text-2xl h1 and raw inputs. Evidence: 'grid gap-3 rounded-lg border p-4' + h1 'text-2xl font-semibold' + inputs 'rounded border p-2'; the same pattern repeats at EditSitePage.tsx:131-133, MySitesPage.tsx:83-84, SiteDetailPage.tsx:81-97

## pages/fishing/MyCatchesPage.tsx
- :108 Copy-pasted list pages producing walls of identical bordered rows, each with the same outline Edit plus red Delete pair. Evidence: className="flex flex-wrap items-center justify-between gap-3 rounded border p-3" repeated identically at MyGearPage.tsx:106 and MySitesPage.tsx:101, same section/search/pagination classes on all three

## pages/fishing/MySitesPage.tsx
- :101 Wall of identical bordered rows nested inside a bordered box. Evidence: row 'rounded border p-3' inside section 'rounded-lg border p-4' (83) with a bordered thumbnail 'rounded-md border' (108); the catch rows repeat this at SiteDetailPage.tsx:119


---

# Appendix C. UX and accessibility problems found in the current build (file:line)

## ../index.html
- :7 The browser tab title is "client" with the Vite favicon, so the tab gives no product identity.
- :7 The browser tab and bookmarks read 'client' with the Vite logo favicon. A mobile-first app with safe-area handling ships no theme-color, manifest or touch icon, and no brand typeface is loaded (system font only).

## App.tsx
- :34 Unknown URLs silently redirect to the marketing page instead of showing a not-found message. A broken catch or site link looks like being logged out or sent home.
- :34 Inconsistent auth gating. My catches, sites and gear and Edit gear render only a signed-in branch, so signed-out users get a blank page under the chrome. Detail and edit pages have no gate at all. Unknown URLs silently redirect to the landing page with no not-found message.

## components/ChatBot.tsx
- :22 ChatBot, ChatInput, ChatMessages and TypingIndicator are dead code. Nothing in the client imports ChatBot; it was unmounted in commit 6017ab5, while POST /api/chat is still live on the server. The fishing assistant is therefore unreachable.
- :34 The chat plays sounds on every send and reply with no mute control. Errors show a generic pill with no retry. The empty state is a blank area with no guidance on what the fishing assistant can do. The chat's hard-coded gray and blue colours ignore dark mode.

## components/ChatInput.tsx
- :1 Icon libraries are mixed within the same app: lucide-react everywhere else, but react-icons MdErrorOutline and FaArrowUp in the chat components.
- :40 If the chat is revived, the send button is icon-only with no aria-label, and the textarea has no label and its focus outline removed (`focus:outline-0`), so there is no visible focus indicator.

## components/ChatMessages.tsx
- :28 Chat bubbles wrap ReactMarkdown output (which renders its own <p>, <ul> and similar) inside a <p>, which is invalid nesting. With no typography styles, markdown lists and headings render unstyled. There are no timestamps, no sender labels and no aria-live for new replies.

## components/ImageUploader.tsx
- :81 The helper line shows raw MIME types ('Accepted: image/jpeg, image/png, image/webp') instead of the human-friendly 'JPG, PNG or WebP'.
- :120 Pickers that allow multiple images still select one file at a time, because the hidden input has no `multiple` attribute. Uploading 8 catch photos takes 8 separate trips through the file dialog.
- :120 Image picker says "You can upload up to 8 images" but the file input has no `multiple` attribute and there is no drag-and-drop, so photos go in one at a time. The helper shows raw MIME types, errors mention "R2" and "Cloudflare R2", there is no image count, and the dropzone stays enabled at the limit. The <label> is not tied to any control.
- :129 The upload tile is styled as a dashed dropzone but has no drag-and-drop support, no paste support, no reordering and no cover-photo choice.
- :132 The dashed dropzone-style button implies drag and drop, but it only opens the file dialog on click. There are no drop handlers.
- :145 ImageUploader validation errors appear in a plain `text-red-500` paragraph with no role=alert or aria-live, using a hard-coded colour instead of the destructive token. After a validation error the input is not reset, so re-picking the same file may do nothing.

## components/TypingIndicator.tsx
- :5 The typing indicator's stagger classes `[animation-delay: 0.2]` and `[animation-delay: 0.4]` are malformed, so all three dots pulse in unison instead of in sequence.

## components/fishing/FishingActionBar.tsx
- :6 Mobile has no route to Add gear: the bottom bar lists only Feed, Catches, Sites and Gear plus a Log catch FAB, and the My gear page has no add button, so on phones /gear/new is unreachable without typing the URL.
- :6 Log site is unreachable on mobile. The mobile tab bar has Feed, Catches, Sites, Gear and a Log catch button only; 'Log site' exists only in the desktop dock. My locations and site detail have no create button either.
- :6 Navigation differs by breakpoint. Mobile has no Log site or Add gear entry. Neither variant has Home or Profile. Names drift ('Sites' on mobile vs 'Log site' / 'My locations' on desktop), and MapPin means 'list my sites' on mobile but 'create a site' on desktop, where the list uses LayoutGrid.
- :17 Navigation labels are inconsistent. The desktop dock says "My locations" and mobile says "Sites" for /sites/me. "Log catch" and "Add gear" share the identical Plus icon. Dock items show both a native title tooltip and a custom tooltip.
- :18 The desktop dock uses the identical Plus icon for 'Log catch' and 'Add gear' and labels items only in hover tooltips, so the two are indistinguishable without hovering and undiscoverable on touch laptops.
- :26 The fixed desktop dock (top-[5.25rem], about 84 to 150px) floats over hero content. At md widths (768 to 1023px), where the hero only has py-16, it likely covers the pill badge and top of the h1. It keeps covering content while scrolling.
- :26 The desktop dock is fixed at `top-[5.25rem]` and overlays feed cards while scrolling. Its items are icon-only, relying on hover tooltips, and two different actions (Log catch, Add gear) share the same Plus icon.
- :26 No nav item is active on /catches/:catchId or /catches/:catchId/edit, so the angler gets no sense of place. On desktop the fixed dock at top-[5.25rem] floats over scrolling content such as the hero photo.
- :26 The desktop dock stays fixed below the header and floats over form content when scrolling, which can cover fields and the map.
- :26 About 150px of permanent top chrome on desktop. The sticky header (~69px) and a separate fixed dock at top 84px both stay on screen while scrolling, and content scrolls underneath the dock pill. The 96px spacer only offsets the first paint.
- :32 On /gear/:gearId/edit no nav item is highlighted, because the NavLink to /gear/me doesn't match. On mobile, /gear/new also highlights nothing.
- :34 The dock hover lift and scale probably snap instead of easing. The transition list is `transform,...` but Tailwind v4's translate and scale utilities animate the separate `translate`/`scale` CSS properties (inferred, not browser-verified).
- :37 In dark mode the dock hover pairs the near-white foreground icon with the teal accent background (`hover:bg-accent hover:text-foreground`), about 1.9:1 contrast.
- :41 The desktop dock is icon-only, with labels only in hover or focus tooltips, and two different actions share the same Plus icon (Log catch, Add gear). Create and browse actions are interleaved with no grouping. Each item also has a native `title`, so a second browser tooltip appears on top of the custom one.
- :54 Three navigation landmarks (header nav, desktop dock, mobile tab bar) have no aria-label to tell them apart.
- :69 The active mobile tab label is 11px `text-primary` on the background, about 3.8:1 contrast, which fails WCAG AA for small text. The default Button's primary-foreground on primary is also about 3.8:1 for 14px labels, and destructive white-on-red is about 4.1:1.

## components/fishing/GoogleMapLocationPicker.tsx
- :28 No map search or address lookup, the default view is the center of the contiguous US at zoom 4, and there is no loading placeholder while the Maps script loads (an empty 320px bordered box). The unused parseGoogleMapsCoordinates helper shows a paste-a-link feature was considered but never wired up.
- :131 On Edit location, the map picker requests the device location as soon as it mounts and, if allowed, silently overwrites the site's saved latitude and longitude with wherever the user is standing. Saving then moves the spot.
- :131 The location permission prompt fires on page load with no user action, on both Log site and Log catch.
- :135 Developer and vendor jargon in user-facing copy: the map error tells users to 'Set VITE_GOOGLE_MAPS_API_KEY', uploads say 'Uploading to R2...' and 'Could not upload image to Cloudflare R2.', and the uploader helper lists raw MIME types 'image/jpeg, image/png, image/webp'.
- :135 The map failure message exposes a developer env var to anglers ("Set VITE_GOOGLE_MAPS_API_KEY"). The map defaults to the centre of the USA at zoom 4, has no place search or coordinate readout, and the geolocation error uses the same muted grey as helper text.
- :141 The map picker's init effect depends on onChange, which the page recreates on every render. Any re-render (weather loading flag, unit select, date, gear toggle) rebuilds the map and marker and re-runs geolocation, so a manually placed pin can snap back to the device location.
- :144 The picker never shows existing coordinates on first load. The sync effect returns early before the map exists and does not re-run after init, so on Edit (with location denied) the pin sits at the US center at zoom 4 while the inputs show the saved coordinates.
- :148 Coordinate inputs show no units, format or range. Every keystroke pans and zooms the map to 14, and clearing a field sends the pin to 0 because Number('') is 0.
- :164 When the map fails to load, the whole picker, including 'Use current location', is replaced by a grey sentence, leaving only manual lat/lng typing.
- :185 The picker's location error is grey `text-xs text-muted-foreground`, not styled as an error, so it is easy to miss.

## components/landing/LandingFaq.tsx
- :43 FAQ is a static stack of fully expanded cards with no disclosure pattern. It adds length without letting users scan questions.

## components/landing/LandingFeatures.tsx
- :14 Marketing copy promises features the app does not have: trip planning, seasonal recommendations, tournament prep, and a "Trip plans generated" stat. App routes only cover catches, sites, gear, feed and profile (App.tsx:19-35).
- :45 Anchor jumps (#features, #use-cases, #faq) have no scroll-margin-top. The sticky header (about 69px) and on md+ the fixed dock hide the section heading after the jump.
- :81 The #use-cases target has no heading or label, so the jump lands on two cards with no context.
- :94 Low-contrast micro text: text-xs uppercase labels in text-primary/80 on bg-muted/30 or bg-card/60 risk falling below 4.5:1, especially in light mode.

## components/landing/LandingFooter.tsx
- :10 Footer Privacy and Terms are href="#" dead links. "Contact" points to #faq, which contains no contact information.

## components/landing/LandingHeader.tsx
- :8 The header on the app's profile page still shows marketing anchors (Features, Use cases, FAQ) instead of app navigation (Feed, My catches, Sites, Gear).
- :8 The header on every app page shows marketing anchors (Features, Use cases, FAQ) that do full navigations back to the landing page, while real app destinations live only in the dock.
- :17 The header content width (max-w-6xl) and feed width (max-w-4xl) do not align, so the brand and feed column edges are offset on desktop.
- :17 The header container (max-w-6xl) and page content (max-w-4xl) have different widths, so the logo and page content don't share a left edge on desktop.
- :20 Wordmark plus three header controls likely crowd a 375px-wide row (px-4 gutter), risking the "Fullstack AI Angler" text wrapping to two lines.
- :28 On mobile a signed-in user has no route to /profile from the home page. The Profile link is md+ only, the hamburger is dead, and the bottom bar has no profile tab.
- :28 The profile page cannot be reached on mobile. The only link to /profile is in the header nav, which is `hidden md:flex`. The mobile hamburger button has no onClick, ProfilePage has no FishingActionBar, and no other file links to /profile.
- :29 The Clerk loading gap causes layout shift. Neither Show branch renders until Clerk resolves, so Sign in or the avatar and the Profile link pop in after first paint.
- :38 Header section links are plain <a href="/#...">, not router Links. Because this header is on every page, clicking Features, Use cases or FAQ from an in-app page (e.g. /catches/new) does a full reload back to the marketing page, and marketing links clutter the app navigation.
- :52 There is no sign-up path for new visitors. The only auth entry is a small header "Sign in" (Clerk modal); the hero primary CTA does not open sign-up or sign-in.
- :53 Small tap targets: header "Sign in" is h-8 (32px), theme toggle and hamburger are 36px, footer links are unpadded 14px text (about 20px tall), and mobile tab labels are text-[11px].
- :63 The mobile hamburger button does nothing (no onClick, no sheet). Below md the nav is hidden, so phone users cannot reach Features, Use cases, FAQ or (when signed in) Profile from the header.
- :63 The mobile hamburger button in the header has no handler and does nothing. The header also shows marketing anchors (Features, Use cases, FAQ) inside the app.
- :63 The mobile 'Open navigation menu' button has no onClick, so it is a dead control on every page in this group. The header's Features / Use cases / FAQ links jump to the landing page from inside the app.
- :63 The header's mobile menu button has no onClick, so tapping it does nothing. Profile and the landing links are therefore unreachable on mobile.
- :63 The mobile hamburger menu button is a dead control: it has an aria-label but no handler and no menu.
- :63 The header's mobile hamburger button has no handler and does nothing. Header nav links on these app pages point to landing-page anchors (Features, Use cases, FAQ).
- :63 The mobile hamburger button has no onClick and no menu behind it, so it is a dead control. The header text nav, including the only Profile link, is `hidden md:flex`, so /profile can't be reached from the app UI on phones.
- :63 While Clerk resolves auth, neither Show branch renders, so the page is briefly blank below the chrome. The header's mobile Menu button has no handler (a dead control).

## components/landing/LandingHero.tsx
- :24 On mobile the hero stacks text, CTAs, placeholder box, activity panel and three stat cards before any real product information. The fake stats push the Features section several screens down.
- :40 Both hero CTAs are dead. "Get early access" and "View product tour" have no onClick, href or asChild link.
- :63 The hero "Live activity panel" card shows an ArrowUpRight link affordance, and feature cards change opacity on hover, but neither is clickable. These are false affordances.

## components/landing/LandingThemeToggle.tsx
- :26 Theme flashes light on load for dark users. The .dark class is applied in useEffect after first paint and index.html has no pre-paint script.
- :26 Theme is applied in an effect after mount with no pre-paint script, so dark-preference users see a light flash on every load. `color-scheme` isn't declared, so native selects, date pickers and scrollbars stay light in dark mode. Clerk sign-in and UserButton get no appearance theming.
- :28 The toggle writes localStorage on first mount, freezing the OS colour-scheme preference. Later OS changes are ignored, and there is no system option or matchMedia listener.

## components/profile/ProfileSettingsPanel.tsx
- :131 When the profile fails to load, the user gets a toast plus a page full of 'Unavailable' values, zero counts and blank required inputs, with no inline error or retry button.
- :227 Save toasts expose backend internals ('Profile saved to database', 'Saved to Clerk fallback profile', 'Database is unavailable, so your profile was saved to Clerk metadata.').
- :238 Saving the profile always sends the user away to the home page, so they never see the saved result and cannot keep editing.
- :241 Every save failure (duplicate username 409, validation 400, server 500) shows the same generic toast, 'Please review your values and retry.' Specific server messages such as 'That username is already in use.' are thrown away, and no field is highlighted.
- :267 The summary grid gives the 64px avatar a full third of the width at sm and up (`sm:grid-cols-3`), which leaves a large empty column.
- :269 The two avatar displays disagree. After upload, the picker shows the new avatar as a 4:3 rectangle while the circular summary avatar keeps the old one until save. An uploaded but unsaved avatar is silently discarded when the user leaves, with no unsaved-changes warning.
- :293 The identity summary shows the email and an internal database 'User ID' (meaningless to an angler) but not the display name, @username or bio. 'Last profile update' is system metadata presented at the same level as 'Joined'.
- :313 The Followers and Following tiles are native buttons with no hover state, no focus-visible style, no aria-haspopup and no visual cue (chevron or 'View') that they open a list.
- :345 Page order buries the edit form: the read-only gallery (up to 12 images) sits between the stat tiles and the form, pushing Save far below the fold. The page title says 'Profile settings' but mixes public-profile content with settings.
- :351 Gallery tiles are dead ends. They are not links even though sourceId is available. The badge shows the raw enum 'CATCH' or 'SITE' at 10px. The gallery is silently capped at 12, with catches first, so sites can be cut off, and there is no 'see all' link.
- :369 The empty gallery state is a single muted sentence with no button or link to /catches/new or /sites/new.
- :381 The form uses raw inputs with no custom focus style, no placeholders and no inline errors, which is inconsistent with the shadcn buttons and their 3px focus ring.
- :402 The Username field enforces `pattern="[a-zA-Z0-9_]+"`, 3 to 40 characters, with no helper text. Users only get the browser's generic 'match the requested format' tooltip. There is also no @ prefix to show it is a handle.
- :414 The Bio field has a 280-character maxLength but no counter. Typing simply stops at the limit with no explanation.
- :436 'Manage account / delete in Clerk' is an outline button with the same size as, and directly beside, the primary Save button. The word 'delete' in the label and the vendor name make it confusing, and it is easy to hit by mistake.
- :449 On close, the dialog title is cleared immediately, so during the exit animation the description reads 'Browse and search your  list.'
- :464 The connections search input has only a placeholder, no label or aria-label. It fires a request on every keystroke with no debounce, and each keystroke replaces the list with the text 'Loading...', which causes flicker.
- :478 Connection rows are not actionable: no link to the person, no follow or unfollow, no pagination. 'No users found.' is shown both when the user has no followers and when a search has no matches.

## components/r2-image-picker.tsx
- :32 The site image picker is limited to one image by mistake. LogSitePage passes label 'Site images' and maxItems 12 but no `multiple`, and R2ImagePicker defaults `multiple` to `scope === 'catch'`. Sites therefore show 'Upload one image.' and reject a second upload.
- :32 Site images only accepts one photo. R2ImagePicker's `multiple` defaults to false for scope 'site', so the helper says 'Upload one image.' and a second image is rejected, even though maxItems={12} is passed and the API allows 12.
- :46 Upload feedback is split across two patterns: type and size errors show inline under the tile (ImageUploader), while network, limit and single-image errors show as toasts (R2ImagePicker).
- :47 'Maximum 1 images allowed.' is ungrammatical for the single-image gear picker.
- :102 Upload progress is only a small inline 'Uploading to R2...' loader, with no per-file progress or count. The select tile stays enabled during upload. A second selection made mid-upload runs with the older `value` closure and can overwrite the first upload's result when it calls onChange.
- :125 The single-image picker won't replace: choosing a second photo gives the error toast 'Only one image is allowed here.', forcing remove-then-reupload. This is awkward on a field labelled 'Replace image'.
- :125 Single-image pickers (avatar, gear) cannot replace an image in place. Choosing a new file while one exists shows an error toast telling the user to remove the current image first.
- :143 The picker's <label> has no htmlFor and isn't associated with the hidden file input.
- :143 The picker's `<label>` is not associated with any control (no htmlFor), so screen readers do not announce 'Avatar image' or 'Catch images' for the select button.
- :158 Save catch is not disabled while images are still uploading, so a catch can be saved without in-flight photos.
- :159 Implementation jargon in user-facing copy: 'Uploading to R2...', 'Could not upload image to Cloudflare R2.', and raw MIME types in the helper line.
- :174 'Remove image' acts instantly with no confirmation or undo, and nothing indicates the change is unsaved until the parent form is submitted.

## components/ui/button.tsx
- :25 Row action buttons in the My catches, sites and gear lists use Button size sm (32px tall), below comfortable touch size, right next to a destructive Delete.

## components/ui/card.tsx
- :33 Card titles (feature names, FAQ questions, stat labels) render as divs via CardTitle, not headings. This flattens the document outline for screen readers; only the h1 and the two h2s are real headings.
- :33 CardTitle renders a div rather than a heading, so card titles aren't in the document outline for assistive tech.

## components/ui/carousel.tsx
- :100 The carousel has no swipe or drag on touch devices, no keyboard arrow support, no slide position indicator, and 32px arrow buttons overlaid on the photo. Feed images all use the generic alt text 'Post'.
- :137 The image carousel has no swipe gesture on touch devices, no position indicator or count, and 32px arrow buttons (below a 44px tap target). Images cannot be opened full size.

## components/ui/dialog.tsx
- :21 The dialog has animate-in/animate-out with no fade or zoom modifiers, so it pops in and out abruptly while still waiting out a 200ms duration on close.
- :38 DialogContent is `w-full max-w-lg` with no horizontal margin, so on phones the modal touches both screen edges. Its close button has `focus:outline-none` with no replacement focus indicator.
- :38 The dialog has no side margin on narrow screens (`w-full max-w-lg`), so it runs edge to edge with rounded corners on phones. It also has no max-height or scroll for long content such as the connections list.
- :44 The unfollow confirm button uses the primary variant rather than destructive. The dialog closes before the request resolves, with no feedback. The dialog's close X uses `focus:outline-none`, so keyboard focus on it is invisible.
- :44 The dialog close X removes its focus outline (`focus:outline-none`) with no replacement, so keyboard users can't see focus on it.
- :73 On phones the dialog is `w-full` with no side margin, and its stacked footer buttons have no vertical gap (`sm:space-x-2` applies only from sm).
- :73 DialogFooter stacks buttons on mobile with no gap (spacing is `sm:space-x-2` only), so Cancel and Unfollow touch. The unfollow confirmation also uses the primary blue button rather than a destructive style.

## components/ui/fishing-bobber-loader.tsx
- :17 The loader box has no fixed height and is swapped for content on arrival, causing layout jumps. There is no error fallback, so pages whose fetch fails can sit on the loader indefinitely alongside an error toast. The upload label exposes vendor jargon ('Uploading to R2...').
- :26 The bobber loader's infinite float and ripple animation ignores prefers-reduced-motion and uses hardcoded red, white and sky colours that do not adapt to dark mode.
- :28 The loader's infinite bobbing animation has no prefers-reduced-motion override.
- :28 The loader animation loops indefinitely with no prefers-reduced-motion fallback.
- :28 The bobber loader is likely drawn misaligned. The animated body and ripple carry both Tailwind's `-translate-x-1/2` (CSS `translate`) and a keyframe `transform: translate(-50%)`, so they shift half their width left of the static cap and stem. The white body (`bg-white border-white/60`) is also nearly invisible on the near-white light background, and its palette colours ignore theme tokens.

## components/ui/slider.tsx
- :30 The slider thumb is 20px, well under a 44px touch target. The Feed radius slider has no accessible name because the visible 'Local radius' text isn't linked, and its minimum of 0 km is a meaningless radius.

## components/ui/toast.tsx
- :20 Toasts are not announced to assistive tech: no role=status or aria-live on the toast or the Toaster container. They also appear and vanish without animation after 4.5s, overlapping the sticky header.
- :21 Toasts have no role or aria-live, so screen-reader users never hear save or error results. Success and error differ only by a thin pastel border (no icon or wording cue). They auto-dismiss after 4.5s with no pause on hover or focus, and have no enter or exit animation.

## components/ui/toaster.tsx
- :8 On mobile the toaster is `fixed right-4 w-full px-4`, which pushes toasts flush against the left screen edge with an uneven right gap, overlapping the sticky header.
- :8 On phones the toast stack (fixed top-4 right-4, w-full, px-4) is shifted so toasts touch the left screen edge and cover the sticky header and user menu. Success and error differ only by border colour (emerald-300 vs red-300), with no icon.
- :8 On mobile the toast stack is `fixed right-4 w-full px-4`, which pushes its left edge off-screen. Toasts sit flush against the left edge with a 32px gap on the right.
- :8 On phones the toast stack is `fixed right-4 w-full px-4`, so toasts touch the left screen edge with a 32px gap on the right.

## components/ui/use-toast.ts
- :17 Toast ids use `crypto.randomUUID()`, which only exists in secure contexts. Testing on a phone over plain http on a LAN IP would throw inside every toast() call.

## index.css
- :119 Raw input, select and textarea elements have no focus style of their own, only the global outline-ring/50 tint on the browser outline. That does not match the 3px focus ring on shadcn Buttons in the same forms.
- :122 The global body style has `pb-24` on mobile to clear a bottom action bar, but ProfilePage has no action bar, so 96px of blank space is left at the bottom.
- :152 No reduced-motion handling anywhere in live CSS: the infinite bobber float and ripple, dock magnification, carousel slide and smooth scrolling all ignore prefers-reduced-motion.

## main.tsx
- :11 A missing Clerk publishable key throws before React renders, leaving a blank white page with no visible error.
- :17 Clerk components (sign-in modal, UserButton menu) get no appearance config, so they do not follow the app's dark mode.
- :22 Scroll position isn't reset on route change (BrowserRouter with no ScrollRestoration or scrollTo anywhere), so opening a detail page from a scrolled list can land mid-page.

## packages/server/services/fishing.service.ts
- :554 Saving the edit form silently wipes data shown on the detail page. Humidity and UV index are always written as null (fishing.service.ts:184-185), so those tiles disappear after any edit. The fish count is reset to 1 because the form never sends count (fishing.service.ts:554). waterTemp is also nulled.
- :635 Logging a site silently creates a public GLOBAL feed post with its description and coordinates. The form never tells the angler their spot will be published.

## pages/HomePage.tsx
- :4 Signed-in and signed-out users get the identical marketing page. HomePage has no auth branch, so a signed-in angler lands on "Get early access" and fake stats with no recent catches, no quick log and no personal summary. Only the header auth control and a desktop-only Profile link differ.
- :8 The action bar is placed after the footer. Its md+ h-24 spacer plus the pb-16 wrapper leave about 160px of blank background under the footer on desktop. On mobile, pb-16 plus body pb-24 (index.css:122) do the same.
- :9 The action bar is rendered for signed-out visitors. Catches, Sites and Gear (and the My catches, My locations and My gear dock items) open pages wrapped only in Show when="signed-in" with no signed-out fallback, leaving an empty page and a dead end (e.g. MyCatchesPage.tsx:91, MySitesPage.tsx:82, MyGearPage.tsx:87).
- :9 The app nav is mounted on the landing page for signed-out visitors. The dock floats over the hero, the mobile tab bar and FAB link to auth-gated pages, and the desktop spacer renders after the footer as extra blank space.

## pages/ProfilePage.tsx
- :10 No shared layout route: 13 pages each mount the header and nav themselves. ProfilePage omits FishingActionBar, so it has no app nav, yet body `pb-24` still reserves 96px of empty space at the bottom on mobile.
- :12 There is no loading fallback for Clerk's auth check: while Clerk initialises, both <Show> branches render nothing and the main area is blank.

## pages/fishing/CatchDetailPage.tsx
- :14 The detail page drops the social and context data the API already returns: angler (createdBy.displayName/username), likeCount, commentCount, species.scientificName, count, depth and the weather icon. There is no way to see who caught it or to like or comment.
- :59 Neither page handles load failures. A deleted or nonexistent catch, a network error, or (on edit) a signed-out user hitting the auth-only /api/gear leaves the bobber loader spinning forever. There is no not-found message, retry or sign-in prompt.
- :146 Dead ends. The detail page has no Edit, Delete or back link, even for the owner. The edit page has no Cancel/Back and no Delete. Delete exists only as a native window.confirm on the My catches list (MyCatchesPage.tsx:67).
- :146 Dark mode breaks the detail card. The article is hardcoded bg-white while text inherits the light dark-mode foreground, so the title, species, notes and site link become near-invisible. Tiles use fixed slate colours.
- :149 Gallery is minimal and inaccessible. Every photo has alt="Catch". Text 'Prev'/'Next' buttons sit on the photo with no position counter, dots or thumbnails, and there is no swipe or keyboard support. A fixed h-96 with object-cover crops portrait fish photos. activeImage is not reset when catchId changes.
- :191 The caught date uses raw toLocaleString, which includes seconds and depends on the browser locale (e.g. '15/09/2026, 10:30:00').
- :193 Weak hierarchy on detail. Species, the key fact, is a plain 16px 'Species: X' line under the date. Group labels Gear/Conditions/Size/Site are <p className="font-medium"> at body size rather than headings, so the document outline has only the h1. Notes come last, after the map, with no heading.
- :239 Hardcoded light colours break dark mode on catch detail: white article and slate-50 stat tiles with slate-900 text stay light on a navy page.
- :252 The Size group always renders two tiles showing only a dash when length and weight are empty, which is noise rather than information.
- :290 The embedded Google Map is a 256px interactive iframe that can capture scroll and touch on mobile. It has no 'open in maps' or directions link, and the site name link is just underlined text.

## pages/fishing/EditCatchPage.tsx
- :108 The browser location permission prompt fires as soon as the edit page mounts, with no explanation. If denied, it fails silently and only surfaces later as the 'No coordinates available' toast.
- :121 Edit page has no client auth gate. Signed-out visitors wait on an endless loader. Signed-in non-owners can open another angler's catch in the editor, fill it in, and get no feedback when the save fails.
- :193 Save has no submitting state and no error handling. The Save button never disables, so double submits are possible. Any 400/401/404/500 is an unhandled rejection with no toast or inline error. Examples: a 1-character title (server needs 2), whitespace-only notes, a rebuilt snapshot with an empty iconBaseUri failing .url(), or a non-owner saving (404).
- :229 'Load latest conditions' pulls weather as of right now, not when the fish was caught, and overwrites the stored historical conditions with no confirmation or undo. The label 'latest' does not explain this.
- :230 Condition refresh uses the catch's originally saved site, not the site currently chosen in the dropdown. The select is uncontrolled, and the lookup uses item?.site?.id. Changing the site and then refreshing fetches weather for the old location.
- :255 When the upstream weather lookup fails, the server returns HTTP 200 with weather: null (fishing.controller.ts:48-54). The client then clears Overview and all read-only condition fields but still shows the success toast 'Conditions updated'.
- :280 The edit form cannot change species, fish count, depth or photos. Species shows on detail as 'Species: Not specified' with no way to fix it here, and images cannot be added, removed or reordered after logging.
- :285 Title, date/time, notes and site have no visible label, placeholder or aria-label. The form opens as four unexplained boxes, and screen readers announce unnamed fields.
- :288 Raw native controls have no designed focus style (only the browser outline tinted by global outline-ring/50), which is inconsistent with the 3px ring on shadcn buttons on the same form.
- :294 The edit form saves the wrong catch time on every save. The datetime-local default is the UTC time (ISO string sliced), but on submit the value is parsed as local time. In Africa/Johannesburg (UTC+2) each save moves the catch 2 hours earlier. The same catch also shows different times on detail (toLocaleString, local) and edit (UTC).
- :308 Inconsistent terminology between the two catch pages: 'Site' on detail vs 'No fishing spot selected' on edit; 'Wind gusts' vs 'Wind gust'; 'Gear' vs 'Gear used'. The action bar also mixes 'Sites' and 'My locations'.
- :324 The gear checklist lists every gear item from every user (gear.service.ts:132-138) and the site dropdown lists every user's sites (fishing.service.ts:330-341). The gear list is a long, unsearchable run of checkbox rows, pushing Save far below the fold. Selected rows get no highlight, and the server's 20-item limit is never shown.
- :378 Mixed typography inside one form. Title/Date/Notes/Site inputs render at 16px regular, while inputs nested in labels (Overview, conditions, Length, Weight) inherit text-sm font-medium and render at 14px medium.
- :392 The read-only Temperature, Cloud cover, Wind and Wind gust inputs look identical to editable inputs, so users will try to type in them. Precipitation, Humidity and UV index shown on detail are missing from the editor entirely.
- :450 Unit selects (cm/ft, kg/lbs) do not convert the number already typed. Switching cm to ft on a 45 cm fish saves it as 45 ft (1371.6 cm). 'ft' with step 0.1 is an odd unit for fish length (inches missing). There is no min attribute. Detail always shows cm/kg regardless of what the angler entered.

## pages/fishing/EditGearPage.tsx
- :42 Edit gear fetches the entire /api/gear/me list and searches it client-side to find one item.
- :52 If loading gear fails, the error toast fires but gear stays null, so the 'Loading gear...' bobber animates forever with no retry or way out.
- :77 An existing gear photo can't be removed. The image is only sent when replaced, and 'Remove image' only clears a newly uploaded file. The current photo sits outside the 'Replace image' card and silently vanishes once a new one uploads.
- :81 Edit gear save has no try/catch, no submitting state and no disabled button. A failed PUT (for example a 400 for a whitespace-only name) gives no feedback, and double submits are possible.
- :99 The Edit gear inputs have neither labels nor placeholders. If the angler clears a field, nothing indicates which field it is.

## pages/fishing/EditSitePage.tsx
- :126 Edit location has no auth or owner gate. Signed-out users and non-owners see a fully editable form and only learn on save, through a generic 'Unable to update location' toast.
- :129 Images cannot be added, removed or replaced after creation. Edit location has no image picker, and the update API has no images field.
- :133 Terminology is inconsistent for the same object: 'Log fishing site', 'Edit location', 'My locations', 'Sites' tab, 'Unable to load your sites', 'Location deleted'. Toast phrasing also varies ('Check your values and try again.' versus 'Please check your values and try again.').
- :134 Every Edit location field has no label; they rely on placeholders that disappear once filled. Log site labels the same fields, so the two pages are inconsistent and the edit form fails accessibility basics.
- :150 Edit location has two different current-location buttons ('Use my current location' in the Location options box and 'Use current location' in the picker) with different feedback (toasts versus inline grey text).

## pages/fishing/FeedPage.tsx
- :91 Filter, scope and radius choices are not reflected in the URL or persisted, so they reset on every visit or back navigation. Filters and slider are not sticky and scroll away while browsing.
- :107 `isLoading` starts false, so `No feed posts found.` flashes on first paint before the initial fetch starts.
- :126 The Local scope never asks the server for nearby posts. It always sends `scope: GLOBAL`, then filters on the client only the 25-post pages already loaded. Nearby posts beyond those pages stay invisible, and the server's NEARBY radius query is dead code.
- :142 Geolocation is requested again with `enableHighAccuracy: true, maximumAge: 0` and an 8s timeout on every load in Local mode: the first page, every infinite-scroll page, and after every like, comment, follow and unfollow. That adds repeated GPS delays and battery drain.
- :180 A feed load error only shows a transient toast. The list area keeps stale posts or shows the misleading `No feed posts found.`, with no inline retry.
- :204 Infinite scroll depends only on the window scroll event, with no IntersectionObserver or Load more button. When filtering leaves the page shorter than the viewport (typical in Local), no scroll event can fire, more pages never load, and the user hits a dead end on the empty radius message.
- :228 Local mode drops any post without coordinates. Catch posts are created without latitude/longitude (server fishing.service.ts:443-451), so Local plus Catch feed is always empty, and Local plus All only ever shows site posts. Nothing in the UI explains this.
- :245 Like has no optimistic update or pending state. Each click refetches page 1, discarding every page loaded beyond the first and jumping the scroll position. Double clicks send two toggles.
- :245 Like, comment, follow and unfollow have no error handling at all. Failures become unhandled promise rejections with no user feedback, and successes get no confirmation either.
- :289 Stacked padding (main px-4, panel p-4, card px-4) leaves about 48px of horizontal padding per side on a 375px phone. Card-in-panel nesting also doubles borders and shadows.
- :291 Five toggle buttons mix two independent filters (scope Global/Local and type All/Catch/Site) in one row with identical styling and no grouping or labels. They have no aria-pressed or radiogroup semantics, wrap to multiple lines on phones, and the `All feed / Catch feed / Site feed` wording is redundant.
- :333 The radius slider has no accessible name (no aria-label, the visible `Local radius` label is not associated with it), allows 0 km (which shows nothing), and is km only. It re-filters silently with no count of matching posts.
- :348 The signed-in helper note is permanent, takes space above the posts, and names two actions (log a catch or site) without linking to them.
- :373 No author avatar is shown although `author.avatarUrl` is returned, so the only identity cue is two lines of small text.
- :382 The `Following` status pill is a raw button about 24px tall with no hover or focus-visible style. A control that looks like a status badge unexpectedly opens a confirmation dialog.
- :413 The meta line shows raw enums `CATCH • GLOBAL`. Scope is always GLOBAL, so half of it is noise. There is no post date or time even though `createdAt` is returned, and no distance even in Local mode where it is computed.
- :429 Every feed image has the alt text `Post`, which gives screen reader users nothing about the photo, catch or spot.
- :449 Posts without notes or description show the literal caption `No text`.
- :451 Cards are dead ends. The catch title, site name, images and author are not links, even though `/catches/:catchId` and `/sites/:siteId` detail pages exist and author ids are available.
- :463 Signed-out users see a clickable Like button, but the endpoint requires auth. The 401 is swallowed (no try/catch, no toast) and nothing prompts sign-in.
- :466 The liked state is shown only by colour (`text-primary`). The label stays `Like`, the icon is not filled, and there is no aria-pressed, so the state is invisible to screen readers and weak for colour-blind users.
- :487 The counts line is not pluralised (`1 comments`, `1 likes`) and sits below the Like/Comment buttons instead of next to them, so the count and its action are separated.
- :495 Only the 5 most recent comments come back (newest first). There is no `View all N comments` even when `commentCount` is higher, so older comments cannot be reached, and comments have no timestamps or delete-own option.
- :512 Signed-out users can open comments but get no composer and no prompt to sign in to comment.
- :514 The comment input has no label or aria-label (placeholder only), bypasses the design system's input styling, has no maxLength (server limit 1000), and pressing Enter does not submit because there is no form.
- :528 The comment send button is icon-only with no aria-label, is never disabled for empty input (it silently ignores the click), and shows no submitting state, so duplicate posts are possible.
- :548 Loading feedback is small muted text placed after the post list, so during a reload triggered by a like or comment it renders below existing posts and is usually off-screen. There is no skeleton, and it is inconsistent with the FishingBobberLoader used on MyCatchesPage, MySitesPage, CatchDetailPage and others.
- :558 When location access fails, the red error in the radius panel is paired with the empty message `No posts found inside this radius yet.`, which wrongly blames the radius. There is no retry or Use Global option.
- :558 The empty, loading-more and end-of-feed messages can show at the same time (for example `No posts found inside this radius yet.` together with `You reached the end of the feed.`). Empty states have no call to action such as log a catch or widen the radius.

## pages/fishing/LogCatchPage.tsx
- :149 For Other, empty custom coordinates count as a valid location: Number('') is 0, which is finite. Weather is fetched for 0,0, and the "Drop a pin on the map" check never fires, so if the map fails to load or geolocation is denied, a site is created at 0,0. The helper text claiming weather is cleared without coordinates is therefore wrong.
- :151 A selected site that has no coordinates silently falls back to the device location for weather, with no indication.
- :163 The weather snapshot is always current conditions, even if the angler backdates "Date and time". caughtAt is not passed to the weather lookup, so a catch logged hours later gets the wrong weather stored.
- :176 Weather refetches on every coordinate change (every pin drag or click, every geolocation update) with no debounce or abort, so responses can arrive out of order and overwrite newer data.
- :204 "Use current location" (the default) does not save any location. It only feeds the weather lookup; the catch is posted with siteId null and no coordinates. The label promises something the save does not do.
- :229 Double-submit risk: isSaving is only set after the Other-site POST. During site creation the Save button is still enabled, and a repeat click can create duplicate sites. If the catch save then fails, an orphan site is left behind.
- :280 On a 500 error the page silently resubmits without images and the photos are dropped, with a neutral toast that blames upload reliability. Uploaded files stay orphaned.
- :305 Validation lives only in top-right toasts that auto-dismiss after 4.5s. No inline messages, no field focus, no aria-live on the Toaster container. Server 400s (for example a 1-character title, which fails min 2) have no message, so the angler just sees "Check your values and try again."
- :361 No draft or autosave and no unsaved-changes guard. Navigating via the always-visible dock or bottom nav discards a half-filled catch and leaves uploaded photos orphaned.
- :366 The options loader appears inside the form while every field below is already interactive, so dropdowns show empty or "no gear" states during loading.
- :369 No species field at all. The Catch model has speciesId/species (schema.prisma:123-124), but the form never asks what fish was caught, so the free-text title has to carry it.
- :371 Title and notes have no maxLength or character counts, although the server enforces 2-120 and up to 2000 characters. datetime-local gives no timezone cue.
- :374 There are no Input, Select, Textarea or Label primitives. About 60 raw controls use at least four different class recipes (`rounded border p-2`, `w-full rounded border px-3 py-2 text-sm`, `rounded-md border border-border bg-background px-3 py-2`, `rounded-full border px-3 py-2 text-sm`). None has its own focus or invalid styling or a background token, and they don't match Button radius, height or type size in the same form.
- :389 Field order is not how an angler thinks: free-text Notes comes before location, gear and measurements; the read-only weather block sits between gear and length/weight; photos (often the main thing) are at the very bottom. One long single-column form with no progressive grouping or sticky save.
- :401 Location and Gear dropdowns are hand-built inline disclosures. No aria-expanded, no listbox or option roles, no arrow-key navigation, no close on outside click or Escape, no selected marker in the list, and ▲/▼ text glyphs instead of icons. Their search inputs have no label.
- :411 Wording drifts between location, spot and site, and the same option has two names: the trigger says "Other (create new location)" while the list row says "Other (add new spot)". "Use current location" also appears twice with different meanings (dropdown default vs the map button).
- :474 The customSpot input has native `required`, so the browser bubble fires first and the custom "Site name is required" toast is unreachable. Two validation styles are mixed.
- :514 Gear list loads GET /api/gear, which returns every user's gear (gear.service.ts listGear has no owner filter), so anglers pick from strangers' kit. The empty state "No gear found in the database yet." is also a dead end with no link to /gear/new, and it shows while gear is still loading.
- :532 Raw inputs, selects, checkboxes and dropdown row buttons have no designed hover or focus state. Only shadcn Buttons get a focus ring; the rest rely on the browser outline tinted by outline-ring/50. Native checkboxes and p-2 rows are small tap targets.
- :565 Similar pages behave differently: Edit catch has a manual "Load latest conditions" button with success and error toasts, and an editable Overview field (EditCatchPage.tsx:368-377). Log catch auto-fetches silently into read-only fields.
- :573 Weather is shown as 8 read-only text inputs that look identical to editable fields. Empty values show blank boxes plus the literal text "Weather icon". Fetch failures are silent (the server's weatherError is ignored).
- :697 Unit choices are odd and unlabelled: fish length offers cm or ft (no inches), and weight kg or lbs with 0.1 step. Each unit select sits inside the same <label> as the number input, so the select has no accessible name. Spin buttons are hidden, there is no min, 0 becomes null, and negatives only fail on the server with a generic message.

## pages/fishing/LogGearPage.tsx
- :47 Server validation (trimmed, 1-120 chars, gear.schema.ts:19-20) isn't mirrored client-side (no maxLength). A whitespace-only name passes 'required' and then fails with the generic toast 'Unable to save gear', with no field error.
- :59 The Add and Edit gear forms have no Cancel or Back link. Leaving means using the nav.
- :64 Gear form fields have no <label> or aria-label. Name and Brand rely on placeholders that disappear once typed, and the Type select has neither label nor placeholder, so screen readers announce unnamed fields.
- :76 Raw inputs and selects use only 'rounded border p-2', with no background, height, text size or focus-visible ring. They look and focus differently from the shadcn Buttons beside them, and the native select has no colour classes for dark mode.
- :97 Save gear isn't disabled while the photo is still uploading (isUploading is internal to the picker), so saving mid-upload creates gear without its image.

## pages/fishing/LogSitePage.tsx
- :37 Latitude or longitude of exactly 0 is saved as null (`Number(latitude) || null`).
- :49 Server validation (name 2 to 120 chars, description max 2000, access notes max 500, coordinate ranges) is not surfaced. There are no maxLength or min/max attributes, and failures show only a generic toast, with no per-field errors.
- :156 Water type options differ between pages: Log site offers only Freshwater and Saltwater, while Edit offers Brackish and Other as well. Detail prints the raw enum ('FRESHWATER').
- :182 Log site and Edit location forms have no cancel or back action. On mobile the full-width submit sits below a 320px map and several fields, with no sticky action.

## pages/fishing/MyCatchesPage.tsx
- :16 The catch list omits what anglers scan for: length and weight are fetched but never rendered, and species isn't requested at all.
- :67 Delete uses the unstyled native window.confirm. The request has no loading state and no error handling (a failed delete gives no feedback), and catch delete offers no undo even though the server only soft-deletes.
- :94 Search inputs have no label or aria-label, no search icon and no clear button. Gear search matches only name, brand and the raw enum; catch search matches only title and site name (not species, dates or notes).
- :132 The catch count isn't pluralised, so a single fish reads '1 catches'.
- :133 caughtAt is rendered with toLocaleString(), showing full date plus time to the second in whatever locale and timezone the browser has (e.g. '9/15/2026, 6:42:13 AM'). Verbose and inconsistent across devices.

## pages/fishing/MyGearPage.tsx
- :26 There are no sort or filter controls: no filter by gear type, and no date range, site or species filter for catches. Order is fixed server-side (gear by createdAt desc, catches by caughtAt desc).
- :73 Deleting gear is a server hard delete that also detaches it from every catch that used it (gear.service.ts:208, many-to-many at schema.prisma:98), but the confirm only asks 'Delete this gear item?' with no warning.
- :87 My gear, My catches and Edit gear have no signed-out branch: signed-out visitors see an empty main area. The unguarded fetch still runs, gets a 401 and shows 'Unable to load your gear/catches', which is inconsistent with Add gear's sign-in prompt.
- :98 Empty states are dead ends. 'No gear found.' / 'No catches found.' is shown both when the angler has nothing and when a search has no matches, with no Add gear or Log catch CTA.
- :109 Gear rows without a photo render no placeholder, so their text shifts left and misaligns with photo rows. Catch rows show a 'No img' box, and thumbnail size and radius differ between the two pages (48px rounded vs 56px rounded-md).
- :117 Similar rows behave differently: the gear name is plain text with no detail view (e.g. catches made with this gear), while the catch title is an underlined link.
- :119 Gear type is shown lowercase in the list ('reel') but title-cased in the form ('Reel'). There is no type badge or icon to scan by category.
- :124 Edit and Delete are size sm (h-8, 32px), below the 44px tap-target guideline, and sit 8px apart. A solid red Delete on every row makes the destructive action the most prominent thing in the list.
- :138 Pagination shows only 'Page X of Y', with no total count and no scroll to top on page change. The list header shows no count either.

## pages/fishing/MySitesPage.tsx
- :67 Delete uses a native window.confirm and has no error handling. A failed delete gives no feedback, and there is no pending state or undo.
- :82 Signed-out users on My locations see an empty page with no sign-in prompt, and the fetch still fires and shows an 'Unable to load your sites' error toast.
- :85 The search input has no label or aria-label, no search icon, and no type='search'.
- :93 One message, 'No locations found.', covers both a brand-new user with zero sites and a search with no matches, with no call to log a site.
- :123 Pluralization and abbreviation in list copy: '1 catches logged', and the 'No img' placeholder.

## pages/fishing/SiteDetailPage.tsx
- :8 Site detail has no likes or reviews at all, though the model has likeCount, reviewCount, Review and SiteLike. There is no API route or UI to like or review a site.
- :35 Site detail and Edit location have no error or not-found handling. A 404, deleted site or network error leaves the bobber loader spinning forever.
- :81 Site detail is a dead end for the owner: no Edit or Delete, no back link to My locations, no 'Log a catch here'. It also never shows who created the site, although createdBy is returned.
- :84 Site detail shows only the first image. There is no gallery or carousel for the other stored photos.
- :99 Site detail prints water type as the raw uppercase enum value, e.g. 'Water type: FRESHWATER'.
- :108 The heading says 'Recent catches at this site', but the section lists every catch, paginated 10 at a time.
- :137 Catch dates render with `new Date(caughtAt).toLocaleString()`, a long browser-locale date-time with seconds. The angler who caught each fish is not shown, though catches at a site can come from any user.
- :154 Catch pagination uses raw buttons with no type, no hover or focus styles and roughly 26px tap targets (px-2 py-1 text-sm). The picker's location button is about 28px (px-3 py-1).
- :177 The map, the page's main location information, sits at the very bottom under the whole paginated catch list. With no coordinates the section disappears with no message.
- :179 'Open map location' opens a new tab with no visual or text cue.


---

# Appendix D. Every user-facing string in the current build, verbatim

Rewrite all of them. Strings are grouped by file; the location is where the string first appears.

## ../../server/controllers/fishing.controller.ts
- 15: "Authentication required. (surfaced as toast description on 401)"
- 110: "Unable to save your catch right now. Please try again without images first. (surfaced as toast description)"

## ../index.html
- 7: "client (document title in browser tab)"
- 7: "client"

## components/ChatBot.tsx
- 48: "Something went wrong. Please try again."

## components/ChatInput.tsx
- 41: "Ask anything"

## components/ImageUploader.tsx
- 81: "Accepted: ${acceptedFileTypes.join(', ')} • Max size: ${maxMb}MB (renders: Accepted: image/jpeg, image/png, image/webp • Max size: 10MB)"
- 81: "Accepted: {image/jpeg, image/png, image/webp} • Max size: {maxMb}MB"
- 81: "Accepted: {acceptedFileTypes joined} • Max size: {maxMb}MB (renders as: Accepted: image/jpeg, image/png, image/webp • Max size: 10MB)"
- 81: "Accepted: image/jpeg, image/png, image/webp • Max size: 10MB"
- 91: "Unsupported image type. Please upload JPG, PNG, or WebP."
- 97: "File too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB."
- 97: "File too large. Maximum size is {n}MB."
- 111: "Could not process image. Please try another file."
- 136: "Select image"
- 139: "Image is center-cropped automatically."
- 139: "Image is center-cropped automatically. (not shown here)"
- 140: "Image keeps its original framing."

## components/fishing/FishingActionBar.tsx
- 7: "Feed (mobile tab label)"
- 7: "Feed / Catches / Sites / Gear (mobile nav labels)"
- 8: "Catches (mobile tab label)"
- 8: "Catches"
- 9: "Sites (mobile tab label)"
- 9: "Sites"
- 10: "Gear (mobile tab label)"
- 10: "Gear"
- 14: "Log catch (desktop dock tooltip, aria-label and title)"
- 14: "Log catch"
- 14: "Log catch / Log site / My catches / My locations / Add gear / My gear / Feed (desktop dock labels and tooltips)"
- 15: "Log site (desktop dock tooltip, aria-label and title)"
- 15: "Log site"
- 16: "My catches (desktop dock tooltip, aria-label and title)"
- 16: "My catches"
- 17: "My locations (desktop dock tooltip, aria-label and title)"
- 17: "My locations"
- 18: "Add gear (desktop dock tooltip, aria-label and title)"
- 18: "Add gear"
- 19: "My gear (desktop dock tooltip, aria-label and title)"
- 19: "My gear"
- 20: "Feed (desktop dock tooltip, aria-label and title)"
- 85: "Log a catch (aria-label on mobile floating plus button)"
- 85: "Log a catch (aria-label)"
- 85: "Log a catch"
- 85: "Log a catch (aria-label, mobile + button)"

## components/fishing/GoogleMapLocationPicker.tsx
- 101: "Fishing site pin (marker hover title)"
- 101: "Fishing site pin (marker title)"
- 135: "Google Map could not load. Set VITE_GOOGLE_MAPS_API_KEY to use the draggable pin map."
- 171: "Drag the pin (or click the map) to set your exact fishing site."
- 181: "Getting current location..."
- 182: "Use current location"
- 186: "We couldn't access your location. You can still place the pin manually."

## components/landing/LandingFaq.tsx
- 7: "Can we swap in real illustrations later?"
- 9: "Yes. We added dedicated placeholder blocks with clear sizing intent so design assets can drop in with minimal refactoring."
- 12: "Does this visual design support both dark and light mode?"
- 14: "It does. The page now uses semantic tokens, soft gradients, and contrast-safe cards that adapt to the selected mode."
- 17: "Is the layout still easy to scale?"
- 19: "Absolutely. Sections are modular and can be extended with testimonials, pricing, docs links, or release notes."
- 35: "Frequently asked questions"
- 38: "Built to feel like a polished SaaS landing page while staying consistent with your existing component stack."

## components/landing/LandingFeatures.tsx
- 14: "Responsive trip planning"
- 16: "Build your ideal fishing day from mobile, tablet, or desktop with a single workflow."
- 21: "Spot discovery maps"
- 23: "Explore nearby lakes and proven bank-access points with map-centered context."
- 28: "Catch log timeline"
- 30: "Track species, bait, weather, and outcomes so your future sessions are repeatable."
- 35: "Seasonal recommendations"
- 37: "Get suggestions based on changing water conditions and fish activity patterns."
- 49: "A landing page designed like a modern product showcase"
- 52: "Cleaner hierarchy, better color contrast, and reusable content blocks inspired by premium component systems."
- 86: "Tournament day preparation"
- 91: "Build a quick game plan with map pins, weather checks, and gear notes in one place."
- 95: "Placeholder for tactical illustration / dashboard image"
- 104: "Weekend explorer mode"
- 109: "Capture casual outings, favorite spots, and best bait combos without clutter."
- 113: "Placeholder for lifestyle art / photo"

## components/landing/LandingFooter.tsx
- 6: "© {current year} Fullstack AI Angler. Designed for modern outdoor products."
- 11: "Privacy"
- 14: "Terms"
- 20: "Contact"

## components/landing/LandingHeader.tsx
- 9: "Features"
- 9: "Features / Use cases / FAQ"
- 10: "Use cases"
- 11: "FAQ"
- 25: "Fullstack AI Angler"
- 34: "Profile"
- 54: "Sign in"
- 67: "Open navigation menu (aria-label)"
- 67: "Open navigation menu"

## components/landing/LandingHero.tsx
- 13: "Mapped locations"
- 13: "1,200+"
- 14: "Trip plans generated"
- 14: "4,800+"
- 15: "Smart insights shared"
- 15: "12k+"
- 28: "Inspired by modern UI libraries"
- 31: "Plan, log, and relive your best fishing days with a premium UI."
- 35: "We redesigned the landing experience with richer color, glassy surfaces, and modular sections ready for your illustrations, product renders, and future marketing assets."
- 41: "Get early access"
- 44: "View product tour"
- 49: "Hero illustration slot"
- 52: "Drop a 16:10 fishing scene, app dashboard mockup, or motion artwork here."
- 62: "Live activity panel"
- 67: "Illustration slot A"
- 70: "Illustration slot B"

## components/landing/LandingThemeToggle.tsx
- 39: "Switch to dark mode (aria-label, shown while theme is light; template `Switch to ${nextTheme} mode`)"
- 39: "Switch to light mode (aria-label, shown while theme is dark)"
- 39: "Switch to {nextTheme} mode (aria-label; renders Switch to dark mode / Switch to light mode)"
- 39: "Switch to ${nextTheme} mode"
- 39: "Switch to {dark|light} mode (aria-label)"
- 39: "Switch to ${nextTheme} mode (aria-label; renders 'Switch to dark mode' or 'Switch to light mode')"
- 39: "Switch to {light|dark} mode (aria-label)"

## components/profile/ProfileSettingsPanel.tsx
- 79: "Unavailable"
- 134: "Could not load your profile"
- 136: "Make sure you are signed in and try refreshing the page."
- 168: "Unable to load connections"
- 169: "Please try again."
- 182: "Followers"
- 229: "Saved to Clerk fallback profile"
- 230: "Profile saved to database"
- 233: "Database is unavailable, so your profile was saved to Clerk metadata."
- 234: "Your profile details were updated successfully."
- 242: "Unable to save profile"
- 243: "Please review your values and retry."
- 256: "Profile settings"
- 259: "Manage the account fields saved in your app database."
- 264: "Loading your profile..."
- 272: "Profile avatar (img alt)"
- 284: "Signed in as {email}"
- 293: "User ID: {profile.id} (or 'User ID: Unavailable')"
- 297: "Joined: {Mon D, YYYY} (or 'Joined: Unavailable')"
- 303: "Last profile update: {Mon D, YYYY} (or 'Last profile update: Unavailable')"
- 347: "Your catches & site images"
- 358: "{entry.sourceTitle} (gallery img alt)"
- 363: "CATCH / SITE (raw sourceType badge)"
- 370: "Add catches or sites with images to build your gallery."
- 379: "Display name"
- 393: "Username"
- 409: "Bio"
- 420: "Avatar image"
- 428: "Editable fields: display name, username, bio, and avatar image."
- 434: "Save app profile"
- 441: "Manage account / delete in Clerk"
- 460: "Browse and search your {followers|following} list."
- 470: "Search by name or username"
- 480: "No users found."
- 491: "{entry.displayName} (connection avatar img alt)"
- 504: "@{entry.username}"

## components/r2-image-picker.tsx
- 47: "Maximum ${maxItems} images allowed."
- 47: "Maximum {maxItems} images allowed."
- 62: "${file.name} skipped"
- 62: "{file.name} skipped"
- 63: "Only JPG, PNG, and WebP are allowed."
- 106: "Image upload complete."
- 109: "Partial upload complete"
- 110: "${uploaded.length} uploaded, ${failedFiles.length} failed."
- 110: "{uploaded.length} uploaded, {failedFiles.length} failed."
- 110: "{uploaded} uploaded, {failed} failed."
- 114: "Upload failed"
- 115: "Could not upload image to Cloudflare R2."
- 127: "Only one image is allowed here."
- 127: "Only one image is allowed here. (not reachable for catch scope)"
- 128: "Remove the current image to upload a new one."
- 128: "Remove the current image to upload a new one. (not reachable for catch scope)"
- 146: "You can upload up to ${maxItems} images."
- 146: "You can upload up to {maxItems} images."
- 147: "Upload one image."
- 147: "Upload one image. (not shown for catch scope)"
- 159: "Uploading to R2..."
- 170: "${label} ${index + 1} (img alt, e.g. Gear image 1)"
- 170: "{label} {index + 1} (preview img alt)"
- 170: "{label} {index + 1} (img alt, e.g. Site images 1)"
- 170: "{label} {index + 1} (thumbnail alt, e.g. Catch images 1)"
- 188: "Remove image"

## components/ui/carousel.tsx
- 145: "Previous slide (sr-only)"
- 170: "Next slide (sr-only)"

## components/ui/dialog.tsx
- 46: "Close (sr-only)"

## components/ui/fishing-bobber-loader.tsx
- 10: "Loading..."
- 10: "Loading... (default label, overridden in this group)"

## components/ui/toast.tsx
- 40: "Dismiss notification (aria-label)"
- 40: "Dismiss notification"

## lib/weather.ts
- 10: "Cardinal abbreviations: N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW (raw value shown if unmapped)"
- 40: "{n} °C"
- 40: "{value} °C"
- 55: "{value} km/h"
- 58: "{n} km/h"

## main.tsx
- 12: "Missing VITE_CLERK_PUBLISHABLE_KEY"

## pages/ProfilePage.tsx
- 21: "Sign in to access your profile"
- 24: "Your profile settings page is protected. Please sign in to review and update your account details."

## pages/fishing/CatchDetailPage.tsx
- 77: "Overview"
- 81: "Temperature"
- 91: "Precipitation"
- 94: "{weatherPrecipitationProbability}%"
- 98: "Wind"
- 101: "{cardinal abbreviation} {n} km/h"
- 105: "Wind gusts"
- 115: "Cloud cover"
- 118: "{weatherCloudCover}%"
- 122: "Humidity"
- 125: "{weatherRelativeHumidity}%"
- 129: "UV index"
- 144: "Loading catch details..."
- 151: "Catch (img alt, same for every photo)"
- 156: "No images uploaded"
- 171: "Prev"
- 191: "Caught {new Date(caughtAt).toLocaleString()}"
- 194: "Species: {species.commonName}"
- 194: "Not specified"
- 211: "{gear.name} (gear thumbnail alt)"
- 219: "• {gear.brand} • {gear.type lowercased}"
- 229: "Conditions"
- 232: "No conditions recorded."
- 253: "Size"
- 257: "Length"
- 261: "{length} cm"
- 262: "—"
- 262: "— (empty length value)"
- 267: "Weight"
- 271: "{weight} kg"
- 272: "— (empty weight value)"
- 279: "Site"
- 285: "{site.name} (link text)"
- 291: "Map for {site.name} (iframe title)"
- 298: "No coordinates recorded for this site."

## pages/fishing/EditCatchPage.tsx
- 217: "Catch updated"
- 242: "No coordinates available"
- 244: "Pick a site with coordinates or enable location access."
- 259: "Conditions updated"
- 263: "Unable to update conditions"
- 264: "Please try again in a moment."
- 278: "Loading catch editor..."
- 284: "Edit catch"
- 308: "No fishing spot selected"
- 311: "{site.name} (select option)"
- 317: "Gear used"
- 321: "No gear found in the database yet."
- 346: "{entry.name} (gear thumbnail alt)"
- 354: "• {entry.brand} • {entry.type lowercased}"
- 375: "Loading conditions..."
- 376: "Load latest conditions"
- 408: "{cloudCover}%"
- 423: "Wind gust"
- 459: "cm"
- 460: "ft"
- 487: "kg"
- 488: "lbs"

## pages/fishing/EditGearPage.tsx
- 47: "Gear not found"
- 54: "Unable to load gear"
- 83: "Gear updated"
- 98: "Edit gear"
- 119: "Rod / Reel / Bait / Lure / Line / Hook / Weights (select options, title-cased from GEAR_TYPES at lines 13-21)"
- 127: "{gear.name} (img alt)"
- 133: "Replace image"
- 139: "Save changes"
- 142: "Loading gear..."

## pages/fishing/EditSitePage.tsx
- 41: "Location is unavailable"
- 42: "Your browser does not support geolocation."
- 53: "Location added"
- 55: "Latitude and longitude were filled from your device."
- 62: "Could not get your location"
- 64: "Please allow location access, or click the map to drop a pin."
- 107: "Location updated"
- 112: "Unable to update location"
- 113: "Please check your values and try again."
- 127: "Loading location..."
- 133: "Edit location"
- 148: "Location options"
- 157: "Detecting location..."
- 158: "Use my current location"
- 192: "Optional water type"
- 195: "Brackish"
- 196: "Other"

## pages/fishing/FeedPage.tsx
- 138: "Geolocation is not available in this browser."
- 157: "We could not access your location. Enable location access to use Local radius filtering."
- 182: "Unable to load feed"
- 290: "Feed"
- 296: "Global"
- 302: "Local"
- 308: "All feed"
- 314: "Catch feed"
- 320: "Site feed"
- 329: "Local radius"
- 331: "{radiusKm} km"
- 350: "Your feed posts are created when you log a catch or log a fishing site."
- 374: "{post.author.displayName}"
- 376: "@{post.author.username}"
- 394: "Following"
- 407: "Follow"
- 413: "{post.type} • {post.scope} (renders e.g. CATCH • GLOBAL or SITE • GLOBAL)"
- 429: "Post (img alt text)"
- 429: "Post (img alt)"
- 449: "No text"
- 453: "Catch: {post.catch.title}"
- 458: "Site: {post.site.name}"
- 472: "Like"
- 483: "Comment"
- 488: "{post.commentCount} comments • {post.likeCount} likes"
- 501: "{entry.user.displayName}:"
- 508: "No comments yet."
- 526: "Add comment (input placeholder)"
- 550: "Loading feed..."
- 555: "Loading more posts..."
- 561: "No posts found inside this radius yet."
- 562: "No feed posts found."
- 567: "You reached the end of the feed."
- 583: "Unfollow user"
- 585: "Do you want to unfollow @{pendingUnfollow?.username}?"
- 594: "Cancel"
- 607: "Unfollow"

## pages/fishing/LogCatchPage.tsx
- 114: "Unable to load fishing spots"
- 116: "You can still save a catch without selecting a spot."
- 197: "Invalid catch date/time"
- 198: "Please choose a valid date and time."
- 212: "Site name is required"
- 213: "Add a name for your custom location."
- 221: "Drop a pin on the map"
- 223: "Choose your custom location by dropping a pin on the map."
- 243: "Unable to create location"
- 244: "Please try dropping your pin again."
- 277: "Catch logged!"
- 293: "Catch logged without images"
- 295: "Your catch was saved. You can add images later while we improve upload reliability."
- 312: "Unable to log catch"
- 367: "Loading your fishing spots and gear..."
- 370: "Catch title"
- 373: "Catch title (placeholder)"
- 379: "Date and time"
- 390: "Notes"
- 393: "Notes (placeholder)"
- 399: "Location"
- 411: "Other (create new location)"
- 414: "Select location"
- 417: "▲ / ▼ (dropdown glyphs)"
- 461: "Other (add new spot)"
- 469: "New location name"
- 472: "Enter fishing spot name (placeholder)"
- 498: "{n} gear selected"
- 499: "Select gear"
- 511: "Search gear by name, brand, or type (placeholder)"
- 520: "No gear matches your search."
- 553: "• {brand} • {type lowercased}"
- 567: "Weather snapshot"
- 568: "(loading...)"
- 586: "Weather description"
- 602: "Weather icon (img alt fallback)"
- 610: "Weather icon (visible fallback text)"
- 627: "Wind direction"
- 639: "Wind speed"
- 665: "Precipitation chance"
- 671: "{percent}%"
- 680: "Weather fields are cleared for custom locations without coordinates."
- 691: "Length (placeholder)"
- 716: "Weight (placeholder)"
- 739: "Catch images"
- 745: "Save catch"
- 751: "Sign in to log a catch."

## pages/fishing/LogGearPage.tsx
- 43: "Gear saved"
- 47: "Unable to save gear"
- 66: "Gear name"
- 72: "Brand"
- 84: "Rod"
- 84: "Reel"
- 84: "Bait"
- 84: "Lure"
- 84: "Line"
- 84: "Hook"
- 84: "Weights"
- 91: "Gear image"
- 98: "Saving..."
- 98: "Save gear"
- 104: "Sign in to add gear."

## pages/fishing/LogSitePage.tsx
- 47: "Fishing site logged!"
- 52: "Unable to log fishing site"
- 53: "Check your values and try again."
- 71: "Log fishing site"
- 74: "Site name"
- 79: "Site name (placeholder)"
- 89: "Description"
- 94: "Description (placeholder)"
- 109: "Latitude"
- 114: "Latitude (placeholder)"
- 127: "Longitude"
- 132: "Longitude (placeholder)"
- 148: "Water type"
- 156: "Select water type"
- 157: "Freshwater"
- 158: "Saltwater"
- 166: "Access notes"
- 171: "Access notes (placeholder)"
- 177: "Site images"
- 183: "Save site"
- 189: "Sign in to log a fishing site."

## pages/fishing/MyCatchesPage.tsx
- 57: "Unable to load your catches"
- 67: "Delete this catch?"
- 73: "Catch deleted"
- 98: "Search catches"
- 101: "Loading your catches..."
- 104: "No catches found."
- 116: "{entry.title} (img alt)"
- 121: "No img"
- 132: "{entry.count} catches • {new Date(entry.caughtAt).toLocaleString()} • {entry.site?.name}"
- 134: "No site"

## pages/fishing/MyGearPage.tsx
- 53: "Unable to load your gear"
- 73: "Delete this gear item?"
- 79: "Gear deleted"
- 94: "Search gear"
- 97: "Loading your gear..."
- 100: "No gear found."
- 112: "{entry.name} (img alt)"
- 119: "{entry.brand} • {entry.type.toLowerCase()}"
- 125: "Edit"
- 132: "Delete"
- 141: "Page {page} of {totalPages}"
- 150: "Previous"
- 158: "Next"

## pages/fishing/MySitesPage.tsx
- 48: "Unable to load your sites"
- 68: "Delete this location? (window.confirm)"
- 74: "Location deleted"
- 89: "Search locations (placeholder)"
- 92: "Loading your locations..."
- 95: "No locations found."
- 107: "{site name} (img alt)"
- 123: "{catchCount} catches logged"

## pages/fishing/SiteDetailPage.tsx
- 79: "Loading site details..."
- 92: "No image yet"
- 98: "No description yet."
- 99: "Water type: {waterType}"
- 101: "Access notes: {accessNotes}"
- 108: "Recent catches at this site"
- 112: "No catches logged for this site yet."
- 124: "{catch title} (img alt)"
- 130: "No image"
- 140: "{caughtAt toLocaleString} • {species}"
- 142: "Unknown species"
- 151: "Page {catchesPage} of {totalCatchPages}"
- 185: "Open map location"
- 188: "Map of {site name} (iframe title)"


---

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
