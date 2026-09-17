import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/title';
import {
   describeAir,
   describePressure,
   describeWind,
   fetchConditions,
   fetchMyCatches,
   toSavableSnapshot,
   type WeatherSnapshot,
} from '@/components/fishing/record/api';
import {
   formatClock,
   lengthMetric,
   weightMetric,
} from '@/components/fishing/record/format';
import {
   Conditions,
   type ConditionsPhase,
} from '@/components/fishing/quicklog/Conditions';
import { MeasureField } from '@/components/fishing/quicklog/MeasureField';
import {
   PhotoBlock,
   type UploadedPhoto,
} from '@/components/fishing/quicklog/PhotoBlock';
import {
   Receipt,
   type TimeSource,
   type Where,
} from '@/components/fishing/quicklog/Receipt';
import { MapLocationPicker } from '@/components/fishing/MapLocationPicker';
import { ChoiceGroup, TextField } from '@/components/ui/field';
import { readPhotoMeta } from '@/lib/exif';
import { formatMetres, nearestSpot, type SpotLike } from '@/lib/geo';
import { SpeciesGuess } from '@/components/fishing/SpeciesGuess';
import { SpeciesField } from '@/components/fishing/quicklog/SpeciesField';
import {
   toMetricValue,
   type MeasureUnit,
} from '@/components/fishing/quicklog/measure';
import {
   NOT_SURE,
   UNNAMED_TITLE,
   fetchSpecies,
   matchSpecies,
   speciesChoices,
   type Species,
} from '@/components/fishing/quicklog/species';
import { usePositionFix } from '@/components/fishing/quicklog/useFix';

/*
 * The fast path. The clock is stamped on arrival, the fix starts tightening and the
 * conditions land on their own; the angler only names the fish and its size. The
 * only thing that can hold the save is a photo still going up.
 */
export function QuickLogPage() {
   useDocumentTitle('Log a catch');
   return (
      <RequireSignIn what="your log">
         <QuickLog />
      </RequireSignIn>
   );
}

