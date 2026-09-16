import type { ReactNode } from 'react';
import { Row } from './Row';
import { gearTypeWords, metaLine } from './format';

/*
 * A gear item as one row. The photo is contained rather than cropped, because a rod
 * on a table is the whole length of the thing. Delete sits outside the row link.
 */

export type GearRowItem = {
   id: string;
   name: string;
   brand: string;
   type: string;
   imageUrl: string | null;
};

export function GearRow({
   item,
   trailing,
}: {
   item: GearRowItem;
   trailing?: ReactNode;
}) {
   /* TODO(api): the row wants "41 catches, best 6.1 kg" and a gear detail route to
    * link to (appendix E, A6). Until that exists the row opens the editor. */
   const subline = metaLine(item.brand || null, gearTypeWords(item.type).one);

   return (
      <Row
         to={`/gear/${item.id}/edit`}
         title={item.name}
         subline={subline || 'Brand not recorded'}
         label={`${item.name}, ${subline}`}
         photoUrl={item.imageUrl}
         photoAlt={`Photo of ${item.name}`}
         photoFit="contain"
         trailing={trailing}
      />
   );
}
