import { PageHead } from '@/components/brand/PageHead';
import axios from 'axios';
import {
   useEffect,
   useMemo,
   useRef,
   useState,
   type CSSProperties,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { DayStrip } from '@/components/forecast/DayStrip';
import { HourGrid } from '@/components/forecast/HourGrid';
import { PlaceSearch } from '@/components/forecast/PlaceSearch';
import { RatingPanel } from '@/components/forecast/RatingPanel';
import {
   clockAtPlace,
   fetchForecast,
   localHourNow,
   namePlace,
   type Forecast,
   type ForecastDay,
   type ForecastRating,
   type PlaceHit,
   type RatedHour,
} from '@/components/forecast/forecast-api';
import { Button } from '@/components/ui/button';
import { usePosition } from '@/lib/position';
import { useIsSignedIn } from '@/lib/auth-client';
import {
   fetchConditions,
   type WeatherSnapshot,
} from '@/components/fishing/record/api';
import { useDocumentTitle } from '@/lib/title';
import { readUnitSystem, speedIn, tempIn, unitOf } from '@/lib/units';

/*
 * The week ahead, at a place.
 *
 * The home page reads the hour where you stand. This is the other question an
 * angler asks: what will Saturday be like at Kommetjie. So the place is
 * searched or taken from the phone, kept in the address so the page can be
 * sent to a friend, and the days and hours laid out under it.
 *
 * Public, like a tide table pinned up at the slipway. There is nothing of
 * anyone's in a forecast.
 */

type Target = { latitude: number; longitude: number; name: string | null };

type Status = 'idle' | 'loading' | 'ready' | 'error';

/* With no place and no fix, a search leans towards the coast most of the
   first anglers fish, so Kanu is the farm at Stellenbosch, not a town in
   Japan. */
const HOME_WATERS = { latitude: -33.9, longitude: 18.9 };

export function ForecastPage() {
   useDocumentTitle('Forecast');

   const [params, setParams] = useSearchParams();
   const { fix, ask, state: positionState } = usePosition();
   const system = readUnitSystem();

   const target = useMemo<Target | null>(() => {
      const lat = Number(params.get('lat'));
      const lng = Number(params.get('lng'));
      if (Number.isFinite(lat) && Number.isFinite(lng) && params.has('lat')) {
         return { latitude: lat, longitude: lng, name: params.get('name') };
      }
      if (fix) {
         return {
            latitude: fix.latitude,
            longitude: fix.longitude,
            name: null,
         };
      }
      return null;
   }, [params, fix?.latitude, fix?.longitude]);

   const [status, setStatus] = useState<Status>(target ? 'loading' : 'idle');
   const [forecast, setForecast] = useState<Forecast | null>(null);
   /*
    * Whether the week is worth driving out for, read off this angler's own
    * log on the server. Null for anyone signed out, and null when the page
    * had to go to Open-Meteo itself because the server was throttled: in
    * both cases the week draws exactly as it always did.
    */
   const [rating, setRating] = useState<ForecastRating | null>(null);

   /*
    * The reading of the moment at the place, beside the week ahead. This is
    * the same reading the quick log stamps on a catch, and where the
    * WeatherKit keys are set on the server it is the phone's own weather.
    */
   const { isSignedIn } = useIsSignedIn();
   const [now, setNow] = useState<WeatherSnapshot | null>(null);
   const [placeName, setPlaceName] = useState<string | null>(null);
   const [selected, setSelected] = useState<string | null>(null);
   /*
    * Reading it again. `attempt` moves for the button under the hours and
    * for a tab that has been away longer than the answer keeps for; `forced`
    * carries the nonce past the browser's copy, and `quiet` holds the
    * skeleton back when nobody asked, so a phone picked up again fills in
    * under the reader rather than blanking on them.
    */
   const [attempt, setAttempt] = useState(0);
   const forced = useRef(false);
   const quiet = useRef(false);
   const readAt = useRef(0);
   const reread = (options?: { quiet?: boolean }) => {
      forced.current = true;
      quiet.current = options?.quiet ?? false;
      setAttempt((n) => n + 1);
   };

   useEffect(() => {
      if (!isSignedIn || !target) return;
      const controller = new AbortController();
      fetchConditions(target.latitude, target.longitude, controller.signal)
         .then((snapshot) => {
            if (!controller.signal.aborted) setNow(snapshot ?? null);
         })
         .catch(() => undefined);
      return () => controller.abort();
   }, [isSignedIn, target?.latitude, target?.longitude, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

   /*
    * The clock, ticking. Everything on this page that says now is worked out
    * while it draws: the hour banded in teal, which day counts as today, and
    * the time under the hours. Nothing was moving them, so a page left open
    * on a phone kept whatever hour it was opened on.
    */
   const [nowMs, setNowMs] = useState(() => Date.now());
   useEffect(() => {
      let timer = 0;
      const beat = () => {
         setNowMs(Date.now());
         timer = window.setTimeout(beat, 60000 - (Date.now() % 60000) + 50);
      };
      timer = window.setTimeout(beat, 60000 - (Date.now() % 60000) + 50);
      /* Back from somewhere else: the hour first, and the reading again if
         the one on screen is older than the answer is kept for. */
      const woke = () => {
         if (document.visibilityState !== 'visible') return;
         setNowMs(Date.now());
         if (readAt.current && Date.now() - readAt.current > 5 * 60 * 1000) {
            reread({ quiet: true });
         }
      };
      document.addEventListener('visibilitychange', woke);
      return () => {
         window.clearTimeout(timer);
         document.removeEventListener('visibilitychange', woke);
      };
   }, []);

   /* The forecast for wherever the page is pointed. */
   useEffect(() => {
      if (!target) {
         setStatus('idle');
         return;
      }
      const controller = new AbortController();
      const fresh = forced.current;
      const under = quiet.current;
      forced.current = false;
      quiet.current = false;
      if (!under) setStatus('loading');
      fetchForecast(
         target.latitude,
         target.longitude,
         controller.signal,
         fresh,
         system
      )
         .then((answer) => {
            if (!answer) {
               setStatus('error');
               return;
            }
            const found = answer.forecast;
            readAt.current = Date.now();
            setForecast(found);
            setRating(answer.rating);
            setSelected((was) =>
               was && found.days.some((d) => d.date === was)
                  ? was
                  : (found.days[0]?.date ?? null)
            );
            setStatus('ready');
            /*
             * That may have come off the browser's own five minute copy.
             * Draw it, since a drawn week beats a spinner, then ask the
             * server for a newer one behind it. Once only: the second ask
             * carries the nonce, so whatever it brings back stands.
             */
            const age = Date.now() - new Date(found.issuedAt).getTime();
            if (!fresh && Number.isFinite(age) && age > 5 * 60 * 1000) {
               reread({ quiet: true });
            }
         })
         .catch((error) => {
            if (!axios.isCancel(error)) setStatus('error');
         });
      return () => controller.abort();
   }, [target?.latitude, target?.longitude, attempt, system]);

   /* Its name, when the address did not carry one. */
   useEffect(() => {
      if (!target) {
         setPlaceName(null);
         return;
      }
      if (target.name) {
         setPlaceName(target.name);
         return;
      }
      setPlaceName(null);
      const controller = new AbortController();
      namePlace(target.latitude, target.longitude, controller.signal)
         .then((found) =>
            setPlaceName(
               found
                  ? [found.name, found.region].filter(Boolean).join(', ')
                  : null
            )
         )
         .catch(() => undefined);
      return () => controller.abort();
   }, [target?.latitude, target?.longitude, target?.name]);

   const pick = (place: PlaceHit) => {
      setParams({
         lat: place.latitude.toFixed(4),
         lng: place.longitude.toFixed(4),
         name: [place.name, place.region].filter(Boolean).join(', '),
      });
   };

   const useMine = () => {
      void ask().then((found) => {
         if (found) setParams({});
      });
   };

   /* Inland the marine model says nothing, so the tide row and its
      provenance both stay away. */
   const hasTide = useMemo(
      () => (forecast?.hours ?? []).some((h) => (h.seaLevelM ?? null) !== null),
      [forecast]
   );

   const nowLocal = forecast
      ? localHourNow(forecast.utcOffsetSeconds, nowMs)
      : null;
   /* When the app last asked, on the clock at the place. */
   const checkedAt = forecast
      ? clockAtPlace(forecast.issuedAt, forecast.utcOffsetSeconds)
      : null;
   const today = nowLocal ? nowLocal.slice(0, 10) : '';
   const day = forecast?.days.find((d) => d.date === selected) ?? null;
   /* The day after, because a moon that rises today sets tomorrow morning. */
   const dayAt = day
      ? (forecast?.days.findIndex((d) => d.date === day.date) ?? -1)
      : -1;
   const nextDay = dayAt < 0 ? null : (forecast?.days[dayAt + 1] ?? null);
   const dayHours = useMemo(
      () =>
         forecast && selected
            ? forecast.hours.filter((h) => h.local.startsWith(selected))
            : [],
      [forecast, selected]
   );
   /* The band per hour, by its local stamp, for the row in the instrument. */
   const ratedHours = useMemo(
      () =>
         rating
            ? new Map<string, RatedHour>(
                 rating.hours.map((h) => [h.local, h] as const)
              )
            : undefined,
      [rating]
   );
   const ratedDay = rating?.days.find((d) => d.date === selected) ?? null;

   return (
      <section className="relative mx-auto w-[min(1680px,100%-32px)] pb-8 md:pb-12">
         <PageHead
            kicker="Forecast"
            title={
               placeName ??
               (target
                  ? status === 'ready'
                     ? 'Where you are'
                     : 'Reading the week'
                  : 'Pick a place')
            }
         />
         <PlaceSearch
            onPick={pick}
            onUseMine={useMine}
            locating={positionState === 'asking'}
            near={
               target ??
               (fix
                  ? { latitude: fix.latitude, longitude: fix.longitude }
                  : HOME_WATERS)
            }
            className="w-full"
         />

         {status === 'idle' ? (
            <p className="mt-8 max-w-[52ch] text-[17px] text-ink-2">
               Search for a beach, a town or a headland, or use where you are.
               Seven days, hour by hour: wind and gusts with their direction,
               rain, pressure, swell, water temperature, the tide, the sun and
               the moon.
            </p>
         ) : status === 'error' ? (
            <div className="mt-8 flex flex-col items-start gap-4">
               <p className="max-w-[46ch] text-[17px] text-ink-2">
                  Could not read the forecast here. Try again.
               </p>
               <Button type="button" variant="outline" onClick={() => reread()}>
                  Try again
               </Button>
            </div>
         ) : status === 'loading' || !forecast || !day ? (
            <ForecastSkeleton />
         ) : (
            <>
               {now ? (
                  <div className="mt-5">
                     <NowFacts
                        snapshot={now}
                        system={system}
                        utcOffsetSeconds={forecast.utcOffsetSeconds}
                     />
                  </div>
               ) : null}
               <div className="mt-5">
                  <DayStrip
                     days={forecast.days}
                     selected={day.date}
                     today={today}
                     system={system}
                     onSelect={setSelected}
                  />
               </div>

               {/* Closer on a desk than on a phone. The strip, its caption and
                   the instrument are one thing being read top to bottom, and
                   the target is all of it under the day strip in a single
                   nine hundred pixel screen. */}
               <div
                  id="forecast-day"
                  role="tabpanel"
                  aria-labelledby={`day-${day.date}`}
                  className="mt-5 md:mt-3"
               >
                  {rating && ratedDay ? (
                     <div className="mb-5 md:mb-4">
                        <RatingPanel
                           key={ratedDay.date}
                           day={ratedDay}
                           rating={rating}
                           today={today}
                        />
                     </div>
                  ) : null}

                  <DayFacts key={day.date} day={day} system={system} />

                  <div className="mt-5 md:mt-4">
                     <HourGrid
                        key={day.date}
                        hours={dayHours}
                        day={day}
                        next={nextDay}
                        nowLocal={day.date === today ? nowLocal : null}
                        system={system}
                        rated={ratedHours}
                     />
                  </div>
               </div>

               <p className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[14px] text-ink-3">
                  <span>
                     {/* Checked, not read: this is when the app last asked
                         Open-Meteo, on the clock at the place, so a page sent
                         to a friend across a border still makes sense. */}
                     {checkedAt ? `Checked ${checkedAt}` : 'Checked'}
                     {forecast.timezone
                        ? `, hours in ${forecast.timezone.replace('_', ' ')}`
                        : ''}
                     . Weather data by Open-Meteo.com.
                     {hasTide
                        ? ' Sea level modelled on an 8 km grid, not a tide table.'
                        : ''}
                  </span>
                  <button
                     type="button"
                     onClick={() => reread()}
                     className="g-tracked -my-3 inline-flex min-h-11 items-center text-[16px] text-ink underline-offset-4 hover:underline"
                  >
                     Read again
                  </button>
               </p>
            </>
         )}
      </section>
   );
}

/*
 * What the day can be summed up in, above the hours.
 *
 * Four facts, never five. The tab above already says the sky, the high and
 * the low, so printing "Clear, 19 high 13 low" under it is the same day said
 * twice. What is left is the four things the tab cannot hold: the light, the
 * moon with its times, the hardest wind, and whether it rains.
 *
 * Two columns on a phone, where a label over its sentence is the only way four
 * facts fit. On a desk it was four columns of the same shape and it cost a
 * whole band of height to carry about ninety characters, so from md it is one
 * line under the day strip instead: the label inline in front of what it
 * names, the four running across, wrapping if a moon has a lot to say. It
 * reads as the caption to the strip above it, which is what it is.
 *
 * No mark beside any of them: an icon next to a word it duplicates is the
 * oldest tell there is.
 */
function DayFacts({
   day,
   system,
}: {
   day: ForecastDay;
   system: ReturnType<typeof readUnitSystem>;
}) {
   const clock = (stamped: string | null) =>
      stamped ? stamped.slice(11, 16) : null;
   const windMax = speedIn(day.windMaxKph, system);
   const gustMax = speedIn(day.windGustMaxKph, system);

   const facts: { key: string; label: string; value: string }[] = [];

   if (clock(day.sunrise) && clock(day.sunset)) {
      facts.push({
         key: 'light',
         label: 'Light',
         value: `${clock(day.sunrise)} to ${clock(day.sunset)}`,
      });
   }

   /*
    * When it is up is as much of the moon as a night session needs, in clock
    * order: a set before the rise is last night's moon going down.
    */
   const moonTimes = [
      day.moonrise ? { at: clock(day.moonrise), word: 'up' } : null,
      day.moonset ? { at: clock(day.moonset), word: 'down' } : null,
   ]
      .filter((t): t is { at: string; word: string } => t !== null)
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((t) => `${t.word} ${t.at}`);

   facts.push({
      key: 'moon',
      label: 'Moon',
      value:
         `${day.moon.name}, ${Math.round(day.moon.illumination * 100)}% lit` +
         (moonTimes.length > 0 ? `, ${moonTimes.join(', ')}` : '') +
         (day.moon.spring ? '. Spring tide' : ''),
   });

   if (windMax !== null) {
      facts.push({
         key: 'wind',
         label: 'Wind',
         value: `Up to ${windMax} ${unitOf('speed', system)}${
            gustMax !== null ? `, gusting ${gustMax}` : ''
         }`,
      });
   }

   if (day.precipitationProbabilityMax !== null) {
      facts.push({
         key: 'rain',
         label: 'Rain',
         value:
            day.precipitationProbabilityMax === 0
               ? 'None expected'
               : `${day.precipitationProbabilityMax}% chance${
                    day.precipitationSumMm
                       ? `, ${Math.round(day.precipitationSumMm * 10) / 10} mm`
                       : ''
                 }`,
      });
   }

   return (
      <dl className="grid grid-cols-2 gap-x-5 gap-y-3 md:flex md:flex-wrap md:items-baseline md:gap-x-7 md:gap-y-1">
         {facts.map((fact, index) => (
            <div
               key={fact.key}
               className="fact min-w-0 md:flex md:items-baseline md:gap-2"
               style={{ '--i': index } as CSSProperties}
            >
               <dt className="lab text-ink-3">{fact.label}</dt>
               <dd className="text-[14px] leading-tight text-ink">
                  {fact.value}
               </dd>
            </div>
         ))}
      </dl>
   );
}

function ForecastSkeleton() {
   return (
      <div role="status" aria-label="Reading the forecast" className="mt-5">
         <div className="-mx-4 flex gap-px px-4 md:mx-0 md:px-0">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
               <span
                  key={i}
                  className="shimmer h-[118px] min-w-16 flex-1 bg-bg-2 md:h-[119px] md:min-w-[96px]"
               />
            ))}
         </div>
         <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 md:mt-3 md:flex md:gap-x-7">
            {[0, 1, 2, 3].map((i) => (
               <span key={i} className="shimmer h-9 bg-bg-2 md:h-5 md:flex-1" />
            ))}
         </div>
         {/* The instrument at the height it lands at, so nothing shifts under
             the reader: the hours head, the wind bars, the tide, sky and air,
             the two arcs, rain, swell and the control under them. The desk
             figure is the ten rows at their md heights plus the head and the
             hairlines between them, which is what the row table adds up to. */}
         <div className="shimmer -mx-4 mt-5 h-[550px] bg-bg-2 md:mx-0 md:mt-4 md:h-[647px]" />
      </div>
   );
}

