import { Contours } from '@/components/brand/Contours';
import { Img } from '@/components/Img';
import { cn } from '@/lib/utils';

/*
 * The wide photograph behind an angler's name.
 *
 * With a photograph it is the coast they fish. Without one it is the sea floor
 * contours the rest of the product draws, so a new profile is not a grey
 * rectangle with a name under it. Either way it is a picture, never a colour.
 */
export function Banner({
   url,
   cardUrl,
   className,
}: {
   url: string | null | undefined;
   /* 900px on the long edge, which is more than a 220px band ever needs. */
   cardUrl?: string | null;
   className?: string;
}) {
   return (
      <div
         aria-hidden="true"
         className={cn(
            /* The contour ink is a faint version of the page's own ink, so the
             * ground has to be the page's second surface, not the black block,
             * or the strokes vanish into it. */
            'relative h-[140px] w-full overflow-hidden bg-bg-2 md:h-[220px]',
            className
         )}
      >
         {url ? (
            /*
             * The band at the top of a profile, and the first thing on the
             * screen, so it loads without waiting to be scrolled to. It is
             * never more than 220px tall, so the card copy is plenty.
             */
            <Img
               src={url}
               cardSrc={cardUrl}
               alt=""
               priority
               fill
               sizes="100vw"
            />
         ) : (
            <Contours seed={11} className="inset-0 h-full w-full" />
         )}
      </div>
   );
}
