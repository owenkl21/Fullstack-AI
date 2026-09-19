import axios from 'axios';
import { makeImageVariants, type VariantName } from '@/lib/images';
import type { UploadedPhoto } from './PhotoBlock';

/*
 * A photograph on its way to the bucket, without the frame around it.
 *
 * The hero photo has a frame, a shutter and a place to drag; the extra
 * photographs in the strip have none of that, so they only need the two
 * calls: sign, then put the bytes straight on the presigned URL.
 */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
/* What the long form allowed, and what the strip counts up to. */
export const MAX_PHOTOS = 8;

export function photoProblem(file: File) {
   if (!PHOTO_TYPES.includes(file.type)) {
      return 'That kind of photo will not go up. Use a JPG, PNG or WebP.';
   }
   if (file.size > PHOTO_MAX_BYTES) {
      return 'That photo is over 10 MB. Take it again at a smaller size.';
   }
   return null;
}

type SignedVariant = {
   variant: VariantName;
   contentType: string;
   uploadUrl: string;
};

/**
 * Sign, put the original, then put the two smaller copies beside it.
 *
 * The copies are what the feed, the rows and the record's ladder ask for
 * first. Without them the server still signs their URLs, the bucket answers
 * 404, and every phone-logged catch was drawn from its original or not at
 * all. Same convention as the long form's picker: the copies are not fatal,
 * the original is the upload.
 */
export async function uploadPhoto(file: File): Promise<UploadedPhoto> {
   let variants: Awaited<ReturnType<typeof makeImageVariants>> = [];
   try {
      variants = await makeImageVariants(file);
   } catch (error) {
      console.warn('Could not make smaller copies of this photo', error);
   }

   const { data: signed } = await axios.post<{
      storageKey: string;
      uploadUrl: string;
      readUrl: string;
      cardReadUrl?: string | null;
      thumbReadUrl?: string | null;
      variants?: SignedVariant[];
   }>('/api/uploads/sign', {
      scope: 'catch',
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      variants: variants.map((entry) => entry.variant),
   });
   await axios.put(signed.uploadUrl, file, {
      headers: { 'Content-Type': file.type },
   });
   await putVariants(variants, signed.variants ?? []);
   return {
      storageKey: signed.storageKey,
      url: signed.readUrl,
      cardUrl: signed.cardReadUrl ?? null,
      thumbUrl: signed.thumbReadUrl ?? null,
      focusX: 0.5,
      focusY: 0.5,
   };
}

/** The small copies go up after the original, in parallel, and a miss is a warning. */
export async function putVariants(
   made: Awaited<ReturnType<typeof makeImageVariants>>,
   signed: SignedVariant[]
) {
   await Promise.all(
      made.map(async (entry) => {
         const target = signed.find((item) => item.variant === entry.variant);
         if (!target) return;
         try {
            await axios.put(target.uploadUrl, entry.blob, {
               headers: { 'Content-Type': target.contentType },
            });
         } catch (error) {
            console.warn(`The ${entry.variant} copy did not go up`, error);
         }
      })
   );
}
