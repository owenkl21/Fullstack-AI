import {
   PhotoBlock,
   type UploadedPhoto,
} from '@/components/fishing/quicklog/PhotoBlock';
import {
   areaSentence,
   checksSentence,
   judgedSentence,
   needsMeasurePhoto,
   type Competition,
} from '@/components/social/competitions-api';
import {
   AREA_SENTENCE,
   measurePhotoTitle,
} from '@/components/fishing/competition-entry';
import { cn } from '@/lib/utils';

/*
 * What entering a catch in a competition asks for, beyond the catch itself.
 *
 * Two things: a photograph of the fish on the tape or the scale with the
 * figure readable, which is what the reader reads and the namer names, and
 * one sentence to tick about where it was caught. Both log forms draw these
 * from here, so an entry asks the same questions wherever it is made.
 */

export function CompetitionBanner({
   competition,
   className,
}: {
   competition: Competition;
   className?: string;
}) {
   return (
      <div
         className={cn(
            'border-l-[3px] border-teal bg-bg-2 px-4 py-3',
            className
         )}
      >
         <p className="text-[15px] text-ink-2">
            Entering{' '}
            <span className="g-tracked text-[19px] text-ink">
               {competition.name}
            </span>{' '}
            · judged on {judgedSentence(competition.rule, competition.measure)}
            {competition.species
               ? `, ${competition.species.commonName} only`
               : ''}
            . {areaSentence(competition)}.
         </p>
         <p className="mt-1 text-[14px] text-ink-3">
            {checksSentence(competition.checks)}
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
   className?: string;
}) {
   return (
      <div className={cn('flex flex-col gap-5', className)}>
         {needsMeasurePhoto(competition) ? (
            <div>
               <span className="lab mb-2 block">
                  {competition.measure === 'LENGTH'
                     ? 'On the tape'
                     : 'On the scale'}
               </span>
               <PhotoBlock
                  idPrefix="measure-photo"
                  title={measurePhotoTitle(competition)}
                  hint="Required. The figure is read off this picture."
                  frameNote="The picture the reader gets."
                  initial={measurePhoto}
                  onChange={onMeasurePhoto}
                  onBusyChange={onMeasureBusy}
               />
            </div>
         ) : null}

         <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug">
            <input
               type="checkbox"
               className="mt-1 size-4 shrink-0 accent-ink"
               checked={areaConfirmed}
               onChange={(event) => onAreaConfirmed(event.target.checked)}
            />
            <span>{AREA_SENTENCE}</span>
         </label>

         {problem ? (
            <p role="alert" className="text-[15px] text-destructive">
               {problem}
            </p>
         ) : null}
      </div>
   );
}
