# Free weather, marine and almanac data to replace the Google Weather API

**Recommendation:** Replace Google with Open-Meteo, read from the hourly arrays rather than a "current" block, and select the hour that brackets `caughtAt` so a catch logged in the car park at 21:00 still stores the conditions at 18:40. One new keyless client (`packages/server/clients/open-meteo.client.ts`) covers all three needs: the forecast endpoint with `past_days` for anything inside 60 days (verified live at a Cape coordinate), the historical-forecast endpoint beyond that, and the marine endpoint for sea surface temperature and wave height on coastal spots. Sun, moon phase and illumination come from `suncalc@2.0.2` (BSD-2-Clause, 51 KB, no API, no key), and tides stay closed as a UI commitment because the authoritative South African source is copyrighted.

**Effort:** M. The mapping and the code table are mechanical and the new client is one file, but inverting the write path so the server reads conditions from `caughtAt` rather than trusting a client-supplied snapshot touches 6 server files and 7 client files, and the marine branch plus the optional backfill add a second and third pass.

> Scope note: this is research and design only. Nothing in the repo was edited, no installs were run, and no git commands were issued. Every third-party claim below was fetched live today; where a provider's own page contradicted what I expected, I have said so.

## What exists today

**The call.** `packages/server/clients/weather.client.ts` is 70 lines that hit `https://weather.googleapis.com/v1/currentConditions:lookup` with `unitsSystem=METRIC`, resolving the key from `GOOGLE_WEATHER_API_KEY`, then falling back to `GOOGLE_MAPS_API_KEY`, then `GOOGLE_API_KEY`, and optionally sending a `Referer` from `GOOGLE_WEATHER_API_REFERER`. It returns `response.json()` raw, with no typing and no shaping. Note the fallback chain: removing only `GOOGLE_WEATHER_API_KEY` would not disable this client, it would silently start billing the Maps key.

**The endpoints.** `packages/server/routes.ts` exposes `GET /api/weather/current` (behind `requireApiAuth`, handler `fishingController.getCurrentWeatherByCoordinates`) and `POST /api/fishing/conditions` (geocode a place name, then look up weather). The controller deliberately answers `200` with `{ weather: null, weatherError }` on failure so a lookup can never block a save. That behaviour is correct and should survive the migration unchanged.

**The storage.** `Catch` in `packages/server/prisma/schema.prisma` carries 25 weather columns plus `weather` (free text), `waterTemp` and `depth`. `mapWeatherSnapshotToCatchData` (`packages/server/services/fishing.service.ts:125-190`) fills nine of them and hard-codes thirteen to `null` **in the success branch**:

`weatherCurrentTime`, `weatherTimeZoneId`, `weatherFeelsLikeTemperatureDegrees`, `weatherFeelsLikeTemperatureUnit`, `weatherDewPointDegrees`, `weatherDewPointUnit`, `weatherAirPressureMeanSeaLevelMillibars`, `weatherWindDirectionDegrees`, `weatherVisibilityDistanceValue`, `weatherVisibilityDistanceUnit`, `weatherIsDaytime`, `weatherRelativeHumidity`, `weatherUvIndex`, `weatherThunderstormProbability`.

`waterTemp` is separately hard-nulled at both write sites (`fishing.service.ts:384` on create, `:556` on update). `weatherConditionType` is assigned the same string as `weatherConditionText`, so one of the two columns is dead weight. This matches appendix E of the redesign brief (`docs/redesign/05-functionality-gaps.md`, item A2.2), including its correction that the pressure the draft assumed was "already returned" is `null` at the storage layer.

**The contract.** `weatherSnapshotSchema` in `packages/server/schemas/fishing.schema.ts:25-52` accepts only nine values, all required, in Google's response shape. The client mirrors it: `toSavableSnapshot` in `packages/client/src/components/fishing/record/api.ts` refuses to send a partial reading at all. So the pipeline's ceiling is set by the zod schema, not by the provider.

**The timing bug.** `packages/client/src/pages/fishing/LogCatchPage.tsx:432` calls `/api/weather/current` with `params: coordinates` and nothing else. `caughtAt` is never sent. A catch logged three hours after the fact stores three-hours-late weather, and Edit catch's re-read overwrites stored history with today's.

