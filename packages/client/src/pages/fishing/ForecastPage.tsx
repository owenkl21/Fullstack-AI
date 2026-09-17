import { PageHead } from '@/components/brand/PageHead';
import { ContourField } from '@/components/brand/ContourField';
import axios from 'axios';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
   CloudRainIcon,
   DaylightIcon,
   MoonPhaseIcon,
   SunIconFor,
   WindArrowIcon,
   WindIcon,
} from '@/components/fishing/home/ConditionIcons';
import { DayStrip } from '@/components/forecast/DayStrip';
import { HourGrid } from '@/components/forecast/HourGrid';
import { PlaceSearch } from '@/components/forecast/PlaceSearch';
import {
   fetchForecast,
   localHourNow,
   namePlace,
   type Forecast,
   type ForecastDay,
   type PlaceHit,
} from '@/components/forecast/forecast-api';
import { formatClock } from '@/components/fishing/record/format';
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
    * The reading of the moment at the place, beside the week ahead. This is
    * the same reading the quick log stamps on a catch, and where the
    * WeatherKit keys are set on the server it is the phone's own weather.
    */
   const { isSignedIn } = useIsSignedIn();
   const [now, setNow] = useState<WeatherSnapshot | null>(null);
   useEffect(() => {
      if (!isSignedIn || !target) return;
      const controller = new AbortController();
      fetchConditions(target.latitude, target.longitude, controller.signal)
         .then((snapshot) => {
            if (!controller.signal.aborted) setNow(snapshot ?? null);
         })
         .catch(() => undefined);
      return () => controller.abort();
   }, [isSignedIn, target?.latitude, target?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps
   const [placeName, setPlaceName] = useState<string | null>(null);
   const [selected, setSelected] = useState<string | null>(null);
   const [attempt, setAttempt] = useState(0);

   /* The forecast for wherever the page is pointed. */
   useEffect(() => {
      if (!target) {
         setStatus('idle');
         return;
      }
      const controller = new AbortController();
      setStatus('loading');
      fetchForecast(target.latitude, target.longitude, controller.signal)
         .then((found) => {
            if (!found) {
               setStatus('error');
               return;
            }
            setForecast(found);
            setSelected((was) =>
               was && found.days.some((d) => d.date === was)
                  ? was
                  : (found.days[0]?.date ?? null)
            );
            setStatus('ready');
         })
         .catch((error) => {
            if (!axios.isCancel(error)) setStatus('error');
         });
      return () => controller.abort();
   }, [target?.latitude, target?.longitude, attempt]);

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

   const nowLocal = forecast ? localHourNow(forecast.utcOffsetSeconds) : null;
   const today = nowLocal ? nowLocal.slice(0, 10) : '';
   const day = forecast?.days.find((d) => d.date === selected) ?? null;
   const dayHours = useMemo(
      () =>
         forecast && selected
            ? forecast.hours.filter((h) => h.local.startsWith(selected))
            : [],
      [forecast, selected]
   );

   return (
      <section className="relative mx-auto w-[min(1680px,100%-32px)] pb-8 md:pb-12">
         <ContourField seed={9} />
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
         <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <PlaceSearch
               onPick={pick}
               onUseMine={useMine}
               locating={positionState === 'asking'}
               near={target}
               className="w-full"
            />
         </div>

         {status === 'idle' ? (
            <p className="mt-8 max-w-[52ch] text-[17px] text-ink-2">
               Search for a beach, a town or a headland, or use where you are.
               Seven days, hour by hour: wind and gusts with their direction,
               rain, pressure, swell, water temperature, the sun and the moon.
            </p>
         ) : status === 'error' ? (
            <div className="mt-8 flex flex-col items-start gap-4">
               <p className="max-w-[46ch] text-[17px] text-ink-2">
                  Could not read the forecast here. Try again.
               </p>
               <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAttempt((n) => n + 1)}
               >
                  Try again
               </Button>
            </div>
         ) : status === 'loading' || !forecast || !day ? (
            <ForecastSkeleton />
         ) : (
            <>
               {now ? (
                  <div className="mt-8">
                     <NowFacts snapshot={now} system={system} />
                  </div>
               ) : null}
               <div className="mt-8">
                  <DayStrip
                     days={forecast.days}
                     selected={day.date}
                     today={today}
                     system={system}
                     onSelect={setSelected}
                  />
               </div>

               <div
                  id="forecast-day"
                  role="tabpanel"
                  aria-labelledby={`day-${day.date}`}
                  className="mt-8"
               >
                  <DayFacts key={day.date} day={day} system={system} />

                  <div className="mt-8">
                     <HourGrid
                        key={day.date}
                        hours={dayHours}
                        nowLocal={day.date === today ? nowLocal : null}
                        system={system}
                     />
                  </div>
               </div>

               <p className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[14px] text-ink-3">
                  <span>
                     Read {formatClock(forecast.issuedAt)}
                     {forecast.timezone
                        ? `, hours in ${forecast.timezone.replace('_', ' ')}`
                        : ''}
                     . Weather data by Open-Meteo.com.
                  </span>
                  <button
                     type="button"
                     onClick={() => setAttempt((n) => n + 1)}
                     className="g-tracked text-[16px] text-ink underline-offset-4 hover:underline"
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
 * What the day can be summed up in, above the hours: when there is light, what
 * the moon is doing, the strongest wind and where from, the rain, the sun.
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
   const hi = tempIn(day.temperatureMaxC, system);
   const lo = tempIn(day.temperatureMinC, system);

   const facts: {
      key: string;
      icon: React.ReactNode;
      label: string;
      value: string;
   }[] = [];

   if (clock(day.sunrise) && clock(day.sunset)) {
      facts.push({
         key: 'light',
         icon: <DaylightIcon aria-hidden="true" />,
         label: 'Light',
         value: `${clock(day.sunrise)} to ${clock(day.sunset)}`,
      });
   }

   facts.push({
      key: 'moon',
      icon: <MoonPhaseIcon fraction={day.moon.fraction} className="size-5" />,
      label: 'Moon',
      value: `${day.moon.name}, ${Math.round(day.moon.illumination * 100)}% lit${
         day.moon.spring ? '. Spring tide' : ''
      }`,
   });

   if (windMax !== null) {
      facts.push({
         key: 'wind',
         icon:
            day.windDirectionDominant === null ? (
               <WindIcon aria-hidden="true" />
            ) : (
               <WindArrowIcon degrees={day.windDirectionDominant} />
            ),
         label: 'Wind',
         value: `Up to ${windMax} ${unitOf('speed', system)}${
            gustMax !== null ? `, gusting ${gustMax}` : ''
         }`,
      });
   }

   if (day.precipitationProbabilityMax !== null) {
      facts.push({
         key: 'rain',
         icon: <CloudRainIcon aria-hidden="true" />,
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

   if (hi !== null && lo !== null) {
      facts.push({
         key: 'air',
         icon: <SunIconFor text={day.conditionText} />,
         label: day.conditionText ?? 'Air',
         value: `${hi}° high, ${lo}° low`,
      });
   }

   return (
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
         {facts.map((fact, index) => (
            <div
               key={fact.key}
               className="fact flex items-start gap-2.5"
               style={{ '--i': index } as CSSProperties}
            >
               <span className="mt-[2px] shrink-0 text-ink-3">{fact.icon}</span>
               <span className="min-w-0">
                  <dt className="lab text-ink-3">{fact.label}</dt>
                  <dd className="mt-0.5 text-[15px] text-ink">{fact.value}</dd>
               </span>
            </div>
         ))}
      </dl>
   );
}

function ForecastSkeleton() {
   return (
      <div role="status" aria-label="Reading the forecast" className="mt-8">
         <div className="flex gap-px">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
               <span
                  key={i}
                  className="shimmer h-[132px] min-w-[96px] flex-1 bg-bg-2"
               />
            ))}
         </div>
         <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
               <span key={i} className="shimmer h-10 bg-bg-2" />
            ))}
         </div>
         <div className="mt-8 flex flex-col gap-px">
            {[0, 1, 2, 3, 4, 5].map((i) => (
               <span key={i} className="shimmer h-10 w-full bg-bg-2" />
            ))}
         </div>
      </div>
   );
}

