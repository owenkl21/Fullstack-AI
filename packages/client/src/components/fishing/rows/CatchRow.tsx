import { Row, RowNumber } from './Row';
import {
   formatDateTime,
   formatLength,
   formatWeight,
   metaLine,
   plural,
} from './format';

/*
 * A catch as one row: the photo, what was caught, when and where it happened, and
 * the measurement on the right. Length and weight are both in the row now; on a
 * wide screen they line up as two tabular columns.
 */

export type CatchRowItem = {
   id: string;
   title: string;
   caughtAt: string;
   count: number;
   length: number | null;
   weight: number | null;
   site: { id: string; name: string } | null;
};

export function CatchRow({
   item,
   photoUrl,
   marked = false,
}: {
   item: CatchRowItem;
   photoUrl?: string | null;
   marked?: boolean;
}) {
   const when = formatDateTime(item.caughtAt);
   /*
    * No spot is not worth a line. It used to say "No spot recorded", which on a
    * phone truncated to "No spot recor..." and told the reader nothing they
    * could not already see. The date alone reads cleanly.
    */
   const where = item.site?.name ?? null;
   const fish = item.count > 1 ? plural(item.count, 'fish', 'fish') : null;
   const subline = metaLine(when, where, fish);

   const lengthText = formatLength(item.length);
   const weightText = formatWeight(item.weight);
   const headline = lengthText ?? weightText;

   return (
      <Row
         to={`/catches/${item.id}`}
         title={item.title}
         subline={subline}
         label={`${item.title}, ${subline}`}
         photoUrl={photoUrl}
         photoAlt={`Photo of ${item.title}`}
         marked={marked}
         right={
            headline ? (
               /*
                * Two columns, length then weight, each present whether or not
                * it was taken. A row that only ever showed centimetres made
                * the log look as though nothing was ever weighed.
                */
               <span className="flex items-baseline gap-4 md:gap-6">
                  <span className="flex flex-col items-end md:w-24">
                     <span className="lab text-ink-3">Length</span>
                     {lengthText ? (
                        <RowNumber>{lengthText}</RowNumber>
                     ) : (
                        <span className="text-[13px] text-ink-3">
                           Not taken
                        </span>
                     )}
                  </span>
                  <span className="flex flex-col items-end md:w-24">
                     <span className="lab text-ink-3">Weight</span>
                     {weightText ? (
                        <RowNumber>{weightText}</RowNumber>
                     ) : (
                        <span className="text-[13px] text-ink-3">
                           Not taken
                        </span>
                     )}
                  </span>
               </span>
            ) : (
               <span className="text-sm text-ink-3 md:w-48 md:text-right">
                  Not measured
               </span>
            )
         }
      />
   );
}