**Already Open-Meteo.** `packages/server/clients/geocoding.client.ts` already calls `https://geocoding-api.open-meteo.com/v1/search`. Open-Meteo is not a new vendor in this codebase, it is an existing one.

**The attribution.** The exact string `Source: Includes weather data from Google` is hard-coded in four places: `packages/client/src/pages/fishing/CatchDetailPage.tsx:398`, `packages/client/src/lib/weather.ts:219` (as `WEATHER_SOURCE_LINE`, rendered at `LogCatchPage.tsx:1344`), `packages/client/src/components/landing/LandingRecord.tsx:58`, and `packages/client/src/components/landing/demo/data.ts:113`.

**Migration tooling.** There is no `packages/server/prisma/migrations` directory. Schema changes go through `bun run prisma:db:push`. No hand-written migration should be added.

---

## Options considered

### Open-Meteo — recommended

**Forecast API.** `https://api.open-meteo.com/v1/forecast`. Live call at `-34.1279, 18.4487` (Kommetjie) requesting all sixteen variables we care about returned **real numbers for every one of them**, no nulls: `temperature_2m`, `apparent_temperature`, `relative_humidity_2m`, `dew_point_2m`, `surface_pressure`, `pressure_msl`, `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`, `cloud_cover`, `precipitation`, `precipitation_probability`, `visibility` (unit `m`), `uv_index`, `is_day`, `weather_code`. Units come back in a `hourly_units` block; `uv_index` and `is_day` carry an empty unit string.
Source: https://open-meteo.com/en/docs and the live response from the URL above.

**The past window, measured rather than assumed.** The docs say `past_days` accepts `0-92`. In practice at this coordinate: `past_days=7` fully populated, `past_days=31` fully populated, `past_days=60` fully populated (first timestamp `2026-07-18T00:00`), but `past_days=92` came back with **leading nulls** before real data began. So the honest working limit is around 60 days, not the documented 92. This contradicts the documentation and the design below is built on the measured number.

**Historical Forecast API.** `https://historical-forecast-api.open-meteo.com/v1/forecast`. This is archived high-resolution model runs stitched together, not reanalysis. Live: a request for `2022-01-01` returned real `visibility` (24140 m) and real `uv_index`, but `precipitation_probability` was **entirely null**. A request for `2026-09-14` to `2026-09-15`, the two days before today, returned every variable populated including `precipitation_probability`, so latency is effectively nil.
Source: https://open-meteo.com/en/docs/historical-forecast-api plus the two live calls.

**Historical (ERA5 archive) API.** `https://archive-api.open-meteo.com/v1/archive`. Live: `temperature_2m`, `apparent_temperature`, `relative_humidity_2m`, `dew_point_2m`, `surface_pressure`, `pressure_msl`, wind, `cloud_cover`, `precipitation`, `weather_code` and `is_day` all returned real numbers. But a request for `visibility`, `uv_index` and `precipitation_probability` came back with those three units as `"undefined"` and every value `null`. Combined with ERA5's 0.25° (~25 km) grid and 5-day delay, **this endpoint is the wrong choice for us** and the design below does not use it.
Source: https://open-meteo.com/en/docs/historical-weather-api plus the live call.

**Marine API.** `https://marine-api.open-meteo.com/v1/marine`. Live at the Kommetjie coordinate: `sea_surface_temperature` 11.9 to 12.9 °C, `wave_height` 1.16 to 2.40 m, `swell_wave_height` 0.60 to 2.00 m, `sea_level_height_msl` -0.87 to 0.55 m, all real numbers. Live at Theewaterskloof (`-34.06, 19.25`), an inland dam: **200 OK with every value null and no error message**, which gives us a free and reliable coastal test. Supports `past_days` 0-92 and `start_date`/`end_date`. Models include MeteoFrance MFWAM at 0.08° (~8 km) and ECMWF WAM at 9 km. The docs state plainly: "Accuracy at coastal areas is limited. This is not suitable for coastal navigation."
Source: https://open-meteo.com/en/docs/marine-weather-api plus both live calls.

**Air Quality API.** `https://air-quality-api.open-meteo.com/v1/air-quality` carries `uv_index` and `uv_index_clear_sky` as well as `pm10` and `pm2_5`, at 0.4° (~45 km) globally. **We do not need it**: UV is available on the forecast API at far better resolution, confirmed live.
Source: https://open-meteo.com/en/docs/air-quality-api

