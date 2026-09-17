import axios from 'axios';
import { useEffect, useState } from 'react';
import { CameraIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import {
   fetchCompetitions,
   type Competition,
} from '@/components/social/competitions-api';
import { Button } from '@/components/ui/button';
import { Picker } from '@/components/ui/picker';
import { cn } from '@/lib/utils';

/*
 * Entering a catch in a competition.
 *
 * Pick the competition, then the figure it judges is read off the
 * photograph: the fish on a tape for a length competition, on a scale for
 * a weight one. The reader is asked for what it can actually see and how
 * sure it is, and under sixty per cent it is sent back for a clearer
 * picture rather than trusted. What it read is what goes on the record.
 */
export type Reading = {
   measure: 'LENGTH' | 'WEIGHT';
   value: number;
   unit: 'cm' | 'in' | 'kg' | 'lb';
   confidence: number;
   note: string;
};

type RawReading = {
   value: number | null;
   unit: 'cm' | 'in' | 'kg' | 'lb' | null;
   confidence: number;
   seen: 'tape' | 'scale' | 'none';
   note: string;
};

const SURE_ENOUGH = 0.6;

export function CompetitionEntry({
   competitionId,
   onCompetition,
   imageUrl,
   reading,
   onReading,
}: {
   competitionId: string | null;
   onCompetition: (id: string | null) => void;
   /* The first photograph of the catch, once it has gone up. */
   imageUrl: string | null;
   reading: Reading | null;
   onReading: (reading: Reading | null) => void;
}) {
   const [open, setOpen] = useState(competitionId !== null);
   const [running, setRunning] = useState<Competition[] | null>(null);
   const [busy, setBusy] = useState(false);
   const [problem, setProblem] = useState<string | null>(null);
   const [off, setOff] = useState(false);

   useEffect(() => {
      if (!open || running) return;
      const controller = new AbortController();
      fetchCompetitions(controller.signal, 1)
         .then((result) =>
            setRunning(
               result.items.filter(
                  (c) => c.status === 'running' && c.youEntered
               )
            )
         )
         .catch(() => setRunning([]));
      return () => controller.abort();
   }, [open, running]);

   const chosen = running?.find((c) => c.id === competitionId) ?? null;

   const read = async () => {
      if (!chosen || !imageUrl) return;
      setBusy(true);
      setProblem(null);
      try {
         const { data } = await axios.post<{ reading: RawReading }>(
            '/api/vision/read',
            { imageUrl, measure: chosen.measure }
         );
         const r = data.reading;
         const wantsLength = chosen.measure === 'LENGTH';
         const unitFits =
            r.unit !== null &&
            (wantsLength
               ? r.unit === 'cm' || r.unit === 'in'
               : r.unit === 'kg' || r.unit === 'lb');
         if (r.value === null || !unitFits || r.confidence < SURE_ENOUGH) {
            onReading(null);
            setProblem(
               r.seen === 'none'
                  ? `No ${wantsLength ? 'tape' : 'scale'} in the picture. Take one with the fish on the ${wantsLength ? 'tape' : 'scale'} and the figure readable.`
                  : `Could not read it well enough (${Math.round(r.confidence * 100)}% sure). ${r.note} Take a clearer one.`
            );
            return;
         }
         onReading({
            measure: chosen.measure,
            value: r.value,
            unit: r.unit as Reading['unit'],
            confidence: r.confidence,
            note: r.note,
         });
      } catch (error) {
         if (axios.isAxiosError(error) && error.response?.status === 503) {
            setOff(true);
         } else {
            setProblem('The photo could not be read just now. Try again.');
         }
      } finally {
         setBusy(false);
      }
   };

   return (
      <div className="border-t border-line pt-4">
         {!open ? (
            <button
               type="button"
               onClick={() => setOpen(true)}
               className="g-tracked inline-flex h-11 items-center gap-2 text-[17px] text-ink underline-offset-4 hover:underline"
            >
               For a competition?
            </button>
         ) : (
            <div className="flex flex-col gap-4">
               <div className="flex flex-wrap items-end gap-3">
                  <Picker
                     label="Competition"
                     allLabel={
                        running === null
                           ? 'Reading'
                           : running.length
                             ? 'Pick one'
                             : 'None running that you are in'
                     }
                     value={competitionId ?? ''}
                     onChange={(next) => {
                        onCompetition((next as string) || null);
                     }}
                     options={(running ?? []).map((c) => ({
                        value: c.id,
                        label: c.name,
                        hint: `${c.measure === 'LENGTH' ? 'Length' : 'Weight'}${c.species ? `, ${c.species.commonName} only` : ''}`,
                     }))}
                     className="min-w-[240px]"
                  />
                  <button
                     type="button"
                     onClick={() => {
                        onCompetition(null);
                        setOpen(false);
                     }}
                     className="g-tracked inline-flex h-11 items-center text-[15px] text-ink-2 hover:text-ink"
                  >
                     Not for a competition
                  </button>
               </div>

               {chosen ? (
                  <div className="flex flex-col gap-3 border-l-[3px] border-teal bg-bg-2 px-4 py-3">
                     <p className="text-[15px] text-ink-2">
                        {chosen.name} is judged on{' '}
                        {chosen.measure === 'LENGTH' ? 'length' : 'weight'}. Add
                        a photograph of the fish{' '}
                        {chosen.measure === 'LENGTH'
                           ? 'lying along a tape or ruler with the figure at its nose or tail readable'
                           : 'on the scale with the display readable'}
                        , then read it off. What is read is what is entered.
                     </p>
                     {reading ? (
                        <p className="flex items-start gap-2 text-[15px]">
                           <CheckCircleIcon
                              className="mt-0.5 size-5 shrink-0 text-teal-text"
                              aria-hidden="true"
                           />
                           <span>
                              Read {reading.value} {reading.unit} off the
                              photograph, {Math.round(reading.confidence * 100)}
                              % sure.{' '}
                              <span className="text-ink-3">{reading.note}</span>
                           </span>
                        </p>
                     ) : null}
                     {problem ? (
                        <p
                           role="alert"
                           className="text-[15px] text-destructive"
                        >
                           {problem}
                        </p>
                     ) : null}
                     {off ? (
                        <p className="text-[15px] text-ink-2">
                           The photo reader is not switched on for this server
                           yet. The entry still saves; the organiser will check
                           the picture.
                        </p>
                     ) : (
                        <div>
                           <Button
                              type="button"
                              variant={reading ? 'outline' : 'default'}
                              size="sm"
                              disabled={!imageUrl || busy}
                              onClick={() => void read()}
                              className={cn(!imageUrl && 'opacity-60')}
                           >
                              <CameraIcon aria-hidden="true" />
                              {busy
                                 ? 'Reading'
                                 : reading
                                   ? 'Read it again'
                                   : `Read the ${chosen.measure === 'LENGTH' ? 'length' : 'weight'} off the photo`}
                           </Button>
                           {!imageUrl ? (
                              <p className="mt-2 text-[14px] text-ink-3">
                                 Add the photograph first.
                              </p>
                           ) : null}
                        </div>
                     )}
                  </div>
               ) : null}
            </div>
         )}
      </div>
   );
}
