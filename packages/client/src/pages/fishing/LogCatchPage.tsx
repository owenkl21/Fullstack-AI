import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { MapLocationPicker } from '@/components/fishing/MapLocationPicker';
import { R2ImagePicker } from '@/components/r2-image-picker';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useDocumentTitle } from '@/lib/title';
import { cn } from '@/lib/utils';
import {
   WEATHER_SOURCE_LINE,
   conditionLines,
   type WeatherSnapshot,
} from '@/lib/weather';
import {
   fetchSpecies,
   matchSpecies,
   speciesChoices,
   type Species,
} from '@/components/fishing/quicklog/species';
import { AddGearInline } from '@/components/fishing/AddGearInline';
import { readPhotoMeta } from '@/lib/exif';
import { distanceM, formatMetres, nearestSpot } from '@/lib/geo';
import { SpeciesGuess } from '@/components/fishing/SpeciesGuess';
import { SpeciesCombobox } from '@/components/fishing/SpeciesCombobox';
import { readDraft, removeDraft, saveDraft } from '@/lib/drafts';
import { useSearchParams } from 'react-router-dom';
import { CompetitionEntry } from '@/components/fishing/CompetitionEntry';
import { entryProblem } from '@/components/fishing/competition-entry';
import type { UploadedPhoto } from '@/components/fishing/quicklog/PhotoBlock';
import {
   submitEntry,
   type Competition,
} from '@/components/social/competitions-api';
import { ChoiceGroup, TextArea, TextField } from '@/components/ui/field';
import { Fold } from '@/components/ui/fold';
import { MeasureField } from '@/components/fishing/quicklog/MeasureField';
import { toMetricValue } from '@/components/fishing/quicklog/measure';

type SiteOption = {
   id: string;
   name: string;
   latitude: number | null;
   longitude: number | null;
};

export type GearOption = {
   id: string;
   name: string;
   brand: string;
   type: string;
   imageUrl: string | null;
};

type UploadedImage = { storageKey: string; url: string };

/* Everything the edit route hands back so the one form can open prefilled. */
export type CatchFormInitial = {
   title: string;
   notes: string | null;
   caughtAt: string;
   siteId: string | null;
   length: number | null;
   weight: number | null;
   count: number | null;
   depth: number | null;
   waterTemp: number | null;
   visibility?: 'PRIVATE' | 'GROUPS' | 'PUBLIC';
   hideLocation?: boolean;
   /* A pin of the catch's own, where it had one. */
   latitude?: number | null;
   longitude?: number | null;
   gearIds: string[];
   gears: GearOption[];
   images: UploadedImage[];
   released?: boolean;
   /*
    * How the two figures were taken, and the competition the catch was entered
    * in. The update route writes back everything the form sends, so a field the
    * edit page does not carry over is a field the save quietly rewrites.
    */
   lengthSource?: 'EYE' | 'TAPE';
   weightSource?: 'EYE' | 'SCALE';
   competitionId?: string | null;
   snapshot: WeatherSnapshot | null;
   weather: string | null;
};

type SpotMode = 'here' | 'saved' | 'new';
type LengthUnit = 'cm' | 'in';
type WeightUnit = 'kg' | 'lb';

const NOTES_LIMIT = 2000;
/*
 * Gear, in the order it is picked up: the rod, the reel, the line, then what
 * goes on the end. A list of twenty items in the order they were added is a
 * list nobody can scan; the same list under seven headings is.
 */
type GearKind =
   | 'ROD'
   | 'REEL'
   | 'LINE'
   | 'HOOK'
   | 'WEIGHTS'
   | 'RIG'
   | 'LURE'
   | 'BAIT';

const GEAR_KINDS: { value: GearKind; word: string; plural: string }[] = [
   { value: 'ROD', word: 'Rod', plural: 'Rods' },
   { value: 'REEL', word: 'Reel', plural: 'Reels' },
   { value: 'LINE', word: 'Line', plural: 'Line' },
   { value: 'HOOK', word: 'Hook', plural: 'Hooks' },
   { value: 'WEIGHTS', word: 'Weights', plural: 'Weights' },
   { value: 'RIG', word: 'Rig', plural: 'Rigs' },
   { value: 'LURE', word: 'Lure', plural: 'Lures' },
   { value: 'BAIT', word: 'Bait', plural: 'Bait' },
];

const TITLE_LIMIT = 120;
const MAX_PHOTOS = 8;

const pad = (value: number) => String(value).padStart(2, '0');