**Licence, key and limits.** No API key on the free tier. Free limits are quoted as "Less than 10'000 API calls per day, 5'000 per hour and 600 per minute". Data is CC BY 4.0. The requested credit line, from the project's own README, is **"Weather data by Open-Meteo.com"**. The source code is AGPLv3, which does not touch us since we are an API consumer.
Sources: https://open-meteo.com/en/terms and https://github.com/open-meteo/open-meteo

**The commercial catch, and it is the important one.** The terms say: "You may only use the free API services for non-commercial purposes," and define non-commercial as "private or non-profit websites or apps that do not have subscriptions or advertising." The pricing page marks the free tier "Commercial use ❌". Open-Meteo's own blog gives Standard at $29 per month (1M calls) and Professional at $99 per month (5M calls). I could not read prices from the pricing page itself, which renders them client-side, so treat the figures as blog-sourced rather than page-sourced.
Critically, the pricing table shows the **Standard tier excludes both the Historical Weather API and the Historical Forecast API**; those need Professional. That shapes the design: keep as much as possible inside the forecast endpoint's past window, which Standard does include.
Sources: https://open-meteo.com/en/terms, https://open-meteo.com/en/pricing, https://openmeteo.substack.com/p/api-subscriptions-for-commercial

**ECMWF vs GFS vs best_match.** Leave it on the default `best_match`, described as providing "the best forecast for any given location worldwide". Two facts settle this. The DWD page states "visibility and snowfall height are not available in ICON Global," so if we pinned a single global model we could lose a column we have a slot for; `best_match` blends and our live South African calls returned visibility populated. And ECMWF IFS HRES at 9 km drops to 3-hourly after 90 hours and carries "an additional delay of 2 hours compared to the real-time IFS dissemination", which is a needless penalty for a past-hours lookup.
Sources: https://open-meteo.com/en/docs/ecmwf-api, https://open-meteo.com/en/docs/dwd-api, https://open-meteo.com/en/docs/gfs-api

### Met.no Locationforecast — loses on history

CC BY 4.0, no key, genuinely free, and explicitly commercial-friendly (no commercial restriction in the terms). It carries `air_temperature`, `air_pressure_at_sea_level`, `relative_humidity`, `dew_point_temperature`, wind speed, direction and gusts, cloud fraction, precipitation amount and probability, UV index, fog fraction and a `symbol_code`.

It loses on the single requirement this product is built around. The documentation states: "While we only serve current forecasts via the API, you can find historical forecast model data in NetCDF format on https://thredds.met.no/thredds/metno.html." A catch logged hours later cannot be served. It also has **no visibility**, **no surface pressure** (only MSL) and **no apparent temperature**, which would leave three of our columns permanently null. Operationally it demands a real `User-Agent` (403 otherwise), `If-Modified-Since` caching, and anything over 20 requests/second needs an agreement.
Sources: https://api.met.no/doc/TermsOfService, https://api.met.no/doc/locationforecast/datamodel, https://api.met.no/weatherapi/locationforecast/2.0/documentation

Worth keeping in mind as a **failover** for the "now" case, since its licence and price are compatible and it would cover a genuine Open-Meteo outage.

### WeatherAPI.com — loses on history depth and on needing a key

100K calls/month free, commercial use permitted on the free tier, first paid tier $7 per month. But the free plan gives **1 day of history** and marine limited to "1 Day. No Tide Data." A catch backdated a week is unservable. It also requires a key, which is precisely the operational weight we are trying to shed.
Source: https://www.weatherapi.com/pricing.aspx

### Stormglass.io — loses outright

Tempting because it bundles tide, SST and waves. The free tier is **10 requests per day** and is not permitted for commercial use; the first paid tier is €19/month and commercial rights start at €49/month. Ten requests a day cannot run a logging app.
Source: https://stormglass.io/pricing/

### OpenWeatherMap One Call 3.0 — loses on the card

Roughly 1,000 calls/day free, but activation requires a credit card on file to bill overage. I could not get the vendor's own pricing page to render, so I am flagging this as secondary-sourced. Either way, a card-on-file requirement is strictly worse than a keyless free endpoint.
Source: https://openweathermap.org/api/one-call-3 (would not render), corroborated by search results only.

