import type { ReactNode } from 'react';
import type {
   Competition,
   JudgeView,
   JudgeYesNo,
} from '@/components/social/competitions-api';
import { CHECK_LABELS } from '@/components/social/entry-checks';
import { formatMeasure, type UnitChoice } from '@/lib/units';
import { cn } from '@/lib/utils';

/*
 * What the judge made of an entry, on the entry itself.
 *
 * The organiser sees the lot: its verdict in three words, its note, what it
 * read off the measure, whether the two photographs show the same fish,
 * whether the fish is on the measure, the species, anything that looked
 * edited, and the checks it had doubts about. It is laid out like the check
 * lines above it, label and finding, because it is the same kind of thing: a
 * second opinion, not a ruling. The organiser still decides.
 *
 * The angler sees one kind sentence, set off by a teal rule, and nothing
 * that reads as an accusation. Everybody else sees nothing; the server does
 * not send it to them.
 */

const VERDICT: Record<
   'accept' | 'review' | 'reject',
   { words: string; tone: string }
> = {
   accept: { words: 'Looks right', tone: 'text-ink' },
   review: { words: 'Worth a look', tone: 'text-teal-text' },
   reject: { words: 'Looks wrong', tone: 'text-destructive' },
};

const yesNo = (value: JudgeYesNo) =>
   value === 'yes' ? 'Yes' : value === 'no' ? 'No' : 'Not sure';

const TAMPER: Record<string, string> = {
   screen: 'A photo of a screen',
   edited_digits: 'Edited figures',
   lighting: 'Lighting that does not match',
   other: 'Something composed',
};

const modelName = (model: string | null) =>
   model === 'claude-sonnet-5' ? 'Claude Sonnet 5' : (model ?? 'The judge');

function Line({
   label,
   children,
   warn = false,
}: {
   label: string;
   children: ReactNode;
   warn?: boolean;
}) {
   return (
      <div className="grid grid-cols-[118px_1fr] items-baseline gap-2.5 py-[5px]">
         <dt className="g-tracked text-[15px] leading-[1.2] tracking-[0.07em]">
            {label}
         </dt>
         <dd
            className={cn(
               'min-w-0 text-[14px] leading-[1.4]',
               warn ? 'text-destructive' : 'text-ink-2'
            )}
         >
            {children}
         </dd>
      </div>
   );
}

export function JudgeFindings({
   judge,
   competition: c,
   units,
}: {
   judge: JudgeView | null | undefined;
   competition: Competition;
   units: UnitChoice;
}) {
   if (!judge) return null;

   /* The angler's own entry: the sentence written for them. */
   if (judge.audience === 'angler') {
      return (
         <div
            className="flex flex-col gap-1 border-l-2 border-teal pl-3.5"
            data-judge="angler"
         >
            <span className="lab">From the judge</span>
            <p className="text-[15px] leading-[1.5] text-ink-2">
               {judge.anglerNote}
            </p>
         </div>
      );
   }

   if (judge.status === 'unchecked') {
      return (
         <p className="text-[14px] text-ink-3" data-judge="unchecked">
            <span className="lab mr-2">The judge</span>
            Not seen by the judge. {judge.reason}
         </p>
      );
   }

   const verdict = VERDICT[judge.overall];
   const hasMeasure = c.rule !== 'SPECIES_VARIETY';
   const r = judge.reading;
   /* Read in whatever the measure was printed in, shown in the reader's
      own unit, converted once. */
   const metric =
      r.value === null || r.unit === null
         ? null
         : r.unit === 'in'
           ? r.value * 2.54
           : r.unit === 'lb'
             ? r.value * 0.45359237
             : r.value;
   const read = formatMeasure(metric, c.measure, units);
   const device = r.seen === 'none' ? null : r.seen;
   const doubts = judge.checks.filter((line) => line.verdict !== 'pass');
   const species =
      judge.species.plausible === 'yes'
         ? `Plausible${judge.species.bestGuess ? `, looks like ${judge.species.bestGuess.toLowerCase()}` : ''}`
         : judge.species.plausible === 'no'
           ? `Unlikely${judge.species.bestGuess ? `, looks like ${judge.species.bestGuess.toLowerCase()}` : ''}`
           : `Not sure${judge.species.bestGuess ? `, perhaps ${judge.species.bestGuess.toLowerCase()}` : ''}`;

   return (
      <section
         aria-label="What the judge found"
         className="flex flex-col gap-2.5 border border-line p-3.5"
         data-judge="organiser"
      >
         <div className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 flex-col">
               <span className="lab">The judge</span>
               <span className="truncate text-[13px] text-ink-3">
                  {modelName(judge.model)}
               </span>
            </span>
            <span
               className={cn(
                  'g-tracked shrink-0 text-[18px] leading-none',
                  verdict.tone
               )}
            >
               {verdict.words}
            </span>
         </div>

         {judge.organiserNote ? (
            <p className="text-[15px] leading-[1.5]">{judge.organiserNote}</p>
         ) : null}

         <dl className="flex flex-col">
            {hasMeasure ? (
               <>
                  <Line label="Read" warn={read === null}>
                     {read
                        ? `${read}${device ? ` on the ${device}` : ''}, ${Math.round(r.confidence * 100)}% sure`
                        : 'Could not be read'}
                  </Line>
                  <Line label="Same fish" warn={judge.sameFish === 'no'}>
                     {yesNo(judge.sameFish)}
                  </Line>
                  <Line
                     label={
                        c.measure === 'LENGTH' ? 'On the tape' : 'On the scale'
                     }
                     warn={judge.fishOnMeasure === 'no'}
                  >
                     {yesNo(judge.fishOnMeasure)}
                  </Line>
               </>
            ) : null}
            <Line label="Species" warn={judge.species.plausible === 'no'}>
               {species}
            </Line>
            <Line label="Edited" warn={judge.tamperSigns.length > 0}>
               {judge.tamperSigns.length
                  ? judge.tamperSigns
                       .map((sign) =>
                          [
                             TAMPER[sign.kind] ?? sign.kind,
                             sign.detail.replace(/\.$/, ''),
                          ]
                             .filter(Boolean)
                             .join(': ')
                       )
                       .join('. ') + '.'
                  : 'No sign of it'}
            </Line>
            {doubts.map((line) => (
               <Line
                  key={line.check}
                  label={CHECK_LABELS[line.check] ?? line.check}
                  warn={line.verdict === 'fail'}
               >
                  {line.verdict === 'fail' ? 'Did not pass. ' : 'Not sure. '}
                  {line.reason}
               </Line>
            ))}
         </dl>

         {judge.anglerNote ? (
            <p className="border-t border-line pt-2.5 text-[14px] text-ink-3">
               <span className="lab mr-2">The angler is told</span>
               {judge.anglerNote}
            </p>
         ) : null}
      </section>
   );
}