/* datetime-local speaks local time, so the record has to be read in local time too. */
const clock = (date: Date) =>
   date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const toLocalInputValue = (date: Date) =>
   `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const fromLocalInputValue = (value: string) => {
   const trimmed = value.trim();
   if (!trimmed) {
      return null;
   }
   const parsed = new Date(trimmed);
   return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const numberOrNull = (value: string) => {
   const trimmed = value.trim();
   if (!trimmed) {
      return null;
   }
   const parsed = Number(trimmed);
   return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const round = (value: number, places: number) => Number(value.toFixed(places));

const zoneName = () => {
   try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return zone ? (zone.split('/').pop()?.replace(/_/g, ' ') ?? zone) : null;
   } catch {
      return null;
   }
};

const dateSentence = (date: Date) =>
   new Intl.DateTimeFormat('en-ZA', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
   }).format(date);

type FieldErrors = Partial<
   Record<
      | 'species'
      | 'length'
      | 'weight'
      | 'count'
      | 'depth'
      | 'waterTemp'
      | 'caughtAt'
      | 'spot'
      | 'newSpotName',
      string
   >
>;

/* ------------------------------------------------------------------ */

/*
 * A numbered heading. Four steps down the left of the page tell an angler
 * how much form there is before they start, which is the difference between
 * a form and a chore.
 */
function GroupHeading({ step, children }: { step?: number; children: string }) {
   return (
      <h2 className="flex items-baseline gap-3">
         {step ? (
            <span className="g num text-[22px] text-teal-text md:text-[26px]">
               {String(step).padStart(2, '0')}
            </span>
         ) : null}
         <span className="g text-[30px] md:text-[36px]">{children}</span>
      </h2>
   );
}

function FieldError({ id, message }: { id: string; message?: string }) {
   if (!message) {
      return null;
   }
   return (
      <p id={id} role="alert" className="mt-2 text-[14px] text-destructive">
         {message}
      </p>
   );
}

/* ------------------------------------------------------------------ */

export function CatchForm({
   mode,
   catchId,
   initial,
   draftId = null,
}: {
   mode: 'create' | 'edit';
   catchId?: string;
   initial?: CatchFormInitial;
   /* The draft this form was opened from, forgotten once the catch saves. */
   draftId?: string | null;
}) {
   const navigate = useNavigate();
   const isEdit = mode === 'edit';

   const [species, setSpecies] = useState(initial?.title ?? '');
   const [recentSpecies, setRecentSpecies] = useState<string[]>([]);
   const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>(
      initial?.visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC'
   );
   const [hideLocation, setHideLocation] = useState(
      initial?.hideLocation ?? false
   );
   const [speciesList, setSpeciesList] = useState<Species[]>([]);

   const [lengthValue, setLengthValue] = useState(
      initial?.length != null ? String(initial.length) : ''
   );
   const [lengthUnit, setLengthUnit] = useState<LengthUnit>('cm');
   const [weightValue, setWeightValue] = useState(
      initial?.weight != null ? String(initial.weight) : ''
   );
   const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');

   const [countValue, setCountValue] = useState(String(initial?.count ?? 1));
   const [depthValue, setDepthValue] = useState(
      initial?.depth != null ? String(initial.depth) : ''
   );
   const [waterTempValue, setWaterTempValue] = useState(
      initial?.waterTemp != null ? String(initial.waterTemp) : ''
   );
   const [images, setImages] = useState<UploadedImage[]>(
      isEdit ? [] : (initial?.images ?? [])
   );
   const [isPhotoUploading, setIsPhotoUploading] = useState(false);

   const [sites, setSites] = useState<SiteOption[]>([]);
   const startsWithPin =
      typeof initial?.latitude === 'number' &&
      typeof initial?.longitude === 'number';
   const [spotMode, setSpotMode] = useState<SpotMode>(
      initial?.siteId ? 'saved' : startsWithPin ? 'new' : 'here'
   );
   /*
    * Whether the angler has answered the where question themselves, by
    * picking a saved spot or putting a pin down by hand. A photograph's own
    * position beats the phone's fix, which only says where the phone is now,
    * but it never overrules an answer.
    */
   const spotChosen = useRef(Boolean(initial?.siteId) || startsWithPin);
   /* A line under the map saying why the pin moved to the photograph. */
   const [photoNote, setPhotoNote] = useState<string | null>(null);
   /* Named under the map, the way the record names every other source. */
   const [positionFromPhoto, setPositionFromPhoto] = useState(false);
   const [savedSiteId, setSavedSiteId] = useState(initial?.siteId ?? '');
   const [siteSearch, setSiteSearch] = useState('');
   const [newSpotName, setNewSpotName] = useState('');
   /* A catch that carried its own pin opens with that pin already placed. */
   const [newLatitude, setNewLatitude] = useState(
      startsWithPin ? String(initial?.latitude) : ''
   );
   const [newLongitude, setNewLongitude] = useState(
      startsWithPin ? String(initial?.longitude) : ''
   );
   const [herePosition, setHerePosition] = useState<{
      latitude: number;
      longitude: number;
   } | null>(null);
   const [hereState, setHereState] = useState<
      'idle' | 'locating' | 'ready' | 'refused'
   >('idle');

   const [caughtAt, setCaughtAt] = useState(() =>
      initial?.caughtAt
         ? toLocalInputValue(new Date(initial.caughtAt))
         : toLocalInputValue(new Date())
   );

   /*
    * When the photographs were taken. A log of several fish is usually
    * several photographs, and the camera wrote the moment of each shutter
    * into the file. The earliest fills in the time, unless the angler has
    * already typed one, and the span between first and last is kept on the
    * record as the stretch the fish came in over.
    */
   /*
    * A catch entered in a competition. The figure the competition judges
    * is read off a photograph of the fish on a tape or a scale, and what
    * was read is what is saved, so nobody has to take anyone's word.
    */
   const [lengthSource, setLengthSource] = useState<'EYE' | 'TAPE'>(
      initial?.lengthSource ?? 'EYE'
   );
   const [weightSource, setWeightSource] = useState<'EYE' | 'SCALE'>(
      initial?.weightSource ?? 'EYE'
   );
   const [competitionId, setCompetitionId] = useState<string | null>(
      initial?.competitionId ?? null
   );
   const [released, setReleased] = useState<'KEPT' | 'RELEASED'>(
      initial?.released ? 'RELEASED' : 'KEPT'
   );
   /*
    * Entering it in a competition. The competition itself, the photograph of
    * the fish on the tape or scale, and the sentence about the area. The
    * entry is written after the catch is, and the checks run on the server.
    */
   const [competition, setCompetition] = useState<Competition | null>(null);
   const [measurePhoto, setMeasurePhoto] = useState<UploadedPhoto | null>(null);
   const [measureBusy, setMeasureBusy] = useState(false);
   const [areaConfirmed, setAreaConfirmed] = useState(false);
   const [entryIssue, setEntryIssue] = useState<string | null>(null);
   const [photoTimes, setPhotoTimes] = useState<Date[]>([]);
   const caughtAtEdited = useRef(isEdit);
   const photoSpan = useMemo(() => {
      if (photoTimes.length < 2) return null;
      const sorted = [...photoTimes].sort((a, b) => a.getTime() - b.getTime());
      const from = sorted[0]!;
      const to = sorted[sorted.length - 1]!;
      return to.getTime() - from.getTime() > 60_000 ? { from, to } : null;
   }, [photoTimes]);
   const onPhotoFiles = (files: File[]) => {
      void Promise.all(files.map((file) => readPhotoMeta(file))).then(
         (found) => {
            const times = found
               .map((meta) => meta.takenAt)
               .filter((t): t is Date => t !== null);
            if (times.length) {
               setPhotoTimes((was) => [...was, ...times]);
               if (!caughtAtEdited.current) {
                  const earliest = [...times, ...photoTimes].sort(
                     (a, b) => a.getTime() - b.getTime()
                  )[0]!;
                  setCaughtAt(toLocalInputValue(earliest));
               }
            }

            /*
             * And where it was taken. The camera wrote the position beside the
             * time and this form read past it, so a picture that knew the
             * gully it came out of still left the map empty. It fills a blank
             * only: a saved spot or a pin the angler put down themselves is
             * their answer to the question and stands.
             */
            const placed = found.find(
               (meta) => meta.latitude !== null && meta.longitude !== null
            );
            if (spotChosen.current) return;
            if (!placed) {
               if (files.length && spotMode !== 'saved') {
                  setPhotoNote(
                     'The photograph carries no position, so the pin stays where it is. Phones often strip it from a shared or edited picture.'
                  );
               }
               return;
            }
            const photoAt = {
               latitude: placed.latitude!,
               longitude: placed.longitude!,
            };
            /* The phone's fix only says where the phone is now. */
            const phoneAt = spotMode === 'here' ? herePosition : null;
            setSpotMode('new');
            setNewLatitude(photoAt.latitude.toFixed(6));
            setNewLongitude(photoAt.longitude.toFixed(6));
            setPositionFromPhoto(true);
            setPhotoNote(
               phoneAt
                  ? `The pin is on the photograph's own place, ${formatMetres(distanceM(phoneAt, photoAt))} from where your phone is now. Drag it if that is not where the fish came out.`
                  : "The pin is on the photograph's own place. Drag it if that is not where the fish came out."
            );
            setErrors((current) => ({ ...current, spot: undefined }));
         }
      );
   };

   const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(
      initial?.snapshot ?? null
   );
   const [conditionsState, setConditionsState] = useState<
      'idle' | 'loading' | 'failed'
   >('idle');
   const [isConfirmingRefresh, setIsConfirmingRefresh] = useState(false);

   const [gear, setGear] = useState<GearOption[]>(initial?.gears ?? []);
   const [gearSearch, setGearSearch] = useState('');
   const [gearKind, setGearKind] = useState<GearKind | 'ANY'>('ANY');
   const [selectedGearIds, setSelectedGearIds] = useState<string[]>(
      initial?.gearIds ?? []
   );

   const [notes, setNotes] = useState(initial?.notes ?? '');

   const [errors, setErrors] = useState<FieldErrors>({});
   const [isSaving, setIsSaving] = useState(false);
   const [sitesState, setSitesState] = useState<'loading' | 'ready' | 'failed'>(
      'loading'
   );
   const [gearState, setGearState] = useState<'loading' | 'ready' | 'failed'>(
      'loading'
   );
   const [conditionsMessage, setConditionsMessage] = useState<string | null>(
      null
   );

   const weatherRequestRef = useRef(0);

   /* --- options ---------------------------------------------------- */

   /* Spots, gear and recent names are asked for separately, so one failing
      does not empty the other two and blame the wrong thing. */
   const loadOptions = useCallback(async () => {
      const [siteResult, gearResult, catchResult] = await Promise.allSettled([
         axios.get('/api/sites'),
         axios.get('/api/gear/me'),
         axios.get('/api/catches/me'),
      ]);

      if (siteResult.status === 'fulfilled') {
         setSites(siteResult.value.data.sites ?? []);
         setSitesState('ready');
      } else {
         console.error('Unable to read your spots', siteResult.reason);
         setSitesState('failed');
      }

      if (gearResult.status === 'fulfilled') {
         const own: GearOption[] = gearResult.value.data.gear ?? [];
         // Gear already on this catch stays in the list so editing never drops it.
         const attached = (initial?.gears ?? []).filter(
            (entry) => !own.some((item) => item.id === entry.id)
         );
         setGear([...own, ...attached]);
         setGearState('ready');
      } else {
         console.error('Unable to read your gear', gearResult.reason);
         setGearState('failed');
      }

      if (catchResult.status === 'fulfilled') {
         /*
          * Real species, not the titles of previous catches. A title is whatever
          * somebody typed; offering those as species meant a catch saved from
          * this form carried no species and could never be scored.
          */
         try {
            const all = await fetchSpecies();
            setSpeciesList(all);
            setRecentSpecies(
               speciesChoices(catchResult.value.data.catches ?? [], all, 6)
            );
         } catch {
            setRecentSpecies([]);
         }
      }
   }, [initial?.gears]);

   /*
    * A piece added here joins the list and is ticked straight away: it was
    * added because it caught this fish.
    */
   const addGear = (entry: GearOption) => {
      setGear((current) =>
         current.some((g) => g.id === entry.id) ? current : [entry, ...current]
      );
      setSelectedGearIds((current) =>
         current.includes(entry.id) ? current : [...current, entry.id]
      );
      setGearSearch('');
   };

   const retryOptions = () => {
      setSitesState('loading');
      setGearState('loading');
      void loadOptions();
   };

   useEffect(() => {
      void loadOptions();
   }, [loadOptions]);

   useEffect(() => {
      if (isEdit) {
         setGear((current) => {
            const attached = (initial?.gears ?? []).filter(
               (entry) => !current.some((item) => item.id === entry.id)
            );
            return attached.length > 0 ? [...current, ...attached] : current;
         });
      }
   }, [initial?.gears, isEdit]);

   /* --- where ------------------------------------------------------ */

   const askForPosition = useCallback(() => {
      if (!navigator.geolocation) {
         setHereState('refused');
         return;
      }

      setHereState('locating');
      navigator.geolocation.getCurrentPosition(
         (position) => {
            setHerePosition({
               latitude: position.coords.latitude,
               longitude: position.coords.longitude,
            });
            setHereState('ready');
         },
         () => {
            setHerePosition(null);
            setHereState('refused');
         },
         { enableHighAccuracy: true, timeout: 12000 }
      );
   }, []);

   /*
    * The form opens on "the spot I am at", so the fix is asked for at once
    * and the map is on screen with the pin on it, rather than waiting for a
    * tap on a button that says what is already chosen.
    */
   useEffect(() => {
      if (!isEdit && spotMode === 'here' && hereState === 'idle') {
         askForPosition();
      }
   }, [isEdit, spotMode, hereState, askForPosition]);

   const chooseSpotMode = (next: SpotMode) => {
      /* Picking a saved spot is an answer; "the spot I am at" and "a new
       * spot" only say where the answer will come from. */
      spotChosen.current = next === 'saved';
      setPhotoNote(null);
      setSpotMode(next);
      setErrors((current) => ({ ...current, spot: undefined }));
      // The position is only ever asked for when this is the choice made.
      if (next === 'here' && hereState === 'idle') {
         askForPosition();
      }
   };

   /* The picker only calls this for a drag, a tap, a search or Locate, so it
    * is always the angler's own hand on the pin. */
   const setNewCoordinates = useCallback(
      (latitude: number, longitude: number) => {
         spotChosen.current = true;
         setPositionFromPhoto(false);
         setPhotoNote(null);
         setNewLatitude(latitude.toFixed(6));
         setNewLongitude(longitude.toFixed(6));
         setErrors((current) => ({ ...current, spot: undefined }));
      },
      []
   );

   const selectedSite = useMemo(
      () => sites.find((site) => site.id === savedSiteId) ?? null,
      [sites, savedSiteId]
   );

   const activeCoordinates = useMemo(() => {
      if (spotMode === 'here') {
         return herePosition;
      }

      if (spotMode === 'saved') {
         if (
            selectedSite &&
            typeof selectedSite.latitude === 'number' &&
            typeof selectedSite.longitude === 'number'
         ) {
            return {
               latitude: selectedSite.latitude,
               longitude: selectedSite.longitude,
            };
         }
         return null;
      }

      const latitude = numberOrNull(newLatitude);
      const longitude = numberOrNull(newLongitude);
      if (
         latitude === null ||
         longitude === null ||
         Number.isNaN(latitude) ||
         Number.isNaN(longitude)
      ) {
         return null;
      }
      return { latitude, longitude };
   }, [spotMode, herePosition, selectedSite, newLatitude, newLongitude]);

   /*
    * A position on top of a spot you already have is that spot. Offered, not
    * forced: the same beach can be two spots to the angler who fishes it.
    */
   const nearSaved = useMemo(
      () =>
         spotMode === 'saved' ? null : nearestSpot(sites, activeCoordinates),
      [spotMode, sites, activeCoordinates]
   );

   const spotLabel = useMemo(() => {
      if (spotMode === 'saved') {
         return selectedSite?.name ?? 'the spot you picked';
      }
      if (spotMode === 'new') {
         return newSpotName.trim() || 'the pin you dropped';
      }
      return 'your position';
   }, [spotMode, selectedSite, newSpotName]);

   const filteredSites = useMemo(() => {
      const term = siteSearch.trim().toLowerCase();
      if (!term) {
         return sites;
      }
      return sites.filter((site) => site.name.toLowerCase().includes(term));
   }, [sites, siteSearch]);

   /* --- conditions ------------------------------------------------- */

   /* Read inside fetchConditions without making it a new function on every
    * keystroke in the date field, which would restart the debounce. */
   const caughtAtRef = useRef(caughtAt);
   useEffect(() => {
      caughtAtRef.current = caughtAt;
   }, [caughtAt]);

   const fetchConditions = useCallback(
      async (
         coordinates: { latitude: number; longitude: number },
         announce: boolean
      ) => {
         const ticket = weatherRequestRef.current + 1;
         weatherRequestRef.current = ticket;
         setConditionsState('loading');
         setConditionsMessage(null);

         try {
            /*
             * For the hour it was caught. A fish logged that evening from the
             * couch, or a week later from a photograph, wants the weather it
             * was caught in, and the client can read that back for weeks.
             */
            const at = fromLocalInputValue(caughtAtRef.current);
            const { data } = await axios.get('/api/weather/current', {
               params: {
                  ...coordinates,
                  ...(at ? { at: at.toISOString() } : {}),
               },
            });

            // A reading that arrived after a newer one was asked for is dropped.
            if (weatherRequestRef.current !== ticket) {
               return;
            }

            const next: WeatherSnapshot | null = data.weather ?? null;

            if (!next) {
               // The lookup answers 200 with nothing when it fails upstream, so the
               // stored reading is kept rather than wiped and called a success.
               setConditionsState('failed');
               setConditionsMessage(
                  'The reading did not come back. What is here is what was stored.'
               );
               return;
            }

            setSnapshot(next);
            setConditionsState('idle');
            if (announce) {
               toast({ title: 'Conditions replaced.', variant: 'success' });
            }
         } catch (error) {
            if (weatherRequestRef.current !== ticket) {
               return;
            }
            console.error('Unable to read conditions', error);
            setConditionsState('failed');
            setConditionsMessage(
               'The reading did not come back. What is here is what was stored.'
            );
         }
      },
      []
   );

   /*
    * A new catch reads the conditions on its own once a position settles. An edit
    * keeps what was stored until the angler asks for a fresh reading.
    */
   useEffect(() => {
      if (isEdit || !activeCoordinates) {
         return;
      }

      const timer = window.setTimeout(() => {
         void fetchConditions(activeCoordinates, false);
      }, 400);

      return () => window.clearTimeout(timer);
      /* caughtAt is in the list on purpose: moving the time to last night has
       * to fetch last night's weather. */
   }, [isEdit, activeCoordinates, fetchConditions, caughtAt]);

   const refreshConditions = () => {
      setIsConfirmingRefresh(false);
      if (!activeCoordinates) {
         setConditionsState('failed');
         setConditionsMessage(
            'There is no position to read from. Pick a spot with a position first.'
         );
         return;
      }
      void fetchConditions(activeCoordinates, true);
   };

   const lines = useMemo(() => conditionLines(snapshot), [snapshot]);

   /* --- measurements ----------------------------------------------- */

   /*
    * The figure is kept in centimetres and kilograms whatever the angler
    * types in; MeasureField converts what is already typed when the unit
    * changes, so the arithmetic lives in one place for both log forms.
    */
   const lengthInCm = () => toMetricValue(lengthValue, lengthUnit);
   const weightInKg = () => toMetricValue(weightValue, weightUnit);

   /* --- validation -------------------------------------------------- */

   const validateField = (field: keyof FieldErrors): string | undefined => {
      switch (field) {
         case 'species': {
            const trimmed = species.trim();
            if (trimmed.length < 2) {
               return 'Name the fish, at least two letters. Write Not sure if you do not know.';
            }
            if (trimmed.length > TITLE_LIMIT) {
               return `Keep this under ${TITLE_LIMIT} characters.`;
            }
            return undefined;
         }
         case 'length': {
            const raw = numberOrNull(lengthValue);
            if (raw === null) return undefined;
            if (Number.isNaN(raw)) return 'Use numbers only, like 44 or 44.5.';
            if (raw < 0) return 'A length cannot be negative.';
            if (raw === 0)
               return 'Leave this empty if the fish was not measured.';
            return undefined;
         }
         case 'weight': {
            const raw = numberOrNull(weightValue);
            if (raw === null) return undefined;
            if (Number.isNaN(raw)) return 'Use numbers only, like 1.9.';
            if (raw < 0) return 'A weight cannot be negative.';
            if (raw === 0)
               return 'Leave this empty if the fish was not weighed.';
            return undefined;
         }
         case 'count': {
            const raw = numberOrNull(countValue);
            if (raw === null) return undefined;
            if (Number.isNaN(raw) || !Number.isInteger(raw))
               return 'Use a whole number of fish.';
            if (raw < 1) return 'One fish is the smallest a catch can be.';
            if (raw > 999) return 'That is more fish than this can hold.';
            return undefined;
         }
         case 'depth': {
            const raw = numberOrNull(depthValue);
            if (raw === null) return undefined;
            if (Number.isNaN(raw)) return 'Use numbers only, like 6.5.';
            if (raw < 0) return 'A depth cannot be negative.';
            return undefined;
         }
         case 'waterTemp': {
            const raw = numberOrNull(waterTempValue);
            if (raw === null) return undefined;
            if (Number.isNaN(raw)) return 'Use numbers only, like 16.';
            return undefined;
         }
         case 'caughtAt': {
            const parsed = fromLocalInputValue(caughtAt);
            if (!parsed) return 'Pick the date and time the fish came out.';
            return undefined;
         }
         case 'newSpotName': {
            if (spotMode !== 'new') return undefined;
            /* Blank is allowed: then only this catch keeps the pin and no
             * spot is made. A name that is there has to be a name. */
            const name = newSpotName.trim();
            if (name.length > 0 && name.length < 2)
               return 'Give the spot a name, at least two letters.';
            return undefined;
         }
         case 'spot': {
            if (spotMode === 'saved' && !savedSiteId) {
               return 'Pick a spot from the list.';
            }
            if (spotMode !== 'new') return undefined;
            if (!activeCoordinates)
               return 'Drop a pin on the map so the spot has a position.';
            return undefined;
         }
         default:
            return undefined;
      }
   };

   const markTouched = (field: keyof FieldErrors) => {
      setErrors((current) => ({ ...current, [field]: validateField(field) }));
   };

   /* --- save -------------------------------------------------------- */

   const buildPayload = (siteId: string | null) => {
      const parsedCaughtAt = fromLocalInputValue(caughtAt);
      const trimmedNotes = notes.trim();
      const count = numberOrNull(countValue);
      const depth = numberOrNull(depthValue);
      const waterTemp = numberOrNull(waterTempValue);
      const length = lengthInCm();
      const weight = weightInKg();
      const sky = snapshot?.weatherCondition?.description?.text?.trim();

      return {
         title: species.trim(),
         caughtAt: parsedCaughtAt ? parsedCaughtAt.toISOString() : '',
         /* A competition entry's figure came off the tape or the scale. */
         lengthSource:
            competition?.measure === 'LENGTH' ? 'TAPE' : lengthSource,
         weightSource:
            competition?.measure === 'WEIGHT' ? 'SCALE' : weightSource,
         competitionId: competitionId ?? null,
         caughtUntil:
            Number(countValue) > 1 && photoSpan
               ? photoSpan.to.toISOString()
               : null,
         notes: trimmedNotes ? trimmedNotes.slice(0, NOTES_LIMIT) : null,
         siteId,
         /* Null where the name is not one we publish figures for. The catch
          * still saves; it just cannot be ranked, and the profile says so. */
         speciesId: matchSpecies(species, speciesList)?.id ?? null,
         /*
          * Where exactly. Kept on the catch when the position is the device's
          * or a dropped pin; left null when it is simply the saved spot's, so
          * the spot stays the one place that position lives.
          */
         latitude:
            spotMode !== 'saved' ? (activeCoordinates?.latitude ?? null) : null,
         longitude:
            spotMode !== 'saved'
               ? (activeCoordinates?.longitude ?? null)
               : null,
         visibility,
         /* Only meaningful on a catch anyone else can see. */
         hideLocation: visibility === 'PUBLIC' ? hideLocation : false,
         weather: sky ? sky.slice(0, 280) : null,
         weatherSnapshot: snapshot,
         length: length === null || Number.isNaN(length) ? null : length,
         weight: weight === null || Number.isNaN(weight) ? null : weight,
         // Always sent: the update path writes the whole record, so a field the
         // form does not send comes back as the server's default, not as it was.
         count: count === null || Number.isNaN(count) ? 1 : count,
         depth: depth === null || Number.isNaN(depth) ? null : depth,
         // TODO(api): appendix E item 11. The write path accepts waterTemp and
         // then stores null for it, so this reading cannot be kept yet.
         waterTemp:
            waterTemp === null || Number.isNaN(waterTemp) ? null : waterTemp,
         gearIds: selectedGearIds,
         released: released === 'RELEASED',
      };
   };

   const saveAsDraft = () => {
      saveDraft(
         'full',
         species.trim() || 'Catch',
         {
            title: species,
            notes,
            caughtAt,
            siteId: spotMode === 'saved' ? savedSiteId || null : null,
            latitude:
               spotMode === 'here'
                  ? (herePosition?.latitude ?? null)
                  : spotMode === 'new'
                    ? numberOrNull(newLatitude)
                    : null,
            longitude:
               spotMode === 'here'
                  ? (herePosition?.longitude ?? null)
                  : spotMode === 'new'
                    ? numberOrNull(newLongitude)
                    : null,
            length: lengthInCm(),
            weight: weightInKg(),
            count: numberOrNull(countValue),
            depth: numberOrNull(depthValue),
            waterTemp: numberOrNull(waterTempValue),
            visibility,
            hideLocation,
            gearIds: selectedGearIds,
            gears: gear.filter((entry) => selectedGearIds.includes(entry.id)),
            images,
            released: released === 'RELEASED',
            lengthSource,
            weightSource,
            competitionId,
         },
         draftId
      );
      toast({ title: 'Draft kept', description: 'Find it under My catches.' });
      navigate('/catches/me');
   };

   const successSentence = (payload: ReturnType<typeof buildPayload>) => {
      const parts = [payload.title];
      if (payload.length !== null) {
         parts.push(`${round(payload.length, 1)} cm`);
      }
      const when = fromLocalInputValue(caughtAt);
      if (when) {
         parts.push(dateSentence(when));
      }
      if (spotMode === 'saved' && selectedSite) {
         parts.push(selectedSite.name);
      }
      if (spotMode === 'new' && newSpotName.trim()) {
         parts.push(newSpotName.trim());
      }
      return `${parts.join(', ')}.`;
   };

   const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isSaving || isPhotoUploading || measureBusy) {
         return;
      }

      const fields: (keyof FieldErrors)[] = [
         'species',
         'length',
         'weight',
         'count',
         'depth',
         'waterTemp',
         'caughtAt',
         'newSpotName',
         'spot',
      ];
      const found: FieldErrors = {};
      for (const field of fields) {
         const message = validateField(field);
         if (message) {
            found[field] = message;
         }
      }
      setErrors(found);

      const firstBroken = fields.find((field) => found[field]);
      if (firstBroken) {
         document
            .querySelector<HTMLElement>(`[data-field="${firstBroken}"]`)
            ?.focus();
         return;
      }

      // Set before the spot is created, so a second tap cannot make a second spot.
      setIsSaving(true);

      try {
         let siteId: string | null =
            spotMode === 'saved' ? savedSiteId || null : null;

         if (spotMode === 'new' && activeCoordinates && newSpotName.trim()) {
            const { data } = await axios.post('/api/sites', {
               name: newSpotName.trim(),
               latitude: activeCoordinates.latitude,
               longitude: activeCoordinates.longitude,
               description: null,
               waterType: null,
               accessNotes: null,
               images: [],
            });
            siteId = data.site.id;
         }

         const payload = buildPayload(siteId);

         if (isEdit && catchId) {
            // TODO(api): appendix E item 1. The update route takes the whole record,
            // not a patch, so every field the form holds is sent back with it.
            // TODO(api): appendix E item 6. It takes no images, so photos on an
            // existing catch cannot be changed here yet.
            await axios.put(`/api/catches/${catchId}`, payload);
            toast({
               title: 'Catch saved.',
               description: successSentence(payload),
               variant: 'success',
            });
            if (draftId) removeDraft(draftId);
            navigate(`/catches/${catchId}`, { replace: true });
            return;
         }

         /* What the competition judges, metric, and whether it can be entered. */
         const declaredValue = !competition
            ? null
            : competition.rule === 'SPECIES_VARIETY'
              ? null
              : competition.measure === 'LENGTH'
                ? lengthInCm()
                : weightInKg();
         if (competition && competitionId) {
            const problem = entryProblem(
               competition,
               measurePhoto,
               areaConfirmed,
               declaredValue
            );
            setEntryIssue(problem);
            if (problem) {
               toast({
                  title: 'Not entered yet.',
                  description: problem,
                  variant: 'error',
               });
               return;
            }
         }

         const { data } = await axios.post('/api/catches', {
            ...payload,
            images,
         });

         if (competition && competitionId) {
            /* The catch is in; now the entry, and the competition's page. */
            try {
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
                  photoTakenAt: photoTimes[0]?.toISOString() ?? null,
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
            title: 'Catch saved.',
            description: successSentence(payload),
            variant: 'success',
         });
         navigate(`/catches/${data.catch.id}`, { replace: true });
      } catch (error) {
         console.error('Unable to save the catch', error);
         const message =
            axios.isAxiosError(error) &&
            typeof error.response?.data?.message === 'string'
               ? error.response.data.message
               : 'Nothing was saved. Check the fields above and try again.';
         toast({ title: 'Not saved', description: message, variant: 'error' });
      } finally {
         setIsSaving(false);
      }
   };

   /* --- gear -------------------------------------------------------- */

   const filteredGear = useMemo(() => {
      const term = gearSearch.trim().toLowerCase();
      if (!term) {
         return gear;
      }
      return gear.filter((entry) =>
         [entry.name, entry.brand, entry.type]
            .join(' ')
            .toLowerCase()
            .includes(term)
      );
   }, [gear, gearSearch]);

   const toggleGear = (gearId: string) => {
      setSelectedGearIds((previous) =>
         previous.includes(gearId)
            ? previous.filter((id) => id !== gearId)
            : [...previous, gearId]
      );
   };

   /* --- render ------------------------------------------------------ */

   const zone = zoneName();
   const caughtAtDate = fromLocalInputValue(caughtAt);
   const isBusy = isSaving || isPhotoUploading || measureBusy;
   /*
    * The first photograph, whether it went up in this sitting or came back
    * with the catch. An edit cannot change photos yet, so the ones already on
    * the record are the ones the namer and the competition reader work from.
    */
   const firstPhoto = (isEdit ? initial?.images : images)?.[0]?.url ?? null;

   return (
      <form
         onSubmit={onSubmit}
         noValidate
         className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-x-14"
      >
         <div className="flex min-w-0 flex-col gap-12">
            {/* ---------------- The fish ---------------- */}
            <section className="flex flex-col gap-6">
               <GroupHeading step={1}>The fish</GroupHeading>

               {isEdit ? (
                  <div className="flex flex-col gap-3">
                     <span className="lab">Photos</span>
                     {initial?.images.length ? (
                        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                           {initial.images.map((image, index) => (
                              <li
                                 key={image.storageKey}
                                 className="aspect-[4/3] bg-bg-2"
                              >
                                 <img
                                    src={image.url}
                                    alt={`Photo ${index + 1}`}
                                    width={400}
                                    height={300}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                 />
                              </li>
                           ))}
                        </ul>
                     ) : (
                        <p className="text-ink-2">No photos on this catch.</p>
                     )}
                     <p className="text-[14px] text-ink-3">
                        Photos cannot be changed here yet.
                     </p>
                  </div>
               ) : (
                  <R2ImagePicker
                     scope="catch"
                     label="Photos of the catch"
                     maxItems={MAX_PHOTOS}
                     value={images}
                     onChange={setImages}
                     onFiles={onPhotoFiles}
                     disabled={isSaving}
                     onUploadingChange={setIsPhotoUploading}
                  />
               )}

               <SpeciesGuess
                  imageUrl={firstPhoto}
                  current={species}
                  onPick={(candidate) => {
                     if (candidate) {
                        setSpecies(candidate.commonName);

                        setErrors((current) => ({
                           ...current,
                           species: undefined,
                        }));
                     }
                  }}
                  onCreated={(made) =>
                     setSpeciesList((list) => [...list, made])
                  }
               />

               <div data-field="species">
                  <SpeciesCombobox
                     value={species}
                     species={speciesList}
                     recent={recentSpecies}
                     error={errors.species}
                     onChange={(name) => {
                        setSpecies(name);
                        setErrors((current) => ({
                           ...current,
                           species: undefined,
                        }));
                     }}
                     onCreated={(made) =>
                        setSpeciesList((list) => [...list, made])
                     }
                  />
               </div>

               <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <MeasureField
                     id="length"
                     label="Length"
                     fieldName="length"
                     sources={[
                        { value: 'EYE', label: 'By eye' },
                        { value: 'TAPE', label: 'On a tape' },
                     ]}
                     source={lengthSource}
                     onSourceChange={(next) =>
                        setLengthSource(next as 'EYE' | 'TAPE')
                     }
                     value={lengthValue}
                     error={errors.length}
                     unit={lengthUnit}
                     units={['cm', 'in'] as const}
                     onChange={setLengthValue}
                     onBlur={() => markTouched('length')}
                     onUnitChange={(next) => setLengthUnit(next as LengthUnit)}
                  />
                  <MeasureField
                     id="weight"
                     label="Weight"
                     fieldName="weight"
                     sources={[
                        { value: 'EYE', label: 'By eye' },
                        { value: 'SCALE', label: 'On a scale' },
                     ]}
                     source={weightSource}
                     onSourceChange={(next) =>
                        setWeightSource(next as 'EYE' | 'SCALE')
                     }
                     value={weightValue}
                     error={errors.weight}
                     unit={weightUnit}
                     units={['kg', 'lb'] as const}
                     onChange={setWeightValue}
                     onBlur={() => markTouched('weight')}
                     onUnitChange={(next) => setWeightUnit(next as WeightUnit)}
                  />
               </div>

               <ChoiceGroup
                  inline
                  label="Kept or released"
                  value={released}
                  onChange={setReleased}
                  options={[
                     { value: 'KEPT', label: 'Kept' },
                     { value: 'RELEASED', label: 'Released' },
                  ]}
               />

               <TextField
                  label="How many"
                  data-field="count"
                  inputMode="numeric"
                  autoComplete="off"
                  numeric
                  className="max-w-[200px]"
                  hint={undefined}
                  value={countValue}
                  error={errors.count}
                  onChange={(event) => setCountValue(event.target.value)}
                  onBlur={() => markTouched('count')}
               />

               {/*
                * The two readings an angler takes only when they have the
                * kit for it. Behind a fold so the first screen of the form
                * is the fish, not the instrumentation.
                */}
               <Fold
                  title="More"
                  headingClassName="text-[22px] md:text-[26px]"
                  open={initial?.depth != null || initial?.waterTemp != null}
               >
                  <div className="grid grid-cols-1 gap-5 pt-4 sm:grid-cols-2">
                     <TextField
                        label="Depth in metres"
                        data-field="depth"
                        inputMode="decimal"
                        autoComplete="off"
                        numeric
                        value={depthValue}
                        error={errors.depth}
                        onChange={(event) => setDepthValue(event.target.value)}
                        onBlur={() => markTouched('depth')}
                        placeholder="6.5"
                     />
                     <TextField
                        label="Water temperature in °C"
                        data-field="waterTemp"
                        inputMode="decimal"
                        autoComplete="off"
                        numeric
                        value={waterTempValue}
                        error={errors.waterTemp}
                        hint="Blank keeps the sea model's reading."
                        onChange={(event) =>
                           setWaterTempValue(event.target.value)
                        }
                        onBlur={() => markTouched('waterTemp')}
                        placeholder="16"
                     />
                  </div>
               </Fold>

               {/*
                * Last in the section, because it opens into a panel of its
                * own: anything under it would read as its contents.
                */}
               {!isEdit ? (
                  <CompetitionEntry
                     competitionId={competitionId}
                     onCompetition={(id, chosen) => {
                        setCompetitionId(id);
                        setCompetition(chosen);
                        setEntryIssue(null);
                        if (!id) {
                           setMeasurePhoto(null);
                           setAreaConfirmed(false);
                        }
                     }}
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
               ) : null}
            </section>

            <hr className="rule-dashed" />

            {/* ---------------- Where ---------------- */}
            <section className="flex flex-col gap-6">
               <GroupHeading step={2}>Where</GroupHeading>

               <div
                  role="radiogroup"
                  aria-label="Where you caught it"
                  className="flex flex-col"
               >
                  {(
                     [
                        ['here', 'The spot I am at'],
                        ['saved', 'A saved spot'],
                        ['new', 'A new spot'],
                     ] as [SpotMode, string][]
                  ).map(([value, text]) => (
                     <label
                        key={value}
                        className="flex min-h-12 cursor-pointer items-center gap-3 border-t border-line py-3 first:border-t-0"
                     >
                        <input
                           type="radio"
                           name="spot-mode"
                           className="size-5 accent-teal"
                           checked={spotMode === value}
                           onChange={() => chooseSpotMode(value)}
                        />
                        <span className="g-tracked text-[19px]">{text}</span>
                     </label>
                  ))}
               </div>

               {spotMode === 'here' ? (
                  <div className="bg-bg-2 p-4">
                     {hereState === 'locating' ? (
                        <p className="text-ink-2">Getting a fix.</p>
                     ) : null}
                     {hereState === 'ready' && herePosition ? (
                        <>
                           <MapLocationPicker
                              latitude={String(herePosition.latitude)}
                              longitude={String(herePosition.longitude)}
                              source="Phone fix"
                              onChange={(latitude, longitude) => {
                                 spotChosen.current = true;
                                 setPhotoNote(null);
                                 setHerePosition({ latitude, longitude });
                              }}
                           />
                           {photoNote ? (
                              <p className="mt-2 text-[14px] text-ink-3">
                                 {photoNote}
                              </p>
                           ) : null}
                        </>
                     ) : null}
                     {hereState === 'refused' ? (
                        <div className="flex flex-col items-start gap-3">
                           <p className="text-ink-2">
                              No position came back. Your phone may have
                              location turned off for this site.
                           </p>
                           <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={askForPosition}
                           >
                              Try again
                           </Button>
                        </div>
                     ) : null}
                     {hereState === 'idle' ? (
                        <Button
                           type="button"
                           variant="outline"
                           size="sm"
                           onClick={askForPosition}
                        >
                           Get a fix
                        </Button>
                     ) : null}
                     <p className="mt-3 text-[14px] text-ink-3">
                        Your position sets the conditions and is kept on the
                        catch.
                     </p>
                     {isEdit && initial?.siteId ? (
                        <p className="mt-2 text-[14px] text-ink-3">
                           This catch is filed under a spot. Saving with this
                           chosen leaves it with no spot.
                        </p>
                     ) : null}
                  </div>
               ) : null}

               {nearSaved ? (
                  <div className="rule-dashed-left flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-2 pl-4">
                     <p className="text-[15px]">
                        {nearSaved.spot.name} is{' '}
                        {formatMetres(nearSaved.metres)} away.
                     </p>
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                           setSavedSiteId(nearSaved.spot.id);
                           chooseSpotMode('saved');
                        }}
                     >
                        File it there
                     </Button>
                  </div>
               ) : null}

               {spotMode === 'saved' ? (
                  <div className="flex flex-col gap-3">
                     <TextField
                        label="Search your spots"
                        type="search"
                        value={siteSearch}
                        onChange={(event) => setSiteSearch(event.target.value)}
                        placeholder="Kalk Bay"
                     />
                     {sitesState === 'loading' ? (
                        <p className="text-ink-2">Reading your spots.</p>
                     ) : sitesState === 'failed' ? (
                        <div className="flex flex-col items-start gap-3">
                           <p className="text-destructive">
                              Could not read your spots.
                           </p>
                           <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={retryOptions}
                           >
                              Try again
                           </Button>
                        </div>
                     ) : sites.length === 0 ? (
                        <p className="text-ink-2">
                           You have no spots yet. Choose A new spot and drop a
                           pin.
                        </p>
                     ) : filteredSites.length === 0 ? (
                        <div className="flex flex-col items-start gap-3">
                           <p className="text-ink-2">
                              No spot goes by that name.
                           </p>
                           <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSiteSearch('')}
                           >
                              Clear search
                           </Button>
                        </div>
                     ) : (
                        <ul data-field="spot" tabIndex={-1}>
                           {filteredSites.map((site) => (
                              <li key={site.id}>
                                 <label className="flex min-h-12 cursor-pointer items-center gap-3 border-t border-line py-3">
                                    <input
                                       type="radio"
                                       name="saved-site"
                                       className="size-5 accent-teal"
                                       checked={savedSiteId === site.id}
                                       onChange={() => {
                                          setSavedSiteId(site.id);
                                          setErrors((current) => ({
                                             ...current,
                                             spot: undefined,
                                          }));
                                       }}
                                    />
                                    <span className="text-[16px]">
                                       {site.name}
                                    </span>
                                 </label>
                              </li>
                           ))}
                        </ul>
                     )}
                     <FieldError id="spot-picked-error" message={errors.spot} />
                     {selectedSite && !activeCoordinates ? (
                        <p className="text-[14px] text-ink-3">
                           This spot has no position recorded, so no conditions
                           can be read for it.
                        </p>
                     ) : null}
                  </div>
               ) : null}

               {spotMode === 'new' ? (
                  <div className="flex flex-col gap-4">
                     <div>
                        <TextField
                           label="Name this spot"
                           data-field="newSpotName"
                           value={newSpotName}
                           maxLength={TITLE_LIMIT}
                           autoComplete="off"
                           error={errors.newSpotName}
                           hint="Name it to keep it as a spot."
                           onChange={(event) =>
                              setNewSpotName(event.target.value)
                           }
                           onBlur={() => markTouched('newSpotName')}
                           placeholder="Rooi-Els"
                        />
                     </div>
                     <div data-field="spot" tabIndex={-1}>
                        <MapLocationPicker
                           latitude={newLatitude}
                           longitude={newLongitude}
                           source={
                              positionFromPhoto ? 'From the photograph' : null
                           }
                           onChange={setNewCoordinates}
                        />
                        <FieldError id="spot-error" message={errors.spot} />
                        {photoNote ? (
                           <p className="mt-2 text-[14px] text-ink-3">
                              {photoNote}
                           </p>
                        ) : null}
                     </div>
                  </div>
               ) : null}
            </section>

            <hr className="rule-dashed" />

            {/* ---------------- When and conditions ---------------- */}
            <section className="flex flex-col gap-6">
               <GroupHeading step={3}>When</GroupHeading>

               <div>
                  <TextField
                     label="Caught at"
                     data-field="caughtAt"
                     type="datetime-local"
                     numeric
                     value={caughtAt}
                     error={errors.caughtAt}
                     hint={
                        <>
                           {zone ? `Your time, ${zone}.` : 'Your own time.'}
                           {photoSpan
                              ? ` The photographs run from ${clock(photoSpan.from)} to ${clock(photoSpan.to)}, so the log is kept as that stretch.`
                              : ''}
                        </>
                     }
                     onChange={(event) => {
                        caughtAtEdited.current = true;
                        setCaughtAt(event.target.value);
                     }}
                     onBlur={() => markTouched('caughtAt')}
                  />
               </div>
            </section>

            <hr className="rule-dashed" />

            {/* ---------------- Gear and notes ---------------- */}
            <section className="flex flex-col gap-6">
               <GroupHeading step={4}>Gear and notes</GroupHeading>

               <div className="flex flex-col gap-3">
                  <TextField
                     label="Search your gear"
                     type="search"
                     value={gearSearch}
                     onChange={(event) => setGearSearch(event.target.value)}
                     placeholder="Daiwa"
                  />
                  {gear.length > 6 ? (
                     <ChoiceGroup
                        label="Kind"
                        inline
                        value={gearKind}
                        options={[
                           { value: 'ANY' as const, label: 'Any' },
                           ...GEAR_KINDS.filter((kind) =>
                              gear.some((entry) => entry.type === kind.value)
                           ).map((kind) => ({
                              value: kind.value,
                              label: kind.plural,
                           })),
                        ]}
                        onChange={setGearKind}
                     />
                  ) : null}
                  {gearState === 'loading' ? (
                     <p className="text-ink-2">Reading your gear.</p>
                  ) : gearState === 'failed' ? (
                     <div className="flex flex-col items-start gap-3">
                        <p className="text-destructive">
                           Could not read your gear.
                        </p>
                        <Button
                           type="button"
                           variant="outline"
                           size="sm"
                           onClick={retryOptions}
                        >
                           Try again
                        </Button>
                     </div>
                  ) : gear.length === 0 ? (
                     <div className="flex flex-col items-start gap-3">
                        <p className="text-ink-2">
                           No gear yet. Add a rod or a reel and it shows up
                           here.
                        </p>
                        <AddGearInline onAdded={addGear} />
                     </div>
                  ) : filteredGear.length === 0 ? (
                     <div className="flex flex-col items-start gap-3">
                        <p className="text-ink-2">No gear goes by that name.</p>
                        <Button
                           type="button"
                           variant="outline"
                           size="sm"
                           onClick={() => setGearSearch('')}
                        >
                           Clear search
                        </Button>
                     </div>
                  ) : (
                     <ul>
                        {GEAR_KINDS.flatMap((kind) => {
                           const items = filteredGear.filter(
                              (entry) =>
                                 entry.type === kind.value &&
                                 (gearKind === 'ANY' || gearKind === kind.value)
                           );
                           if (!items.length) return [];
                           const chosen = items.filter((entry) =>
                              selectedGearIds.includes(entry.id)
                           ).length;
                           return [
                              <li
                                 key={`${kind.value}-head`}
                                 className="lab flex items-baseline justify-between pt-4 pb-1 text-ink-3"
                              >
                                 <span>{kind.plural}</span>
                                 <span className="num">
                                    {chosen
                                       ? `${chosen} of ${items.length}`
                                       : items.length}
                                 </span>
                              </li>,
                              ...items.map((entry) => (
                                 <li key={entry.id}>
                                    <label className="flex min-h-12 cursor-pointer items-center gap-3 border-t border-line py-3">
                                       <input
                                          type="checkbox"
                                          className="size-5 accent-teal"
                                          checked={selectedGearIds.includes(
                                             entry.id
                                          )}
                                          onChange={() => toggleGear(entry.id)}
                                       />
                                       {entry.imageUrl ? (
                                          <img
                                             src={entry.imageUrl}
                                             alt=""
                                             width={44}
                                             height={44}
                                             loading="lazy"
                                             className="size-11 bg-bg-2 object-cover"
                                          />
                                       ) : null}
                                       <span className="flex flex-col">
                                          <span className="g text-[22px]">
                                             {entry.name}
                                          </span>
                                          <span className="text-[14px] text-ink-2">
                                             {entry.brand}
                                          </span>
                                       </span>
                                    </label>
                                 </li>
                              )),
                           ];
                        })}
                     </ul>
                  )}

                  {gearState === 'ready' && gear.length > 0 ? (
                     <AddGearInline onAdded={addGear} />
                  ) : null}
               </div>

               <TextArea
                  label="Notes"
                  rows={4}
                  maxLength={NOTES_LIMIT}
                  value={notes}
                  hint={`${notes.length} of ${NOTES_LIMIT}`}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="What the water was doing, what it took."
               />
            </section>
         </div>

         {/*
          * The side of the page, sticky on a desktop: what the record will say,
          * the conditions it will carry, who sees it, and the save. On a phone
          * it follows the form, and the save is repeated in a bar at the foot.
          */}
         <aside className="flex flex-col gap-8 lg:sticky lg:top-[84px]">
            <div className="border border-line p-4">
               <h2 className="lab lab-rule">Conditions at that hour</h2>
               {snapshot ? null : (
                  <p className="mt-3 text-[14px] text-ink-2">
                     {activeCoordinates
                        ? 'Read for the pin and the hour once both are set.'
                        : 'Get a fix, or pick a spot, and the conditions are read for that hour.'}
                  </p>
               )}
               <dl className={cn('mt-3 flex flex-col', !snapshot && 'hidden')}>
                  {lines.map((line) => (
                     <div
                        key={line.label}
                        className="flex items-baseline justify-between gap-4 border-t border-line py-2 first:border-t-0"
                     >
                        <dt className="lab">{line.label}</dt>
                        <dd className="num text-right text-[15px] text-ink-2">
                           {line.value}
                        </dd>
                     </div>
                  ))}
               </dl>
               {conditionsState === 'loading' ? (
                  <p className="mt-3 text-[14px] text-ink-3">
                     Reading the conditions.
                  </p>
               ) : null}
               {conditionsState === 'failed' && conditionsMessage ? (
                  <p role="alert" className="mt-3 text-[14px] text-destructive">
                     {conditionsMessage}
                  </p>
               ) : null}
               {/* Nothing to credit until there is a reading to credit it for. */}
               {snapshot ? (
                  <p className="mt-3 text-[14px] text-ink-3">
                     {WEATHER_SOURCE_LINE}
                  </p>
               ) : null}

               {/*
                * A new catch reads on its own as soon as it has a position, so
                * the control is only worth showing once there is a reading it
                * could replace.
                */}
               <div className={cn('mt-4', !isEdit && !snapshot && 'hidden')}>
                  {isConfirmingRefresh ? (
                     <div className="flex flex-col items-start gap-3">
                        <p className="text-[15px] text-ink-2">
                           This replaces the wind, air, cloud and rain kept with
                           this catch with a fresh reading for{' '}
                           {caughtAtDate ? clock(caughtAtDate) : 'that hour'} at{' '}
                           {spotLabel}.
                        </p>
                        <div className="flex flex-wrap gap-3">
                           <Button
                              type="button"
                              size="sm"
                              onClick={refreshConditions}
                           >
                              Replace them
                           </Button>
                           <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setIsConfirmingRefresh(false)}
                           >
                              Keep what is here
                           </Button>
                        </div>
                     </div>
                  ) : (
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={conditionsState === 'loading'}
                        onClick={() => setIsConfirmingRefresh(true)}
                     >
                        Refresh conditions
                     </Button>
                  )}
               </div>
            </div>

            <section className="flex flex-col gap-5">
               <h2 className="lab lab-rule">Who sees this</h2>

               {/* The heading above is the label; naming it twice named nothing. */}
               <ChoiceGroup
                  hideLabel
                  label="Who can see the catch"
                  value={visibility}
                  onChange={setVisibility}
                  options={[
                     { value: 'PUBLIC', label: 'Everyone' },
                     { value: 'PRIVATE', label: 'Only me' },
                  ]}
                  hint={
                     visibility === 'PRIVATE'
                        ? 'It stays in your log and never reaches the feed or a board.'
                        : 'It appears in the feed and counts on the boards.'
                  }
               />

               {/*
                * A separate question from who can see it. An angler will happily
                * show a fish and not the gully it came out of, and making that all
                * or nothing is how a log stops being used. The position is still
                * stored either way; it is withheld from other anglers rather than
                * thrown away, so the record stays complete.
                */}
               {visibility === 'PUBLIC' ? (
                  <ChoiceGroup
                     label="Show where it was caught"
                     value={hideLocation ? 'HIDE' : 'SHOW'}
                     onChange={(next) => setHideLocation(next === 'HIDE')}
                     options={[
                        { value: 'SHOW', label: 'Show the spot' },
                        { value: 'HIDE', label: 'Keep it to myself' },
                     ]}
                     hint={
                        hideLocation
                           ? 'The fish shows, the mark does not. You still see it on your own map.'
                           : 'Other anglers can see which spot this came from.'
                     }
                  />
               ) : null}
            </section>

            {/* On a phone the same three live in the bar at the foot. */}
            <div className="hidden flex-wrap items-center gap-4 lg:flex">
               <Button type="submit" size="xl" disabled={isBusy}>
                  {isEdit ? 'Save changes' : 'Save catch'}
               </Button>
               {!isEdit ? (
                  <Button
                     type="button"
                     variant="outline"
                     size="lg"
                     onClick={saveAsDraft}
                  >
                     Save draft
                  </Button>
               ) : null}
               <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() =>
                     navigate(
                        isEdit && catchId
                           ? `/catches/${catchId}`
                           : '/catches/me'
                     )
                  }
               >
                  Cancel
               </Button>
               {isPhotoUploading ? (
                  <span className="text-[14px] text-ink-3">
                     A photo is still going up.
                  </span>
               ) : null}
            </div>
         </aside>

         {/*
          * The save, within a thumb's reach, on a phone. The phone navigation
          * stands down on this route, so the bar has the foot to itself and
          * carries both ways out of a half-written catch.
          */}
         <div className="sticky bottom-0 -mx-4 border-t border-line bg-background px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] lg:hidden">
            {isPhotoUploading ? (
               <p className="mb-2 text-[14px] text-ink-3">
                  A photo is still going up.
               </p>
            ) : null}
            <div
               className={cn(
                  'flex items-center gap-4',
                  isEdit ? 'justify-end' : 'justify-between'
               )}
            >
               {!isEdit ? (
                  <button
                     type="button"
                     onClick={saveAsDraft}
                     className="g-tracked inline-flex min-h-11 items-center text-[15px] whitespace-nowrap hover:text-teal-text"
                  >
                     Save draft
                  </button>
               ) : null}
               <Button type="submit" size="lg" disabled={isBusy}>
                  {isEdit ? 'Save changes' : 'Save catch'}
               </Button>
            </div>
         </div>
      </form>
   );
}

