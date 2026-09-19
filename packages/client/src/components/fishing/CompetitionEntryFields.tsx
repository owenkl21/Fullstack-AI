import {
   PhotoBlock,
   type UploadedPhoto,
} from '@/components/fishing/quicklog/PhotoBlock';
import {
   areaSentence,
   needsMeasurePhoto,
   type Competition,
} from '@/components/social/competitions-api';
import { AREA_SENTENCE } from '@/components/fishing/competition-entry';
import { cn } from '@/lib/utils';

/*
 * What entering a catch in a competition asks for, beyond the catch itself.
 *
 * Two things: a photograph of the fish on the tape or the scale with the
 * figure readable, which is what the reader reads and the namer names, and
 * one sentence to tick about where it was caught. Both log forms draw these
 * from here, so an entry asks the same questions wherever it is made.
 *
 * On the log the two live in different steps, because they belong to
 * different questions: the photograph goes under the catch photo in step one,
 * the sentence under sharing in step three. `part` says which one to draw;
 * left out, both come together, which is how the long form still uses it.
 */

/*
 * "16 to 24 Sep", or "28 Aug to 3 Sep" when it crosses a month: one month
 * word where one will do, because this sentence is already carrying the rule
 * and the place.
 */
function runRange(startsAt: string, endsAt: string) {
   const from = new Date(startsAt);
   const to = new Date(endsAt);
   if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return '';
   const month = (d: Date) =>
      d.toLocaleDateString(undefined, { month: 'short' });
   const full = (d: Date) => `${d.getDate()} ${month(d)}`;
   if (from.toDateString() === to.toDateString()) return full(to);
   return month(from) === month(to)
      ? `${from.getDate()} to ${full(to)}`
      : `${full(from)} to ${full(to)}`;
}

export function CompetitionBanner({
   competition,
   className,
}: {
   competition: Competition;
   className?: string;
}) {
   const judged =
      competition.rule === 'SPECIES_VARIETY'
         ? 'Judged on most different species'
         : competition.measure === 'LENGTH'
           ? 'Judged on length, from a tape'
           : 'Judged on weight, from a scale';
   const where = areaSentence(competition);
   const when = runRange(competition.startsAt, competition.endsAt);

   return (
      <div
         className={cn('blk blk-flat px-4 pt-3.5 pb-4', className)}
         data-competition-banner=""
      >
         <span className="lab block text-paper-2">Entering</span>
         <h3 className="g mt-1 text-[26px] text-paper">{competition.name}</h3>
         <p className="mt-1 text-[14px] leading-[1.5] text-paper-2">
            {judged}
            {competition.species
               ? `, ${competition.species.commonName} only`
               : ''}
            . {[where, when].filter(Boolean).join(', ')}.
         </p>
      </div>
   );
}

export function CompetitionEntryFields({
   competition,
   measurePhoto,
   onMeasurePhoto,
   onMeasureBusy,
   areaConfirmed,
   onAreaConfirmed,
   problem,
   part = 'both',
   className,
}: {
   competition: Competition;
   measurePhoto: UploadedPhoto | null;
   onMeasurePhoto: (photo: UploadedPhoto | null) => void;
   onMeasureBusy: (busy: boolean) => void;
   areaConfirmed: boolean;
   onAreaConfirmed: (confirmed: boolean) => void;
   /* What stopped the save, if anything did. */
   problem?: string | null;
   /* Which of the two asks to draw. */
   part?: 'both' | 'photo' | 'area';
   className?: string;
}) {
   const photo = part !== 'area' && needsMeasurePhoto(competition);
   const area = part !== 'photo';

   return (
      <div className={cn('flex flex-col gap-5', className)}>
         {photo ? (
            <div className="flex flex-col gap-2">
               <div className="flex items-center justify-between gap-3">
                  <span className="lab">
                     {competition.measure === 'LENGTH'
                        ? 'On the tape'
                        : 'On the scale'}
                  </span>
                  <span className="lab text-teal-text">Required</span>
               </div>
               <PhotoBlock
                  variant="cell"
                  idPrefix="measure-photo"
                  title={
                     competition.measure === 'LENGTH'
                        ? 'Photograph the fish on the tape'
                        : 'Photograph the fish on the scale'
                  }
                  initial={measurePhoto}
                  onChange={onMeasurePhoto}
                  onBusyChange={onMeasureBusy}
               />
            </div>
         ) : null}

         {area ? (
            <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug">
               <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-ink"
                  checked={areaConfirmed}
                  onChange={(event) => onAreaConfirmed(event.target.checked)}
               />
               <span>{AREA_SENTENCE}</span>
            </label>
         ) : null}

         {problem ? (
            <p role="alert" className="text-[15px] text-destructive">
               {problem}
            </p>
         ) : null}
      </div>
   );
}
