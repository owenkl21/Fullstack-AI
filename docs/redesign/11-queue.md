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

## Next, in order

1. **Species from a photograph.** Needs a model decision first: a vision
    call per photo costs money and needs a key, so it is Owen's call which
    provider and whether at all.
2. **The pin brief in Claude Design** (docs/redesign/12-design-brief-pins.md):
    once the SVGs come back, swap them into `kindPin` and the cluster disc.

## Standing constraints

The font and the theme do not change. No em dashes in anything a reader sees.
Mobile first, desktop deliberate.
