import axios from 'axios';
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

export async function uploadPhoto(file: File): Promise<UploadedPhoto> {
   const { data: signed } = await axios.post<{
      storageKey: string;
      uploadUrl: string;
      readUrl: string;
   }>('/api/uploads/sign', {
      scope: 'catch',
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
   });
   await axios.put(signed.uploadUrl, file, {
      headers: { 'Content-Type': file.type },
   });
   return {
      storageKey: signed.storageKey,
      url: signed.readUrl,
      focusX: 0.5,
      focusY: 0.5,
   };
}