/*
 * Right now at the place: the figures an angler checks before leaving the
 * car, in one ruled row. Water and swell only where the sea is near enough
 * to have been read.
 */
function NowFacts({
   snapshot,
   system,
}: {
   snapshot: WeatherSnapshot;
   system: ReturnType<typeof readUnitSystem>;
}) {
   const t = (c: number | null | undefined) =>
      typeof c === 'number'
         ? `${Math.round(tempIn(c, system) ?? c)}${unitOf('temp', system)}`
         : null;
   const w = (kph: number | null | undefined) =>
      typeof kph === 'number'
         ? `${Math.round(speedIn(kph, system) ?? kph)} ${unitOf('speed', system)}`
         : null;
   const facts: { key: string; label: string; value: string | null }[] = [
      {
         key: 'sky',
         label: 'Sky',
         value: snapshot.weatherCondition?.description?.text ?? null,
      },
      { key: 'air', label: 'Air', value: t(snapshot.temperature?.degrees) },
      {
         key: 'feels',
         label: 'Feels like',
         value: t(snapshot.feelsLike?.degrees),
      },
      {
         key: 'wind',
         label: 'Wind',
         value:
            snapshot.wind?.speed?.value != null
               ? `${snapshot.wind.direction?.cardinal ?? ''} ${w(snapshot.wind.speed.value)}${snapshot.wind.gust?.value != null ? `, gusting ${w(snapshot.wind.gust.value)}` : ''}`.trim()
               : null,
      },
      {
         key: 'pressure',
         label: 'Pressure',
         value:
            snapshot.airPressure?.meanSeaLevelMillibars != null
               ? `${Math.round(snapshot.airPressure.meanSeaLevelMillibars)} hPa`
               : null,
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
         key: 'uv',
         label: 'UV',
         value:
            snapshot.uvIndex != null
               ? String(Math.round(snapshot.uvIndex))
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
      {
         key: 'water',
         label: 'Water',
         value: t(snapshot.sea?.surfaceTemperatureC),
      },
      {
         key: 'swell',
         label: 'Swell',
         value:
            snapshot.sea?.swellHeightM != null
               ? `${snapshot.sea.swellHeightM.toFixed(1)} m${snapshot.sea.swellPeriodS != null ? ` at ${Math.round(snapshot.sea.swellPeriodS)} s` : ''}`
               : null,
      },
      {
         key: 'sea',
         label: 'Sea',
         value:
            snapshot.sea?.waveHeightM != null
               ? `${snapshot.sea.waveHeightM.toFixed(1)} m`
               : null,
      },
   ];
   const shown = facts.filter((f) => f.value);
   if (shown.length === 0) return null;
   return (
      <section aria-label="Right now" className="border-t-2 border-ink pt-4">
         <div className="flex items-baseline justify-between gap-4">
            <h2 className="g text-[26px]">Right now</h2>
            <span className="lab text-ink-3">
               {snapshot.observedAt
                  ? `Read ${formatClock(snapshot.observedAt)}`
                  : 'The reading of the moment'}
            </span>
         </div>
         <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
            {shown.map((fact, index) => (
               <div
                  key={fact.key}
                  className="fact min-w-0"
                  style={{ '--i': index } as CSSProperties}
               >
                  <dt className="lab text-ink-3">{fact.label}</dt>
                  <dd className="mt-0.5 text-[17px] text-ink">{fact.value}</dd>
               </div>
            ))}
         </dl>
      </section>
   );
}
