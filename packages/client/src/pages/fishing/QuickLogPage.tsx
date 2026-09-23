import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/title';
import {
   fetchConditions,
   fetchMyCatches,
   toKilometresPerHour,
   toReadouts,
   toSavableSnapshot,
   type WeatherSnapshot,
} from '@/components/fishing/record/api';
import {
   formatClock,
   lengthMetric,
   weightMetric,
} from '@/components/fishing/record/format';
import { formatCardinal } from '@/lib/weather';
import {
   Conditions,
   type ConditionsPhase,
   type Readout,
} from '@/components/fishing/quicklog/Conditions';
import { MeasureField } from '@/components/fishing/quicklog/MeasureField';
import {
   PhotoBlock,
   type UploadedPhoto,
} from '@/components/fishing/quicklog/PhotoBlock';
import { PhotoStrip } from '@/components/fishing/quicklog/PhotoStrip';
import { SmallBox } from '@/components/fishing/quicklog/SmallBox';
import { SpotRow } from '@/components/fishing/quicklog/SpotRow';
import { GearPicker } from '@/components/fishing/quicklog/GearPicker';
import { PreviewCard } from '@/components/fishing/quicklog/PreviewCard';
import { CompetitionRow } from '@/components/fishing/quicklog/CompetitionRow';
import {
   type TimeSource,
   type Where,
} from '@/components/fishing/quicklog/Receipt';
import { MapLocationPicker } from '@/components/fishing/MapLocationPicker';
import { usePhone } from '@/lib/media';
import { Segment } from '@/components/fishing/quicklog/Segment';
import { CaughtAt } from '@/components/fishing/quicklog/CaughtAt';
import { dayStamp } from '@/components/fishing/quicklog/stamp';
import { readPhotoMeta, type PhotoMeta } from '@/lib/exif';
import { distanceM, nearestSpot, type SpotLike } from '@/lib/geo';
import { SpeciesGuess } from '@/components/fishing/SpeciesGuess';
import {
   enterCompetition,
   fetchCompetition,
   listWords,
   needsMeasurePhoto,
   submitEntry,
   type Competition,
} from '@/components/social/competitions-api';
import {
   CompetitionBanner,
   CompetitionEntryFields,
} from '@/components/fishing/CompetitionEntryFields';
import { entryProblem } from '@/components/fishing/competition-entry';
import { EntryPhotoSteps } from '@/components/fishing/EntryPhotos';
import { readUnits, writeUnits } from '@/lib/units';
import { SpeciesCombobox } from '@/components/fishing/SpeciesCombobox';
import type { GearOption } from '@/pages/fishing/LogCatchPage';
import { readDraft, removeDraft, saveDraft } from '@/lib/drafts';
import {
   convertTyped,
   toMetricValue,
   type MeasureUnit,
} from '@/components/fishing/quicklog/measure';
import {
   NOT_SURE,
   UNNAMED_TITLE,
   fetchSpecies,
   matchSpecies,
   speciesChoices,
   speciesKey,
   type Species,
} from '@/components/fishing/quicklog/species';
import { usePositionFix } from '@/components/fishing/quicklog/useFix';
import { useSession } from '@/lib/auth-client';
import { useMyAvatar } from '@/components/profile/avatar-api';
import { refusalWords } from '@/components/feed/moderation-api';

/*
 * The log. There is one.
 *
 * The clock is stamped on arrival, the fix starts tightening and the
 * conditions land on their own; the angler only names the fish and its size.
 * On a phone it is three steps in the order the fish comes in: the catch,
 * its size and gear, then who sees it. On a desktop it is one card, the fish
 * on the left and its context on the right. The only thing that can hold the
 * save is a photo still going up.
 */
export function QuickLogPage() {
   useDocumentTitle('Log a catch');
   return (
      <RequireSignIn what="your log">
         <QuickLog />
      </RequireSignIn>
   );
}

/* How far apart two places are, in the words the line under the map uses. */
const away = (metres: number) =>
   metres < 1000
      ? `${Math.round(metres / 10) * 10} m`
      : metres < 10000
        ? `${(metres / 1000).toFixed(1)} km`
        : `${Math.round(metres / 1000)} km`;

/*
 * The one fish a competition is for, when it is for exactly one: the log then
 * names the fish itself. A competition for several leaves the choice open and
 * says which count.
 */
const onlyFish = (c: Competition | null | undefined) =>
   c && c.species.length === 1 ? c.species[0]!.commonName : null;

/* Which way the pressure is going, read off the hour three hours back. */
const PRESSURE_STEP_HOURS = 3;
const trendWord = (now: number, before: number) =>
   now - before > 0.6 ? 'Rising' : before - now > 0.6 ? 'Falling' : 'Steady';

