# Free maps to replace Google Maps (picker, read-only maps, spots map, Open Graph image)

**Recommendation:** Replace the Google Maps JS API and the Google embed iframes with MapLibre GL JS 6.10.0 (BSD-3-Clause, no key), styled from OpenFreeMap's hosted `dark` and `positron` styles on day one, with the style source behind a single constant so it can be swapped to a self-hosted Protomaps PMTiles extract on the R2 bucket you already pay nothing for. Do not use react-leaflet: version 5.0.0 is licensed Hippocratic-2.1, which is not an OSI licence and is a legal question you do not want in a commercial product. Accept that there is no free, commercially-licensed satellite layer at a resolution that shows coastal structure, so keep "Open in Maps" as the imagery escape hatch and add the OpenSeaMap seamark overlay instead, which is the layer that actually serves a rock and surf angler.

**Effort:** M. The picker already has the right shape (tap, drag, geolocate, paste, type) and the two read-only surfaces are one-line iframes, so most of the work is a mechanical swap of the map object plus the [lng, lat] flip; the spots map and the Open Graph pipeline are the only genuinely new builds, and the Open Graph half is blocked on deploy facts that are not in the repo.

've# Free maps to replace Google Maps

## What exists today

### The client draws maps in three different ways, only one of which uses the key

**1. The picker (`packages/client/src/components/fishing/GoogleMapLocationPicker.tsx`, 480 lines).** Loads the Google Maps JS API through `loadGoogleMapsScript()` and builds a `google.maps.Map` with `gestureHandling: 'cooperative'`, `disableDefaultUI: true`, `zoomControl: true`, `clickableIcons: false` and a generated `styles` array. The pin is a `google.maps.Marker` (the class Google has deprecated in favour of `AdvancedMarkerElement`). Four ways to set a position already exist and all of them are good: tap the map, drag the pin, paste a Maps link, or the viewfinder button calling `navigator.geolocation.getCurrentPosition`. When no key is present, `status` becomes `'unavailable'` and two typed latitude/longitude fields take over.

Consumers are only `LogSitePage.tsx:337` and `LogCatchPage.tsx:1279`. **`EditSitePage.tsx` does not use the picker at all**: it reads `asCoordinate(site.latitude)` at lines 66 to 67 and offers no map, so a spot's pin cannot be corrected after it is created.

**2. The read-only maps are plain iframes with no key and no styling.** `CatchDetailPage.tsx:408-412` embeds `https://maps.google.com/maps?q={lat},{lng}&z=14&output=embed` and `SiteDetailPage.tsx:296-301,364-366` embeds `https://www.google.com/maps?q={lat},{lng}&z=13&output=embed`. Worth naming: `output=embed` is not the documented Maps Embed API. Google's own getting-started page shows the supported form as `https://www.google.com/maps/embed/v1/place?key=API_KEY&q=...` and requires the key ([developers.google.com/maps/documentation/embed/get-started](https://developers.google.com/maps/documentation/embed/get-started)). So these iframes are an undocumented endpoint that can change without notice, they ignore the day and night themes entirely, and they are the ugliest surface in the redesigned app.

**3. `MySitesPage.tsx:169-183` already ships the List and Map chips**, and the Map branch renders a `PlainState` reading "Map view is coming". The brief at `docs/redesign/00-prompt.md:187-188` asks for "the map plotting the angler's own spots with teal pins and saved spots in grey", while the gap list defers it as B6 at `05-functionality-gaps.md:161-165`.

### The theming work already done is the strongest argument for what comes next

`packages/client/src/lib/maps.ts:130-186` (`buildMapStyle`) reads `--bg-2`, `--ink`, `--ink-2` and `--teal` off the document, mixes water and roads from them, and hides POI and transit. The comment at line 128 admits the failure mode: "Returns an empty list if a token cannot be read, which leaves Google's own tiles." The theme itself is stamped as `data-theme="day|night"` on `<html>` before first paint (`index.html`) and read by `useTheme()` in `lib/theme.ts`. Whatever replaces Google has to keep this ability to wear the theme, because the brief treats it as non-negotiable.

### Env and the server

