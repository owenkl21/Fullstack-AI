import { Contours } from '@/components/brand/Contours';
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
   className,
}: {
   url: string | null | undefined;
   className?: string;
}) {
   return (
      <div
         aria-hidden="true"
         className={cn(
            'relative h-[140px] w-full overflow-hidden bg-black-block md:h-[220px]',
            className
         )}
      >
         {url ? (
            <img
               src={url}
               alt=""
               className="absolute inset-0 size-full object-cover"
               loading="eager"
            />
         ) : (
            <Contours seed={11} className="inset-0 h-full w-full opacity-70" />
         )}
      </div>
   );
}
