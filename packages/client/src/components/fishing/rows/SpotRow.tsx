import { Row, RowNumber, type RowPhoto } from './Row';
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
   /* The photographs as the API sent them, so the 52px square reads the 160px
    * copy rather than whatever came off the camera. */
   images?: RowPhoto[];
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
   /* 52 square, so it reads the 160px copy and keeps the original as the
    * fallback for a spot photographed before the variants existed. */
   const photo = item.images?.[0]?.image;

   return (
      <Row
         to={`/sites/${item.id}`}
         title={item.name}
         subline={subline}
         label={`${item.name}, ${subline}, ${catches}`}
         photoUrl={photoUrl ?? photo?.url ?? null}
         photoCardUrl={photo?.cardUrl}
         photoThumbUrl={photo?.thumbUrl}
         photoAlt={`Photo of ${item.name}`}
         right={
            <RowNumber className="md:w-32 md:text-right">{catches}</RowNumber>
         }
      />
   );
}
