import { Row, RowNumber } from './Row';
import { formatDateTime, metaLine, plural, waterTypeWord } from './format';

/*
 * A spot as one row: the photo, the name, the water and when it was last fished,
 * and how many catches have come off it.
 */

export type SpotRowItem = {
   id: string;
   name: string;
   catchCount: number;
   createdAt?: string | null;
   /* TODO(api): GET /api/sites/me returns neither the water type nor a last fished
    * date (appendix E, B3 and B6). Both render the moment the endpoint sends them. */
   waterType?: string | null;
   lastCatchAt?: string | null;
   latitude?: number | null;
   longitude?: number | null;
};

export function SpotRow({
   item,
   photoUrl,
}: {
   item: SpotRowItem;
   photoUrl?: string | null;
}) {
   const water = waterTypeWord(item.waterType);
   const lastFished = formatDateTime(item.lastCatchAt);
   const added = formatDateTime(item.createdAt);
   const when = lastFished
      ? `Last fished ${lastFished}`
      : added
        ? `Added ${added}`
        : null;
   const subline = metaLine(water, when) || 'No date recorded';
   const catches = plural(item.catchCount, 'catch', 'catches');

   return (
      <Row
         to={`/sites/${item.id}`}
         title={item.name}
         subline={subline}
         label={`${item.name}, ${subline}, ${catches}`}
         photoUrl={photoUrl}
         photoAlt={`Photo of ${item.name}`}
         right={
            <RowNumber className="md:w-32 md:text-right">{catches}</RowNumber>
         }
      />
   );
}
