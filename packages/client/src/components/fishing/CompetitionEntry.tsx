import { useEffect, useState } from 'react';
import {
   fetchCompetitions,
   speciesWords,
   type Competition,
} from '@/components/social/competitions-api';
import { Button } from '@/components/ui/button';
import { Picker } from '@/components/ui/picker';
import type { UploadedPhoto } from '@/components/fishing/quicklog/PhotoBlock';
import {
   CompetitionBanner,
   CompetitionEntryFields,
} from '@/components/fishing/CompetitionEntryFields';

/*
 * Entering a catch in a competition, from the full catch form.
 *
 * Pick one of the running competitions you are in, add the photograph of the
 * fish on the tape or scale, tick the sentence about where it was caught. The
 * entry is written after the catch is, and the checks run on the server: the
 * figure is read off the photograph there, so nothing is read here first.
 */

/* Kept for anything that still names it; the reader no longer runs here. */
export type Reading = {
   measure: 'LENGTH' | 'WEIGHT';
   value: number;
   unit: 'cm' | 'in' | 'kg' | 'lb';
   confidence: number;
   note: string;
};

export function CompetitionEntry({
   competitionId,
   onCompetition,
   measurePhoto,
   onMeasurePhoto,
   onMeasureBusy,
   areaConfirmed,
   onAreaConfirmed,
   problem,
}: {
   competitionId: string | null;
   onCompetition: (id: string | null, competition: Competition | null) => void;
   measurePhoto: UploadedPhoto | null;
   onMeasurePhoto: (photo: UploadedPhoto | null) => void;
   onMeasureBusy: (busy: boolean) => void;
   areaConfirmed: boolean;
   onAreaConfirmed: (confirmed: boolean) => void;
   problem?: string | null;
}) {
   const [open, setOpen] = useState(competitionId !== null);
   const [running, setRunning] = useState<Competition[] | null>(null);

   useEffect(() => {
      if (!open || running) return;
      const controller = new AbortController();
      fetchCompetitions(controller.signal, 1, 'mine')
         .then((result) =>
            setRunning(
               result.items.filter(
                  (c) =>
                     c.youEntered &&
                     /* With teams, only once they are on a side. */
                     !(c.teamsEnabled && !c.yourTeamId) &&
                     (c.status === 'running' || c.id === competitionId)
               )
            )
         )
         .catch(() => setRunning([]));
      return () => controller.abort();
   }, [open, running, competitionId]);

   const chosen = running?.find((c) => c.id === competitionId) ?? null;

   return (
      <div>
         {!open ? (
            <Button
               type="button"
               variant="outline"
               onClick={() => setOpen(true)}
            >
               Enter it in a competition
            </Button>
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
                        const id = (next as string) || null;
                        onCompetition(
                           id,
                           running?.find((c) => c.id === id) ?? null
                        );
                     }}
                     options={(running ?? []).map((c) => ({
                        value: c.id,
                        label: c.name,
                        hint: [
                           c.measure === 'LENGTH' ? 'Length' : 'Weight',
                           speciesWords(c.species),
                        ]
                           .filter(Boolean)
                           .join(', '),
                     }))}
                     className="min-w-[240px]"
                  />
                  <button
                     type="button"
                     onClick={() => {
                        onCompetition(null, null);
                        setOpen(false);
                     }}
                     className="g-tracked inline-flex h-11 items-center text-[15px] text-ink-2 hover:text-ink"
                  >
                     Not for a competition
                  </button>
               </div>

               {chosen ? (
                  <>
                     <CompetitionBanner competition={chosen} />
                     <CompetitionEntryFields
                        competition={chosen}
                        measurePhoto={measurePhoto}
                        onMeasurePhoto={onMeasurePhoto}
                        onMeasureBusy={onMeasureBusy}
                        areaConfirmed={areaConfirmed}
                        onAreaConfirmed={onAreaConfirmed}
                        problem={problem}
                     />
                  </>
               ) : null}
            </div>
         )}
      </div>
   );
}
