import { useState } from 'react';
import { CheckIcon, MinusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { FramedPhoto } from '@/components/FramedPhoto';
import {
   entryStateLabel,
   type Competition,
   type CompetitionEntry,
   type EntryCheck,
} from '@/components/social/competitions-api';
import {
   CHECK_LABELS,
   checkValue,
   orderedReport,
} from '@/components/social/entry-checks';
import { JudgeFindings } from '@/components/social/JudgeFindings';
import { formatStamp } from '@/components/fishing/record/format';
import { formatMeasure, type UnitChoice } from '@/lib/units';
import { cn } from '@/lib/utils';

/*
 * One entry, and what was checked about it.
 *
 * Shut, it is a thumbnail, who caught what, when, and one word for where it
 * stands. Open, it is the six checks in the order they always run, the
 * photograph of the fish on the scale, and the two things the organiser can
 * do about it. An entrant who is not the organiser gets Flag in their place;
 * on your own entry the one thing that is yours to do is withdraw it.
 *
 * The whole shut row is the handle, so there is no "the checks" link under
 * it asking to be pressed.
 */

/* The mark beside a check. A tick passed, a dash did not run, and a cross
   did not pass: the frames draw the first two, and a flagged check must
   never be allowed to look like a tick. */
function CheckMark({ status }: { status: EntryCheck['status'] }) {
   if (status === 'pass')
      return (
         <CheckIcon
            aria-label="Passed"
            strokeWidth={1.5}
            className="relative top-[3px] size-[18px]"
         />
      );
   if (status === 'flag')
      return (
         <XMarkIcon
            aria-label="Did not pass"
            strokeWidth={1.5}
            className="relative top-[3px] size-[18px] text-destructive"
         />
      );
   return (
      <MinusIcon
         aria-label="Not checked"
         strokeWidth={1.5}
         className="relative top-[3px] size-[18px]"
      />
   );
}

function CheckLines({
   entry,
   competition,
   units,
}: {
   entry: CompetitionEntry;
   competition: Competition;
   units: UnitChoice;
}) {
   const lines = orderedReport(entry.report);
   if (entry.state === 'PENDING')
      return (
         <p className="text-[15px] text-ink-2" role="status">
            Checking. A few seconds.
         </p>
      );
   if (!lines.length)
      return <p className="text-[15px] text-ink-2">Nothing was checked.</p>;

   return (
      <div className="flex flex-col">
         {lines.map((check) => (
            <div
               key={check.code}
               className={cn(
                  'grid grid-cols-[20px_118px_1fr] items-baseline gap-2.5 py-[7px] lg:py-1.5',
                  check.status === 'skip' && 'text-ink-3'
               )}
            >
               <CheckMark status={check.status} />
               <span className="g-tracked text-[16px] leading-[1.2] tracking-[0.07em]">
                  {CHECK_LABELS[check.code] ?? check.code}
               </span>
               <span
                  className={cn(
                     'text-[14px] leading-[1.4]',
                     check.status === 'skip' ? '' : 'text-ink-2'
                  )}
               >
                  {checkValue(check, entry, competition, units)}
               </span>
            </div>
         ))}
      </div>
   );
}

export function EntryRow({
   competition: c,
   entry,
   units,
   open,
   onToggle,
   busy,
   onReview,
   onFlag,
   onWithdraw,
}: {
   competition: Competition;
   entry: CompetitionEntry;
   units: UnitChoice;
   open: boolean;
   onToggle: () => void;
   busy: string | null;
   onReview: (
      entry: CompetitionEntry,
      action: 'accept' | 'exclude',
      note: string
   ) => void;
   onFlag: (entry: CompetitionEntry, reason: string) => void;
   onWithdraw: (entry: CompetitionEntry) => void;
}) {
   const [note, setNote] = useState('');
   const working = busy !== null && busy.endsWith(entry.id);

   const figure =
      c.rule === 'SPECIES_VARIETY'
         ? null
         : formatMeasure(entry.value, c.measure, units);

   /* The reason a row reads the way it does, on the date line where the
      frames put it: "Fri 18 Sep, 05:40 · before the start". */
   const reason =
      entry.state === 'EXCLUDED'
         ? (entry.reviewNote ??
           orderedReport(entry.report).find((l) => l.status === 'flag')?.detail)
         : entry.flagReason
           ? entry.flagReason
           : null;

   const head = (
      <div className="flex items-center gap-3">
         <span className="size-14 shrink-0 bg-black-block">
            {entry.heroUrl ? (
               <FramedPhoto
                  src={entry.heroUrl}
                  alt=""
                  framing={entry.heroFraming ?? null}
                  className="size-14"
               />
            ) : null}
         </span>
         <span className="flex min-w-0 flex-1 flex-col text-left leading-[1.3]">
            <span className="truncate text-[15px] font-semibold">
               {entry.displayName}
            </span>
            <span className="truncate text-[14px] text-ink-2">
               {entry.speciesName ?? 'Species not given'}
               {figure ? (
                  <>
                     {' · '}
                     <span className="num">{figure}</span>
                  </>
               ) : null}
            </span>
            <span className="num text-[13px] text-ink-3">
               {formatStamp(entry.caughtAt)}
               {reason ? ` · ${reason}` : ''}
            </span>
         </span>
         <span
            className={cn(
               'lab max-w-[80px] shrink-0 text-right leading-[1.35]',
               entry.state === 'HELD'
                  ? 'text-teal-text'
                  : entry.state === 'COUNTED'
                    ? 'text-ink'
                    : 'text-ink-3'
            )}
         >
            {entryStateLabel(entry.state)}
         </span>
      </div>
   );

   if (!open)
      return (
         <li className="border-b border-line">
            <button
               type="button"
               aria-expanded={false}
               onClick={onToggle}
               className="w-full py-3.5"
            >
               {head}
            </button>
         </li>
      );

   return (
      <li className="flex flex-col gap-4 border-b border-line py-4">
         <button
            type="button"
            aria-expanded
            onClick={onToggle}
            className="w-full text-left"
         >
            {head}
         </button>

         <CheckLines entry={entry} competition={c} units={units} />

         <JudgeFindings judge={entry.judge} competition={c} units={units} />

         {entry.note ? (
            <p className="text-[14px] text-ink-2">{entry.note}</p>
         ) : null}

         {/* The two photographs the entry was judged on, each by what it
             is, whole rather than cropped: a tape's last mark is exactly
             what a crop takes off. Each opens full size. */}
         {entry.heroUrl || entry.measureUrl ? (
            <div className="grid grid-cols-2 gap-2.5">
               {[
                  {
                     url: entry.heroUrl,
                     caption: 'The fish',
                     alt: `${entry.displayName}'s fish`,
                  },
                  {
                     url: entry.measureUrl,
                     caption:
                        c.measure === 'LENGTH' ? 'On the tape' : 'On the scale',
                     alt:
                        c.measure === 'LENGTH'
                           ? 'The fish on the tape'
                           : 'The fish on the scale',
                  },
               ].map((shot, i) =>
                  shot.url ? (
                     <figure
                        key={shot.caption}
                        className="m-0 flex min-w-0 flex-col gap-1.5"
                     >
                        <figcaption className="lab">
                           <span className="num">
                              {String(i + 1).padStart(2, '0')}
                           </span>{' '}
                           {shot.caption}
                        </figcaption>
                        <a
                           href={shot.url}
                           target="_blank"
                           rel="noreferrer"
                           className="block"
                           aria-label={`${shot.alt}, full size`}
                        >
                           <img
                              src={shot.url}
                              alt={shot.alt}
                              loading="lazy"
                              className="block aspect-[4/3] w-full bg-black-block object-contain"
                           />
                        </a>
                     </figure>
                  ) : null
               )}
            </div>
         ) : null}

         {entry.canReview ? (
            <div className="flex flex-col gap-3">
               <input
                  type="text"
                  value={note}
                  maxLength={280}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="A note for the angler"
                  aria-label="A note for the angler"
                  className="h-12 border-b border-dashed border-line-2 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3 focus:border-ink"
               />
               <div className="flex gap-2.5">
                  {entry.state !== 'COUNTED' ? (
                     <Button
                        type="button"
                        size="lg"
                        className="flex-1 text-[18px]"
                        disabled={working}
                        onClick={() => onReview(entry, 'accept', note)}
                     >
                        Accept entry
                     </Button>
                  ) : null}
                  {entry.state !== 'EXCLUDED' ? (
                     <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="px-[18px] text-[18px]"
                        disabled={working}
                        onClick={() => onReview(entry, 'exclude', note)}
                     >
                        Exclude
                     </Button>
                  ) : null}
               </div>
            </div>
         ) : entry.yours && entry.state !== 'EXCLUDED' ? (
            /* Your own entry: the one thing that is yours to do with it. */
            <Button
               type="button"
               variant="outline"
               size="lg"
               className="self-start px-[18px] text-[18px]"
               disabled={working}
               onClick={() => onWithdraw(entry)}
            >
               Withdraw
            </Button>
         ) : entry.canFlag ? (
            /* An entrant gets Flag where the organiser gets Accept and
               Exclude, on the same line the organiser's note sits on: the
               server will not hold an entry without a reason for it. */
            <div className="flex flex-col gap-3">
               <input
                  type="text"
                  value={note}
                  maxLength={280}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="What is not right"
                  aria-label="What is not right"
                  className="h-12 border-b border-dashed border-line-2 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3 focus:border-ink"
               />
               <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="self-start px-[18px] text-[18px]"
                  disabled={working || note.trim().length < 2}
                  onClick={() => onFlag(entry, note)}
               >
                  Flag
               </Button>
            </div>
         ) : null}
      </li>
   );
}
