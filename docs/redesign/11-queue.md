# Owen's queue, 17 September 2026

Raised in one message during the design pass. Ordered by what hurts most, not by
the order they were said in. Anything marked done has been pushed and checked on
the live deploy.

## Done

- [x] **Blank white page on a route, needs a refresh.** Every route is code
      split and the file names carry a content hash, so a deploy removes the
      hashes an open tab still expects. Nothing caught the rejection. Imports
      retry once, then reload once, then fall to a boundary that says so.
- [x] **Asked for my location every single time.** One shared store, kept in
      localStorage. The prompt is still only raised by a tap, but the answer is
      remembered and a granted permission refreshes silently.
- [x] **Everything we can get in the conditions.** Already had air, feels-like,
      dew point, humidity, pressure, cloud, visibility, wind, gusts, UV, sea
      surface temperature, wave and swell. Added sunrise, sunset and moon phase
      with a spring-tide flag, since no weather API publishes a phase and that is
      what a shore angler plans around.

- [x] **Show all of it, with icons.** Water, swell, sea state, moon with the lit
      fraction drawn from the real phase, first and last light, humidity, sky.
      Pressure had been fetched and then dropped on the way to the screen, so
      its readout always said "Not reported"; it reads 1035 hPa now.
- [x] **Gear on a log without leaving it.** Three fields, saves, joins the list
      and ticks itself. Checked live: 201, and the piece comes back ticked.
- [x] **Back goes where you came from**, rather than always to My catches.
- [x] **Marks on the feed controls**, with the counts on the controls they
      belong to, and a card that keeps its shape when there is no photograph.
- [x] **Railway was never auto-deploying.** Every deployment in the project's
      history was triggered by hand from a laptop and the repository has no
      webhooks, so the server had been three hours behind the client. A CI
      workflow now deploys it and fails if the server does not answer.

- [x] **Anglers have a profile other people can open.** New public endpoint and
      an /anglers/:id route, with follow from it. The public view is its own
      query, not the owner's with a flag: the owner's selects an email address
      and every catch regardless of visibility, and only PUBLIC records appear
      here. Checked on the live payload: no email field, correct keys only.
- [x] **Followers and following are controls**, with the figure leading and a
      mark on each, on both profiles.
- [x] **Favourite species, favourite spot, best day.** Counted over the catches
      already loaded. The site had never been selected for the stats, so a
      favourite spot could not have been worked out before. Each stays null
      until it has happened more than once.

- [x] **A forecast page.** `/forecast`: search a beach, a town or a headland,
      or use where you are; seven days, hour by hour, wind and gusts with their
      direction as arrows, rain chance and fall, thunder from convective energy,
      pressure, swell with direction and period, sea, water, UV, first and last
      light, the moon. Kept in the address so it can be sent on. Public.
- [x] **Conditions say where you are.** Nominatim through the server, cached a
      day per kilometre. "Conditions at Kommetjie, taken 15:42."
- [x] **Precipitation in millimetres and thunder** on the reading and the grid.
- [x] **Catches were saving with every weather column null.** Open-Meteo
      answers the hosted server with 429 because Railway's outbound address is
      shared with strangers. The server now logs the status, retries, and
      remembers an hour for ten minutes; the browser reads Open-Meteo itself
      from its own address when the server cannot, and a save carries the whole
      reading so the server keeps it. Verified with the server endpoint blocked.
- [x] **Keeping other anglers' spots and gear.** A Kept page under the account
      menu; keep buttons on their spot page, in the map popup, and on the gear
      rows of a catch that is not yours.
- [x] **Banner behind the name**, on both profile pages, set from settings
      beside the photograph. Contours stand in until there is one.
- [x] **A place search on the map** that moves the view.
- [x] **Spot and gear forms on the shared field set.**
- [x] **A private spot was public by address.** Not found to everyone but its
      owner now.
- [x] **The catch form's last nine raw inputs** on the field set, and the gear
      list under its kinds (rod, reel, line, hook, weights, lure, bait) with a
      kind filter once there is enough gear to need one.
- [x] **Phone: the Log key** has its plus and rounded corners.
- [x] **The feed card reads fish first.** Species as the heading, its size
      straight under, then where and when as a caption, then the angler's own
      title when it says more, then notes. The meta line no longer sits between
      the name and the photograph.
- [x] **Phone: the filters** share one row that scrolls sideways; the first
      post moved up from 337px to 246px on a 390 screen.
