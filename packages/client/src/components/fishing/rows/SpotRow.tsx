import { Stars } from '@/components/fishing/reviews/Stars';
import type { SpotRating } from '@/components/fishing/reviews/reviews-api';
import { Row, RowNumber, type RowPhoto } from './Row';
import { formatDateTime, metaLine, plural, waterTypeWord } from './format';

/*
 * A spot as one row: the photo, the name, what anglers rate it, the water and
 * when it was last fished, and how many catches have come off it.
 */

export type SpotRowItem = {
   id: string;
   name: string;
   catchCount: number;
   createdAt?: string | null;
   waterType?: string | null;
   lastCatchAt?: string | null;
   rating?: SpotRating | null;
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
   const desktopLine = metaLine(water, when) || 'No date recorded';
   const catches = plural(item.catchCount, 'catch', 'catches');
   const rating = item.rating;
   const average = rating && rating.count > 0 ? rating.average : null;
   const avg = average === null ? '' : average.toFixed(1);
   const count = rating?.count ?? 0;
   const ratings = plural(count, 'rating', 'ratings');
   /* 52 square, so it reads the 160px copy and keeps the original as the
    * fallback for a spot photographed before the variants existed. */
   const photo = item.images?.[0]?.image;

   return (
      <Row
         to={`/sites/${item.id}`}
         title={item.name}
         subline={
            <>
               {/* A phone has no room for a third column, so the rating takes
                   the line under the name and the date gives way to it. The
                   list is still ordered by that date. */}
               <span className="mt-[3px] flex items-center gap-1.5 overflow-hidden whitespace-nowrap leading-[1.3] md:hidden">
                  {average !== null ? (
                     <>
                        <Stars
                           value={average}
                           className="gap-px [--star:13px]"
                        />
                        <span className="num font-medium text-ink">{avg}</span>
                        <span className="num text-ink-3">({count})</span>
                     </>
                  ) : (
                     <span className="text-ink-3">Not rated yet</span>
                  )}
                  {water ? <span className="truncate">· {water}</span> : null}
               </span>
               <span className="hidden truncate md:block">{desktopLine}</span>
            </>
         }
         label={`${item.name}, ${average !== null ? `rated ${avg} out of 5 from ${ratings}` : 'not rated yet'}, ${desktopLine}, ${catches}`}
         photoUrl={photoUrl ?? photo?.url ?? null}
         photoCardUrl={photo?.cardUrl}
         photoThumbUrl={photo?.thumbUrl}
         photoAlt={`Photo of ${item.name}`}
         right={
            <>
               {average !== null ? (
                  <span className="hidden w-32 items-center gap-2 md:inline-flex">
                     <Stars value={average} className="gap-px [--star:15px]" />
                     <span className="num text-sm font-medium text-ink">
                        {avg}{' '}
                        <span className="font-normal text-ink-3">
                           ({count})
                        </span>
                     </span>
                  </span>
               ) : (
                  <span className="hidden w-32 text-sm text-ink-3 md:block">
                     Not rated yet
                  </span>
               )}
               <RowNumber className="md:w-32 md:text-right">
                  {catches}
               </RowNumber>
            </>
         }
      />
   );
}