/*
 * Right now at the place, in one line.
 *
 * This used to print twelve figures, and the instrument below it prints nine
 * of the same ones against the hour they belong to, with the current hour
 * banded in teal. Saying the sky, the air, the wind, the pressure, the swell
 * and the sea twice on one screen is how a page gets to two thousand pixels.
 *
 * What is left is the four readings the hours do not carry: what the air feels
 * like on skin, how wet it is, how much cloud, and how far you can see. Those
 * are a reading of the moment and no forecast row holds them.
 */
function NowFacts({
   snapshot,
   system,
   utcOffsetSeconds,
}: {
   snapshot: WeatherSnapshot;
   system: ReturnType<typeof readUnitSystem>;
   /* The reading is stamped on the place's clock, not the reader's. */
   utcOffsetSeconds: number;
}) {
   const readAt = clockAtPlace(snapshot.observedAt, utcOffsetSeconds);
   const t = (c: number | null | undefined) =>
      typeof c === 'number'
         ? `${Math.round(tempIn(c, system) ?? c)}${unitOf('temp', system)}`
         : null;
   const facts: { key: string; label: string; value: string | null }[] = [
      {
         key: 'feels',
         label: 'Feels like',
         value: t(snapshot.feelsLike?.degrees),
      },
      {
         key: 'humidity',
         label: 'Humidity',
         value:
            snapshot.relativeHumidity != null
               ? `${Math.round(snapshot.relativeHumidity)}%`
               : null,
      },
      {
         key: 'cloud',
         label: 'Cloud',
         value:
            snapshot.cloudCover != null
               ? `${Math.round(snapshot.cloudCover)}%`
               : null,
      },
      {
         key: 'visibility',
         label: 'Visibility',
         value:
            snapshot.visibilityM != null
               ? `${Math.round(snapshot.visibilityM / 1000)} km`
               : null,
      },
   ];
   const shown = facts.filter((f) => f.value);
   if (shown.length === 0) return null;
   return (
      <section aria-label="Right now" className="border-t border-line pt-3">
         <div className="flex items-baseline justify-between gap-4">
            <h2 className="lab text-teal-text">Right now</h2>
            <p className="lab text-ink-3">
               {readAt ? `Read ${readAt}` : 'The reading of the moment'}
            </p>
         </div>
         <dl className="mt-1.5 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-0">
            {shown.map((fact, index) => (
               <div
                  key={fact.key}
                  className="fact min-w-0"
                  style={{ '--i': index } as CSSProperties}
               >
                  <dt className="lab text-ink-3">{fact.label}</dt>
                  <dd className="num text-[14px] leading-tight text-ink">
                     {fact.value}
                  </dd>
               </div>
            ))}
         </dl>
      </section>
   );
}
