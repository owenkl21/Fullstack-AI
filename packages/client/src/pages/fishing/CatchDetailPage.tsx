import { Contours } from '@/components/brand/Contours';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { StaticMap } from '@/components/map/StaticMap';
import { useDocumentTitle } from '@/lib/title';
import {
   formatCardinal,
   toMetricTemperature,
   toMetricWindSpeed,
} from '@/lib/weather';
import { CountIn } from '@/components/fishing/record/CountIn';
import { RecordActions } from '@/components/fishing/record/RecordActions';
import { RecordCell, RecordRail } from '@/components/fishing/record/RecordRail';
import { RecordHero } from '@/components/fishing/record/RecordHero';
import { RecordSkeleton } from '@/components/fishing/record/RecordSkeleton';
import { fetchCatch, type CatchDetail } from '@/components/fishing/record/api';
import { useBuilt } from '@/components/fishing/record/motion';
import {
   formatCoords,
   formatStamp,
   lengthImperial,
   lengthMetric,
   plural,
   weightImperial,
   weightMetric,
} from '@/components/fishing/record/format';
import { useIsSignedIn } from '@/lib/auth-client';
import { SaveButton } from '@/components/saved/SaveButton';
import { useKept } from '@/components/saved/saved-api';
import { useGoBack } from '@/lib/go-back';

type LoadState =
   | { status: 'loading'; data: null }
   | { status: 'ready'; data: CatchDetail }
   | { status: 'notfound'; data: null }
   | { status: 'error'; data: null };

const LOADING: LoadState = { status: 'loading', data: null };

function useCatchRecord(catchId: string | undefined) {
   const [attempt, setAttempt] = useState(0);
   const [result, setResult] = useState<{
      key: string;
      value: LoadState;
   } | null>(null);

   const key = `${catchId ?? ''}:${attempt}`;

   useEffect(() => {
      if (!catchId) {
         return;
      }

      const controller = new AbortController();
      let done = false;

      // Every skeleton times out into something the angler can act on.
      const timer = window.setTimeout(() => {
         if (!done) {
            setResult({ key, value: { status: 'error', data: null } });
         }
      }, 5000);

      const load = async () => {
         try {
            const record = await fetchCatch(catchId, controller.signal);
            done = true;
            setResult({ key, value: { status: 'ready', data: record } });
         } catch (error) {
            if (axios.isCancel(error)) {
               return;
            }
            done = true;
            const missing =
               axios.isAxiosError(error) && error.response?.status === 404;
            setResult({
               key,
               value: { status: missing ? 'notfound' : 'error', data: null },
            });
         } finally {
            window.clearTimeout(timer);
         }
      };

      void load();
      return () => {
         window.clearTimeout(timer);
         controller.abort();
      };
   }, [catchId, key]);

   const state: LoadState = !catchId
      ? { status: 'notfound', data: null }
      : result?.key === key
        ? result.value
        : LOADING;

   return { state, retry: () => setAttempt((count) => count + 1) };
}

function useIsOwner(ownerId: string | null | undefined) {
   const { isSignedIn } = useIsSignedIn();
   const [profileId, setProfileId] = useState<string | null>(null);

   useEffect(() => {
      if (!isSignedIn) {
         return;
      }
      const controller = new AbortController();
      const load = async () => {
         try {
            const { data } = await axios.get<{ profile: { id: string } }>(
               '/api/users/me',
               {
                  signal: controller.signal,
               }
            );
            setProfileId(data.profile?.id ?? null);
         } catch {
            setProfileId(null);
         }
      };
      void load();
      return () => controller.abort();
   }, [isSignedIn]);

   return Boolean(isSignedIn && profileId && ownerId && profileId === ownerId);
}

export function CatchDetailPage() {
   const { catchId } = useParams();
   const { state, retry } = useCatchRecord(catchId);

   if (state.status === 'notfound') {
      return <NotFoundPage />;
   }

   return <CatchRecord state={state} onRetry={retry} />;
}