- [x] **Contours on desktop** run the width of the screen behind the column
      instead of stopping at its edge.
- [x] **This season strip** is one tile a day with the count of fish on it.
- [x] **When you catch:** two charts on the profile, fish by hour and by moon
      phase, counted from the log in the browser.
- [x] **A catch with a dropped pin shows its map.** Hidden-location catches
      have the pin withheld by the server from everyone but the angler.
- [x] **Spots cluster at low zoom**, yours and theirs separately, as a
      doubled disc with a count that opens out on zoom or tap.
- [x] **A terrain base** (OpenTopoMap) beside satellite, plain and streets.
- [x] **A level system.** Ten ranks (Greenhorn to Legend of the ledges),
      points from fish, species, spots, range, days, care taken, released, big
      fish and competitions; fourteen badges. Counted on the server
      (`progress.service.ts`), public view counts public catches only. Rank
      card on both profile pages; full reckoning on `/insights`.
- [x] **Insights page** with the log by hour, month, weekday, moon, wind
      rose, pressure, water, sky, light, and by species, spot and gear.
- [x] **The catch form** in two columns with numbered steps, boxed
      measurements with the unit switch attached, a sticky side panel and a
      phone save bar.
- [x] **Photo times.** A log of several fish reads EXIF shutter times; the
      earliest fills in the time, the span is stored as `caughtUntil` and
      shown on the catch.
- [x] **Pins as SVG teardrops**; clusters as ringed circles.
- [x] **Feed radius as a draggable slider** drawn as the fishing line.
- [x] **Map controls** share one label column.
- [x] **The waterline**: plate, wet strips, shadow, foam, a slow swell;
      nothing filled to the box's bottom (the ruled line).
- [x] Avatar over banner; pickers aligned; no more "Ward 21"; no-photo hero
      fixed; length and weight columns in the catch list; season tiles level
      and counting fish.
- [x] **Deploys.** Vercel builds `fishlogger` `main`; `git push origin` deploys
      nothing. Railway is `railway up --service server --detach`.

## Done, 17 September evening

- [x] **Fast log reads the photograph**: shutter time and GPS from EXIF, a
      pin to drop, "take a photo" and "choose one", conditions re-read for the
      place and hour, who sees it, spot shown or hidden, save as a public or
      private spot, by-eye/tape/scale as a real switch, kept on the record.
- [x] **Home plate** names where you are, last spot under it; conditions as
      tiles three across that stagger in; season strip is photo and date with
      black month breaks.
- [x] **Feed**: pickers on a phone, no sideways scroll; radius is a Radix
      slider drawn as the fishing line.
- [x] **Map**: filters over the map (layers panel, species picker, drop a mark,
      log here, legend).
- [x] **Boards**: one filter bar, species multi-select, order by, top ten
      paged with your own row pinned.
- [x] **Competitions**: invitation only with follower invites (a week to
      accept), time left, results with the winner, paging; a catch can be
      entered and the figure is read off a photo by Claude Haiku 4.5
      (`ANTHROPIC_API_KEY` on the server switches it on).
- [x] **Fish namer**: both log forms offer the hub's two best guesses after a
      photo; needs `FISHIAL_URL` (+ `FISHIAL_TOKEN`) on the server. Hub side in
      [13-fishial-on-the-hub.md](13-fishial-on-the-hub.md).
- [x] Forecast colour for wind and sky, phone grid scroll fixed; profile and
      insights count-ins and growing bars.

## Done on 17 Sep, the second list (commit 90218a2)

- Forecast: hourly cells carry a tint per band (`forecast/tones.ts`,
  `.tone-*` in index.css); the loud bands go solid with paper text. Day
  facts and the hour grid re-land when the day changes.
- Feed: Global or Local is one switch ahead of the rest. The radius slider
  (`ui/slider.tsx`) keeps its value while dragging and commits on release.
- Comments: cards with an initial, a boxed composer with a real send button,
  Enter sends, replies animate in (`.comment-in`).
- Spots: `MapLocationPicker` is a fixed pin the map moves under, with wheel
  zoom, place search (Nominatim), Maps link or typed pair, locate, base
  switch. The map's Log here goes to `/log?lat&lng` (quick log reads it).
  A position within 600 m of one of your spots files the catch there
  (`lib/geo.ts`), with an opt-out on the quick log and an offer on the form.