/* ------------------------------------------------------------------ */

export function LogCatchPage() {
   useDocumentTitle('Log a catch');
   const navigate = useNavigate();
   const [params] = useSearchParams();
   const draftId = params.get('draft');
   const draft = draftId ? readDraft(draftId) : null;
   const initial =
      draft && draft.kind === 'full'
         ? ({
              snapshot: null,
              weather: null,
              gearIds: [],
              gears: [],
              images: [],
              ...(draft.state as Record<string, unknown>),
           } as unknown as CatchFormInitial)
         : undefined;

   return (
      <RequireSignIn what="your log">
         <section className="mx-auto w-[min(1400px,100%-32px)] py-8 md:py-12">
            {/*
             * On a phone the navigation stands down for this form and the
             * save bar carries only Save draft and Save catch, so the way
             * out lives up here, the way it does on the fast log. On a
             * desktop the rail's Cancel does the same job.
             */}
            <div className="flex items-start justify-between gap-4">
               <h1 className="g text-[44px] md:text-[56px]">Log a catch</h1>
               <button
                  type="button"
                  onClick={() => navigate('/catches/me')}
                  aria-label="Close without saving"
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line text-ink hover:border-ink lg:hidden"
               >
                  <XMarkIcon className="size-5" aria-hidden="true" />
               </button>
            </div>
            <div className="mt-10">
               <CatchForm
                  key={draftId ?? 'new'}
                  mode="create"
                  initial={initial}
                  draftId={draftId}
               />
            </div>
         </section>
      </RequireSignIn>
   );
}