function QuickLog() {
   const navigate = useNavigate();
   const [stampedAt, setStampedAt] = useState(() => new Date());
   const [timeSource, setTimeSource] = useState<TimeSource>('clock');
   const { status: fixStatus, fix } = usePositionFix();
   /*
    * Where the fish came out: the photograph's own GPS beats the phone's
    * fix, and a pin the angler drops beats both. The phone's fix arrives on
    * its own and only fills in while nothing better is known.
    */
   const [params] = useSearchParams();
   const [where, setWhere] = useState<Where | null>(() => {
      /* Arriving from the map: the pin is where the map was looking. */
      const lat = Number(params.get('lat'));
      const lng = Number(params.get('lng'));
      return params.has('lat') && Number.isFinite(lat) && Number.isFinite(lng)
         ? { latitude: lat, longitude: lng, source: 'pin' }
         : null;
   });
   const [pinOpen, setPinOpen] = useState(false);

   /*
    * The spots you already have. A position within a few hundred metres of
    * one is that spot, and the catch is filed there rather than as a new
    * pin, unless you say it is not.
    */
   const [spots, setSpots] = useState<SpotLike[]>([]);
   useEffect(() => {
      const controller = new AbortController();
      axios
         .get<{ sites?: SpotLike[] }>('/api/sites', {
            signal: controller.signal,
         })
         .then(({ data }) => setSpots(data.sites ?? []))
         .catch(() => undefined);
      return () => controller.abort();
   }, []);
   const near = useMemo(() => nearestSpot(spots, where), [spots, where]);
   const [notThatSpot, setNotThatSpot] = useState<string | null>(null);
   const filedUnder = near && notThatSpot !== near.spot.id ? near.spot : null;
   useEffect(() => {
      if (fix && (!where || where.source === 'phone')) {
         setWhere({
            latitude: fix.latitude,
            longitude: fix.longitude,
            source: 'phone',
            accuracy: fix.accuracy,
         });
      }
   }, [fix]); // eslint-disable-line react-hooks/exhaustive-deps

   const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
   const [hideLocation, setHideLocation] = useState(false);
   const [spotName, setSpotName] = useState('');
   const [spotPublic, setSpotPublic] = useState(false);

   const onPhotoFile = (file: File) => {
      void readPhotoMeta(file).then((meta) => {
         if (meta.takenAt && timeSource !== 'typed') {
            setStampedAt(meta.takenAt);
            setTimeSource('photo');
         }
         if (meta.latitude !== null && meta.longitude !== null) {
            setWhere((was) =>
               was?.source === 'pin'
                  ? was
                  : {
                       latitude: meta.latitude as number,
                       longitude: meta.longitude as number,
                       source: 'photo',
                    }
            );
         }
      });
   };

   const [entered, setEntered] = useState(false);
   const [conditions, setConditions] = useState<{
      snapshot: WeatherSnapshot;
      at: string | null;
   } | null>(null);
   const [conditionsFailed, setConditionsFailed] = useState(false);

   const [options, setOptions] = useState<string[]>([]);
   const [species, setSpecies] = useState<Species[]>([]);
   const [chosen, setChosen] = useState<string | null>(null);
   const [typed, setTyped] = useState('');
   const [speciesError, setSpeciesError] = useState<string | null>(null);
   const speciesInput = useRef<HTMLInputElement>(null);

   const [length, setLength] = useState('');
   const [lengthUnit, setLengthUnit] = useState<MeasureUnit>('cm');
   const [lengthSource, setLengthSource] = useState<'EYE' | 'TAPE'>('EYE');
   const [weight, setWeight] = useState('');
   const [weightUnit, setWeightUnit] = useState<MeasureUnit>('kg');
   const [weightSource, setWeightSource] = useState<'EYE' | 'SCALE'>('EYE');

   const [photo, setPhoto] = useState<UploadedPhoto | null>(null);
   const [photoBusy, setPhotoBusy] = useState(false);
   const [isSaving, setIsSaving] = useState(false);

   const conditionsRequest = useRef<AbortController | null>(null);

   useEffect(() => {
      const frame = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(frame);
   }, []);

   useEffect(() => {
      const controller = new AbortController();
      const load = async () => {
         try {
            /*
             * Both together: the chips are this angler's own species, and the
             * full list is what a typed name gets resolved against before the
             * catch is saved.
             */
            const [catches, all] = await Promise.all([
               fetchMyCatches(controller.signal),
               fetchSpecies(controller.signal),
            ]);
            setSpecies(all);
            setOptions(speciesChoices(catches, all));
         } catch {
            setOptions([]);
         }
      };
      void load();
      return () => controller.abort();
   }, []);

   useEffect(() => () => conditionsRequest.current?.abort(), []);

   /*
    * The conditions for the place and the hour, read again whenever either
    * moves: a photograph with its own time and place replaces what the phone
    * guessed in the car park.
    */
   const hourKey = `${stampedAt.toISOString().slice(0, 13)}|${where ? `${where.latitude.toFixed(3)},${where.longitude.toFixed(3)}` : ''}`;
   useEffect(() => {
      if (!where) return;
      conditionsRequest.current?.abort();
      const controller = new AbortController();
      conditionsRequest.current = controller;
      setConditionsFailed(false);
      const load = async () => {
         try {
            const weather = await fetchConditions(
               where.latitude,
               where.longitude,
               controller.signal,
               stampedAt
            );
            if (controller.signal.aborted) return;
            if (!weather) {
               setConditionsFailed(true);
               return;
            }
            setConditions({ snapshot: weather, at: formatClock(new Date()) });
         } catch (error) {
            if (!axios.isCancel(error)) setConditionsFailed(true);
         }
      };
      void load();
   }, [hourKey]); // eslint-disable-line react-hooks/exhaustive-deps

   const phase: ConditionsPhase = conditions
      ? 'ready'
      : conditionsFailed ||
          fixStatus === 'denied' ||
          fixStatus === 'unsupported'
        ? 'missing'
        : where
          ? 'loading'
          : 'waiting';

   const snapshot = conditions?.snapshot ?? null;

   const lines = useMemo(() => {
      if (!snapshot) {
         return [];
      }
      return [
         { key: 'Wind', value: describeWind(snapshot) },
         { key: 'Pressure', value: describePressure(snapshot) },
         { key: 'Air', value: describeAir(snapshot) },
      ].filter((line): line is { key: string; value: string } =>
         Boolean(line.value)
      );
   }, [snapshot]);

   const close = () => {
      if (window.history.length > 1) {
         navigate(-1);
      } else {
         navigate('/');
      }
   };

   const nothingCaught = () => {
      // TODO(api): appendix E, blank trips are not stored, so nothing is saved here.
      toast({ title: 'Nothing saved. Blank trips are not kept yet.' });
      navigate('/');
   };

   const save = async () => {
      const other = typed.trim();
      if (other.length === 1) {
         setSpeciesError('That needs at least two letters.');
         speciesInput.current?.focus();
         return;
      }

      const named = other || (chosen && chosen !== NOT_SURE ? chosen : null);
      const title = named ?? UNNAMED_TITLE;
      /*
       * Resolve to a real species wherever the name is one we know. Without
       * this the catch cannot be scored, which is most of what the product
       * does with a catch. An unrecognised name still saves, as a title only.
       */
      const matched = named ? matchSpecies(named, species) : null;
      const lengthCm = toMetricValue(length, lengthUnit);
      const weightKg = toMetricValue(weight, weightUnit);

      try {
         setIsSaving(true);

         /*
          * A named spot is saved first and the catch filed under it; the
          * spot takes the angler's choice of public or private. Unnamed, the
          * catch keeps the pin on its own.
          */
         let siteId: string | null = filedUnder?.id ?? null;
         if (!siteId && spotName.trim() && where) {
            const { data: made } = await axios.post<{
               site?: { id: string };
               id?: string;
            }>('/api/sites', {
               name: spotName.trim(),
               latitude: where.latitude,
               longitude: where.longitude,
               visibility: spotPublic ? 'PUBLIC' : 'PRIVATE',
               waterType: 'SALTWATER',
            });
            siteId = made.site?.id ?? made.id ?? null;
         }

         const payload = {
            title,
            caughtAt: stampedAt.toISOString(),
            notes: null,
            siteId,
            speciesId: matched?.id ?? null,
            latitude: where?.latitude ?? null,
            longitude: where?.longitude ?? null,
            visibility,
            hideLocation,
            weather: snapshot?.weatherCondition?.description?.text ?? null,
            weatherSnapshot: toSavableSnapshot(snapshot),
            length: lengthCm,
            weight: weightKg,
            lengthSource,
            weightSource,
            images: photo ? [photo] : [],
            gearIds: [],
         };

         const { data } = await axios.post<{ catch: { id: string } }>(
            '/api/catches',
            payload
         );
         toast({
            title: `Catch saved. ${[
               title,
               lengthMetric(lengthCm) ?? weightMetric(weightKg),
               formatClock(stampedAt),
            ]
               .filter(Boolean)
               .join(', ')}.`,
            variant: 'success',
         });
         navigate(`/catches/${data.catch.id}`, { replace: true });
      } catch (error) {
         setIsSaving(false);
         const message =
            axios.isAxiosError(error) &&
            typeof error.response?.data?.message === 'string'
               ? error.response.data.message
               : 'Check the length and weight, then try again.';
         toast({ title: 'Not saved.', description: message, variant: 'error' });
      }
   };

   const textControl =
      'g-tracked inline-flex h-11 items-center px-2 text-[18px] text-ink-2 transition-colors duration-150 hover:text-ink';

   return (
      <section
         className={cn(
            'mx-auto flex min-h-[calc(100dvh-124px)] w-full max-w-[560px] flex-col lg:max-w-[1080px] transition-[transform,opacity] duration-[460ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)] md:my-10 md:min-h-0 md:border md:border-line',
            entered ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
         )}
      >
         <div className="h-[3px] w-full shrink-0 bg-teal" aria-hidden="true" />
         <div className="flex flex-wrap items-center justify-between gap-x-2 border-b border-line py-1.5 pr-1 pl-4">
            <h1 className="g text-[26px]">Log a catch</h1>
            <div className="flex items-center">
               <button
                  type="button"
                  className={textControl}
                  onClick={nothingCaught}
               >
                  Nothing caught?
               </button>
               <button type="button" className={textControl} onClick={close}>
                  Close
               </button>
            </div>
         </div>

         <div className="flex flex-1 flex-col gap-4 px-4 py-4 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:px-8 lg:py-6">
            <div className="flex min-w-0 flex-col gap-4">
               <Receipt
                  at={stampedAt}
                  timeSource={timeSource}
                  onTime={(next) => {
                     setStampedAt(next);
                     setTimeSource('typed');
                  }}
                  where={where}
                  fixStatus={fixStatus}
                  pinOpen={pinOpen}
                  onTogglePin={() => setPinOpen((open) => !open)}
               >
                  <MapLocationPicker
                     latitude={where ? String(where.latitude) : ''}
                     longitude={where ? String(where.longitude) : ''}
                     onChange={(latitude, longitude) =>
                        setWhere({ latitude, longitude, source: 'pin' })
                     }
                  />
               </Receipt>

               {near ? (
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border border-line px-4 py-3">
                     <p className="text-[15px]">
                        {filedUnder ? (
                           <>
                              <span className="lab mr-2 text-ink-3">Spot</span>
                              <span className="g-tracked text-[19px]">
                                 {near.spot.name}
                              </span>
                              <span className="ml-2 text-ink-3">
                                 {formatMetres(near.metres)} away, you have
                                 fished here before
                              </span>
                           </>
                        ) : (
                           <span className="text-ink-2">
                              Not filed under {near.spot.name}.
                           </span>
                        )}
                     </p>
                     <button
                        type="button"
                        onClick={() =>
                           setNotThatSpot(filedUnder ? near.spot.id : null)
                        }
                        className="g-tracked text-[17px] text-teal-text hover:opacity-80"
                     >
                        {filedUnder ? 'Not this spot' : 'File it there'}
                     </button>
                  </div>
               ) : null}

               <Conditions
                  phase={phase}
                  lines={lines}
                  takenAt={conditions?.at ?? null}
               />
            </div>

            <div className="flex min-w-0 flex-col gap-4">
               <PhotoBlock
                  onChange={setPhoto}
                  onBusyChange={setPhotoBusy}
                  onFile={onPhotoFile}
               />

               <SpeciesGuess
                  imageUrl={photo?.url ?? null}
                  current={typed || chosen || ''}
                  onPick={(candidate) => {
                     if (!candidate) {
                        speciesInput.current?.focus();
                        return;
                     }
                     setTyped(candidate.commonName);
                     setChosen(null);
                     setSpeciesError(null);
                  }}
               />

               <SpeciesField
                  options={options}
                  chosen={chosen}
                  typed={typed}
                  error={speciesError}
                  inputRef={speciesInput}
                  onChoose={(species) => {
                     setChosen(species);
                     setTyped('');
                     setSpeciesError(null);
                  }}
                  onType={(value) => {
                     setTyped(value);
                     setChosen(null);
                     setSpeciesError(null);
                  }}
               />

               <div className="grid grid-cols-2 gap-3">
                  <MeasureField
                     id="length"
                     label="Length"
                     units={['cm', 'in']}
                     unit={lengthUnit}
                     value={length}
                     onChange={setLength}
                     onUnitChange={setLengthUnit}
                     sources={[
                        { value: 'EYE', label: 'By eye' },
                        { value: 'TAPE', label: 'On a tape' },
                     ]}
                     source={lengthSource}
                     onSourceChange={(next) =>
                        setLengthSource(next as 'EYE' | 'TAPE')
                     }
                     placeholder="0"
                  />
                  <MeasureField
                     id="weight"
                     label="Weight"
                     units={['kg', 'lb']}
                     unit={weightUnit}
                     value={weight}
                     onChange={setWeight}
                     onUnitChange={setWeightUnit}
                     sources={[
                        { value: 'EYE', label: 'By eye' },
                        { value: 'SCALE', label: 'On a scale' },
                     ]}
                     source={weightSource}
                     onSourceChange={(next) =>
                        setWeightSource(next as 'EYE' | 'SCALE')
                     }
                     placeholder="0"
                  />
               </div>

               {/* Who sees it, and whether the place travels with it. */}
               <div className="flex flex-col gap-4 border-t border-line pt-4">
                  <ChoiceGroup
                     inline
                     size="sm"
                     label="Who sees it"
                     value={visibility}
                     onChange={setVisibility}
                     options={[
                        { value: 'PUBLIC', label: 'Everyone' },
                        { value: 'PRIVATE', label: 'Only me' },
                     ]}
                  />
                  {visibility === 'PUBLIC' && where ? (
                     <ChoiceGroup
                        inline
                        size="sm"
                        label="The spot"
                        value={hideLocation ? 'HIDE' : 'SHOW'}
                        onChange={(next) => setHideLocation(next === 'HIDE')}
                        options={[
                           { value: 'SHOW', label: 'Show it' },
                           { value: 'HIDE', label: 'Keep it to myself' },
                        ]}
                        hint={
                           hideLocation
                              ? 'The fish shows on the feed, the pin does not.'
                              : 'Other anglers see where this came from.'
                        }
                     />
                  ) : null}
                  {where && !filedUnder ? (
                     <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                        <TextField
                           label="Save this place as a spot"
                           value={spotName}
                           maxLength={120}
                           autoComplete="off"
                           placeholder="Leave blank to keep only the pin"
                           onChange={(event) => setSpotName(event.target.value)}
                        />
                        {spotName.trim() ? (
                           <ChoiceGroup
                              size="sm"
                              label="The spot is"
                              value={spotPublic ? 'PUBLIC' : 'PRIVATE'}
                              onChange={(next) =>
                                 setSpotPublic(next === 'PUBLIC')
                              }
                              options={[
                                 { value: 'PRIVATE', label: 'Private' },
                                 { value: 'PUBLIC', label: 'Public' },
                              ]}
                           />
                        ) : null}
                     </div>
                  ) : null}
               </div>
            </div>
         </div>

         <button
            type="button"
            onClick={() => void save()}
            disabled={photoBusy || isSaving}
            className="g-tracked sticky bottom-0 z-10 flex h-14 w-full shrink-0 items-center justify-center bg-teal text-[26px] text-teal-ink transition-[filter] duration-150 active:brightness-95 disabled:opacity-60 md:bottom-0"
         >
            {isSaving
               ? 'Saving'
               : photoBusy
                 ? 'Sending the photo'
                 : 'Save catch'}
         </button>
      </section>
   );
}