- Water is salt or fresh only in both spot forms.
- Desktop: quick log two columns from `lg`; containers widened (home 1040,
  form 1120, feed 800, profile and spot 960, competitions 1000).
- Loaders shimmer (`.shimmer`) on forecast and insights; insights table rows
  stagger in (`tr.fact`).

Verified live with `audit/verify17.mjs`, `comments2.mjs`, `nearby.mjs`.

## Done on 17 Sep, evening (commits c3f8cf7, 299b109, 13db842)

Line by line, both lists, checked on the live site by `audit/lbl.mjs`,
`lbl2.mjs` and `lbl3.mjs` (desktop at 1900 and 2000, phone at 390): 40 checks,
all passing.

- Distance control is a fader (`ui/slider.tsx`): deep track, teal fill, a grip,
  a ruled scale; value held while dragging, committed on release.
- Comments: four in view, the list scrolls on a teal rail (`.thread-scroll`),
  Load more brings four at a time and reads the whole thread when it runs out.
- Every page column widened again (content 1320 to 1400, data pages and the
  header 1680); the feed runs two columns of cards from `xl`.
- Spot page: no photograph, no empty 360px block above the name.
- Waves (`brand/TornEdge.tsx`): bigger chop, quicker drift, taller box (120,
  80 on phones), and the plate and ground paths close 40 units past the box so
  the one pixel seam between a plate and its section is gone.
- Conditions snapshot: the client no longer drops a reading without an icon
  URL (Open-Meteo has none), so a quick log catch keeps its full conditions.
- The app opens on the feed (`/`), the wordmark and Feed go there, the
  conditions page is `/now` with a Now word in the nav.
- The season strip moved to the bottom of Insights (`insights/SeasonStrip.tsx`),
  by month with a heading per month and a year switch; `summary.ts` has
  `seasonYears` and `seasonMonths`. Dates outside the current year carry the
  year (`record/format.ts`, `feed/format.ts`).
- Profile: personal bests and photographs fold (`ui/fold.tsx`), closed at first.
- Contour drift sits behind insights, forecast, boards, competitions, the feed,
  the catch list and a catch.

## Done on 17 Sep, late (commits 5352991, 1f7b35c and the plate tightening)

Server (deployed with `railway up`; the pre-deploy `prisma db push` made the
tables): `Notification` and `SavedPost` models; `notifications.service.ts`
written to on follow, reply, like, invitation sent and answered; routes
`/api/notifications`, `/api/notifications/unread`, `POST /api/notifications/read`;
`/api/saved/posts` list, keep, let go, and `savedByMe` on feed posts;
`POST /api/species` deduped by normalised name plus a letter or two of
spelling; `RIG` in `GearType`; `clients/weatherkit.client.ts` used for the
reading of the moment when `WEATHERKIT_TEAM_ID`, `WEATHERKIT_KEY_ID`,
`WEATHERKIT_SERVICE_ID` and `WEATHERKIT_PRIVATE_KEY` are set (Open-Meteo keeps
the sea, sun, moon and the week); feed authors' avatars are signed.

Client: bell in the header (`shell/NotificationBell.tsx`, polling 45 s) and
`pages/NotificationsPage.tsx`; Keep on every post and a Posts list on Kept;
`fishing/SpeciesCombobox.tsx` on both forms (search, add, Not sure); kept or
released on both forms; gear and bait pickers on the quick log; drafts in
`lib/drafts.ts` with a list under My catches and Save as draft on both forms;
the quick log's map open from the start, the full form's here mode on the
same map; Right now on the forecast; place search nearest-first with a tap
on a phone. Look: `brand/PageHead.tsx` (inverted plate with the waterline)
on feed, insights, forecast, boards, competitions, my catches and
notifications; `brand/ContourField.tsx` lays four patches across a page;
the wet strip in `TornEdge` no longer draws a straight edge; feed cards
share a row height and comments load as the thread scrolls; map pin cards
(`map/popup.ts`) with marks; pins show the fish beside the count;
`states/NoData.tsx` for empty lists; teal clear cross on search inputs;
bigger profile photos; a long name wraps.

Checked live by `audit/lbl4.mjs` (three of its fails were the check reading
upper-cased text; confirmed by `a2.mjs`). The Now page (`HomeNowPage`) is
in the code with no route and no nav word, as asked.

## Done on 17 Sep, later still (commits 805679b to f6256b0)

