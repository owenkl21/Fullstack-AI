import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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
import { Receipt } from '@/components/fishing/quicklog/Receipt';
import { SpeciesField } from '@/components/fishing/quicklog/SpeciesField';
import {
   toMetricValue,
   type MeasureUnit,
} from '@/components/fishing/quicklog/measure';
import {
   NOT_SURE,
   UNNAMED_TITLE,
   recentSpecies,
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
   const [stampedAt] = useState(() => new Date());
   const { status: fixStatus, fix, isSharp } = usePositionFix();

   const [entered, setEntered] = useState(false);
   const [conditions, setConditions] = useState<{
      snapshot: WeatherSnapshot;
      at: string | null;
   } | null>(null);
   const [conditionsFailed, setConditionsFailed] = useState(false);

   const [options, setOptions] = useState<string[]>([]);
   const [chosen, setChosen] = useState<string | null>(null);
   const [typed, setTyped] = useState('');
   const [speciesError, setSpeciesError] = useState<string | null>(null);
   const speciesInput = useRef<HTMLInputElement>(null);

   const [length, setLength] = useState('');
   const [lengthUnit, setLengthUnit] = useState<MeasureUnit>('cm');
   const [onTape, setOnTape] = useState(false);
   const [weight, setWeight] = useState('');
   const [weightUnit, setWeightUnit] = useState<MeasureUnit>('kg');
   const [onScale, setOnScale] = useState(false);

   const [photo, setPhoto] = useState<UploadedPhoto | null>(null);
   const [photoBusy, setPhotoBusy] = useState(false);
   const [isSaving, setIsSaving] = useState(false);

   const askedForConditions = useRef(false);
   const conditionsRequest = useRef<AbortController | null>(null);

   useEffect(() => {
      const frame = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(frame);
   }, []);

   useEffect(() => {
      const controller = new AbortController();
      const load = async () => {
         try {
            const catches = await fetchMyCatches(controller.signal);
            setOptions(recentSpecies(catches));
         } catch {
            setOptions([]);
         }
      };
      void load();
      return () => controller.abort();
   }, []);

   useEffect(() => () => conditionsRequest.current?.abort(), []);

   // The conditions are pulled once, on the first fix of any accuracy, and a better
   // fix arriving later never cancels the reading already on its way.
   useEffect(() => {
      if (!fix || askedForConditions.current) {
         return;
      }
      askedForConditions.current = true;
      const controller = new AbortController();
      conditionsRequest.current = controller;
      const load = async () => {
         try {
            const weather = await fetchConditions(
               fix.latitude,
               fix.longitude,
               controller.signal
            );
            if (!weather) {
               setConditionsFailed(true);
               return;
            }
            setConditions({ snapshot: weather, at: formatClock(new Date()) });
         } catch (error) {
            if (!axios.isCancel(error)) {
               setConditionsFailed(true);
            }
         }
      };
      void load();
   }, [fix]);

   const phase: ConditionsPhase = conditions
      ? 'ready'
      : conditionsFailed ||
          fixStatus === 'denied' ||
          fixStatus === 'unsupported'
        ? 'missing'
        : fix
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

      const title =
         other || (chosen && chosen !== NOT_SURE ? chosen : UNNAMED_TITLE);
      const lengthCm = toMetricValue(length, lengthUnit);
      const weightKg = toMetricValue(weight, weightUnit);

      // TODO(api): appendix E, a catch carries no position of its own and the fast
      // path creates no spot, so the live fix is shown but not stored.
      const payload = {
         title,
         caughtAt: stampedAt.toISOString(),
         notes: null,
         siteId: null,
         weather: snapshot?.weatherCondition?.description?.text ?? null,
         weatherSnapshot: toSavableSnapshot(snapshot),
         length: lengthCm,
         weight: weightKg,
         images: photo ? [photo] : [],
         gearIds: [],
      };

      try {
         setIsSaving(true);
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
            'mx-auto flex min-h-[calc(100dvh-124px)] w-full max-w-[560px] flex-col transition-[transform,opacity] duration-[460ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)] md:my-10 md:min-h-0 md:border md:border-line',
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

         <div className="flex flex-1 flex-col gap-4 px-4 py-4">
            <Receipt
               stampedAt={stampedAt}
               status={fixStatus}
               fix={fix}
               isSharp={isSharp}
            />

            <Conditions
               phase={phase}
               lines={lines}
               takenAt={conditions?.at ?? null}
            />

            <PhotoBlock onChange={setPhoto} onBusyChange={setPhotoBusy} />

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
                  sourceLabel={onTape ? 'on a tape' : 'by eye'}
                  sourceAction="On a tape"
                  sourceOn={onTape}
                  onSourceToggle={() => setOnTape((on) => !on)}
               />
               <MeasureField
                  id="weight"
                  label="Weight"
                  units={['kg', 'lb']}
                  unit={weightUnit}
                  value={weight}
                  onChange={setWeight}
                  onUnitChange={setWeightUnit}
                  sourceLabel={onScale ? 'on a scale' : 'by eye'}
                  sourceAction="On a scale"
                  sourceOn={onScale}
                  onSourceToggle={() => setOnScale((on) => !on)}
               />
            </div>
         </div>

         <button
            type="button"
            onClick={() => void save()}
            disabled={photoBusy || isSaving}
            className="g-tracked sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 flex h-14 w-full shrink-0 items-center justify-center bg-teal text-[26px] text-teal-ink transition-[filter] duration-150 active:brightness-95 disabled:opacity-60 md:bottom-0"
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
