import { useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import {
   applyFraming,
   framedOnLoad,
   framingStyle,
   resolveFraming,
   type Framing,
} from '@/lib/framing';
import { FishMark } from '@/components/brand/FishMark';

/*
 * Every photograph the product draws on a list or a card goes through here.
 *
 * It exists because the app was serving a 4284 by 5712 original into a 40px
 * avatar, twenty five times down one feed, and the feed weighed 28 MB. The fix
 * is not a smaller picture, it is the right picture: the browser is handed all
 * the sizes that exist and picks the one that fits the box it is drawing into.
 *
 * Three things follow from that and all three are the point:
 *  - the box is fixed before the bytes arrive, so nothing under it ever jumps;
 *  - the mark sits in the box while it fills, so a slow photograph reads as the
 *    product waiting rather than as the product broken;
 *  - a photograph that never arrives gets the same treatment a missing one
 *    gets, not the browser's torn page.
 */

/* The widths the three variants really are, so the browser's density
 * arithmetic is arithmetic and not a guess. lib/images.ts makes the first two;
 * the third is whatever the camera wrote, and 2400 is a deliberate floor. */
const THUMB_W = 256;
const CARD_W = 1200;
const FULL_W = 2400;

export type ImgProps = {
   /** The original, at whatever size it was taken. */
   src?: string | null;
   /** 900px on the long edge. What a card or a tile should be reading. */
   cardSrc?: string | null;
   /** 160px on the long edge. What a row or an avatar should be reading. */
   thumbSrc?: string | null;
   alt: string;
   /**
    * The box, as a CSS ratio such as `4 / 3`. Leave it out only where the
    * photograph's own shape is the point and the caller has sized the wrapper.
    */
   ratio?: string;
   /**
    * The box is already there and already the right shape: fill it. For a
    * parent that has set its own height or ratio and positions this inside it.
    */
   fill?: boolean;
   /** How wide this box actually is, in the caller's own layout terms. */
   sizes?: string;
   /** Above the fold: load it now rather than when it is scrolled to. */
   priority?: boolean;
   /**
    * Offer the untouched original as well. Only the record does, because the
    * record is the photograph; on a card the original is never worth the wait.
    */
   full?: boolean;
   fit?: 'cover' | 'contain';
   /** Where the crop is taken from, when the angler has moved it. */
   objectPosition?: string;
   /**
    * A catch photograph's framing: the point the angler held and how far they
    * pushed in (lib/framing.ts). Pass the image itself, framed or not, and an
    * unframed one gets the catch default rather than dead centre. Leave it
    * out for anything that is not a catch photo (an avatar, a banner, gear, a
    * spot) and the picture is centred as it always was. It only means
    * something where the picture is cropped: a cover fit in a fixed box.
    */
   framing?: Framing | null;
   className?: string;
   imgClassName?: string;
};

export function Img({
   src,
   cardSrc,
   thumbSrc,
   alt,
   ratio,
   fill = false,
   sizes = '100vw',
   priority = false,
   full = false,
   fit = 'cover',
   objectPosition,
   framing,
   className,
   imgClassName,
}: ImgProps) {
   /* Keyed by the URL it settled on, so swapping photographs in a gallery puts
    * the mark back rather than showing the old picture's state over the new
    * picture's empty box. */
   const [settled, setSettled] = useState<{ url: string; ok: boolean } | null>(
      null
   );
   /*
    * A photograph logged before the variants existed has an original and
    * nothing beside it, and the backfill that makes the other two runs against
    * a live bucket. Rather than gamble on that having finished, a variant that
    * comes back missing drops this one box to the original for good. It costs
    * one wasted request on an old photograph and never lies to the reader.
    */
   const [degradedFor, setDegradedFor] = useState<string | null>(null);
   const degraded = Boolean(src) && degradedFor === src;

   /*
    * The ladder the browser gets to choose from, smallest first.
    *
    * The original is on it where `full` says so and nowhere else. A phone at
    * three times density asks for about 1200px of picture for a full width
    * card, and if the original is on the ladder it wins that arithmetic and we
    * are back to downloading four megabytes for a photograph of a fish. It is
    * also there when nothing else is, because a photograph with no variants is
    * better drawn large than not drawn.
    */
   const ladder: { url: string; width: number }[] = [];
   const offer = (url: string | null | undefined, width: number) => {
      /* A photograph the app serves off its own disk has no variants, so all
       * three URLs are the same string and only the first is a candidate. */
      if (!url || ladder.some((entry) => entry.url === url)) return;
      ladder.push({ url, width });
   };

   if (!degraded) {
      offer(thumbSrc, THUMB_W);
      offer(cardSrc, CARD_W);
   }
   if (full || degraded || ladder.length === 0) offer(src, FULL_W);

   const largest = ladder[ladder.length - 1] ?? null;
   const chosen = largest ? largest.url : (src ?? null);
   const srcSet =
      ladder.length > 1
         ? ladder.map((entry) => `${entry.url} ${entry.width}w`).join(', ')
         : undefined;

   const state = !chosen
      ? 'failed'
      : settled && settled.url === chosen
        ? settled.ok
           ? 'loaded'
           : 'failed'
        : 'loading';

   /*
    * Idempotent for the same reason the ref above is: it is reached from it.
    *
    * The browser picks its own rung off the ladder, so the URL that failed is
    * read off the element, not assumed. On the record, where the original is
    * the largest rung, assuming it was the original that failed blamed a
    * missing card copy on the photograph itself and the record showed the
    * house fish over a picture that would have loaded fine on its own.
    */
   const onFailed = (url: string) => {
      if (src && url !== src && degradedFor !== src) {
         setDegradedFor(src);
         return;
      }
      setSettled((was) =>
         was && was.url === url && !was.ok ? was : { url, ok: false }
      );
   };

   const boxStyle: CSSProperties | undefined = ratio
      ? { aspectRatio: ratio }
      : undefined;

   return (
      <div
         className={cn(
            'overflow-hidden bg-bg-2',
            /*
             * A ratio needs a width to work from. Without one the box takes
             * its height from the column it sits in and derives the width
             * from the ratio, which on the feed made a 4:3 photograph 660
             * pixels wide inside a 358 pixel card: blown up, overflowing and
             * soft. A caller that sets its own size still wins, because its
             * classes come after these.
             */
            fill ? 'absolute inset-0 size-full' : 'relative w-full',
            className
         )}
         style={boxStyle}
      >
         {chosen && state !== 'failed' ? (
            <img
               key={chosen}
               ref={(node) => {
                  /*
                   * A photograph already in the cache is complete before React
                   * can hear onLoad, which used to leave the mark sitting over
                   * a picture that had arrived.
                   *
                   * This is an inline ref, so React detaches and reattaches it
                   * on every render and this runs every time. It must therefore
                   * be idempotent: setting a fresh object here unconditionally
                   * is a new value on every pass, React can never bail out of
                   * the re-render, and fifty of these on one feed took the page
                   * to "Maximum update depth exceeded". Only report a change
                   * that is actually a change.
                   */
                  if (!node || !node.complete) return;
                  /* A framing that changed after the picture arrived is
                     drawn again: a pulled out one is written by hand. */
                  if (
                     node.naturalWidth > 0 &&
                     framing !== undefined &&
                     fit === 'cover' &&
                     (ratio || fill)
                  ) {
                     applyFraming(node, resolveFraming(framing));
                  }
                  if (node.naturalWidth > 0) {
                     setSettled((was) =>
                        was && was.url === chosen && was.ok
                           ? was
                           : { url: chosen, ok: true }
                     );
                     return;
                  }
                  onFailed(node.currentSrc || chosen);
               }}
               src={chosen}
               srcSet={srcSet}
               sizes={srcSet ? sizes : undefined}
               alt={alt}
               loading={priority ? 'eager' : 'lazy'}
               decoding={priority ? 'sync' : 'async'}
               fetchPriority={priority ? 'high' : undefined}
               onLoad={(event) => {
                  /* A pulled out photograph is drawn once its shape is known. */
                  if (
                     framing !== undefined &&
                     fit === 'cover' &&
                     (ratio || fill)
                  ) {
                     framedOnLoad(framing)?.(event);
                  }
                  setSettled((was) =>
                     was && was.url === chosen && was.ok
                        ? was
                        : { url: chosen, ok: true }
                  );
               }}
               onError={(event) =>
                  onFailed(event.currentTarget.currentSrc || chosen)
               }
               style={
                  /* The box already hides what spills, so a pushed in
                     photograph is clipped by it and needs no wrapper. */
                  framing !== undefined && fit === 'cover' && (ratio || fill)
                     ? framingStyle(framing)
                     : objectPosition
                       ? { objectPosition }
                       : undefined
               }
               className={cn(
                  ratio || fill
                     ? 'absolute inset-0 h-full w-full'
                     : 'block h-auto w-full',
                  fit === 'contain' ? 'object-contain' : 'object-cover',
                  'transition-opacity duration-300 [transition-timing-function:var(--ease)]',
                  state === 'loaded' ? 'opacity-100' : 'opacity-0',
                  imgClassName
               )}
            />
         ) : null}

         {state === 'loading' ? (
            <span
               aria-hidden="true"
               className="shimmer absolute inset-0 flex items-center justify-center bg-bg-2"
            >
               <FishMark className="h-1/3 w-1/3 text-ink-3/30" />
            </span>
         ) : null}

         {state === 'failed' ? (
            /* The same square a catch with no photograph gets. A picture that
             * did not arrive and a picture that was never taken look the same
             * to the reader, and neither of them is a broken icon. */
            <span
               aria-hidden="true"
               className="absolute inset-0 flex items-center justify-center bg-ink/85"
            >
               <FishMark className="h-1/3 w-1/3 text-paper/40" />
               <span className="absolute inset-x-0 bottom-0 h-1 bg-teal" />
            </span>
         ) : null}
      </div>
   );
}