- Contours: one sheet per page (`brand/ContourField.tsx` over a single
  `Contours`), drawn past the edges and clipped, no fade; rings close with Z,
  the rest run edge to edge; seven levels, features in cycles per 1400 px.
- Map: pin cards are a React tree mounted into the popup (`map/popup.tsx`)
  with Heroicons marks; pin glyphs are Heroicons rendered to markup in
  `lib/leaflet.ts`; the fish is `brand/FishMark`, which now takes SVG props.
- Avatars signed on standings and notification actors; the header reads the
  profile's signed avatar (`profile/avatar-api.ts`) and clips it; the profile
  name row sits above the banner (`relative z-10`).
- Photo focal point: `Image.focusX/focusY`, accepted on `imageInputSchema`,
  returned on catch and feed images; the quick log's `PhotoBlock` shows a
  four by three frame the reader drags; the feed crops to it. Every feed
  photo sits in a 4:3 frame; cards are 80 + 720 + 292 on a desktop.
- Scroll to load: `lib/load-on-scroll.ts` on my catches, my spots,
  notifications, competitions (pages append), standings (ten more at a
  time), a spot's catches. Comments and the feed already did.
- Phone feed actions are icons with counts; counts always show.
- `main.tsx` reloads once on `vite:preloadError` (stale chunk after a
  deploy); `lib/lazy-route.tsx` already retried and reloaded on a failed
  import. A cold load measured signed out (landing at 1.4 s) and signed in
  (insights and feed under 0.8 s) with no page errors.
- A photograph's GPS moves the pin: the picker ignores its own moves
  (resize nudge, following the form) for half a second, so they no longer
  count as a dropped pin.

## Done on 17 Sep, night (commits 6c2e3cb to a0751c6)

- Contours live on each page's black plate (`brand/PageHead.tsx`), edge to
  edge like the water, paper lines, drawn once; `ContourField` is gone and the
  content grounds are plain. `Contours` measures its box once and never
  rebuilds; the profile banner keeps its own (220px, 9 lines).
- Place search: `clients/geocoding.client.ts` asks Photon (OpenStreetMap)
  first with a position bias, Open-Meteo towns as the fallback; hits carry
  `kind`. The forecast and the map picker share `/api/places/search?q&lat&lng`.
  "Kanu wine" finds the farm at Stellenbosch; with no place or fix the
  forecast leans on home waters (-33.9, 18.9).
- The quick log is rebuilt on the catch form design: one card, header with
  Save draft and a close cross, 01 The catch / 02 When and where / 03
  Sharing, sticky footer with the privacy line and Save catch. New pieces:
  `quicklog/MeasureField.tsx` (unit as a dropdown, method as a quiet line),
  `quicklog/Segment.tsx`, `quicklog/CaughtAt.tsx`; `PhotoBlock` restyled
  (choose or take, remove, the feed frame kept). Notes save on the record;
  save-to-spots is a checkbox with a name and private or public. Checked
  live on desktop and phone by `audit/lbl7.mjs`, including a full save.
- Every paged list loads on scroll; the photo focal point is kept and the
  feed crops to it; feed cards one height; an open thread grows the card;
  the thread's fourth reply peeks so scrolling loads more.

## Done on 17 Sep, midnight (commits 9cbcafc, 2a93b6b)

- Phones: the catch form is three steps from the same blocks (`usePhone` in
  `lib/media.ts`): the catch (photo, species, when and where), size and gear,
  sharing and save; Next and Back in the footer; a step bar under the title.
  The desktop card is unchanged.
- The photo is one thing: the feed's 4:3 frame with the picture inside,
  dragged to place; Change and Remove on it.
- `ui/sheet.tsx` (Radix Dialog) rises from the bottom on a phone. `ui/picker`
  uses it under md, a popover above; the button says how many are chosen
  with a badge, the open one is ruled in teal, chosen rows are marked and
  tinted; Clear and Done in the head. The map's layers panel and the legend
  share one sheet on a phone.
- `map/MapToolbar` takes `placement`: overlay on a desktop, a bar of four
  under the map on a phone (Layers, Fish, Mark, Log here); the legend button
  goes; `@media (pointer: coarse)` hides the zoom control. The pin picker on
  a phone puts search above the map and locate and the base below.
- Waves back: the plate's contours are clipped by their own box, not by the
  header, which had been clipping the hanging edge.