function CatchRecord({
   state,
   onRetry,
}: {
   state: LoadState;
   onRetry: () => void;
}) {
   /* Back to the feed, the list or the board you actually came from. */
   const goBack = useGoBack('/catches/me');
   const data = state.data;
   const built = useBuilt();
   const isOwner = useIsOwner(data?.createdBy?.id);
   const { isSignedIn } = useIsSignedIn();
   const kept = useKept(isSignedIn && !isOwner);

   // The gallery is pinned to the record it belongs to, so moving between catches
   // can never leave the index pointing at a photo that is not there.
   const [gallery, setGallery] = useState<{ id: string; index: number } | null>(
      null
   );
   const index = gallery && gallery.id === data?.id ? gallery.index : 0;

   const name = data ? (data.species?.commonName ?? data.title) : '';
   const lengthText = lengthMetric(data?.length);
   const weightText = weightMetric(data?.weight);
   useDocumentTitle(
      data
         ? [name, lengthText ?? weightText].filter(Boolean).join(', ')
         : undefined
   );

   const images = useMemo(
      () =>
         (data?.images ?? [])
            .map((entry) => entry.image)
            .filter((image) => image?.url),
      [data?.images]
   );

   const conditions = useMemo(() => {
      if (!data) {
         return [];
      }
      const wind = toMetricWindSpeed(
         data.weatherWindSpeedValue,
         data.weatherWindSpeedUnit
      );
      const gust = toMetricWindSpeed(
         data.weatherWindGustValue,
         data.weatherWindGustUnit
      );
      const cardinal = formatCardinal(data.weatherWindDirectionCardinal);
      const air = toMetricTemperature(
         data.weatherTemperatureDegrees,
         data.weatherTemperatureUnit
      );
      const sky = data.weather ?? data.weatherConditionText;

      return [
         {
            key: 'Wind',
            value: wind
               ? `${cardinal ? `${cardinal} ` : ''}${wind}${gust ? `, gusting ${gust.replace(' km/h', '')}` : ''}`
               : null,
         },
         { key: 'Air', value: air },
         { key: 'Sky', value: sky },
         {
            key: 'Rain',
            value:
               data.weatherPrecipitationProbability !== null
                  ? `${data.weatherPrecipitationProbability}% chance`
                  : null,
         },
         {
            key: 'Cloud',
            value:
               data.weatherCloudCover !== null
                  ? `${data.weatherCloudCover}%`
                  : null,
         },
         {
            key: 'Humidity',
            value:
               data.weatherRelativeHumidity !== null
                  ? `${data.weatherRelativeHumidity}%`
                  : null,
         },
         {
            key: 'UV index',
            value:
               data.weatherUvIndex !== null
                  ? String(data.weatherUvIndex)
                  : null,
         },
      ].filter((line): line is { key: string; value: string } =>
         Boolean(line.value)
      );
   }, [data]);

   if (state.status === 'loading') {
      return (
         <article className="mx-auto w-full max-w-[1680px]">
            <RecordSkeleton />
         </article>
      );
   }

   if (state.status === 'error' || !data) {
      return (
         <section className="relative mx-auto w-[min(1400px,100%-32px)] py-16">
            <Contours seed={23} className="inset-x-0 top-0 h-[380px] w-full" />
            <h1 className="g text-[44px]">Could not load this catch</h1>
            <p className="mt-3 text-ink-2">
               The record is there, the connection was not. Try again.
            </p>
            <Button
               type="button"
               variant="outline"
               className="mt-6"
               onClick={onRetry}
            >
               Try again
            </Button>
         </section>
      );
   }

   /* One fish is a moment; several are a stretch, first shutter to last. */
   const stamp = data.caughtUntil
      ? `${formatStamp(data.caughtAt)} to ${new Date(data.caughtUntil).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
      : formatStamp(data.caughtAt);
   const spot = data.site?.name ?? 'No spot recorded';
   /*
    * Where it was caught: the catch's own pin first, the spot's position
    * otherwise. A fish logged with a dropped pin and no saved spot had no
    * map at all, which read as the pin having been lost. When the angler hid
    * the location the server has already withheld both, so there is nothing
    * to draw for anyone but them.
    */
   const pin =
      data.latitude != null && data.longitude != null
         ? { lat: data.latitude, lng: data.longitude }
         : null;
   const sitePosition =
      data.site && data.site.latitude != null && data.site.longitude != null
         ? { lat: data.site.latitude, lng: data.site.longitude }
         : null;
   const position = pin ?? sitePosition;
   const coords = formatCoords(position?.lat, position?.lng);
   const lengthDecimals =
      data.length !== null && Number.isInteger(data.length) ? 0 : 1;
   const summary = `${[name, lengthText, stamp].filter(Boolean).join(', ')}.`;
   const angler =
      data.createdBy?.displayName || data.createdBy?.username || null;

   const provenance = [
      angler ? `Logged by ${angler}.` : null,
      data.length !== null || data.weight !== null
         ? // TODO(api): appendix E, a catch stores no measurement source, so no record
           // can say whether the fish went on a tape or a scale.
           'Length and weight are as they were entered. The log does not yet record whether they came off a tape or a scale.'
         : null,
      conditions.length > 0
         ? 'The conditions were read at a forecast point and stored with the catch.'
         : 'No conditions were stored with this catch.',
      coords
         ? `The position is the pin on ${spot}, not a fix taken at the fish.`
         : 'No position recorded.',
   ]
      .filter(Boolean)
      .join(' ');

   return (
      <article className="mx-auto w-full max-w-[1680px] pb-4">
         <RecordHero
            images={images}
            index={index}
            onIndexChange={(next) => setGallery({ id: data.id, index: next })}
            onBack={goBack}
            eyebrow={[stamp, spot].filter(Boolean).join(' · ')}
            title={name}
            built={built}
            headline={
               data.length !== null || data.weight !== null ? (
                  <>
                     {data.length !== null ? (
                        <>
                           <CountIn
                              value={data.length}
                              decimals={lengthDecimals}
                           />{' '}
                           cm
                        </>
                     ) : null}
                     {data.length !== null && data.weight !== null ? (
                        <span className="text-paper-2"> · </span>
                     ) : null}
                     {data.weight !== null ? (
                        <>
                           <CountIn value={data.weight} decimals={1} /> kg
                        </>
                     ) : null}
                  </>
               ) : (
                  <span className="font-sans text-[15px] tracking-normal normal-case text-paper-2">
                     Not measured
                  </span>
               )
            }
         />

         <RecordRail>
            <RecordCell
               label="Length"
               built={built}
               delayMs={50}
               missing="Not measured"
               note={lengthImperial(data.length)}
               value={
                  data.length !== null ? (
                     <>
                        <CountIn
                           value={data.length}
                           decimals={lengthDecimals}
                        />
                        <small className="ml-1 font-sans text-[14px] tracking-normal text-ink-2">
                           cm
                        </small>
                     </>
                  ) : undefined
               }
            />
            <RecordCell
               label="Weight"
               built={built}
               delayMs={150}
               missing="Not measured"
               note={weightImperial(data.weight)}
               value={
                  data.weight !== null ? (
                     <>
                        <CountIn value={data.weight} decimals={1} />
                        <small className="ml-1 font-sans text-[14px] tracking-normal text-ink-2">
                           kg
                        </small>
                     </>
                  ) : undefined
               }
            />
            <RecordCell
               label="Species"
               built={built}
               delayMs={250}
               size="small"
               // TODO(api): appendix E, a catch has no species field, so the fish is
               // named by the record's title until one exists.
               missing="Species not recorded"
               value={data.species?.commonName}
               note={data.species?.scientificName ?? undefined}
            />
            <RecordCell
               label="Position"
               built={built}
               delayMs={350}
               size="small"
               missing="No position recorded"
               value={coords ?? undefined}
               note={coords ? spot : undefined}
            />
            {data.count > 1 ? (
               <RecordCell
                  label="Count"
                  built={built}
                  delayMs={450}
                  value={<CountIn value={data.count} />}
                  note="fish in this record"
               />
            ) : null}
            {data.depth !== null ? (
               <RecordCell
                  label="Depth"
                  built={built}
                  delayMs={450}
                  value={
                     <>
                        <CountIn value={data.depth} decimals={1} />
                        <small className="ml-1 font-sans text-[14px] tracking-normal text-ink-2">
                           m
                        </small>
                     </>
                  }
                  note={`${(data.depth * 3.28084).toFixed(1)} ft`}
               />
            ) : null}
            {data.waterTemp !== null ? (
               <RecordCell
                  label="Water"
                  built={built}
                  delayMs={550}
                  value={
                     <>
                        <CountIn value={data.waterTemp} decimals={1} />
                        <small className="ml-1 font-sans text-[14px] tracking-normal text-ink-2">
                           °C
                        </small>
                     </>
                  }
                  note={`${((data.waterTemp * 9) / 5 + 32).toFixed(1)} °F`}
               />
            ) : null}

            <RecordCell
               label="Conditions"
               built={built}
               delayMs={650}
               wide
               missing={conditions.length === 0 ? 'Not reported' : undefined}
            >
               {conditions.length > 0 ? (
                  <>
                     <ul className="mt-1 flex flex-col gap-1">
                        {conditions.map((line) => (
                           <li
                              key={line.key}
                              className="flex items-baseline justify-between gap-4 border-t border-line pt-1 text-[15px] first:border-0 first:pt-0"
                           >
                              <span className="lab">{line.key}</span>
                              <span className="num font-medium">
                                 {line.value}
                              </span>
                           </li>
                        ))}
                     </ul>
                     <p className="mt-3 text-[14px] text-ink-3">
                        Weather data by Open-Meteo.com
                     </p>
                  </>
               ) : null}
            </RecordCell>
         </RecordRail>

         {coords && position ? (
            <section className="px-4 pt-6 md:px-8">
               <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <h2 className="g text-[30px]">Position</h2>
                  {data.hideLocation ? (
                     <span className="lab text-ink-3">
                        Hidden from other anglers
                     </span>
                  ) : null}
               </div>
               <StaticMap
                  latitude={position.lat}
                  longitude={position.lng}
                  label={
                     data.site ? `Map of ${data.site.name}` : 'Map of the catch'
                  }
                  className="mt-3"
               />
               <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[15px] text-ink-2">
                  {data.site ? (
                     <Link
                        to={`/sites/${data.site.id}`}
                        className="text-teal-text"
                     >
                        {data.site.name}
                     </Link>
                  ) : (
                     <span>Pin dropped where it was caught</span>
                  )}
                  <span className="num text-ink-3">{coords}</span>
               </p>
               <a
                  className="g-tracked mt-2 inline-flex h-11 items-center text-[19px] text-ink-2 hover:text-ink"
                  href={`https://www.google.com/maps/search/?api=1&query=${position.lat},${position.lng}`}
                  target="_blank"
                  rel="noreferrer"
               >
                  Open in Maps
               </a>
            </section>
         ) : null}

         {data.gears.length > 0 ? (
            <section className="px-4 pt-6 md:px-8">
               <div className="flex items-baseline justify-between gap-4">
                  <h2 className="g text-[30px]">Gear</h2>
                  <span className="lab">
                     {plural(data.gears.length, 'item', 'items')}
                  </span>
               </div>
               <ul className="mt-2">
                  {data.gears.map((gear) => (
                     <li
                        key={gear.id}
                        className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-line py-3"
                     >
                        {gear.imageUrl ? (
                           <img
                              src={gear.imageUrl}
                              alt=""
                              loading="lazy"
                              className="size-[52px] bg-bg-2 object-contain"
                           />
                        ) : (
                           <span
                              className="size-[52px] bg-bg-2"
                              aria-hidden="true"
                           />
                        )}
                        <span className="flex flex-col">
                           <span className="g text-[22px]">{gear.name}</span>
                           <span className="text-[14px] text-ink-2">
                              {[gear.brand, gear.type.toLowerCase()]
                                 .filter(Boolean)
                                 .join(' · ')}
                           </span>
                        </span>
                        {isSignedIn && !isOwner ? (
                           <SaveButton
                              kind="gear"
                              id={gear.id}
                              saved={kept.gear.has(gear.id)}
                              size="sm"
                              variant="ghost"
                           />
                        ) : null}
                     </li>
                  ))}
               </ul>
            </section>
         ) : null}

         {data.notes ? (
            <section className="px-4 pt-6 md:px-8">
               <h2 className="g text-[30px]">Notes</h2>
               <p className="mt-2 max-w-[62ch] whitespace-pre-line text-ink-2">
                  {data.notes}
               </p>
            </section>
         ) : null}

         <p
            style={{ transitionDelay: '500ms' }}
            className={cn(
               'mx-4 mt-6 max-w-[62ch] rule-dashed-left py-1 pl-3.5 text-[14px] leading-relaxed text-ink-2 transition-opacity duration-500 md:mx-8',
               built ? 'opacity-100' : 'opacity-0'
            )}
         >
            {provenance}
         </p>

         <RecordActions catchId={data.id} summary={summary} isOwner={isOwner} />
      </article>
   );
}
