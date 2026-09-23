import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import {
   applyFraming,
   framedOnLoad,
   framingStyle,
   resolveFraming,
   type Framing,
} from '@/lib/framing';

/*
 * A catch photograph cropped to a box, the way the angler framed it.
 *
 * For the places that draw a plain <img> rather than going through Img: the
 * small squares in a row, the season tiles, the strip under the log's photo.
 * The box is the caller's (its size, its ratio, its ground); this fills it
 * with a cover fit, holds the angler's point where they put it and pushes in
 * by their zoom. The box hides what spills, which a bare <img> cannot do for
 * itself once it is scaled, and that is the only reason there is a wrapper.
 *
 * A photograph nobody framed gets the catch default (lib/framing.ts), so a
 * tall one in a wide box keeps the face.
 */
export function FramedPhoto({
   framing,
   className,
   imgClassName,
   alt,
   ...img
}: {
   framing?: Framing | null;
   /** The box: its size or ratio, and its ground while the bytes arrive. */
   className?: string;
   imgClassName?: string;
   alt: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'className' | 'style' | 'alt'>) {
   return (
      <span className={cn('relative block overflow-hidden', className)}>
         <img
            {...img}
            alt={alt}
            draggable={false}
            /* A picture already here is redrawn when its framing changes: the
               fit a pulled out one is drawn with is written by hand, and
               nothing else would take it back. */
            ref={(node) => {
               if (node?.complete && node.naturalWidth > 0) {
                  applyFraming(node, resolveFraming(framing));
               }
            }}
            onLoad={(event) => {
               framedOnLoad(framing)?.(event);
               img.onLoad?.(event);
            }}
            style={framingStyle(framing)}
            className={cn('block h-full w-full object-cover', imgClassName)}
         />
      </span>
   );
}