- Checked live by `audit/lbl8.mjs` on a phone and a desktop: five of five.

## Done on 18 September (the morning list)

Raised in three messages: the page heads looked cut off above the water, the
log form needed a cleanup, the forecast wanted bars, a merging temperature
band, tides and the sun and moon; then the name and the mark arrived.

- [x] **The contour sheet reaches the waterline.** It stopped at a ruled edge
      a hundred pixels above the water on every page head because the water's
      own plate path was an opaque fill from the header's edge to the crest.
      `PageHead` now carries the plate and the art in one box that reaches
      `--hang` below the header (`.plate-art`), and `TornEdge` takes `hollow`,
      drawing only the water, with the strips and the shadow clipped to it.
      Checked on all seven page heads and the spot page, day and night, phone
      and desktop (`audit/plates.mjs`).
- [x] **The quick log, cleaned.** The map folds behind one receipt line
      ("Phone fix, within 35 m · -34.13000, 18.33000", "Move the pin") and
      opens only when there is no fix or the angler asks; it never opens while
      the phone is still finding one, and the picker no longer reports its
      first view as a dropped pin. Gone: the footer's second "Public catch ·
      Spot shown", the "Not sure?" link (the list ends in Not sure), "Nothing
      caught? Log a session instead" (it saved nothing), "Required" and the
      four "Optional" tags, the grey zeros in Length and Weight, the camera
      square, every icon beside a word, "Take photo" on a desktop. Labels:
      Kept or released, Seen by, Exact spot, Add this as a spot. Targets to
      44px; the wheel scrolls the page over the map; the desktop map controls
      sit on the map instead of the card's corner; the gear fold is open.
- [x] **The full form, cleaned.** The dashed rules between sections draw;
      depth and water temperature live in a "More" fold; "Enter it in a
      competition" is a button at the end of section 01; Length and Weight
      use the quick log's `MeasureField`; one save row per width, with Save
      draft and Save catch in the phone bar, the nav standing down on the
      form routes and a close control in the page head; the gear and spot
      lists run their full length. Editing a catch no longer writes By eye,
      Kept and no competition over the record.
- [x] **The forecast, with the inspiration worked in.** Wind is a bar per
      hour against a 50 km/h scale, coloured by band, arrow above and gust
      under; air and UV tints are mixed per hour so they merge; a Tide row
      draws the sea level (Open-Meteo marine `sea_level_height_msl`) with
      Flood and Ebb and the time of each high and low, no heights, and says
      so in the attribution; Sun and Moon rows draw the arcs from sunrise,
      sunset, moonrise and moonset over a dashed horizon. Signal colours are
      tokens with night values; no hex left in `tones.ts`. The browser
      fallback mirrors every new field.
- [x] **Fishtagram.** The name and Owen's mark (`public/brand`,
      `brand/Wordmark.tsx`, the favicons, `lib/title.ts`).
- [x] **The loader is the fish leaving the water.** Owen's clip, scrubbed of
      its watermark and shrunk to a 270 KB muted mp4 (`public/brand/loader.*`,
      made by ffmpeg; the recipe is in the BootGate comment), multiplied onto
      the paper by day and inverted and screened onto the dark at night.
      `BootGate` holds the first paint for at least 1.6 s so the leap is seen,
      never more than 2.5 s; reduced motion gets the first frame.
- [x] **The right mark, and a loader with no edges** (later the same day).
      The header mark is the line-art bass (`1.svg`), flipped to paper lines
      for the black header by `audit/logo.mjs ... invert`, and bigger: 44px on
      a phone, 50px on a desktop. The loader clip is 640px now and shown at
      300/440px; its frame is feathered on all four sides so the water dies
      away instead of being cut, and it is inked in the accent (screened over
      a teal ground by day, inverted and multiplied over it at night).

## Next, in order

1. **Switch the readers on**: set `ANTHROPIC_API_KEY` on Railway for the
    competition reader; stand up Fishial on the hub and set `FISHIAL_URL`.
2. **The pin brief in Claude Design** (docs/redesign/12-design-brief-pins.md):
    once the SVGs come back, swap them into `kindPin` and the cluster disc.
3. **Same water, properly**: the 600 m rule is a proxy. When spots carry a
    water body name, match on that first and fall back to distance.

## Standing constraints

The font and the theme do not change. No em dashes in anything a reader sees.
Mobile first, desktop deliberate.
