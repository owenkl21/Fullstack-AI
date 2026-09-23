import type {
   CheckCode,
   Competition,
   CompetitionEntry,
   CompetitionMeasure,
   EntryCheck,
} from '@/components/social/competitions-api';
import { formatMeasure, type UnitChoice } from '@/lib/units';

/*
 * The six checks, named once.
 *
 * An organiser meets them twice: as a list of what will be checked while
 * starting a competition, and as the report on an entry afterwards. They are
 * the same six things in the same order both times, so they are written down
 * here once and rendered twice rather than worded twice.
 *
 * The long form is the sentence on the start flow ("A fish in the photo").
 * The short form is the label on an entry line ("Fish in the photo"), with
 * the finding beside it as a phrase rather than the server's sentence.
 */

/* The order every list of checks is drawn in, on both screens. */
export const CHECK_ORDER: readonly CheckCode[] = [
   'fish',
   'species',
   'figure',
   'window',
   'area',
   'duplicate',
];

/** The label on a check line, beside the mark. */
export const CHECK_LABELS: Record<CheckCode, string> = {
   fish: 'Fish in the photo',
   species: 'Species',
   figure: 'Figure',
   window: 'Window',
   area: 'Area',
   duplicate: 'Entered once',
};

/**
 * The same six as sentences, for the organiser starting a competition. A
 * most-species competition asks for one photo and no figure, so it is not
 * promised a reading or a comparison of two photos it will never have.
 */
export function checkSentences(
   measure: CompetitionMeasure,
   rule?: Competition['rule']
): string[] {
   const measured = rule !== 'SPECIES_VARIETY';
   return [
      'A fish in the photo',
      'The species the namer sees',
      ...(measured
         ? [
              measure === 'LENGTH'
                 ? 'The figure read off the tape'
                 : 'The figure read off the scale',
           ]
         : []),
      'Caught inside the window',
      'Caught inside the area',
      'Not entered twice',
      /* The judge's own question, the one no single check can ask. */
      ...(measured ? ['The same fish in both photos'] : []),
   ];
}

/* The report in the order above, with anything the server did not send
   dropped rather than invented. */
export function orderedReport(report: EntryCheck[]): EntryCheck[] {
   const byCode = new Map(report.map((line) => [line.code, line]));
   return CHECK_ORDER.map((code) => byCode.get(code)).filter(
      (line): line is EntryCheck => Boolean(line)
   );
}

/* The day of the competition a catch fell on, counting the first day as 1. */
function dayOf(caughtAt: string, startsAt: string): number | null {
   const caught = new Date(caughtAt).getTime();
   const start = new Date(startsAt).getTime();
   if (Number.isNaN(caught) || Number.isNaN(start) || caught < start)
      return null;
   return Math.floor((caught - start) / 86400000) + 1;
}

/*
 * The finding, as a phrase.
 *
 * The server sends one full sentence per check. A line on an entry has room
 * for a phrase, so the phrase is rebuilt here from what the entry already
 * carries as fields, and only falls back to the server's sentence where the
 * fact lives nowhere else. Two of them are read back out of that sentence
 * (the namer's percentage, the distance from the water) because the API has
 * no structured form of either; both degrade to the whole sentence rather
 * than to a wrong number when the wording changes.
 */
export function checkValue(
   check: EntryCheck,
   entry: CompetitionEntry,
   competition: Competition,
   units: UnitChoice
): string {
   const detail = check.detail.replace(/\s+$/, '');
   const passed = check.status === 'pass';

   switch (check.code) {
      case 'fish':
         return passed ? 'Yes' : detail;

      case 'species': {
         if (!passed) return detail;
         const agrees = /^the namer agrees/i.test(detail);
         const sure = /\((\d+)\s*%\)/.exec(detail);
         return agrees && sure ? `The namer agrees, ${sure[1]}%` : detail;
      }

      case 'figure': {
         if (check.status === 'skip') {
            if (/not switched on/i.test(detail))
               return 'Not read. The reader is off.';
            if (/did not answer/i.test(detail))
               return 'Not read. The reader did not answer.';
            return `Not read. ${detail}`;
         }
         if (!passed) return detail;
         const read = formatMeasure(
            entry.readValue,
            competition.measure,
            units
         );
         return read ? `Read ${read}` : detail;
      }

      case 'window': {
         if (!passed) return detail;
         const day = dayOf(entry.caughtAt, competition.startsAt);
         return day ? `Inside, day ${day}` : 'Inside';
      }

      case 'area': {
         if (!passed) return detail;
         if (competition.areaType === 'ANYWHERE') return 'Anywhere counts';
         /* "11 km from Oranjeville, within 25 km." keeps its first clause. */
         const near = /^(\d+\s*km from [^,.]+)/i.exec(detail);
         return near ? near[1]! : detail.replace(/\.$/, '');
      }

      case 'duplicate':
         return passed ? 'Yes' : detail;

      default:
         return detail;
   }
}