`packages/client/.env` has `VITE_GOOGLE_MAPS_API_KEY` set, and `.env.example:2` documents it. `GOOGLE_MAPS_API_KEY` is **not** set in `packages/server/.env`, but the name is still referenced: `clients/weather.client.ts:2-4` falls back to `GOOGLE_MAPS_API_KEY` and then `GOOGLE_API_KEY` if `GOOGLE_WEATHER_API_KEY` is missing.

The geocoding client is a red herring. `clients/geocoding.client.ts` is a stub whose header still says "TODO: implement geocoding client", and it calls **Open-Meteo**, not Google: `https://geocoding-api.open-meteo.com/v1/search`. It has exactly one call site, `fishing.service.ts:344` inside `getFishingConditions(locationName)`, exposed at `POST /api/fishing/conditions` (`routes.ts:53-57`). The client never calls that endpoint. Grepping `packages/client/src` for the API surface returns only `/api/weather/current` (`components/fishing/record/api.ts:114` and `LogCatchPage.tsx:432`). **Forward geocoding is dead code**, and it is dead code under a licence that forbids the product's likely future: Open-Meteo's terms state "You may only use the free API services for non-commercial purposes" ([open-meteo.com/en/terms](https://open-meteo.com/en/terms)).

One finding that lands on the Open Graph work: `packages/server/.env` has no `CLOUDFLARE_R2_PUBLIC_BASE_URL`, so `uploads.service.ts:125-140` falls through to `getSignedUrl(..., { expiresIn: 60 * 10 })`. Every image URL the API hands out today expires in ten minutes, which cannot be an `og:image`.

---

## Options considered (with the evidence and the URL for each)

### Rendering library

| Package | Version | Licence | Gzipped | Verdict |
|---|---|---|---|---|
| leaflet | 1.9.4 | BSD-2-Clause | 42,736 B | Viable, raster only in practice |
| react-leaflet | 5.0.0 | **Hippocratic-2.1** | n/a | Rejected on licence |
| maplibre-gl | 6.10.0 | BSD-3-Clause | 283,322 B | Recommended |
| @vis.gl/react-maplibre | 8.1.3 | MIT | n/a | Not needed |
| pmtiles | 4.5.0 | BSD-3-Clause | 7,681 B | For the self-hosted path |
| @protomaps/basemaps | 5.7.2 | BSD-3-Clause | n/a | For the self-hosted path |

**Leaflet 1.9.4**, BSD-2-Clause, no dependencies ([registry.npmjs.org/leaflet/latest](https://registry.npmjs.org/leaflet/latest)), 42,736 bytes gzipped ([bundlephobia](https://bundlephobia.com/api/size?package=leaflet@1.9.4)). Its dist-tags are `{"beta":"1.8.0-beta.3","latest":"1.9.4","alpha":"2.0.0-alpha.1"}` ([registry.npmjs.org/leaflet](https://registry.npmjs.org/leaflet)), so Leaflet 2 exists only as an alpha and 1.9.4 is what you would ship.

**react-leaflet 5.0.0 is the reason not to go down the Leaflet road.** Its npm metadata lists `"license": "Hippocratic-2.1"` with `peerDependencies` of `react ^19.0.0`, `react-dom ^19.0.0`, `leaflet ^1.9.0` ([registry.npmjs.org/react-leaflet/latest](https://registry.npmjs.org/react-leaflet/latest)). The licence file confirms it: Hippocratic License 2.1, whose section 2 reads "The Software shall not be used by any person or entity for any systems, activities, or other uses that violate any Human Rights Laws", with an indemnification clause in section 3 ([LICENSE.md](https://raw.githubusercontent.com/PaulLeCam/react-leaflet/master/LICENSE.md)). This is an ethical-source licence, not an OSI-approved one. React 19 compatibility is fine; the licence is the problem. You could use bare Leaflet with a ref and skip the wrapper, but then you have given up the wrapper and still only have raster tiles.

**MapLibre GL JS 6.10.0**, BSD-3-Clause, described as "BSD licensed community fork of mapbox-gl" ([registry.npmjs.org/maplibre-gl](https://registry.npmjs.org/maplibre-gl), dist-tags `{"v1":"1.15.3","next":"6.0.0-22","latest":"6.10.0"}`). It is 283,322 bytes gzipped ([bundlephobia](https://bundlephobia.com/api/size?package=maplibre-gl@6.10.0)), which is the one genuine cost of this recommendation and is dealt with under "What it costs".

The decisive detail: the brief at `00-prompt.md:185` specifies the spot page map "at 3:2 with `gestureHandling: cooperative`". That is Google's option name, so the brief was written against Google. MapLibre has the exact equivalent verified in its own API docs: `cooperativeGestures`, default `false`, "If `true` or set to an options object, the map is only accessible on desktop while holding Command/Ctrl and only accessible on mobile with two fingers" ([maplibre.org MapOptions](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/)). Leaflet needs a third-party plugin for this.

No React wrapper is needed. `@vis.gl/react-maplibre` 8.1.3 is MIT with peers `react >=16.3.0` and an optional `maplibre-gl >=4.0.0` ([registry](https://registry.npmjs.org/@vis.gl/react-maplibre/latest)), but the existing picker is already written imperatively with refs and effects, so a wrapper would be a rewrite that buys nothing.

### Tile sources

**OpenStreetMap standard tiles: not a production basemap.** The Foundation's policy is best-effort with "no SLA or guarantee", warns that "Commercial services...should be especially aware that access may be withdrawn at any point", prohibits "any pre-emptive fetching of tiles other than those a user is actively viewing", and requires a unique User-Agent naming your app plus a valid Referer and visible attribution ([operations.osmfoundation.org/policies/tiles](https://operations.osmfoundation.org/policies/tiles/)).

**Stadia Maps: disqualified if this product ever charges.** The FAQ is explicit that "Use of Stadia Maps' services commercially requires a paid subscription", and the limits page says the free tier is "available for development, evaluation, and non-commercial use (including academic use)", with overage returning "HTTP 429 Rate Limit Exceeded" ([stadiamaps.com/faqs](https://stadiamaps.com/faqs/), [docs.stadiamaps.com/limits](https://docs.stadiamaps.com/limits/)). It does have good dark styles, so it is a tempting trap. Skip it.

**CARTO: workable but now needs a key and forbids the caching you would want.** An API key is required, and requests without one are watermarked ([github.com/CartoDB/basemap-styles](https://github.com/CartoDB/basemap-styles)). The terms give a fair use limit of "five million (5,000,000) tile requests each calendar month, aggregated across all of Customer's API keys", permit commercial use, require attribution to both OpenStreetMap and CARTO, and prohibit server-side caching, offline use and device caching beyond thirty days ([carto.com/legal/basemap-terms](https://carto.com/legal/basemap-terms)). Generous, but it reintroduces exactly the thing you are trying to delete: a key in the client.

**OpenFreeMap: the best zero-effort answer.** The site states "There are no limits on the number of map views or requests. There's no registration, no user database, no API keys, and no cookies", and answers yes to commercial use. It is candid about the trade: "At the moment, I don't offer SLA guarantees or personalized support", and the funding model is "keep renting servers until they cover the bandwidth" plus GitHub Sponsors ([openfreemap.org](https://openfreemap.org)). The code is MIT and attribution is required: "OpenFreeMap © OpenMapTiles Data from OpenStreetMap", added automatically when using MapLibre ([github.com/hyperknot/openfreemap](https://github.com/hyperknot/openfreemap)).

I verified the endpoints live rather than trusting the docs. `https://tiles.openfreemap.org/styles/dark` and `https://tiles.openfreemap.org/styles/liberty` both return valid style-spec version 8 JSON, with a vector source `openmaptiles` pointing at `https://tiles.openfreemap.org/planet`, sprites at `https://tiles.openfreemap.org/sprites/ofm_f384/ofm` and glyphs at `https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf`. The TileJSON at `https://tiles.openfreemap.org/planet` carries the attribution string verbatim as `OpenFreeMap © OpenMapTiles Data from OpenStreetMap`, a dated tile template (`/planet/20260913_164504_pt/{z}/{x}/{y}.pbf`), and minzoom 0, maxzoom 14. Five styles exist: positron, bright, liberty, dark, fiord.

Note maxzoom 14 on the vector source. MapLibre overzooms past it, so you still get usable z15 to z17 views, but the label and geometry detail stops improving at 14. For a pin on a shoreline this is fine; it is a reason to want the Protomaps path later.

**Protomaps self-hosted on R2: the end state.** The basemap is distributed as a single PMTiles file under the Open Database License as a Produced Work requiring OSM attribution, with the wider project under BSD and ODbL ([docs.protomaps.com/basemaps/downloads](https://docs.protomaps.com/basemaps/downloads)). Five flavors exist and they are exactly what `buildMapStyle` was reaching for: light, dark, white, grayscale, black, where "Flavor is a plain object of color definitions and optional properties", customised by spreading: `let flavor = {...namedFlavor("light"), buildings:"red"}` ([docs.protomaps.com/basemaps/flavors](https://docs.protomaps.com/basemaps/flavors)). Integration is `layers("protomaps", namedFlavor("dark"), {lang:"en"})` with attribution `<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>` ([docs.protomaps.com/basemaps/maplibre](https://docs.protomaps.com/basemaps/maplibre)).

Hosting works because "PMTiles is designed to work on any S3-compatible cloud storage platform that supports HTTP Range Requests", and Cloudflare R2 is named explicitly; CORS must allow `range` and `if-match` and expose `etag` ([docs.protomaps.com/pmtiles/cloud-storage](https://docs.protomaps.com/pmtiles/cloud-storage)). R2 supports this: its S3 API marks Range, If-Match, If-Modified-Since, If-None-Match and If-Unmodified-Since as implemented on GetObject ([developers.cloudflare.com/r2/api/s3/api](https://developers.cloudflare.com/r2/api/s3/api/)), and CORS is configurable with AllowedOrigins, AllowedMethods, AllowedHeaders, ExposeHeaders and MaxAgeSeconds ([developers.cloudflare.com/r2/buckets/cors](https://developers.cloudflare.com/r2/buckets/cors/)).

The cost is effectively zero on your existing bucket. R2's free tier is 10 GB-month storage, 1 million Class A and 10 million Class B operations per month, with egress free; beyond that, storage is $0.015/GB-month and Class B is $0.36 per million ([developers.cloudflare.com/r2/pricing](https://developers.cloudflare.com/r2/pricing/)). Size is the one thing I could not verify directly for South Africa and you should measure rather than trust me: the planet at z0 to z15 is "roughly 120 gigabytes", "each additional zoom level roughly doubles the size", a Berlin extract transferred 71 MB and a US and Mexico extract was 17 GB ([docs.protomaps.com/basemaps/downloads](https://docs.protomaps.com/basemaps/downloads), [go-pmtiles issue 68](https://github.com/protomaps/go-pmtiles/issues/68)). For scale, Geofabrik's South Africa `.osm.pbf` is 400 MB as of 2026-09-15 ([download.geofabrik.de](https://download.geofabrik.de/africa/south-africa.html)). A South Africa extract at z0 to z14 should sit comfortably inside the 10 GB free tier, but run the extract and look before committing. You do not need to download the planet: `pmtiles extract` against the remote archive with a `--bbox` "makes minimal I/O or network requests to the source archive".

### Satellite and imagery: the honest answer is no

This is where the research contradicts what the brief hopes for.

- **Esri World Imagery.** The ArcGIS item metadata gives `licenseInfo` as "This work is licensed under the Esri Master License Agreement" with credits "Esri, Vantor, Earthstar Geographics, and the GIS User Community" ([arcgis.com item 10df2279f9684e4a9f6a7f08febac2a9](https://www.arcgis.com/sharing/rest/content/items/10df2279f9684e4a9f6a7f08febac2a9?f=json)). Esri's terms define noncommercial use as providing the services to third parties at no charge where users "do not generate income, promote the generation of income, or any other means of commercial advantage or private financial gain", and reserve the right to decide which is which ([esri.com/en-us/legal/terms/web-site-service](https://www.esri.com/en-us/legal/terms/web-site-service)). Hotlinking the well-known XYZ URL in a commercial product is not a licensed path.
- **EOX Sentinel-2 cloudless.** Non-commercial use is CC BY-NC-SA 4.0; commercial use requires an "EOX Commercial Attribution-RestrictedUse 1.2 License" purchased from EOX, with attribution "EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 'year')" ([cloudless.eox.at/documentation/license](https://cloudless.eox.at/documentation/license)).
- **NASA GIBS.** Genuinely free and open, since NASA "commits to the full and open sharing of Earth science data" with "no period of exclusive access" ([earthdata.nasa.gov data policy](https://earthdata.nasa.gov/engage/open-data-services-and-software/data-and-information-policy)). But the tile matrix sets top out in the 250 m, 500 m, 1 km, 2 km class ([nasa-gibs.github.io/gibs-api-docs/access-basics](https://nasa-gibs.github.io/gibs-api-docs/access-basics/)). At 250 m per pixel a gully in the rocks at Rooi-Els is a fraction of one pixel. It is useless for structure.

Raw Copernicus Sentinel-2 at 10 m is open for commercial use, but turning it into a cloudless mosaic is the whole of EOX's business and is not a side quest for this product.

**What to do instead.** OpenSeaMap's seamark overlay is transparent, free, and is the layer a rock and surf angler actually reads: beacons, buoys, port detail. Tiles are served from `https://t2.openseamap.org/seamark/{z}/{x}/{y}.png`, data is ODbL and chart tiles are CC-BY-SA, and commercial use is permitted with attribution ([wiki.openstreetmap.org/wiki/OpenSeaMap](https://wiki.openstreetmap.org/wiki/OpenSeaMap)). I could not find a formal tile usage policy for their servers, so treat it as best-effort and optional, exactly as you would OSM's own tiles.

### Geocoding: the app does not need it

- **Nominatim** caps at "an absolute maximum of 1 request per second", requires a real Referer or User-Agent, requires that "Results must be cached on your side", and explicitly forbids "Auto-complete search", which "must not be implemented client-side" ([operations.osmfoundation.org/policies/nominatim](https://operations.osmfoundation.org/policies/nominatim/)). A search-as-you-type spot finder is off the table on the public instance.
- **Photon** is built for exactly that autocomplete case, but its terms say only that "extensive usage will be throttled", ask users to "be fair", and warn that "availability and usage might be subject of change in the future" ([photon.komoot.io](https://photon.komoot.io/)). No commercial commitment either way.
- **Open-Meteo**, which the stub actually calls, is non-commercial only on the free tier, under 10,000 calls a day ([open-meteo.com/en/terms](https://open-meteo.com/en/terms)).

The picker needs none of them. Dropping a pin, centring on me, pasting a link and typing coordinates covers every job in the brief without resolving a single place name. Delete the dead geocoder rather than migrate it.

---

## Recommendation

**MapLibre GL JS 6.10.0, no wrapper, no key, with OpenFreeMap styles behind a single exported constant, and a documented swap to a Protomaps PMTiles extract on the existing R2 bucket.**

One line of reasoning for each judgement call:

- **MapLibre over Leaflet:** `cooperativeGestures` is native, vector tiles let the map wear `--bg-2`, `--ink-2` and `--teal` the way `buildMapStyle` intended, and the only good React binding for Leaflet is licensed Hippocratic-2.1.
- **OpenFreeMap first, Protomaps second:** OpenFreeMap needs no build step and allows commercial use with no key, so it unblocks the interface work immediately; the R2 extract removes the no-SLA dependency later and costs nothing on a bucket you already own.
- **No wrapper:** the picker is already imperative with refs and effects, so `@vis.gl/react-maplibre` would be a rewrite that buys nothing.
- **No satellite layer:** nothing free is licensed for commercial use at a resolution that shows structure, so keep "Open in Maps" as the one-tap imagery escape and add OpenSeaMap seamarks, which serve the angler better than blurry imagery would.
- **Delete the geocoder rather than replace it:** its only call site is unreachable from the client and its provider forbids commercial use.

---

## How it works in this repo (files, endpoints, schema)

### `packages/client/src/lib/maps.ts`

Delete `loadGoogleMapsScript` (lines 43-76), the `Window['google']` type alias (line 1), `buildMapStyle` and its helpers `readToken`, `toHex`, `mix` and the `MapStyleRule` type (lines 78-186). Redefine `canDrawMap` (lines 40-41) so it no longer tests for a key; the useful test now is WebGL support, because MapLibre needs it and some low-end Android browsers do not have it.

**Keep `parseGoogleMapsCoordinates` (lines 6-37). It still works, because it never touched the SDK: it is pure regex over the link text.** Rename it `parseCoordinatesFromLink`, since it is already provider-agnostic. Pattern 2, `/[?&](?:q|ll)=(lat),(lng)/`, happens to parse Apple Maps `?ll=` links too, which is a small free win worth keeping. Two caveats to fix while you are in there:

1. **Short links do not work and they are what the Share button produces.** A `https://maps.app.goo.gl/AbCdEf123` link contains no coordinate pair, so all three patterns miss and the user gets "That link carries no position." The browser cannot follow that redirect and read the `Location` header cross-origin, so this needs a server round trip (below).
2. **Pattern 3 is loose.** `/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/` matches any comma-separated number pair anywhere in the string, so an unrelated URL can produce a confident wrong pin. Order it last and require it to match the whole trimmed input, which also makes a hand-typed `-34.127500, 18.448700` paste work cleanly.

`readPosition` (193-213), `formatCoordinate` (216) and the `MapPosition` type stay exactly as they are.

### New `packages/client/src/lib/mapStyle.ts`

Exports `styleUrlFor(theme: Theme)` returning `https://tiles.openfreemap.org/styles/dark` for night and `.../positron` for day, plus the required attribution string. When the Protomaps swap happens, this one file changes to build the style from `layers("protomaps", {...namedFlavor("dark"), ...productTokens}, {lang:"en"})` against `pmtiles://https://<r2-domain>/za.pmtiles`, and nothing else in the app moves.

### `packages/client/src/components/fishing/GoogleMapLocationPicker.tsx` becomes `LocationPicker.tsx`

The structure survives almost intact, which is why this is an M and not an L. Swap `new mapsLibrary.Map(el, {...})` for `new maplibregl.Map({ container, style: styleUrlFor(theme), center: [lng, lat], zoom, cooperativeGestures: true, attributionControl: { compact: true } })`. Note the coordinate order flips to `[lng, lat]` throughout, which is the single most likely source of bugs in this migration. Replace `google.maps.Marker` with `new maplibregl.Marker({ element, draggable: true })`, where `element` is your own DOM node carrying the Heroicons `map-pin` in `--teal`, which finally puts the pin inside the design system. Keep the existing `click` to place, `dragend` to move, the viewfinder geolocate button, the paste-a-link field and the `lastSentRef` echo guard at lines 236-245 unchanged.

Two behavioural changes worth making deliberately:

- The theme effect at lines 249-255 becomes `map.setStyle(styleUrlFor(theme))`. Markers are DOM overlays in MapLibre and survive a style swap, so the pin does not need re-adding. Sources and layers do not survive, which matters for the spots map below.
- The typed latitude and longitude fields stop being a fallback and become permanently visible. Today they only render when `status === 'unavailable'` (lines 372-406). MapLibre requires WebGL, so a permanent typed path is the honest failure mode, and the brief's own record page already treats coordinates as first-class text.

Import `maplibre-gl/dist/maplibre-gl.css` once. Its controls and attribution chrome carry rounded corners and its own greys, so they need overriding against `--radius: 0px`, `--line` and `--ink-2` in `index.css`.

### New `packages/client/src/components/fishing/StaticMap.tsx`

A read-only MapLibre map at 3:2 with `interactive: false` (or `cooperativeGestures: true` on the spot page, where the brief explicitly asks for it), one marker, no controls except attribution. This replaces the iframe at `CatchDetailPage.tsx:408-412` and the one at `SiteDetailPage.tsx:364-366`, and lets both `mapUrl` and `openMapUrl` (`SiteDetailPage.tsx:296-301`) collapse to just the `openMapUrl` used by the "Open in Maps" links at `CatchDetailPage.tsx:422` and `SiteDetailPage.tsx:376`, which keep pointing at Google because that is where a user wants directions and imagery.

### New `packages/client/src/components/fishing/SpotsMap.tsx`

Replaces the `PlainState` at `MySitesPage.tsx:179-183`. `GET /api/sites/me` already returns `latitude` and `longitude` (`fishing.service.ts:334-338` selects them), so no API work is required. Teal markers for the angler's own spots, grey for saved spots per `00-prompt.md:188`, `fitBounds` over all pins, each marker linking to `/sites/:id`. If you re-add the pins as a GeoJSON source and a circle layer rather than as `Marker` elements, remember they must be re-added on the `styledata` event after a theme swap.

### Server

Two small additions, both optional to the map work itself:

- **`GET /api/geo/resolve-link?url=`** in `routes.ts`, backed by a tiny service that issues a `HEAD` or a non-following `GET` and returns the `Location` for a `maps.app.goo.gl` short link, then reuses `parseCoordinatesFromLink` server-side. Validate the host against an allowlist and never follow more than a couple of redirects, since this is a user-supplied URL being fetched by your server.
- **Delete `clients/geocoding.client.ts`**, its import at `fishing.service.ts:2`, `getFishingConditions` at `fishing.service.ts:343-352`, and the `POST /api/fishing/conditions` route at `routes.ts:53-57`. Nothing in the client calls it.

### The Open Graph image, without a paid static-map service

Three steps, in order of how much they buy you.

**1. The blocker is not the map, it is the URL.** `og:image` must be a stable public URL that a crawler fetches minutes or days later. Today `resolveReadUrl` returns a ten-minute presigned URL because `CLOUDFLARE_R2_PUBLIC_BASE_URL` is unset. Set a custom domain on the R2 bucket first ([public buckets docs](https://developers.cloudflare.com/r2/buckets/public-buckets/)); nothing else here works until you do.

**2. For most catches the OG image is the catch photo, which you already have.** The gap list makes this point independently at `05-functionality-gaps.md:181`: the shareable thing already exists and what is missing is the metadata around it. So `og:image` is the first `CatchImage` by `position`, and no rendering happens at all.

**3. Only when a catch has no photo do you render a map card.** `@stillmap/core` 0.2.0, Apache-2.0, is a "Server-side vector map rendering engine" that needs "No browser, no canvas, no native map library, and no API key", renders to SVG or PNG, and runs "in plain Node" including on Vercel, Cloudflare Workers or Lambda ([github.com/abinnovision/stillmap](https://github.com/abinnovision/stillmap)). Its sources package exports `httpTileSource`, `openFreeMap` and `openMapTiles`, so it can read the same OpenFreeMap vector tiles the client uses ([@stillmap/sources README](https://raw.githubusercontent.com/abinnovision/stillmap/main/packages/sources/README.md)). Two things to check at install rather than take from me: PNG output goes through `@resvg/resvg-js` 2.6.2 (MPL-2.0), which ships per-platform native binaries as optional dependencies, so confirm it resolves under Bun on your deploy target; and PMTiles is not mentioned in its source list, so if you later move the client to R2-hosted PMTiles the renderer may need to stay on `httpTileSource` against a tile endpoint.

Render once at share time, upload the PNG to R2 through the existing `uploads.service.ts` path, and store the key so it is never rendered twice. That is the only schema change in this whole area: an optional `Catch.ogImageKey String?`.

**The meta tags themselves need a server-rendered shell**, and the repo has no deploy configuration (no `vercel.json`, no `netlify.toml`, no Dockerfile), so I cannot tell you where that lands. See the open questions.

### What happens to the two keys

- **`VITE_GOOGLE_MAPS_API_KEY`**: delete from `packages/client/.env`, `packages/client/.env.example:2`, and `lib/maps.ts:41,52`. Then **revoke it in the Google Cloud console**. It has been shipped inside the client bundle, so it is already public, and deleting the code does not un-publish it.
- **`GOOGLE_MAPS_API_KEY`**: never set on the server, but `weather.client.ts:2-4` accepts it as a fallback for the Weather API. Leave that fallback or tidy it, your call. `GOOGLE_WEATHER_API_KEY` and `GOOGLE_WEATHER_API_REFERER` **stay**. Google remains the conditions provider, and the attribution line "Includes weather data from Google" at `lib/weather.ts:219`, `CatchDetailPage.tsx:398` and `LandingRecord.tsx:58` is a term of that API and must not be removed along with the maps.

---

## Migration or build order

1. **Delete the dead geocoder and its route.** Independent of everything else, removes a non-commercial dependency, no UI impact. (`geocoding.client.ts`, `fishing.service.ts:2,343-352`, `routes.ts:53-57`.)
2. **Add `maplibre-gl`, write `lib/mapStyle.ts`, gut the Google half of `lib/maps.ts`.** Nothing renders yet; this is the seam.
3. **Convert the picker.** `LocationPicker.tsx` plus the two import sites (`LogSitePage.tsx:5,337`, `LogCatchPage.tsx:5,1279`). Test the lng/lat flip hard, on a phone, in both themes. Delete `Window.google` from `vite-env.d.ts:3-12` and the key from both env files, then revoke the key.
4. **Replace the two iframes with `StaticMap`.** This is the visible quality jump: two unthemed Google embeds become two maps that obey day and night. (`CatchDetailPage.tsx:408-412`, `SiteDetailPage.tsx:296-301,364-366`.)
5. **Add the picker to `EditSitePage.tsx`**, which has never had one, so a pin can be corrected.
6. **Ship the spots map** into the toggle that already exists at `MySitesPage.tsx:179-183`.

Then, independently and only when they earn it:

7. **The R2 PMTiles swap.** `pmtiles extract` with a South Africa bbox, upload, set CORS to allow `range` and `if-match` and expose `etag`, change `lib/mapStyle.ts`, and add `pmtiles` plus `@protomaps/basemaps`.
8. **The Open Graph work**, gated on setting `CLOUDFLARE_R2_PUBLIC_BASE_URL` and on deciding where server-rendered HTML lives.

Steps 1 to 6 have no schema changes and no API changes. Step 8 adds one optional column.

---

## What it costs and what we lose

**Money: nothing.** OpenFreeMap has no key and no limits. R2 PMTiles fits the free 10 GB and 10 million Class B operations, and a PMTiles map session is roughly tens to low hundreds of range requests, so the free tier covers tens of thousands of sessions a month before $0.36 per million applies.

**Bundle: this is the real cost.** maplibre-gl is 283,322 bytes gzipped against Leaflet's 42,736, on a product whose brief opens with "mobile first". Mitigate with a dynamic `import()` so MapLibre loads only on the four surfaces that need it (log a catch, log or edit a spot, catch detail, spot detail, my spots) and never on the landing page, the feed or the quick log receipt. Do not skip this; it is the difference between a defensible trade and a regression.

**Lost outright:**
- **Satellite and imagery.** Covered above. "Open in Maps" already exists on both detail pages and is now doing real work rather than being a courtesy link.
- **Street View**, which the app never used.
- **Google's POI and place-label density.** OpenMapTiles data in rural coastal South Africa is thinner than Google's. For a pin on a rock ledge this barely matters; for "which parking area is this" it does.
- **Detail beyond z14** on OpenFreeMap's vector source, until the Protomaps swap.

**Gained:**
- No key in the client bundle and no billing surface at all.
- A map that obeys `data-theme` instead of falling back to "Google's own tiles" when a token cannot be read.
- Marker DOM you control, so the pin is the product's own Heroicon in `--teal` rather than a red Google teardrop.
- The same tile data is readable server-side for the OG card.

**One conflict to settle now.** OSM attribution is a licence condition and must be visible and not hidden behind a toggle or beneath UI (per the [tile policy](https://operations.osmfoundation.org/policies/tiles/) and the ODbL). The brief at `00-prompt.md:6` says "No vendor or stack words in the interface". Attribution is not a vendor word you may drop; it is a term. Use MapLibre's compact attribution control so it reads as a small circled "i" that expands, which satisfies the licence and stays quiet in the design.

---

## Open questions for the owner

1. **Is this product commercial, now or later?** It decides Stadia (no), Esri imagery (no), EOX (no) and whether the free-tier reading of several of these sources holds. Everything I have recommended is safe either way, which is deliberate.
2. **Where does server-rendered HTML live in production?** There is no `vercel.json`, `netlify.toml` or Dockerfile in the repo, and the client is a static Vite SPA with a built `dist/`. The OG work cannot be specified further until I know whether the Express server serves the SPA shell or something else does.
3. **Will you set `CLOUDFLARE_R2_PUBLIC_BASE_URL`?** Every image URL currently expires in ten minutes. That is correct for private media and fatal for `og:image`, and it may also be a deliberate privacy choice I should not overturn.
4. **Protomaps extract bounds and maxzoom.** South Africa only, or the whole SADC coastline for anglers who travel to Mozambique and Namibia? And z14 (smaller, matches OpenFreeMap) or z15 (roughly double, visibly better on a shoreline)?
5. **Does the spots map ship before or after the privacy work (C2a)?** The gap list notes at `05-functionality-gaps.md:262` that every spot already publishes its exact latitude and longitude to a public feed with nothing in the UI saying so. A map makes that concrete and browsable. I would put the "shown at about 1 km" control in front of the spots map, not behind it.
6. **Do you want the OpenSeaMap seamark overlay?** It is free, commercially usable and genuinely differentiating for rock and surf, but it runs on community servers with no published usage policy, so it is a best-effort layer with a toggle, not a default.