function QuickLog() {
   const navigate = useNavigate();
   const { data: session } = useSession();
   /* The session carries a storage key; the profile route signs it. */
   const avatarUrl = useMyAvatar(Boolean(session?.user));
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
      /*
       * Arriving from the map: the point the map was looking at. It is a
       * guess at the water, not a pin the angler put down, so a photograph
       * that knows where it was taken overtakes it.
       */
      const lat = Number(params.get('lat'));
      const lng = Number(params.get('lng'));
      return params.has('lat') && Number.isFinite(lat) && Number.isFinite(lng)
         ? { latitude: lat, longitude: lng, source: 'map' }
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
   /*
    * Undefined while nobody has said: the nearest spot stands. A spot or a
    * null is the angler's own answer and beats whatever is near.
    */
   const [spotChoice, setSpotChoice] = useState<SpotLike | null | undefined>(
      undefined
   );
   /* Logging from a spot's own page: the catch is filed there to start. */
   const siteIdParam = params.get('siteId');
   const fromSpotPage = siteIdParam
      ? (spots.find((spot) => spot.id === siteIdParam) ?? null)
      : null;
   const filedUnder =
      spotChoice === undefined
         ? (fromSpotPage ?? near?.spot ?? null)
         : spotChoice;

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
   /* A photograph's place taken as the pin, worth saying on a phone where
      the map is below the fold when the picture goes in. */
   const [photoMoved, setPhotoMoved] = useState(false);

   /*
    * What a chosen photograph tells the log, whether it went in the frame or
    * the strip beside it. The first picture that carries a position speaks
    * for the lot: they are one catch, photographed from one place.
    */
   const takePhotoMeta = (metas: PhotoMeta[], cover: boolean) => {
      if (cover) {
         const takenAt = metas.find((meta) => meta.takenAt)?.takenAt ?? null;
         photoTakenAt.current = takenAt;
         if (takenAt && timeSource !== 'typed') {
            setStampedAt(takenAt);
            setTimeSource('photo');
         }
      }
      const placed = metas.find(
         (meta): meta is PhotoMeta & { latitude: number; longitude: number } =>
            meta.latitude !== null && meta.longitude !== null
      );
      if (placed) {
         const place = {
            latitude: placed.latitude,
            longitude: placed.longitude,
         };
         setPhotoWithoutPosition(false);
         /*
          * The photograph knows where it was taken. It beats the phone's
          * fix, which only says where the phone is now, and the point the
          * map was looking at, which is a guess. A pin the angler put down
          * by hand is their answer: the photograph's place is offered next
          * to it, one tap to take it.
          */
         if (whereRef.current?.source === 'pin') {
            setPhotoPlace(place);
            setPhotoMoved(false);
         } else {
            setWhere({ ...place, source: 'photo' });
            setPhotoPlace(null);
            setPhotoMoved(true);
         }
      } else if (cover || whereRef.current?.source !== 'photo') {
         /* Said every time, not only when the camera wrote a time: a
          * screenshot or a shared picture carries neither, and the angler
          * still expected the pin to move. */
         setPhotoWithoutPosition(true);
         setPhotoMoved(false);
      }
   };

   const onPhotoFile = (file: File) => {
      void readPhotoMeta(file).then((meta) => takePhotoMeta([meta], true));
   };

   const onStripFiles = (files: File[]) => {
      void Promise.all(files.map(readPhotoMeta)).then((metas) =>
         takePhotoMeta(metas, false)
      );
   };

   const [entered, setEntered] = useState(false);
   const [conditions, setConditions] = useState<{
      snapshot: WeatherSnapshot;
      at: string | null;
   } | null>(null);
   const [conditionsFailed, setConditionsFailed] = useState(false);
   const [pressureTrend, setPressureTrend] = useState<string | null>(null);

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
   /* And in the measure photo: the judge sets the two times side by side. */
   const measureTakenAt = useRef<Date | null>(null);
   useEffect(() => {
      if (!competitionId) return;
      const controller = new AbortController();
      fetchCompetition(competitionId, controller.signal)
         .then((detail) => {
            /* With teams an entry counts for a side, and the side is picked
               on the competition's page, so that is where this goes first.
               Sent back now, before a fish is photographed, not after. */
            if (
               detail.competition.teamsEnabled &&
               !detail.competition.yourTeamId
            ) {
               toast({
                  title: 'Pick a team first.',
                  description: 'Your catches count for the team you fish for.',
               });
               navigate(`/competitions/${detail.competition.id}`, {
                  replace: true,
               });
               return;
            }
            setCompetition(detail.competition);
            setCompetitionEntered(detail.you.entered);
            const fish = onlyFish(detail.competition);
            if (fish) {
               setChosen(fish);
               setTyped('');
            }
         })
         .catch(() => {
            /* A read this page called off itself (it left, or the link
               changed) is not a failure to tell anyone about. */
            if (controller.signal.aborted) return;
            toast({
               title: 'Could not read the competition.',
               description: 'The catch still logs as usual.',
               variant: 'error',
            });
         });
      return () => controller.abort();
   }, [competitionId, navigate]);

   const [length, setLength] = useState('');
   /* The reader's own units to begin with (lib/units.ts), the same ones a
      competition's standings are shown in. A draft brings back its own. */
   const [lengthUnit, setLengthUnit] = useState<MeasureUnit>(
      () => readUnits().length
   );
   const [lengthSource, setLengthSource] = useState<'EYE' | 'TAPE'>('EYE');
   const [weight, setWeight] = useState('');
   const [weightUnit, setWeightUnit] = useState<MeasureUnit>(
      () => readUnits().mass
   );
   const [weightSource, setWeightSource] = useState<'EYE' | 'SCALE'>('EYE');
   /*
    * On a scale, the scale is photographed and the figure read off it (Claude,
    * /api/vision/read). The reading comes back with the server's proof, which
    * the catch carries, and only a weight that matches it is saved as off a
    * scale. A weight that does not is said so before it is saved.
    */
   const [scalePhoto, setScalePhoto] = useState<UploadedPhoto | null>(null);
   const [scaleBusy, setScaleBusy] = useState(false);
   const [scaleRead, setScaleRead] = useState<
      | { status: 'idle' | 'reading' | 'off' | 'failed' }
      | { status: 'unread'; note: string }
      | {
           status: 'read';
           value: number;
           unit: 'kg' | 'lb';
           confidence: number;
           note: string;
           proof: string;
        }
   >({ status: 'idle' });
   /* The photographs, the first of them the cover. */
   const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
   const photo = photos[0] ?? null;
   const [photoBusy, setPhotoBusy] = useState(false);
   /* The chosen picture as the browser holds it, so the step 3 card can show
      it at once rather than waiting on the bucket's own copy. */
   const [photoPreview, setPhotoPreview] = useState<string | null>(null);
   const [stripBusy, setStripBusy] = useState(false);
   const [released, setReleased] = useState<'KEPT' | 'RELEASED'>('KEPT');
   /* The long form's three: how many, how deep, how warm the water was. */
   const [countValue, setCountValue] = useState('1');
   const [depthValue, setDepthValue] = useState('');
   const [waterTempValue, setWaterTempValue] = useState('');

   const setCover = (next: UploadedPhoto | null) =>
      setPhotos((was) => (next ? [next, ...was.slice(1)] : was.slice(1)));

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
   const rods = gear.filter((entry) => !isBait(entry));
   const baits = gear.filter(isBait);

   /*
    * A draft reopened. Everything that was typed comes back; the photo too,
    * since it was sent up when it was chosen. Both kinds open here, because
    * there is one log now and the long form's drafts have nowhere else to go.
    */
   const draftId = params.get('draft');
   useEffect(() => {
      if (!draftId) return;
      const draft = readDraft(draftId);
      if (!draft) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = draft.state as Record<string, any>;
      if (draft.kind === 'full') {
         if (typeof d.title === 'string' && d.title) setChosen(d.title);
         if (typeof d.notes === 'string') setNotes(d.notes ?? '');
         if (typeof d.caughtAt === 'string' && d.caughtAt) {
            const when = new Date(d.caughtAt);
            if (!Number.isNaN(when.getTime())) {
               setStampedAt(when);
               setTimeSource('typed');
            }
         }
         if (
            typeof d.latitude === 'number' &&
            typeof d.longitude === 'number'
         ) {
            setWhere({
               latitude: d.latitude,
               longitude: d.longitude,
               source: 'pin',
            });
         }
         if (typeof d.length === 'number') setLength(String(d.length));
         if (typeof d.weight === 'number') setWeight(String(d.weight));
         if (d.count != null) setCountValue(String(d.count));
         if (d.depth != null) setDepthValue(String(d.depth));
         if (d.waterTemp != null) setWaterTempValue(String(d.waterTemp));
         if (d.visibility) setVisibility(d.visibility);
         if (typeof d.hideLocation === 'boolean')
            setHideLocation(d.hideLocation);
         if (Array.isArray(d.gearIds)) setGearIds(d.gearIds);
         if (Array.isArray(d.images)) setPhotos(d.images as UploadedPhoto[]);
         if (typeof d.released === 'boolean')
            setReleased(d.released ? 'RELEASED' : 'KEPT');
         if (d.lengthSource) setLengthSource(d.lengthSource);
         if (d.weightSource) setWeightSource(d.weightSource);
         return;
      }
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
      if (Array.isArray(d.photos)) setPhotos(d.photos);
      else if (d.photo) setPhotos([d.photo]);
      if (typeof d.notes === 'string') setNotes(d.notes);
      if (typeof d.savingSpot === 'boolean') setSavingSpot(d.savingSpot);
      if (typeof d.countValue === 'string') setCountValue(d.countValue);
      if (typeof d.depthValue === 'string') setDepthValue(d.depthValue);
      if (typeof d.waterTempValue === 'string')
         setWaterTempValue(d.waterTempValue);
   }, [draftId]);

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
            photos,
            notes,
            savingSpot,
            countValue,
            depthValue,
            waterTempValue,
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
    * guessed in the car park. The hour before is read as well, because a
    * pressure figure on its own says nothing and which way it is going is
    * what an angler reads it for.
    */
   const hourKey = `${stampedAt.toISOString().slice(0, 13)}|${where ? `${where.latitude.toFixed(3)},${where.longitude.toFixed(3)}` : ''}`;
   useEffect(() => {
      if (!where) return;
      conditionsRequest.current?.abort();
      const controller = new AbortController();
      conditionsRequest.current = controller;
      setConditionsFailed(false);
      setPressureTrend(null);
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
            const now = weather.airPressure?.meanSeaLevelMillibars;
            if (typeof now !== 'number') return;
            const before = new Date(
               stampedAt.getTime() - PRESSURE_STEP_HOURS * 3600_000
            );
            const earlier = await fetchConditions(
               where.latitude,
               where.longitude,
               controller.signal,
               before
            );
            if (controller.signal.aborted) return;
            const then = earlier?.airPressure?.meanSeaLevelMillibars;
            if (typeof then === 'number')
               setPressureTrend(trendWord(now, then));
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

   /*
    * The three readings, as figures rather than sentences: the wind with its
    * direction and its gusts under it, the pressure with which way it is
    * going, the air with the sky.
    */
   const readouts = useMemo<Readout[]>(() => {
      const read = toReadouts(snapshot);
      const cardinal = formatCardinal(snapshot?.wind?.direction?.cardinal);
      const gust = toKilometresPerHour(
         snapshot?.wind?.gust?.value,
         snapshot?.wind?.gust?.unit
      );
      const gusts = gust === null ? null : Math.round(gust);
      return [
         {
            key: 'wind',
            value: read.wind.value,
            unit: 'km/h',
            note:
               cardinal && gusts !== null
                  ? `${cardinal}, gusts ${gusts}`
                  : (cardinal ?? (gusts !== null ? `Gusts ${gusts}` : null)),
         },
         {
            key: 'pressure',
            value: read.pressure.value,
            unit: 'hPa',
            note: pressureTrend,
         },
         { key: 'air', value: read.air.value, unit: '°C', note: read.air.note },
      ];
   }, [snapshot, pressureTrend]);

   const close = () => {
      if (window.history.length > 1) {
         navigate(-1);
      } else {
         navigate('/');
      }
   };

   const declaredValue = !competition
      ? null
      : competition.rule === 'SPECIES_VARIETY'
        ? null
        : competition.measure === 'LENGTH'
          ? toMetricValue(length, lengthUnit)
          : toMetricValue(weight, weightUnit);

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
            /* The three asks sit in three different steps now. */
            if (phone) {
               setStep(
                  !photo || (needsMeasurePhoto(competition) && !measurePhoto)
                     ? 1
                     : needsMeasurePhoto(competition) &&
                         !(declaredValue !== null && declaredValue > 0)
                       ? 2
                       : 3
               );
            }
            return;
         }
      }

      /*
       * Off a scale, the scale is shown and says the same weight. Not when the
       * reader is off: then the weight is kept, as by eye, by the server.
       */
      if (!competition && weightSource === 'SCALE' && weightKg !== null) {
         const problem = !scalePhoto
            ? 'Add a photo of the scale, or switch the weight to By eye.'
            : scaleRead.status === 'reading'
              ? 'The scale is still being read. Give it a moment.'
              : scaleRead.status === 'unread' || scaleRead.status === 'failed'
                ? 'The scale photo could not be read. Take it again, or switch the weight to By eye.'
                : scaleRead.status === 'read' && !scaleMatches
                  ? `The scale reads ${scaleWords}. Use that weight, or switch to By eye.`
                  : null;
         if (problem) {
            toast({
               title: 'Not saved yet.',
               description: problem,
               variant: 'error',
            });
            if (phone) setStep(2);
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

         const countNumber = Number(countValue.trim());
         const depthNumber = Number(depthValue.trim().replace(',', '.'));
         const waterNumber = Number(waterTempValue.trim().replace(',', '.'));

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
            count:
               countValue.trim() &&
               Number.isFinite(countNumber) &&
               countNumber > 0
                  ? Math.round(countNumber)
                  : 1,
            depth:
               depthValue.trim() && Number.isFinite(depthNumber)
                  ? depthNumber
                  : null,
            /* TODO(api): appendix E item 11. The write path takes waterTemp
               and stores null for it, so this reading is not kept yet. */
            waterTemp:
               waterTempValue.trim() && Number.isFinite(waterNumber)
                  ? waterNumber
                  : null,
            /* A competition entry's figure came off the tape or the scale. */
            lengthSource:
               competition?.measure === 'LENGTH' && declaredValue !== null
                  ? 'TAPE'
                  : lengthSource,
            weightSource:
               competition?.measure === 'WEIGHT' && declaredValue !== null
                  ? 'SCALE'
                  : weightSource,
            /* Named, so the server knows the scale mark comes from the judge. */
            competitionId: competition?.id ?? null,
            /* The scale reading and the server's proof of it. */
            ...(!competition &&
            weightSource === 'SCALE' &&
            scaleRead.status === 'read'
               ? {
                    readMeasure: scaleRead.value,
                    readMeasureUnit: scaleRead.unit,
                    readConfidence: scaleRead.confidence,
                    readNote: scaleRead.note.slice(0, 280) || null,
                    readProof: scaleRead.proof,
                 }
               : {}),
            /* The scale photograph goes with the catch, after the others. */
            images:
               !competition && weightSource === 'SCALE' && scalePhoto
                  ? [...photos, scalePhoto]
                  : photos,
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
                  /* Named, not taken to be the first of the catch's list. */
                  fishImage: photo ? { storageKey: photo.storageKey } : null,
                  measureImage: measurePhoto
                     ? {
                          storageKey: measurePhoto.storageKey,
                          url: measurePhoto.url,
                       }
                     : null,
                  declaredValue,
                  areaConfirmed,
                  photoTakenAt: photoTakenAt.current?.toISOString() ?? null,
                  measureTakenAt: measurePhoto
                     ? (measureTakenAt.current?.toISOString() ?? null)
                     : null,
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
         /* A word that is not allowed is named as such, not blamed on the
            figures. */
         const refused = refusalWords(error);
         const message =
            axios.isAxiosError(error) &&
            typeof error.response?.data?.message === 'string'
               ? error.response.data.message
               : refused?.includes('not allowed')
                 ? refused
                 : 'Check the length and weight, then try again.';
         toast({ title: 'Not saved.', description: message, variant: 'error' });
      }
   };

   /*
    * The position as one line under the map: where it came from and how good
    * it is. A photograph's place says how far that is from the phone, because
    * that is the number that tells the angler whether it is the right picture.
    */
   const whereSource = where
      ? where.source === 'photo'
         ? 'From the photograph'
         : where.source === 'pin'
           ? 'Pinned by you'
           : where.source === 'map'
             ? 'From the map'
             : `Phone fix${where.accuracy ? `, within ${Math.round(where.accuracy)} m` : ''}`
      : null;
   const fromPhone =
      where?.source === 'photo' && fix
         ? `${away(distanceM(where, fix))} from the phone`
         : null;
   const whereLine = where
      ? [whereSource, fromPhone].filter(Boolean).join(' · ')
      : fixStatus === 'denied'
        ? 'No position. Location is off for this site.'
        : fixStatus === 'unsupported'
          ? 'No position from this browser.'
          : 'Getting a fix.';
   /*
    * What the photograph just did to the pin, said under the photograph.
    * On a phone the map is a screen and a half below the picker, so the
    * angler adds a picture at the top of the form and nothing they can see
    * answers them. One line, only while there is something to answer.
    */
   const photoNote = photoWithoutPosition
      ? 'This photograph carries no position.'
      : photoPlace
        ? `The photograph was taken ${where ? away(distanceM(where, photoPlace)) : ''} from your pin.`
        : photoMoved
          ? 'Pin moved to where the photograph was taken.'
          : null;
   const privacyLine =
      visibility === 'PRIVATE'
         ? 'Only you see this catch.'
         : hideLocation
           ? 'Your catch is public. Your exact spot stays private.'
           : 'Your catch is public, spot included.';

   /* A section title. No number: the dashes above are the steps. */
   const heading = (title: string, className?: string) => (
      <h2 className={cn('g text-[26px] leading-[0.95]', className)}>{title}</h2>
   );

   /* ---- The blocks, each drawn once, placed by the screen ---------------- */

   const namerBand = (
      <SpeciesGuess
         band
         columns={!phone}
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
   );

   const photoBlock = (
      <PhotoBlock
         initial={photo}
         onChange={setCover}
         onBusyChange={setPhotoBusy}
         onFile={onPhotoFile}
         onPreviewUrl={setPhotoPreview}
         title={phone ? 'Take a photo' : 'Choose a photo'}
         second={phone ? 'Choose one instead' : ''}
         retake={Boolean(competition)}
      >
         {namerBand}
      </PhotoBlock>
   );

   /* The catch's other photographs, under the cover, on a phone as on a
      desktop: a catch can carry up to eight, and the feed swipes through them. */
   const photoStrip = (
      <PhotoStrip
         photos={photos}
         onChange={setPhotos}
         onBusyChange={setStripBusy}
         onFiles={onStripFiles}
         coverPreview={photoPreview}
      />
   );

   /*
    * Entering a competition, the photographs are two numbered steps: the
    * fish, then the same fish on the measure, which opens once the first is
    * chosen. Without a competition the photo block stands alone as before.
    */
   const photoSteps = competition ? (
      <EntryPhotoSteps
         competition={competition}
         fish={
            /* What the photograph did to the pin belongs to the fish photo,
               so on a phone it is said under step one, not under the tape. */
            phone ? (
               <>
                  {photoBlock}
                  {photoNote ? (
                     <p className="mt-2 text-[14px] text-ink-3">{photoNote}</p>
                  ) : null}
               </>
            ) : (
               /* The strip can make another photograph the cover, which is
                  then the fish: it belongs to this step, not after the tape. */
               <>
                  {photoBlock}
                  {photos.length ? (
                     <div className="mt-4">{photoStrip}</div>
                  ) : null}
               </>
            )
         }
         fishIn={photo !== null || photoBusy}
         fishDone={photo !== null}
         measurePhoto={measurePhoto}
         onMeasurePhoto={(next) => {
            setMeasurePhoto(next);
            if (!next) measureTakenAt.current = null;
            setEntryIssue(null);
         }}
         onMeasureBusy={setMeasureBusy}
         onMeasureFile={(file) => {
            measureTakenAt.current = null;
            void readPhotoMeta(file).then((meta) => {
               measureTakenAt.current = meta.takenAt ?? null;
            });
         }}
      />
   ) : (
      photoBlock
   );

   const areaBlock = competition ? (
      <CompetitionEntryFields
         part="area"
         competition={competition}
         measurePhoto={measurePhoto}
         onMeasurePhoto={setMeasurePhoto}
         onMeasureBusy={setMeasureBusy}
         areaConfirmed={areaConfirmed}
         onAreaConfirmed={(next) => {
            setAreaConfirmed(next);
            setEntryIssue(null);
         }}
         problem={entryIssue}
      />
   ) : null;

   /* The fish a competition for several is for, and whether the one named
      here is among them. Matched the way the server matches it, on the name. */
   const allowedFish =
      competition && competition.species.length > 1
         ? competition.species.map((s) => s.commonName)
         : [];
   const namedFish = (chosen ?? typed).trim();
   const offList =
      allowedFish.length > 0 &&
      namedFish !== '' &&
      !allowedFish.some((n) => speciesKey(n) === speciesKey(namedFish));

   const speciesBlock = onlyFish(competition) ? (
      <div className="flex flex-col gap-2">
         <span className="lab">Species</span>
         <div className="flex h-12 items-center justify-between gap-3 border-b border-dashed border-line-2">
            <span className="g-tracked text-[18px]">
               {onlyFish(competition)}
            </span>
            <span className="text-[13px] text-ink-3">
               The competition's fish
            </span>
         </div>
      </div>
   ) : (
      /*
       * The shared combobox, standing on a dashed rule like every other
       * field here rather than in its own filled box.
       */
      <div className="species-line flex flex-col gap-2 [&_input]:h-12 [&_input]:border-0 [&_input]:border-b [&_input]:border-dashed [&_input]:border-line-2 [&_input]:bg-transparent [&_input]:py-0 [&_input]:!pr-0 [&_input]:!pl-[30px] [&_svg]:!left-0">
         <span className="lab">Species</span>
         <SpeciesCombobox
            label=""
            value={chosen ?? typed}
            species={species}
            /* The competition's own fish come first in the list. */
            recent={allowedFish.length ? allowedFish : options}
            error={speciesError}
            inputRef={speciesInput}
            onChange={(name) => {
               setChosen(name);
               setTyped('');
               setSpeciesError(null);
            }}
            onCreated={(made) => setSpecies((list) => [...list, made])}
         />
         {allowedFish.length ? (
            <p
               className={cn(
                  'text-[14px]',
                  offList ? 'text-destructive' : 'text-ink-3'
               )}
               role={offList ? 'status' : undefined}
            >
               {offList
                  ? `Not one of the competition's fish, so the entry would be held. It is for ${listWords(allowedFish)}.`
                  : `The competition is for ${listWords(allowedFish)}.`}
            </p>
         ) : null}
      </div>
   );

   const caughtAtBlock = (
      <CaughtAt
         at={stampedAt}
         timeSource={timeSource}
         onTime={(next) => {
            setStampedAt(next);
            setTimeSource('typed');
         }}
      />
   );

   const mapBlock = (
      <div className="flex flex-col gap-2">
         <div id="quicklog-pin">
            <MapLocationPicker
               readout={false}
               compact
               className="gap-0"
               /* Nothing floats over this map's top left, so Leaflet's own
                  zoom goes back to the corner the review draws it in. */
               mapClassName={cn(
                  'border-0 [&_.leaflet-control-zoom]:!mt-0 [&_.leaflet-control-zoom]:!ml-0',
                  phone ? 'h-[200px]' : 'h-[260px] md:h-[260px]'
               )}
               latitude={where ? String(where.latitude) : ''}
               longitude={where ? String(where.longitude) : ''}
               source={whereSource}
               onChange={(latitude, longitude) => {
                  setWhere({ latitude, longitude, source: 'pin' });
                  setPhotoPlace(null);
                  setPhotoWithoutPosition(false);
                  setPhotoMoved(false);
               }}
            />
         </div>
         <p
            className="text-[14px] text-ink-3"
            data-where-source={where?.source ?? ''}
         >
            {whereLine}
         </p>
         {/*
          * Two things no frame draws, because no frame shows them: a picture
          * that came without a position, and a picture whose position arrived
          * after the angler had already put the pin down.
          */}
         {photoWithoutPosition ? (
            <p className="text-[14px] text-ink-3">
               This photograph carries no position. Phones often strip it when a
               photo is picked from the gallery or shared.
            </p>
         ) : null}
         {photoPlace ? (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[14px]">
               <span className="text-ink-2">
                  The photograph was taken{' '}
                  {where ? away(distanceM(where, photoPlace)) : ''} from your
                  pin.
               </span>
               <button
                  type="button"
                  onClick={() => {
                     setWhere({ ...photoPlace, source: 'photo' });
                     setPhotoPlace(null);
                     setPhotoMoved(false);
                  }}
                  className="g-tracked text-[15px] text-teal-text hover:opacity-80"
               >
                  Use the photograph's place
               </button>
            </div>
         ) : null}
      </div>
   );

   const spotBlock = (
      <SpotRow
         spot={filedUnder}
         spots={spots}
         onFileUnder={(next) => {
            setSpotChoice(next);
            if (next) setSavingSpot(false);
         }}
         adding={savingSpot}
         spotName={spotName}
         onSpotName={setSpotName}
         spotPublic={spotPublic}
         onSpotPublic={setSpotPublic}
         onAdding={setSavingSpot}
         canAdd={Boolean(where)}
      />
   );

   const conditionsBlock = (
      <Conditions
         phase={phase}
         readouts={readouts}
         takenAt={conditions?.at ?? null}
      />
   );

   const measureBlock = (
      <div className="grid grid-cols-2 gap-4 md:gap-6">
         <MeasureField
            id="length"
            label="Length"
            units={['cm', 'in']}
            unit={lengthUnit}
            value={length}
            onChange={setLength}
            onUnitChange={(next) => {
               setLengthUnit(next);
               writeUnits({ length: next as 'cm' | 'in' });
            }}
            placeholder="0"
            sources={[
               { value: 'EYE', label: 'By eye' },
               { value: 'TAPE', label: 'On a tape' },
            ]}
            source={lengthSource}
            onSourceChange={(next) => setLengthSource(next as 'EYE' | 'TAPE')}
         />
         <MeasureField
            id="weight"
            label="Weight"
            units={['kg', 'lb']}
            unit={weightUnit}
            value={weight}
            onChange={setWeight}
            onUnitChange={(next) => {
               setWeightUnit(next);
               writeUnits({ mass: next as 'kg' | 'lb' });
            }}
            placeholder="0.0"
            sources={[
               { value: 'EYE', label: 'By eye' },
               { value: 'SCALE', label: 'On a scale' },
            ]}
            source={weightSource}
            onSourceChange={(next) => setWeightSource(next as 'EYE' | 'SCALE')}
         />
      </div>
   );

   const readScale = async (uploaded: UploadedPhoto) => {
      setScaleRead({ status: 'reading' });
      try {
         const { data } = await axios.post<{
            reading: {
               value: number | null;
               unit: 'cm' | 'in' | 'kg' | 'lb' | null;
               confidence: number;
               note: string;
               seen: 'tape' | 'scale' | 'none';
            } | null;
            proof: string | null;
         }>('/api/vision/read', { imageUrl: uploaded.url, measure: 'WEIGHT' });
         const reading = data.reading;
         if (
            reading &&
            data.proof &&
            typeof reading.value === 'number' &&
            (reading.unit === 'kg' || reading.unit === 'lb')
         ) {
            setScaleRead({
               status: 'read',
               value: reading.value,
               unit: reading.unit,
               confidence: reading.confidence,
               note: reading.note,
               proof: data.proof,
            });
            /* Nothing typed yet: the scale says it. */
            if (!weight.trim()) {
               setWeight(
                  convertTyped(String(reading.value), reading.unit, weightUnit)
               );
            }
            return;
         }
         setScaleRead({
            status: 'unread',
            note: reading?.note ?? '',
         });
      } catch (failure) {
         setScaleRead({
            status:
               axios.isAxiosError(failure) && failure.response?.status === 503
                  ? 'off'
                  : 'failed',
         });
      }
   };

   /* What the scale read, in the angler's unit, and whether it is the weight. */
   const scaleKg =
      scaleRead.status === 'read'
         ? scaleRead.unit === 'lb'
            ? scaleRead.value * 0.45359237
            : scaleRead.value
         : null;
   const typedKg = toMetricValue(weight, weightUnit);
   const scaleMatches =
      scaleKg !== null &&
      typedKg !== null &&
      Math.abs(typedKg - scaleKg) <= Math.max(0.02, scaleKg * 0.02);
   const scaleWords =
      scaleKg !== null
         ? `${convertTyped(String(scaleKg), 'kg', weightUnit)} ${weightUnit}`
         : null;

   const scaleBlock =
      weightSource === 'SCALE' && !competition ? (
         <div className="flex flex-col gap-2">
            <span className="lab">Photo of the scale</span>
            <PhotoBlock
               variant="cell"
               idPrefix="scale-photo"
               initial={scalePhoto}
               onChange={(next) => {
                  setScalePhoto(next);
                  if (next) void readScale(next);
                  else setScaleRead({ status: 'idle' });
               }}
               onBusyChange={setScaleBusy}
               title={phone ? 'Photograph the scale' : 'Choose the scale photo'}
               second={phone ? 'Choose one instead' : ''}
               retake
            />
            <p
               role="status"
               className={cn(
                  'text-[14px]',
                  scaleRead.status === 'read' && scaleMatches
                     ? 'text-teal-text'
                     : 'text-ink-2'
               )}
            >
               {scaleRead.status === 'reading'
                  ? 'Reading the scale.'
                  : scaleRead.status === 'read'
                    ? typedKg === null || scaleMatches
                       ? `The scale reads ${scaleWords}. That is the weight.`
                       : `The scale reads ${scaleWords}, not ${weight.trim()} ${weightUnit}.`
                    : scaleRead.status === 'unread'
                      ? 'No scale reading in that photo. Take it again with the display in the middle, or weigh it by eye.'
                      : scaleRead.status === 'off'
                        ? 'The photo reader is off right now, so this weight is kept as by eye.'
                        : scaleRead.status === 'failed'
                          ? 'The scale could not be read just now. Take it again, or weigh it by eye.'
                          : 'A photo of the scale with the figure showing. It is read to check the weight.'}
            </p>
            {scaleRead.status === 'read' &&
            typedKg !== null &&
            !scaleMatches ? (
               <button
                  type="button"
                  onClick={() =>
                     setWeight(convertTyped(String(scaleKg), 'kg', weightUnit))
                  }
                  className="g-tracked inline-flex min-h-11 items-center self-start text-[16px] text-teal-text hover:opacity-80"
               >
                  Use {scaleWords}
               </button>
            ) : null}
         </div>
      ) : null;

   const keptBlock = (
      <div className="flex flex-col gap-2">
         <span className="lab">Kept or released</span>
         <Segment
            label="Kept or released"
            value={released}
            onChange={setReleased}
            options={[
               { value: 'RELEASED', label: 'Released' },
               { value: 'KEPT', label: 'Kept' },
            ]}
         />
      </div>
   );

   const countBlock = (
      <SmallBox
         id="count"
         label="How many"
         value={countValue}
         onChange={setCountValue}
         inputMode="numeric"
         placeholder="1"
      />
   );

   const depthBlock = (
      <SmallBox
         id="depth"
         label="Depth"
         value={depthValue}
         onChange={setDepthValue}
         unit="m"
         placeholder="0"
      />
   );

   const waterBlock = (
      <SmallBox
         id="water"
         label="Water"
         value={waterTempValue}
         onChange={setWaterTempValue}
         unit="°C"
         placeholder="0"
      />
   );

   const gearBlock = (
      <div className="flex flex-col">
         <GearPicker
            label="Gear"
            gear={rods}
            value={gearIds.filter((id) => rods.some((o) => o.id === id))}
            onChange={(next) =>
               setGearIds((was) => [
                  ...was.filter((id) => baits.some((o) => o.id === id)),
                  ...next,
               ])
            }
            onAdded={(entry) => setGear((list) => [...list, entry])}
         />
         <GearPicker
            label="Bait or lure"
            gear={baits}
            value={gearIds.filter((id) => baits.some((o) => o.id === id))}
            onChange={(next) =>
               setGearIds((was) => [
                  ...was.filter((id) => rods.some((o) => o.id === id)),
                  ...next,
               ])
            }
            onAdded={(entry) => setGear((list) => [...list, entry])}
         />
      </div>
   );

   const notesBlock = (
      <div className="flex flex-col gap-2">
         <label className="lab" htmlFor="notes">
            Notes
         </label>
         <textarea
            id="notes"
            value={notes}
            maxLength={2000}
            placeholder="Anything you want to remember about it."
            onChange={(event) => setNotes(event.target.value)}
            className={cn(
               'w-full resize-none border border-line bg-bg-2 px-3 py-2.5 text-[15px] leading-[1.5] text-ink outline-none placeholder:text-ink-3 focus:border-ink',
               phone ? 'h-[88px]' : 'h-24'
            )}
         />
      </div>
   );

   /* The fold on the phone: the three readings the fast log used to drop. */
   const [moreOpen, setMoreOpen] = useState(() => !phone);
   const moreFold = (
      <div
         className={cn(
            'fold flex flex-col border-t border-line',
            moreOpen && 'fold-open'
         )}
      >
         <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="quicklog-more"
            onClick={() => setMoreOpen((was) => !was)}
            className="flex h-[52px] items-center justify-between gap-3"
         >
            <span className="g text-[22px] leading-[0.95]">More</span>
            <span className="flex items-center gap-3">
               <span className="lab">How many, depth, water</span>
               <ChevronDownIcon
                  aria-hidden="true"
                  strokeWidth={2}
                  className={cn(
                     'size-5 text-ink-2 transition-transform duration-300',
                     moreOpen && 'rotate-180'
                  )}
               />
            </span>
         </button>
         <div
            id="quicklog-more"
            className="fold-body"
            aria-hidden={!moreOpen}
            inert={!moreOpen || undefined}
         >
            <div className="fold-inner min-h-0">
               <div className="grid grid-cols-2 gap-4 pt-1 pb-5">
                  {countBlock}
                  {depthBlock}
                  {waterBlock}
               </div>
            </div>
         </div>
      </div>
   );

   const sharingBlock = (
      <>
         <div className="flex flex-col gap-2">
            <span className="lab">Seen by</span>
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
         <div className="flex flex-col gap-2">
            <span className="lab">Exact spot</span>
            <Segment
               label="Exact spot"
               value={hideLocation ? 'HIDDEN' : 'SHOWN'}
               onChange={(next) => setHideLocation(next === 'HIDDEN')}
               options={[
                  { value: 'SHOWN', label: 'Shown' },
                  { value: 'HIDDEN', label: 'Hidden' },
               ]}
            />
            <p aria-live="polite" className="mt-1 text-[15px] text-ink-2">
               {privacyLine}
            </p>
         </div>
      </>
   );

   /* The card as the feed will publish it, so the two Segments above decide
      something that can be seen. */
   const lengthCm = toMetricValue(length, lengthUnit);
   const weightKg = toMetricValue(weight, weightUnit);
   const previewCard = (
      <div className="flex flex-col gap-2">
         <span className="lab">What will be published</span>
         <PreviewCard
            name={session?.user?.name ?? 'You'}
            handle={session?.user?.username ?? null}
            avatarUrl={avatarUrl}
            photoUrl={photoPreview ?? photo?.url ?? null}
            framing={photo}
            species={
               (typed.trim() ||
                  (chosen && chosen !== NOT_SURE ? chosen : '') ||
                  UNNAMED_TITLE) as string
            }
            size={
               lengthCm !== null
                  ? lengthMetric(lengthCm)
                  : weightKg !== null
                    ? weightMetric(weightKg)
                    : null
            }
            sizeSource={
               lengthCm !== null
                  ? lengthSource === 'TAPE'
                     ? 'On a tape'
                     : 'By eye'
                  : weightKg !== null
                    ? weightSource === 'SCALE'
                       ? 'On a scale'
                       : 'By eye'
                    : null
            }
            caughtLine={`Caught at ${[
               filedUnder?.name,
               dayStamp(stampedAt),
               formatClock(stampedAt),
            ]
               .filter(Boolean)
               .join(', ')}`}
         />
      </div>
   );

   const competitionRow = (
      <CompetitionRow
         competition={competition}
         onChoose={(next) => {
            setCompetition(next);
            setCompetitionEntered(Boolean(next?.youEntered));
            setEntryIssue(null);
            const fish = onlyFish(next);
            if (fish) {
               setChosen(fish);
               setTyped('');
            }
         }}
      />
   );

   const saveWord = isSaving
      ? 'Saving'
      : photoBusy || measureBusy || stripBusy || scaleBusy
        ? 'Sending the photo'
        : competition
          ? competition.checks === 'REVIEW'
             ? 'Submit for review'
             : 'Submit and update standings'
          : 'Save catch';

   const saveButton = (
      <button
         type="button"
         onClick={() => void save()}
         disabled={
            photoBusy || measureBusy || stripBusy || scaleBusy || isSaving
         }
         className={cn(
            'g-tracked flex h-[52px] items-center justify-center bg-teal px-6 text-[22px] text-teal-ink transition-[filter] duration-150 hover:brightness-95 disabled:opacity-60',
            phone ? 'flex-1' : 'w-[280px]'
         )}
      >
         {saveWord}
      </button>
   );

   const saveDraftButton = (className?: string) => (
      <button
         type="button"
         onClick={saveAsDraft}
         className={cn('g-tracked whitespace-nowrap', className)}
      >
         Save draft
      </button>
   );

   const closeButton = (
      <button
         type="button"
         onClick={close}
         aria-label="Close the catch form"
         className={cn(
            'grid shrink-0 place-items-center rounded-full border border-line hover:bg-bg-2',
            phone ? 'size-10' : 'size-11'
         )}
      >
         <XMarkIcon aria-hidden="true" className="size-5" />
      </button>
   );

   /*
    * On a phone the form is three steps, one screen each, in the order the
    * fish comes in. On a desktop everything is on the one card.
    */
   const STEPS = ['The catch', 'Size and gear', 'Sharing'] as const;
   const nextStep = () => {
      setStep((n) => Math.min(3, n + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
   };
   const prevStep = () => {
      setStep((n) => Math.max(1, n - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
   };

   const shell = (children: ReactNode) => (
      <section
         className={cn(
            'mx-auto w-full max-w-[1160px] bg-background transition-[transform,opacity] duration-[460ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)] md:my-8 md:mb-16 md:border md:border-line',
            entered ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
         )}
      >
         {children}
      </section>
   );

   if (phone) {
      return shell(
         <>
            <header className="flex flex-col gap-3 border-b border-line px-4 pt-4 pb-3.5">
               <div className="flex items-center gap-3.5">
                  <h1 className="g text-[30px] leading-[0.95]">Log a catch</h1>
                  {saveDraftButton('ml-auto text-[15px] text-ink-2')}
                  {closeButton}
               </div>
               <ol aria-label="Steps" className="flex gap-1.5">
                  {STEPS.map((title, i) => (
                     <li
                        key={title}
                        aria-current={i + 1 === step ? 'step' : undefined}
                        className={cn(
                           'h-[2px] w-10 transition-colors duration-200',
                           i + 1 === step
                              ? 'bg-teal'
                              : i + 1 < step
                                ? 'bg-ink'
                                : 'bg-line'
                        )}
                     />
                  ))}
               </ol>
            </header>

            <div className="flex flex-col gap-6 px-4 pt-5 pb-6">
               {step === 1 ? (
                  <>
                     {competition ? (
                        <CompetitionBanner competition={competition} />
                     ) : null}
                     {heading('The catch')}
                     {photoSteps}
                     {photoNote && !competition ? (
                        <p className="-mt-3 text-[14px] text-ink-3">
                           {photoNote}
                        </p>
                     ) : null}
                     {photos.length && !competition ? photoStrip : null}
                     {speciesBlock}
                     {caughtAtBlock}
                     {mapBlock}
                     {spotBlock}
                     {conditionsBlock}
                  </>
               ) : step === 2 ? (
                  <>
                     {heading('Size and gear')}
                     {measureBlock}
                     {scaleBlock}
                     {keptBlock}
                     {gearBlock}
                     {notesBlock}
                     {moreFold}
                  </>
               ) : (
                  <>
                     {heading('Sharing')}
                     {previewCard}
                     {sharingBlock}
                     {areaBlock}
                     {competitionRow}
                  </>
               )}
            </div>

            <footer className="sticky bottom-0 z-10 flex gap-2.5 border-t border-line bg-background px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
               {step > 1 ? (
                  <button
                     type="button"
                     onClick={prevStep}
                     className="g-tracked grid h-[52px] w-16 place-items-center border border-ink text-[18px]"
                  >
                     Back
                  </button>
               ) : null}
               {step < 3 ? (
                  <button
                     type="button"
                     onClick={nextStep}
                     className="g-tracked flex h-[52px] flex-1 items-center justify-center bg-ink text-[22px] text-background"
                  >
                     Next
                  </button>
               ) : (
                  saveButton
               )}
            </footer>
         </>
      );
   }

   return shell(
      <>
         <header className="flex items-center gap-5 border-b border-line px-8 py-6">
            <h1 className="g text-[36px] leading-[0.95] whitespace-nowrap">
               Log a catch
            </h1>
            <div className="ml-auto">{closeButton}</div>
         </header>

         {/* The review draws this at 1440, where the right column is 440 and
             the gap 56. Below that both give way rather than squeezing the
             fish into a column too narrow to hold its photograph. */}
         <div className="grid grid-cols-[minmax(0,1fr)_minmax(320px,380px)] items-stretch gap-8 px-8 pt-8 pb-9 xl:grid-cols-[minmax(0,1fr)_440px] xl:gap-14">
            <div className="flex min-w-0 flex-col gap-7">
               {competition ? (
                  <CompetitionBanner competition={competition} />
               ) : null}
               {heading('The catch')}
               {photoSteps}
               {photos.length && !competition ? photoStrip : null}
               {speciesBlock}
               {measureBlock}
               {scaleBlock}
               <div className="grid grid-cols-2 items-end gap-6">
                  {keptBlock}
                  {countBlock}
               </div>
               <div
                  className={cn(
                     'fold flex flex-col gap-5 border-t border-line pt-2',
                     moreOpen && 'fold-open'
                  )}
               >
                  <button
                     type="button"
                     aria-expanded={moreOpen}
                     aria-controls="quicklog-more-desk"
                     onClick={() => setMoreOpen((was) => !was)}
                     className="flex h-11 items-center justify-between gap-3"
                  >
                     <span className="g text-[22px] leading-[0.95]">More</span>
                     <ChevronDownIcon
                        aria-hidden="true"
                        strokeWidth={2}
                        className={cn(
                           'size-5 text-ink-2 transition-transform duration-300',
                           moreOpen && 'rotate-180'
                        )}
                     />
                  </button>
                  <div
                     id="quicklog-more-desk"
                     className="fold-body"
                     aria-hidden={!moreOpen}
                     inert={!moreOpen || undefined}
                  >
                     <div className="fold-inner min-h-0">
                        <div className="grid grid-cols-3 gap-6 pb-1">
                           {depthBlock}
                           {waterBlock}
                           <CompetitionRow
                              layout="cell"
                              competition={competition}
                              onChoose={(next) => {
                                 setCompetition(next);
                                 setCompetitionEntered(
                                    Boolean(next?.youEntered)
                                 );
                                 setEntryIssue(null);
                                 const fish = onlyFish(next);
                                 if (fish) {
                                    setChosen(fish);
                                    setTyped('');
                                 }
                              }}
                           />
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <aside
               className="flex min-w-0 flex-col gap-6"
               aria-label="When, where and who sees it"
            >
               {heading('When and where')}
               {caughtAtBlock}
               {mapBlock}
               {spotBlock}
               {conditionsBlock}
               {heading('Gear and notes', 'mt-3')}
               {gearBlock}
               {notesBlock}
               {heading('Sharing', 'mt-3')}
               {sharingBlock}
               {areaBlock}
            </aside>
         </div>

         <footer className="sticky bottom-0 z-10 flex items-center gap-4 border-t border-line bg-background px-8 py-4">
            {saveDraftButton(
               'ml-auto grid h-[52px] place-items-center border border-ink px-6 text-[18px]'
            )}
            {saveButton}
         </footer>
      </>
   );
}