### Google Weather API — what we are leaving

The SKU is "Weather Usage" (9DB8-727A-ACFE), Essentials tier, **10,000 free billable events per month per SKU**, then $0.15 per 1,000 up to 100k, $0.12, $0.09, $0.06 and $0.038 in higher bands.
Source: https://developers.google.com/maps/billing-and-pricing/pricing

On attribution, Google's policy requires the exact string "Source: Includes weather data from Google", displayed "on or next to the data or imagery used", "near the top or bottom of the content, and within the same visual container". **A correction to our own docs**: `docs/redesign/05-functionality-gaps.md:240` states the policy also mandates 12 to 16 sp, one of three permitted colours and 4.5:1 contrast. The Weather API policies page states the string and the placement but I could not find a font size or contrast requirement specific to Weather attribution on it. It stops mattering once the data is gone, but the gaps doc should not be cited for that detail.
Source: https://developers.google.com/maps/documentation/weather/policies

---

## Recommendation

**Open-Meteo, read from the hourly arrays, never from a `current` block.**

A finding worth stating because it runs against the documentation: the docs list a short set of variables for `current=`, but a live call with `current=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,surface_pressure,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation,weather_code,is_day,visibility,uv_index` **succeeded and returned all of them** (15.9 °C, dew point 6.7, visibility 46080 m, UV 6.35, gusts 62.6 km/h, at `2026-09-16T13:15`). So `current` would work. I still recommend against it: the product needs the minute of the catch, and if "now" and "three hours ago" go down the same hourly code path there is exactly one mapping function to get right, one set of interpolation rules, and no chance of "now" and "backdated" disagreeing about what a reading means.

Everything else follows from that one decision.

---

## How it works in this repo

### The reading, to the minute of the catch

The new client takes `(latitude, longitude, when)` and picks its endpoint from the age of `when`:

| Age of `caughtAt` | Endpoint | Why |
|---|---|---|
| Now, or up to 16 days ahead | `api.open-meteo.com/v1/forecast` | the live path |
| 0 to 60 days back | same, with `past_days` sized to the gap | verified populated at 7, 31 and 60 days; included in the Standard plan if we ever go commercial |
| Older than 60 days | `historical-forecast-api.open-meteo.com/v1/forecast` with `start_date`/`end_date` | verified back to 2022 and current to yesterday; `precipitation_probability` is null on old dates |
| Never | `archive-api.open-meteo.com/v1/archive` | verified to lack `visibility`, `uv_index` and `precipitation_probability` |

During the build, check whether `start_date`/`end_date` work on the forecast endpoint for past dates. If they do, use them instead of `past_days` and the response shrinks from 1,464 hours to 24. I verified `past_days` works and did not verify past `start_date` on that endpoint, so `past_days` is the safe default.

Then interpolate, and be honest about it in two different ways:

- **Continuous values** (temperature, apparent temperature, dew point, humidity, both pressures, wind speed, gusts, cloud cover, visibility, UV) are linearly interpolated between the two bracketing hours.
- **Categorical and directional values** (`weather_code`, `is_day`, `precipitation_probability`, `wind_direction_10m`) take the nearest hour. Wind direction especially: linear interpolation turns 350° and 10° into 180°, which is the wrong way down the beach.

`weatherCurrentTime` stores `caughtAt` itself, and the provenance line says which hours it was drawn between. That satisfies the brief's rule that every value says where it came from.

### Filling all 25 columns

The columns do not change. Only the fill does.

