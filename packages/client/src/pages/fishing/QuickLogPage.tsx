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
   type TimeSource,
   type Where,
} from '@/components/fishing/quicklog/Receipt';
import { MapLocationPicker } from '@/components/fishing/MapLocationPicker';
import { TextArea, TextField } from '@/components/ui/field';
import { Fold } from '@/components/ui/fold';
import { usePhone } from '@/lib/media';
import { formatCoordinate } from '@/lib/maps';
import { Segment } from '@/components/fishing/quicklog/Segment';
import { CaughtAt } from '@/components/fishing/quicklog/CaughtAt';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { readPhotoMeta } from '@/lib/exif';
import { distanceM, formatMetres, nearestSpot, type SpotLike } from '@/lib/geo';
import { SpeciesGuess } from '@/components/fishing/SpeciesGuess';
import {
   enterCompetition,
   fetchCompetition,
   submitEntry,
   type Competition,
} from '@/components/social/competitions-api';
import {
   CompetitionBanner,
   CompetitionEntryFields,
} from '@/components/fishing/CompetitionEntryFields';
import { entryProblem } from '@/components/fishing/competition-entry';
import { SpeciesCombobox } from '@/components/fishing/SpeciesCombobox';
import { Picker } from '@/components/ui/picker';
import { AddGearInline } from '@/components/fishing/AddGearInline';
import type { GearOption } from '@/pages/fishing/LogCatchPage';
import { readDraft, removeDraft, saveDraft } from '@/lib/drafts';
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
   /* The current answer, for the photo handler, which runs after a read. */
   const whereRef = useRef<Where | null>(null);
   useEffect(() => {
      whereRef.current = where;
   }, [where]);
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
   const [savingSpot, setSavingSpot] = useState(false);
   /*
    * A photograph's own position that arrived after the angler had already
    * put the pin down by hand. Their pin stands; the photograph's place is
    * offered beside it rather than taking over.
    */
   const [photoPlace, setPhotoPlace] = useState<{
      latitude: number;
      longitude: number;
   } | null>(null);
   /* Which of the three phone screens is up. */
   const [step, setStep] = useState(1);
   const phone = usePhone();
   const [notes, setNotes] = useState('');
   const [spotPublic, setSpotPublic] = useState(false);

   /*
    * A photograph that arrived with its time but no position. Worth saying
    * once, because the angler added the picture expecting the pin to move and
    * nothing did: the picture came without one, and both phone pickers are
    * where that usually happens.
    */
   const [photoWithoutPosition, setPhotoWithoutPosition] = useState(false);

   const onPhotoFile = (file: File) => {
      void readPhotoMeta(file).then((meta) => {
         photoTakenAt.current = meta.takenAt;
         if (meta.takenAt && timeSource !== 'typed') {
            setStampedAt(meta.takenAt);
            setTimeSource('photo');
         }
         if (meta.latitude !== null && meta.longitude !== null) {
            const place = {
               latitude: meta.latitude,
               longitude: meta.longitude,
            };
            setPhotoWithoutPosition(false);
            /*
             * The photograph knows where it was taken. It beats the phone's
             * fix, which only says where the phone is now, and the map is
             * always on screen so the pin is seen to move. A pin the angler
             * put down by hand is their answer: the photograph's place is
             * offered next to it, one tap to take it.
             */
            if (whereRef.current?.source === 'pin') {
               setPhotoPlace(place);
            } else {
               setWhere({ ...place, source: 'photo' });
               setPhotoPlace(null);
            }
         } else {
            /* Said every time, not only when the camera wrote a time: a
             * screenshot or a shared picture carries neither, and the angler
             * still expected the pin to move. */
            setPhotoWithoutPosition(true);
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

   /*
    * Entering a competition: the same log, preset for it, with two more
    * asks. The photograph of the fish on the tape or scale, and one sentence
    * to tick about where it was caught. The species is locked when the
    * competition is for one fish. The entry is written after the catch.
    */
   const competitionId = params.get('competition');
   const [competition, setCompetition] = useState<Competition | null>(null);
   const [competitionEntered, setCompetitionEntered] = useState(false);
   const [measurePhoto, setMeasurePhoto] = useState<UploadedPhoto | null>(null);
   const [measureBusy, setMeasureBusy] = useState(false);
   const [areaConfirmed, setAreaConfirmed] = useState(false);
   const [entryIssue, setEntryIssue] = useState<string | null>(null);
   /* What the camera wrote in the hero photo, for the window check. */
   const photoTakenAt = useRef<Date | null>(null);
   useEffect(() => {
      if (!competitionId) return;
      const controller = new AbortController();
      fetchCompetition(competitionId, controller.signal)
         .then((detail) => {
            setCompetition(detail.competition);
            setCompetitionEntered(detail.you.entered);
            if (detail.competition.species) {
               setChosen(detail.competition.species.commonName);
               setTyped('');
            }
         })
         .catch(() =>
            toast({
               title: 'Could not read the competition.',
               description: 'The catch still logs as usual.',
               variant: 'error',
            })
         );
      return () => controller.abort();
   }, [competitionId]);

   const [length, setLength] = useState('');
   const [lengthUnit, setLengthUnit] = useState<MeasureUnit>('cm');
   const [lengthSource, setLengthSource] = useState<'EYE' | 'TAPE'>('EYE');
   const [weight, setWeight] = useState('');
   const [weightUnit, setWeightUnit] = useState<MeasureUnit>('kg');
   const [weightSource, setWeightSource] = useState<'EYE' | 'SCALE'>('EYE');
   const [photo, setPhoto] = useState<UploadedPhoto | null>(null);
   const [photoBusy, setPhotoBusy] = useState(false);
   const [released, setReleased] = useState<'KEPT' | 'RELEASED'>('KEPT');

   /* Gear and bait, optional like everything. Your own list, split by kind. */
   const [gear, setGear] = useState<GearOption[]>([]);
   const [gearIds, setGearIds] = useState<string[]>([]);
   useEffect(() => {
      const controller = new AbortController();
      axios
         .get<{ gear?: GearOption[] }>('/api/gear/me', {
            signal: controller.signal,
         })
         .then(({ data }) => setGear(data.gear ?? []))
         .catch(() => undefined);
      return () => controller.abort();
   }, []);
   const isBait = (entry: GearOption) =>
      entry.type === 'BAIT' || entry.type === 'LURE';
   const gearOptions = gear
      .filter((entry) => !isBait(entry))
      .map((entry) => ({
         value: entry.id,
         label: entry.name,
         hint: [entry.brand, entry.type.toLowerCase()]
            .filter(Boolean)
            .join(' · '),
      }));
   const baitOptions = gear.filter(isBait).map((entry) => ({
      value: entry.id,
      label: entry.name,
      hint: [entry.brand, entry.type.toLowerCase()].filter(Boolean).join(' · '),
   }));

   /*
    * A draft reopened. Everything that was typed comes back; the photo too,
    * since it was sent up when it was chosen.
    */
   const draftId = params.get('draft');
   useEffect(() => {
      if (!draftId) return;
      const draft = readDraft(draftId);
      if (!draft || draft.kind !== 'quick') return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = draft.state as Record<string, any>;
      if (d.stampedAt) {
         setStampedAt(new Date(d.stampedAt));
         setTimeSource('typed');
      }
      if (d.where) setWhere(d.where);
      if (d.visibility) setVisibility(d.visibility);
      if (typeof d.hideLocation === 'boolean') setHideLocation(d.hideLocation);
      if (typeof d.spotName === 'string') setSpotName(d.spotName);
      if (typeof d.spotPublic === 'boolean') setSpotPublic(d.spotPublic);
      if (typeof d.chosen === 'string') setChosen(d.chosen);
      if (typeof d.typed === 'string') setTyped(d.typed);
      if (typeof d.length === 'string') setLength(d.length);
      if (d.lengthUnit) setLengthUnit(d.lengthUnit);
      if (d.lengthSource) setLengthSource(d.lengthSource);
      if (typeof d.weight === 'string') setWeight(d.weight);
      if (d.weightUnit) setWeightUnit(d.weightUnit);
      if (d.weightSource) setWeightSource(d.weightSource);
      if (d.released) setReleased(d.released);
      if (Array.isArray(d.gearIds)) setGearIds(d.gearIds);
      if (d.photo) setPhoto(d.photo);
      if (typeof d.notes === 'string') setNotes(d.notes);
      if (typeof d.savingSpot === 'boolean') setSavingSpot(d.savingSpot);
   }, [draftId]); // eslint-disable-line react-hooks/exhaustive-deps

   const saveAsDraft = () => {
      const title = chosen && chosen !== NOT_SURE ? chosen : typed || 'Catch';
      saveDraft(
         'quick',
         title,
         {
            stampedAt: stampedAt.toISOString(),
            where,
            visibility,
            hideLocation,
            spotName,
            spotPublic,
            chosen,
            typed,
            length,
            lengthUnit,
            lengthSource,
            weight,
            weightUnit,
            weightSource,
            released,
            gearIds,
            photo,
            notes,
            savingSpot,
         },
         draftId
      );
      toast({ title: 'Draft kept', description: 'Find it under My catches.' });
      navigate('/catches/me');
   };

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

      /* What the competition judges, metric, and whether it can be entered. */
      const declaredValue = !competition
         ? null
         : competition.rule === 'SPECIES_VARIETY'
           ? null
           : competition.measure === 'LENGTH'
             ? lengthCm
             : weightKg;
      if (competition) {
         const problem = entryProblem(
            competition,
            measurePhoto,
            areaConfirmed,
            declaredValue,
            photo !== null
         );
         setEntryIssue(problem);
         if (problem) {
            toast({
               title: 'Not entered yet.',
               description: problem,
               variant: 'error',
            });
            if (phone) setStep(competition.rule === 'SPECIES_VARIETY' ? 3 : 2);
            return;
         }
      }

      try {
         setIsSaving(true);

         /*
          * A named spot is saved first and the catch filed under it; the
          * spot takes the angler's choice of public or private. Unnamed, the
          * catch keeps the pin on its own.
          */
         let siteId: string | null = filedUnder?.id ?? null;
         if (!siteId && savingSpot && spotName.trim() && where) {
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
            notes: notes.trim() || null,
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
            /* A competition entry's figure came off the tape or the scale. */
            lengthSource:
               competition?.measure === 'LENGTH' && declaredValue !== null
                  ? 'TAPE'
                  : lengthSource,
            weightSource:
               competition?.measure === 'WEIGHT' && declaredValue !== null
                  ? 'SCALE'
                  : weightSource,
            images: photo ? [photo] : [],
            gearIds,
            released: released === 'RELEASED',
         };

         const { data } = await axios.post<{ catch: { id: string } }>(
            '/api/catches',
            payload
         );

         if (competition) {
            /* The catch is in; now the entry, and the competition's page. */
            try {
               if (!competitionEntered) await enterCompetition(competition.id);
               await submitEntry(competition.id, {
                  catchId: data.catch.id,
                  measureImage: measurePhoto
                     ? {
                          storageKey: measurePhoto.storageKey,
                          url: measurePhoto.url,
                       }
                     : null,
                  declaredValue,
                  areaConfirmed,
                  photoTakenAt: photoTakenAt.current?.toISOString() ?? null,
                  note: notes.trim() || null,
               });
               toast({
                  title:
                     competition.checks === 'REVIEW'
                        ? 'Catch submitted for organiser review.'
                        : 'Catch submitted. Standings updated.',
                  variant: 'success',
               });
               if (draftId) removeDraft(draftId);
               navigate(`/competitions/${competition.id}`, { replace: true });
            } catch {
               toast({
                  title: 'Catch saved, not entered.',
                  description:
                     'The catch is in your log. Enter it again from the competition page.',
                  variant: 'error',
               });
               navigate(`/catches/${data.catch.id}`, { replace: true });
            }
            return;
         }

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
         if (draftId) removeDraft(draftId);
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

   /*
    * The position as one receipt line: where it came from, how good it is,
    * and the coordinates it settled on. Without one there is nothing to
    * receipt, only a sentence saying why.
    */
   const whereSource = where
      ? where.source === 'photo'
         ? 'From the photograph'
         : where.source === 'pin'
           ? 'Pinned by you'
           : `Phone fix${where.accuracy ? `, within ${Math.round(where.accuracy)} m` : ''}`
      : null;
   const whereLine = where
      ? `${whereSource} · ${formatCoordinate(where.latitude)}, ${formatCoordinate(where.longitude)}`
      : fixStatus === 'denied'
        ? 'No position. Location is off for this site.'
        : fixStatus === 'unsupported'
          ? 'No position from this browser.'
          : 'Getting a fix.';
   const privacyLine =
      visibility === 'PRIVATE'
         ? 'Only you see this catch.'
         : hideLocation
           ? 'Your catch is public. Your exact spot stays private.'
           : 'Your catch is public, spot included.';

   const heading = (index: string, title: string, note?: string | null) => (
      <div className="mb-5 flex items-center gap-2.5">
         <span className="g-tracked text-[19px] text-teal-text">{index}</span>
         <h2 className="g text-[22px] leading-none">{title}</h2>
         {note ? (
            <span className="ml-auto text-[12px] text-ink-2">{note}</span>
         ) : null}
      </div>
   );

   /* ---- The blocks, each drawn once, placed by the screen ---------------- */

   const speciesBlock = competition?.species ? (
      <div>
         <span className="lab mb-2 block">Species</span>
         <div className="flex items-center justify-between gap-3 border border-ink px-3 py-2">
            <span className="g-tracked text-[21px]">
               {competition.species.commonName}
            </span>
            <span className="text-[13px] text-ink-3">
               The competition's fish
            </span>
         </div>
      </div>
   ) : (
      <div>
         <span className="lab mb-2 block">Species</span>
         <SpeciesCombobox
            label=""
            value={chosen ?? typed}
            species={species}
            recent={options}
            error={speciesError}
            inputRef={speciesInput}
            onChange={(name) => {
               setChosen(name);
               setTyped('');
               setSpeciesError(null);
            }}
            onCreated={(made) => setSpecies((list) => [...list, made])}
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
            onCreated={(made) => setSpecies((list) => [...list, made])}
         />
      </div>
   );

   const competitionBanner = competition ? (
      <CompetitionBanner competition={competition} />
   ) : null;

   const competitionBlock = competition ? (
      <CompetitionEntryFields
         competition={competition}
         measurePhoto={measurePhoto}
         onMeasurePhoto={(next) => {
            setMeasurePhoto(next);
            setEntryIssue(null);
         }}
         onMeasureBusy={setMeasureBusy}
         areaConfirmed={areaConfirmed}
         onAreaConfirmed={(next) => {
            setAreaConfirmed(next);
            setEntryIssue(null);
         }}
         problem={entryIssue}
      />
   ) : null;

   const photoBlock = (
      <PhotoBlock
         initial={photo}
         onChange={setPhoto}
         onBusyChange={setPhotoBusy}
         onFile={onPhotoFile}
         hint={
            competition
               ? 'Required for the competition. This is the picture that goes on the board.'
               : undefined
         }
      />
   );

   const measureBlock = (
      <div>
         <div className="grid grid-cols-2 gap-3 md:gap-4">
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
            />
         </div>
      </div>
   );

   const fishBlock = (
      <div className="flex flex-wrap items-center justify-between gap-3">
         <span className="lab">Kept or released</span>
         <Segment
            label="Kept or released"
            value={released}
            onChange={setReleased}
            className="w-full sm:w-auto sm:min-w-[215px]"
            options={[
               { value: 'RELEASED', label: 'Released' },
               { value: 'KEPT', label: 'Kept' },
            ]}
         />
      </div>
   );

   const gearInner = (
      <div className="flex flex-col gap-4">
         <div className="grid gap-3 sm:grid-cols-2">
            <Picker
               multiple
               size="sm"
               label="Gear"
               allLabel="None chosen"
               value={gearIds.filter((id) =>
                  gearOptions.some((o) => o.value === id)
               )}
               options={gearOptions}
               onChange={(next) =>
                  setGearIds((was) => [
                     ...was.filter((id) =>
                        baitOptions.some((o) => o.value === id)
                     ),
                     ...(next as string[]),
                  ])
               }
            />
            <Picker
               multiple
               size="sm"
               label="Bait or lure"
               allLabel="None chosen"
               value={gearIds.filter((id) =>
                  baitOptions.some((o) => o.value === id)
               )}
               options={baitOptions}
               onChange={(next) =>
                  setGearIds((was) => [
                     ...was.filter((id) =>
                        gearOptions.some((o) => o.value === id)
                     ),
                     ...(next as string[]),
                  ])
               }
            />
         </div>
         <AddGearInline
            onAdded={(entry) => {
               setGear((list) => [...list, entry]);
               setGearIds((was) => [...was, entry.id]);
            }}
         />
         <TextArea
            label="Notes"
            value={notes}
            maxLength={2000}
            rows={3}
            placeholder="Anything you want to remember about it."
            onChange={(event) => setNotes(event.target.value)}
         />
      </div>
   );

   /*
    * Open from the start on a desktop. This column is the shorter of the two
    * and the fold was hiding Notes behind a heading that made the page read
    * as finished.
    */
   const gearFold = (
      <div className="border-t border-line">
         <Fold
            open
            title="Gear, bait & notes"
            headingClassName="text-[18px] md:text-[18px]"
            aside={gearIds.length ? `${gearIds.length} chosen` : undefined}
         >
            <div className="pb-5">{gearInner}</div>
         </Fold>
      </div>
   );

   /* How far the photograph's place is from the pin, in words. */
   const photoPlaceAway =
      photoPlace && where ? formatMetres(distanceM(where, photoPlace)) : null;

   const whenWhereBlock = (
      <div className="border-t-2 border-teal bg-bg-2 p-4 md:p-5">
         <CaughtAt
            at={stampedAt}
            timeSource={timeSource}
            onTime={(next) => {
               setStampedAt(next);
               setTimeSource('typed');
            }}
         />

         {/*
          * The map is always on screen, small, with the pin on whatever is
          * known: the phone's fix, the photograph's place, or where the
          * angler put it. The line above it says which. A position that
          * changes is seen to move, which is the whole point of a map.
          */}
         <div className="mt-4">
            <p
               className={cn(
                  'num text-[14px]',
                  where ? 'text-ink' : 'text-ink-3'
               )}
               data-where-source={where?.source ?? ''}
            >
               {whereLine}
            </p>

            {photoWithoutPosition ? (
               <p className="mt-2 text-[14px] text-ink-3">
                  This photograph carries no position. Phones often strip it
                  when a photo is picked from the gallery or shared.
               </p>
            ) : null}

            {photoPlace ? (
               <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[14px]">
                  <span className="text-ink-2">
                     The photograph was taken {photoPlaceAway} from your pin.
                  </span>
                  <button
                     type="button"
                     onClick={() => {
                        setWhere({ ...photoPlace, source: 'photo' });
                        setPhotoPlace(null);
                     }}
                     className="g-tracked inline-flex min-h-11 items-center text-[15px] text-teal-text hover:opacity-80"
                  >
                     Use the photograph's place
                  </button>
               </div>
            ) : null}

            <div id="quicklog-pin" className="mt-3">
               <MapLocationPicker
                  readout={false}
                  compact
                  mapClassName="h-[220px] md:h-[260px]"
                  latitude={where ? String(where.latitude) : ''}
                  longitude={where ? String(where.longitude) : ''}
                  source={whereSource}
                  onChange={(latitude, longitude) => {
                     setWhere({ latitude, longitude, source: 'pin' });
                     setPhotoPlace(null);
                     setPhotoWithoutPosition(false);
                  }}
               />
            </div>
         </div>

         {near ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[14px]">
               <span>
                  {filedUnder ? (
                     <>
                        <span className="g-tracked text-[17px]">
                           {near.spot.name}
                        </span>
                        <span className="ml-2 text-ink-3">
                           {formatMetres(near.metres)} away. Filed there.
                        </span>
                     </>
                  ) : (
                     <span className="text-ink-2">
                        Not filed under {near.spot.name}.
                     </span>
                  )}
               </span>
               <button
                  type="button"
                  onClick={() =>
                     setNotThatSpot(filedUnder ? near.spot.id : null)
                  }
                  className="g-tracked inline-flex min-h-11 items-center text-[15px] text-teal-text hover:opacity-80"
               >
                  {filedUnder ? 'Not this spot' : 'File it there'}
               </button>
            </div>
         ) : null}

         {where && !filedUnder ? (
            <div className="mt-3">
               <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[15px]">
                  <input
                     type="checkbox"
                     className="size-4 accent-ink"
                     checked={savingSpot}
                     onChange={(event) => setSavingSpot(event.target.checked)}
                  />
                  Add this as a spot
               </label>
               {savingSpot ? (
                  <div className="mt-2 flex flex-col gap-3">
                     <TextField
                        label="Spot name"
                        value={spotName}
                        maxLength={120}
                        autoComplete="off"
                        onChange={(event) => setSpotName(event.target.value)}
                     />
                     <Segment
                        label="The spot is"
                        value={spotPublic ? 'PUBLIC' : 'PRIVATE'}
                        onChange={(next) => setSpotPublic(next === 'PUBLIC')}
                        options={[
                           { value: 'PRIVATE', label: 'Private spot' },
                           { value: 'PUBLIC', label: 'Public spot' },
                        ]}
                     />
                  </div>
               ) : null}
            </div>
         ) : null}

         <div className="mt-4 border-t border-line pt-3">
            <Conditions
               phase={phase}
               lines={lines}
               takenAt={conditions?.at ?? null}
            />
         </div>
      </div>
   );

   const sharingBlock = (
      <div className="flex flex-col gap-4">
         <div>
            <span className="lab mb-2 block">Seen by</span>
            <Segment
               label="Seen by"
               value={visibility}
               onChange={setVisibility}
               options={[
                  { value: 'PUBLIC', label: 'Everyone' },
                  { value: 'PRIVATE', label: 'Only me' },
               ]}
            />
         </div>
         {visibility === 'PUBLIC' && where ? (
            <div>
               <span className="lab mb-2 block">Exact spot</span>
               <Segment
                  label="Exact spot"
                  value={hideLocation ? 'HIDDEN' : 'SHOWN'}
                  onChange={(next) => setHideLocation(next === 'HIDDEN')}
                  options={[
                     { value: 'HIDDEN', label: 'Hidden' },
                     { value: 'SHOWN', label: 'Shown' },
                  ]}
               />
            </div>
         ) : null}
         {/* The one statement of what will be published, so the footer does
             not say it again in another wording. */}
         <p aria-live="polite" className="text-[14px] text-ink-2">
            {privacyLine}
         </p>
      </div>
   );

   const saveButton = (
      <button
         type="button"
         onClick={() => void save()}
         disabled={photoBusy || measureBusy || isSaving}
         className="g-tracked flex min-h-[52px] w-full items-center justify-center bg-teal px-7 text-[22px] text-teal-ink transition-[filter] duration-150 hover:brightness-95 disabled:opacity-60 md:w-auto md:min-w-[222px]"
      >
         {isSaving
            ? 'Saving'
            : photoBusy || measureBusy
              ? 'Sending the photo'
              : competition
                ? competition.checks === 'REVIEW'
                   ? 'Submit for review'
                   : 'Submit and update standings'
                : 'Save catch'}
      </button>
   );

   /*
    * On a phone the form is three steps, one screen each, in the order the
    * fish comes in: the fish and where it came out, then its size and gear,
    * then who sees it. On a desktop everything is on the one card.
    */
   const STEPS = [
      { title: 'The catch', hint: 'The fish, and where it came out' },
      { title: 'Size and gear', hint: 'How big, and on what' },
      { title: 'Sharing', hint: 'Who sees it' },
   ] as const;
   const current = STEPS[step - 1] ?? STEPS[0];
   const nextStep = () => {
      setStep((n) => Math.min(3, n + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
   };
   const prevStep = () => {
      setStep((n) => Math.max(1, n - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
   };

   return (
      <section
         className={cn(
            'mx-auto w-full max-w-[1160px] border border-line border-t-[3px] border-t-teal bg-background transition-[transform,opacity] duration-[460ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)] md:my-8',
            entered ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
         )}
      >
         <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-5 md:items-center md:px-7">
            <div className="min-w-0">
               <h1 className="g text-[30px] leading-none md:text-[34px]">
                  Log a catch
               </h1>

               {phone ? (
                  <ol
                     aria-label="Steps"
                     className="mt-3 flex items-center gap-1.5"
                  >
                     {STEPS.map((s, i) => (
                        <li
                           key={s.title}
                           aria-current={i + 1 === step ? 'step' : undefined}
                           className={cn(
                              'h-[3px] flex-1 transition-colors duration-200',
                              i + 1 <= step ? 'bg-teal' : 'bg-line'
                           )}
                        />
                     ))}
                  </ol>
               ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3 md:gap-4">
               <button
                  type="button"
                  onClick={saveAsDraft}
                  className="g-tracked inline-flex min-h-11 items-center text-[15px] whitespace-nowrap hover:text-teal-text md:text-[16px]"
               >
                  Save draft
               </button>
               <button
                  type="button"
                  onClick={close}
                  aria-label="Close the catch form"
                  className="grid size-11 place-items-center rounded-full border border-line hover:bg-bg-2"
               >
                  <XMarkIcon aria-hidden="true" className="size-5" />
               </button>
            </div>
         </header>

         {phone ? (
            <div className="px-4 py-6">
               {step === 1 ? (
                  <div className="flex flex-col gap-6">
                     {heading('01', current.title)}
                     {competitionBanner}
                     {photoBlock}
                     {speciesBlock}
                     {whenWhereBlock}
                  </div>
               ) : step === 2 ? (
                  <div className="flex flex-col gap-6">
                     {heading('02', current.title)}
                     {measureBlock}
                     {competitionBlock}
                     {fishBlock}
                     <div>
                        <span className="lab mb-3 block">
                           Gear, bait & notes
                        </span>
                        {gearInner}
                     </div>
                  </div>
               ) : (
                  <div className="flex flex-col gap-6">
                     {heading('03', current.title)}
                     {sharingBlock}
                  </div>
               )}
            </div>
         ) : (
            <div className="grid gap-7 px-4 py-6 md:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] md:gap-9 md:px-7 xl:gap-12 xl:px-9">
               <div className="min-w-0">
                  {heading('01', 'The catch')}
                  {competitionBanner ? (
                     <div className="mb-5">{competitionBanner}</div>
                  ) : null}
                  {speciesBlock}
                  <div className="mt-5">{photoBlock}</div>
                  <div className="mt-6">{measureBlock}</div>
                  {competitionBlock ? (
                     <div className="mt-6">{competitionBlock}</div>
                  ) : null}
                  <div className="mt-5">{fishBlock}</div>
                  <div className="mt-6">{gearFold}</div>
               </div>
               <aside
                  className="min-w-0"
                  aria-label="When, where and who sees it"
               >
                  {heading('02', 'When & where')}
                  {whenWhereBlock}
                  <div className="mt-6">
                     {heading('03', 'Sharing')}
                     {sharingBlock}
                  </div>
               </aside>
            </div>
         )}

         <footer className="sticky bottom-0 z-10 border-t border-line bg-background px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:px-7 md:py-4">
            {phone ? (
               <div className="flex items-center gap-3">
                  {step > 1 ? (
                     <button
                        type="button"
                        onClick={prevStep}
                        className="g-tracked inline-flex min-h-[52px] items-center border border-line px-4 text-[17px]"
                     >
                        Back
                     </button>
                  ) : null}
                  {step < 3 ? (
                     <button
                        type="button"
                        onClick={nextStep}
                        className="g-tracked flex min-h-[52px] flex-1 items-center justify-center bg-ink px-6 text-[20px] text-background"
                     >
                        Next
                     </button>
                  ) : (
                     <div className="flex-1">{saveButton}</div>
                  )}
               </div>
            ) : (
               <div className="flex items-center justify-end gap-5">
                  {saveButton}
               </div>
            )}
         </footer>
      </section>
   );
}
