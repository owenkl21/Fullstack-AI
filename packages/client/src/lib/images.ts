/*
 * Three sizes of one photograph, made in the browser at the moment it is picked.
 *
 * Nothing in this stack can afford to resize on the server: the API runs in a
 * small container, it already gets turned away under load, and a resize there
 * would be paid for by every reader of every list. The browser is holding the
 * full resolution file anyway, so this is the one place in the product where
 * the work costs nobody anything.
 *
 * Read the file's own metadata first. lib/exif.ts takes the shutter time and
 * the position off the bytes as they came off the camera, and a canvas keeps
 * pixels and drops every tag, so the order is: read the meta, then resize. That
 * is fine because by then the app has already taken what it needs.
 *
 * The keys these three end up under are the server's business and are written
 * down in one place, packages/server/services/uploads.service.ts. This file
 * makes the pictures; it does not name them.
 */

export type VariantName = 'card' | 'thumb';

/*
 * The long edge, not the width, so a portrait fish held up to the camera and a
 * landscape beach come out of here the same weight. 900 is a comfortable two
 * and a half times the widest card a phone draws; 160 covers a 52px row and a
 * 40px avatar at any pixel density anyone ships.
 *
 * Measured through this exact path in Chromium, on a 4284 by 5712 source, the
 * size the owner's own photographs come off the phone at:
 *
 *   original  4284 x 5712   5858 kB
 *   card       675 x  900    130 kB    45 times smaller
 *   thumb      120 x  160      6 kB   955 times smaller
 *
 * Which is the whole of the fix: a feed of twenty five cards was pulling 28 MB
 * and is now pulling a few hundred kilobytes of it.
 */
/*
 * Sized by WIDTH, not by the long edge, because width is the only thing a
 * srcset entry can promise. A portrait photograph capped at 900 on its long
 * edge is about 500 wide; declaring it as `900w` told the browser it had
 * something it did not, so it picked that copy for a box far wider and drew
 * it soft. The number here is the number the ladder quotes.
 *
 * 1200 is the card because a phone at three times density asks for about
 * 1170 across a full-width photograph, and 256 is the thumb because a 52px
 * row photograph at that density asks for 156.
 */
export const VARIANT_SPEC: Record<
   VariantName,
   { maxWidth: number; quality: number }
> = {
   card: { maxWidth: 1200, quality: 0.8 },
   thumb: { maxWidth: 256, quality: 0.74 },
};

export type ResizedVariant = {
   variant: VariantName;
   blob: Blob;
   width: number;
   height: number;
};

type Decoded = {
   source: CanvasImageSource;
   width: number;
   height: number;
   release: () => void;
};

/*
 * createImageBitmap where it exists, because it is the one decode path that
 * will honour the camera's orientation tag on request. A phone held sideways
 * writes the pixels one way and the rotation beside them, and a canvas that
 * ignores that turns every second fish on its side.
 */
async function decode(file: File): Promise<Decoded> {
   if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file, {
         imageOrientation: 'from-image',
      } as ImageBitmapOptions);
      return {
         source: bitmap,
         width: bitmap.width,
         height: bitmap.height,
         release: () => bitmap.close(),
      };
   }

   const objectUrl = URL.createObjectURL(file);
   const image = new Image();
   image.decoding = 'sync';
   image.src = objectUrl;

   try {
      await new Promise<void>((resolve, reject) => {
         image.onload = () => resolve();
         image.onerror = () =>
            reject(new Error('The photo could not be read.'));
      });
   } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
   }

   return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
   };
}

function drawn(
   decoded: Decoded,
   maxWidth: number,
   quality: number
): Promise<{ blob: Blob; width: number; height: number }> {
   /* Never upscale. A photograph smaller than the target is already the
    * variant, and blowing it up would cost bytes to lose sharpness. */
   const scale = Math.min(1, maxWidth / decoded.width);
   const width = Math.max(1, Math.round(decoded.width * scale));
   const height = Math.max(1, Math.round(decoded.height * scale));

   const canvas = document.createElement('canvas');
   canvas.width = width;
   canvas.height = height;

   const context = canvas.getContext('2d');
   if (!context) {
      return Promise.reject(new Error('The photo could not be resized.'));
   }

   context.imageSmoothingEnabled = true;
   context.imageSmoothingQuality = 'high';
   context.drawImage(decoded.source, 0, 0, width, height);

   return new Promise((resolve, reject) => {
      canvas.toBlob(
         (blob) => {
            if (!blob) {
               reject(new Error('The photo could not be resized.'));
               return;
            }
            resolve({ blob, width, height });
         },
         'image/jpeg',
         quality
      );
   });
}

/**
 * The card and thumb versions of a picked file, in that order.
 *
 * JPEG whatever went in, because these two are only ever read by an `<img>`
 * and a photograph has nothing to gain from PNG. The original goes up beside
 * them untouched, so nothing is lost by this being lossy.
 */
export async function makeImageVariants(file: File): Promise<ResizedVariant[]> {
   const decoded = await decode(file);

   try {
      const out: ResizedVariant[] = [];
      for (const variant of ['card', 'thumb'] as const) {
         const spec = VARIANT_SPEC[variant];
         const { blob, width, height } = await drawn(
            decoded,
            spec.maxWidth,
            spec.quality
         );
         out.push({ variant, blob, width, height });
      }
      return out;
   } finally {
      decoded.release();
   }
}