| Column | Open-Meteo field |
|---|---|
| `weatherCurrentTime` | the catch's own `caughtAt` (was always null) |
| `weatherTimeZoneId` | the `timezone` echoed back from `timezone=auto` (was always null) |
| `weatherConditionType` | stable token from our code table, e.g. `RAIN_SHOWERS_SLIGHT` (was a duplicate of the text) |
| `weatherConditionText` | plain English from our code table |
| `weatherConditionIconBaseUri` | no equivalent; see "what we lose" |
| `weatherTemperatureDegrees` / `Unit` | `temperature_2m` / `'CELSIUS'` |
| `weatherFeelsLikeTemperatureDegrees` / `Unit` | `apparent_temperature` / `'CELSIUS'` (was null) |
| `weatherDewPointDegrees` / `Unit` | `dew_point_2m` / `'CELSIUS'` (was null) |
| `weatherPrecipitationProbability` | `precipitation_probability` |
| `weatherAirPressureMeanSeaLevelMillibars` | `pressure_msl`, rounded (column is `Int`) (was null) |
| `weatherWindDirectionDegrees` | `wind_direction_10m` (was null) |
| `weatherWindDirectionCardinal` | derived from degrees into the 16-point enum the client already speaks |
| `weatherWindSpeedValue` / `Unit` | `wind_speed_10m` with `wind_speed_unit=kmh` / `'KILOMETERS_PER_HOUR'` |
| `weatherWindGustValue` / `Unit` | `wind_gusts_10m` / `'KILOMETERS_PER_HOUR'` |
| `weatherVisibilityDistanceValue` / `Unit` | `visibility` in m, converted to km / `'KILOMETERS'` (was null) |
| `weatherIsDaytime` | `is_day === 1` (was null) |
| `weatherRelativeHumidity` | `relative_humidity_2m` (was null; the UI already renders a tile for it) |
| `weatherUvIndex` | `Math.round(uv_index)` (was null; the UI already renders a tile) |
| `weatherThunderstormProbability` | no equivalent; stays null |
| `weatherCloudCover` | `cloud_cover` |
| `waterTemp` | marine `sea_surface_temperature` on coastal spots (was hard-nulled) |
| `weather` | the plain-English sentence |

The one deliberate change of meaning: `weatherWindDirectionCardinal` must emit Google's enum spelling (`NORTH_NORTHEAST`, `SOUTH_SOUTHWEST`) because `formatCardinal` in `packages/client/src/lib/weather.ts` already maps exactly those sixteen strings. Emitting `NNE` instead would silently fall through its `?? cardinal` branch and ship raw tokens to the interface. Keeping the enum means **zero change to that function and zero change to already-stored rows**.

### Pressure that is comparable across trips

Use `pressure_msl`, not `surface_pressure`. Mean-sea-level pressure removes the altitude term, so a reading at a dam at 300 m and a reading on a rock ledge at sea level sit on the same scale. `surface_pressure` does not, and comparing them across spots would produce nonsense.

Two trends, both cheap:

1. **Within the session.** The same hourly array already contains the hours before `caughtAt`. Compute the 3-hour delta at write time and store it in a new `weatherPressureTrend3h Float?`. Store it rather than recompute, because the whole value of the number is that it can be read back years later without calling anyone.
2. **Since the last trip here.** `SELECT weatherAirPressureMeanSeaLevelMillibars, caughtAt FROM Catch WHERE siteId = ? AND createdById = ? AND caughtAt < ? ORDER BY caughtAt DESC LIMIT 1`. The existing `@@index([siteId, caughtAt(sort: Desc)])` already serves this, so **no index change is needed**. This produces the "1013 hPa, down 6 since your last trip here" line the gaps doc calls B7c.

B7c also depends on blank trips (gaps doc C1). Without a record of fishless sessions, "your last trip here" means "the last time you caught something here", which is a different and much less useful sentence. That dependency is real and it is why this item sits last in the build order.

### Sea surface temperature and waves

One call to the marine endpoint with the same hour selection, requesting `sea_surface_temperature`, `wave_height`, `wave_period`, `wave_direction`, `swell_wave_height` and `sea_level_height_msl`.

Detect coastal spots by **calling and checking for nulls**, not by reading `waterType`. Verified: the inland dam returns 200 with all-null arrays and no error. A `SALTWATER` lagoon can still sit off the wave grid, and a spot the angler mislabelled should not silently lose its sea temperature.

`sea_surface_temperature` fills `waterTemp`. That column is currently hard-nulled at both write sites, so this is pure gain, but the provenance line must be exact: it is a model value on roughly an 8 km grid, not a thermometer in the water. Something like "Water 12 °C, modelled, not measured" keeps faith with the brief's rule that every value says where it came from. Wave height needs a new column.

### Sunrise, sunset, moon phase and illumination, with no API

`suncalc@2.0.2`, BSD-2-Clause, published 2026-09-02, 51,562 bytes unpacked, no runtime dependencies. Its README states the calculations follow Jean Meeus, *Astronomical Algorithms*, with roughly 0.08° accuracy on sun position and about 15 seconds on rise and set times. That is far better than an angler needs to know when it gets light.

