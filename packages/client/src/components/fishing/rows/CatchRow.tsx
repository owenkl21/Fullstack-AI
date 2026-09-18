import { Row, RowNumber, type RowPhoto } from './Row';
import {
   formatDateTime,
   formatLength,
   formatWeight,
   loggedNote,
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
   /*
    * When the catch was written up. Optional because only the angler's own log
    * asks for it: that list is ordered by the day a catch was posted, so a row
    * out of date order needs to say so. A list ordered by the fish itself, like
    * the catches on a spot, leaves it out and the note never appears.
    */
   createdAt?: string | null;
   count: number;
   length: number | null;
   weight: number | null;
   site: { id: string; name: string } | null;
   /*
    * The photographs as the API sent them, so the row can take the 160px copy
    * for its 52px square without every list page having to thread three URLs
    * through by hand. The page still passes `photoUrl` and that stays the
    * fallback for a catch photographed before the variants existed.
    */
   images?: RowPhoto[];
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
   /*
    * Last in the line, and only when the two days disagree. The eye reads the
    * fish, then where it came from, and only then needs to be told that this
    * one was typed up later.
    */
   const logged = loggedNote(item.caughtAt, item.createdAt);
   const subline = metaLine(when, where, fish, logged);

   /* The row draws 52 square, so it wants the 160px copy. The page still
    * passes the original as `photoUrl` and that is what a catch photographed
    * before the variants existed falls back to. */
   const photo = item.images?.[0]?.image;

   const lengthText = formatLength(item.length);
   const weightText = formatWeight(item.weight);
   const headline = lengthText ?? weightText;

   return (
      <Row
         to={`/catches/${item.id}`}
         title={item.title}
         subline={subline}
         label={`${item.title}, ${subline}`}
         photoUrl={photoUrl ?? photo?.url ?? null}
         photoCardUrl={photo?.cardUrl}
         photoThumbUrl={photo?.thumbUrl}
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