- `SunCalc.getTimes(date, lat, lon)` gives `sunrise`, `sunset`, `dawn`, `dusk`, `nauticalDawn`, `nauticalDusk`, `goldenHour` and seven more. Dawn and dusk are when people fish, and they are free.
- `SunCalc.getMoonIllumination(date)` gives `fraction` (0 to 1 illuminated), `phase` (0 to 1 around the cycle) and `waxing`, which names itself: "Waxing gibbous, 73% lit".

The registry metadata for `suncalc` has no `license` field, which is why the licence above is cited from the repository's `LICENSE` file (BSD 2-Clause, Volodymyr Agafonkin) rather than from npm.

Considered and not chosen: `astronomy-engine@2.1.19`, MIT, claiming ±1 arcminute and valid for millennia. It is the better library in the abstract and unnecessary here; we are printing a sunrise to the minute, not pointing a telescope.

This is computed at render time from `caughtAt` and the pin. **No columns, no API, no key, no cost**, which is exactly why the gaps doc rates B7b as priority 2 and UI-only.

### Tides: the honest answer

- **SANHO is the authority and it is closed.** The South African Tide Tables are copyrighted to the South African National Hydrographer, SA Navy, and may not be reproduced without written permission. We cannot scrape, mirror or embed them. If the owner wants real tide tables, the route is a permission request, not a build ticket.
- **Open-Meteo's `sea_level_height_msl` is free and real but is not a tide table.** It comes from MeteoFrance SMOC at 0.083° (~8 km), described as "sea level height considering tides", and it returned believable values at our Cape coordinate (-0.87 to 0.55 m). Open-Meteo themselves warn that 8 km "cannot accurately capture complex coastlines", that heights are referenced to global mean sea level rather than chart datum (LAT) so "direct comparisons are not possible", and that it is not for coastal navigation.
- **FES2022 via AVISO is free and commercially usable but is a project.** The heights "can be used for any purpose (scientific, commercial,…)", but access needs registration and approval, delivery is by FTP/SFTP/Thredds, a specific citation is required, and predicting from it means shipping a tidal atlas plus PyFES (BSD-3-Clause).
- **Paid, if the owner wants numbers now.** TidesAtlas (TICON-4 + NOAA + FES2022, commercial use permitted, 50 free credits, from $7.99/month) or WorldTides (100 free credits, from $4.99/month for 20,000, with the licence restricting cached predictions to the user who requested them).

**Recommendation:** ship the Open-Meteo curve as a **shape with no numbers on the axis**. "Water falling, about three hours after high" is defensible at 8 km resolution and is the thing that actually correlates with fish. "High water 1.74 m at 14:12" is not defensible and would be wrong against the printed tables anglers carry. This honours the gaps doc's B7d instruction not to put a tide slot on a screen before the licensing decision is made, while still giving the angler the direction of the water.

### Weather code to plain English

Open-Meteo returns a bare WMO number and no text, so the mapping is ours to own. One new file, one table, about 30 lines. The full set from the docs:

`0` Clear sky · `1, 2, 3` Mainly clear, partly cloudy, overcast · `45, 48` Fog and depositing rime fog · `51, 53, 55` Drizzle light, moderate, dense · `56, 57` Freezing drizzle light and dense · `61, 63, 65` Rain slight, moderate, heavy · `66, 67` Freezing rain light and heavy · `71, 73, 75` Snowfall slight, moderate, heavy · `77` Snow grains · `80, 81, 82` Rain showers slight, moderate, violent · `85, 86` Snow showers slight and heavy · `95` Thunderstorm slight or moderate · `96, 99` Thunderstorm with slight and heavy hail (Central Europe only).

Three rules for the table. Each code maps to a **token** (fills `weatherConditionType`, stable and machine-readable) and a **text** (fills `weatherConditionText`, in the product's voice), which finally makes those two columns mean different things. Each entry takes an `is_day` variant, so code `0` at 03:00 reads "Clear night sky" and not "Clear sky". And the copy obeys the brief: sentence case, no em dashes, no exclamation marks. Keep the snow codes even though they will almost never fire on the Cape coast; Sutherland and the Berg do snow.

### The new client's shape

`packages/server/clients/open-meteo.client.ts`, replacing `weather.client.ts`:

```ts
export type ConditionsReading = {
  observedAt: Date;          // the catch's own time
  interpolatedFrom: [Date, Date];  // provenance
  timeZoneId: string;
  temperatureC: number; apparentTemperatureC: number; dewPointC: number;
  relativeHumidity: number; pressureMslHpa: number; surfacePressureHpa: number;
  windSpeedKmh: number; windDirectionDegrees: number; windGustsKmh: number;
  cloudCoverPercent: number; precipitationMm: number;
  precipitationProbability: number | null;  // null on old dates
  visibilityKm: number; uvIndex: number; isDay: boolean;
  weatherCode: number; pressureTrend3h: number | null;
};

export type MarineReading = {
  seaSurfaceTemperatureC: number; waveHeightM: number;
  wavePeriodS: number; waveDirectionDegrees: number;
  swellWaveHeightM: number; seaLevelHeightMslM: number;
} | null;  // null means not a coastal point

export async function readConditionsAt(lat: number, lon: number, when: Date): Promise<ConditionsReading | null>;
export async function readMarineAt(lat: number, lon: number, when: Date): Promise<MarineReading>;
```

Both send a descriptive `User-Agent`, carry a timeout and one retry, and return `null` rather than throwing on a bad reading, preserving the existing "never block a save" behaviour.

### Endpoints and schema

`GET /api/weather/current` becomes `GET /api/conditions?latitude=&longitude=&at=`, with the old path kept as an alias for one release so the client can deploy on its own schedule.

The bigger change is direction of trust. Today the client computes a snapshot and posts it; the server stores whatever arrives. **Make the server authoritative**: the client sends where and when, the server reads the conditions and fills the columns. This closes the hole where a client can post invented weather, and it deletes `toSavableSnapshot` and the all-or-nothing `weatherSnapshotSchema` that currently caps the pipeline at nine values.

Schema changes are additive only, applied with `bun run prisma:db:push` (there is no migrations directory and none should be created):

- `latitude Float?`, `longitude Float?` on `Catch`. Already an open gap (A2.1); the conditions work needs it anyway to re-read at the exact pin and to test for coastal.
- `waveHeight Float?`, `seaLevelHeightMsl Float?`
- `weatherPressureTrend3h Float?`
- `weatherProvider String?` so a row can say who it came from, which matters during the changeover and for the provenance line.

All 25 existing weather columns stay exactly as they are.

---

## Migration or build order

1. **Push the additive columns.** `latitude`, `longitude`, `waveHeight`, `seaLevelHeightMsl`, `weatherPressureTrend3h`, `weatherProvider`. Nothing reads them yet. Safe on a live database.
2. **Add the new client and the code table**, behind a `WEATHER_PROVIDER=open-meteo|google` switch with the Google client still in place. Add `GET /api/conditions` alongside the old route. Fully reversible.
3. **Invert the write path.** `mapWeatherSnapshotToCatchData` takes a `ConditionsReading` and fills all 25 columns; the server reads conditions from `caughtAt` and coordinates; `waterTemp` stops being hard-nulled. Accept and ignore the old `weatherSnapshot` body field so old clients keep working.
4. **Client catches up.** Send `caughtAt` and coordinates, stop sending a snapshot, swap the attribution, add the new rows to the conditions block. Fix `LogCatchPage.tsx:432` and change Edit catch's "Load latest conditions" to "Re-read conditions for the time of the catch", which is the difference between repairing history and destroying it.
5. **Marine branch.** Coastal detection, `waterTemp` and wave height start filling.
6. **Almanac.** Add `suncalc`, render sun and moon. Independent of everything above, shippable any time after step 1.
7. **Pressure trend across trips.** Last, because it needs step 3 to have produced readings and it needs blank trips (gaps doc C1) to have readings from fishless sessions.
8. **Remove Google.** Delete `weather.client.ts`, drop the provider switch, remove `GOOGLE_WEATHER_API_KEY` and `GOOGLE_WEATHER_API_REFERER` from `.env.example` and from the deployment environment.
9. **Optional backfill.** Every existing catch whose site has coordinates can have its conditions re-read for its own `caughtAt` through the historical-forecast API. This is the one moment that endpoint earns its keep. One script, well under 600 requests per minute, and it should write `weatherProvider` so a backfilled row is distinguishable from an originally-recorded one.

---

## What it costs and what we lose

**Cost.** From $0.15 per 1,000 calls above 10,000/month to zero. At this app's volume that was never large money; the real gain is no key to rotate, no HTTP-referer restriction to debug (the current client has a bespoke error branch for `API_KEY_HTTP_REFERRER_BLOCKED`), and no billing account coupled to the fishing log.

**What we actually lose:**

- **`iconBaseUri`.** Google shipped an icon URL per condition. Section 3.5 of the brief permits Heroicons outline and nothing else, so this was never going to be rendered. `weatherConditionIconBaseUri` becomes null or holds our own token.
- **`thunderstormProbability`.** No Open-Meteo equivalent. Leave the column null and drop the UI slot rather than deriving a fake percentage from weather codes 95, 96 and 99.
- **`precipitation_probability` on old catches.** Null before roughly the last few years on the historical-forecast endpoint, verified at 2022-01-01. A backfilled 2022 catch will honestly show no rain chance.
- **An uptime guarantee.** Open-Meteo's free tier carries none. The existing "the reading did not come back, what is here is what was stored" behaviour is what makes this acceptable, and it must be preserved rather than tidied away.
- **Precision on water temperature and tide.** Both are model values on roughly an 8 km grid. The provenance line has to say so.

**The licence, which is the thing to actually worry about.** The free tier is non-commercial only, in Open-Meteo's own words. The app today has no subscription and no advertising, so it qualifies under their definition. The day it charges, it needs a plan. And because the Standard plan ($29/month) **excludes** both historical endpoints, a commercial version that lets anglers backdate catches beyond the ~60-day forecast window lands on Professional ($99/month). That is the single most consequential fact in this report, and it is the reason the design pushes as much traffic as possible into the forecast endpoint's past window.

**What happens to `GOOGLE_WEATHER_API_KEY`.** It is deleted from `.env.example` and from the deployment environment, along with `GOOGLE_WEATHER_API_REFERER`. One trap: `weather.client.ts` falls back to `GOOGLE_MAPS_API_KEY` and then `GOOGLE_API_KEY`, so removing the weather key alone would not stop the calls, it would move the billing to the Maps key. Delete the client, not just the variable. `GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_API_KEY` **stay**: `GoogleMapLocationPicker.tsx` and the embed iframes on the record and spot pages still use them.

**What happens to the attribution line.** Google's requirement attaches to displaying Google weather data; when none is displayed, it lapses. The exact string `Source: Includes weather data from Google` is removed from all four places it is hard-coded, including the two marketing surfaces, which would otherwise keep claiming a provider we no longer use.

It is replaced, not deleted. Open-Meteo data is CC BY 4.0 and CC BY requires credit, so the new line is an obligation in the same way the old one was. The project asks for **"Weather data by Open-Meteo.com"**. Put it in the same slot, linked to https://open-meteo.com/, and since CC BY also asks for a link to the licence, the safest rendering is `Weather data by Open-Meteo.com (CC BY 4.0)` with both linked. One line covers the marine data too, same provider, same licence. It is shorter than the Google line, which the conditions block will thank us for on a 375px column.

---

## Open questions for the owner

1. **Will this app ever charge or carry ads?** This is the fork in the road. Free forever if not; $29/month if yes; $99/month if yes *and* anglers can backdate catches more than about 60 days.
2. **Tides.** Ship the Open-Meteo curve as a shape with no numbers, approach SANHO for permission, or buy TidesAtlas or WorldTides? The gaps doc says no UI slot until this is decided, and I agree.
3. **Backfill or not.** Re-reading conditions for existing catches gives every old record a full snapshot, but it rewrites history with a model's opinion of it. My instinct is to backfill and mark the rows via `weatherProvider` so the record says which it is.
4. **Thunderstorm probability and the condition icon.** Drop both slots, or keep the columns null?
5. **Server-authoritative conditions.** I recommend it, and it deletes the client's `toSavableSnapshot`. Confirm you are happy that the client stops being able to supply its own weather.
6. **`weatherUvIndex` is an `Int`.** A UV of 6.35 rounds to 6. Fine, or widen the column to `Float`?
7. **Calling a modelled 8 km sea surface temperature "water temp".** Acceptable with a provenance line, given that the brief demands every value declare its origin?
