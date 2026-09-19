import { useRef, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import type { UploadedPhoto } from './PhotoBlock';
import { MAX_PHOTOS, PHOTO_TYPES, photoProblem, uploadPhoto } from './upload';

/*
 * The rest of the photographs.
 *
 * The first one is the cover: it is the picture in the frame above, the one
 * the feed crops and the one a competition puts on the board. The others sit
 * beside it as thumbnails; tapping one makes it the cover, which is also how
 * one is taken out of the frame without losing it.
 */
export function PhotoStrip({
   photos,
   onChange,
   onBusyChange,
   onFiles,
   coverPreview,
   className,
}: {
   photos: UploadedPhoto[];
   onChange: (next: UploadedPhoto[]) => void;
   onBusyChange: (busy: boolean) => void;
   /* The chosen files themselves, before the bucket has them, so the form
      can read what the camera wrote into each one. */
   onFiles?: (files: File[]) => void;
   /* The cover as the browser already holds it, while the bucket is still
      making its own copy of it. */
   coverPreview?: string | null;
   className?: string;
}) {
   const pickRef = useRef<HTMLInputElement>(null);
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);

   const add = async (files: FileList | null) => {
      if (!files?.length) return;
      const room = MAX_PHOTOS - photos.length;
      const chosen = [...files].slice(0, Math.max(0, room));
      const bad = chosen.map(photoProblem).find(Boolean);
      if (bad) {
         setError(bad);
         return;
      }
      setError(null);
      onFiles?.(chosen);
      setBusy(true);
      onBusyChange(true);
      try {
         const made = await Promise.all(chosen.map(uploadPhoto));
         onChange([...photos, ...made]);
      } catch {
         setError('That photo did not go up. Try it again.');
      } finally {
         setBusy(false);
         onBusyChange(false);
         if (pickRef.current) pickRef.current.value = '';
      }
   };

   const makeCover = (index: number) => {
      if (index === 0) return;
      const next = [...photos];
      const [picked] = next.splice(index, 1);
      if (picked) onChange([picked, ...next]);
   };

   return (
      <div className={cn('flex flex-col gap-2', className)}>
         <div className="flex items-center gap-2">
            {photos.map((photo, i) => (
               <button
                  key={photo.storageKey}
                  type="button"
                  onClick={() => makeCover(i)}
                  aria-label={
                     i === 0
                        ? 'The cover photograph'
                        : `Make photograph ${i + 1} the cover`
                  }
                  className="relative h-[66px] w-[88px] shrink-0 overflow-hidden"
               >
                  <img
                     src={(i === 0 && coverPreview) || photo.url}
                     alt=""
                     className="h-full w-full object-cover"
                  />
                  {i === 0 ? (
                     <span className="lab absolute top-0 left-0 bg-teal px-1.5 py-1 text-[11px] tracking-[0.14em] text-teal-ink">
                        Cover
                     </span>
                  ) : null}
               </button>
            ))}
            {photos.length < MAX_PHOTOS ? (
               <button
                  type="button"
                  onClick={() => pickRef.current?.click()}
                  aria-label="Add another photograph"
                  disabled={busy}
                  className="grid h-[66px] w-[88px] shrink-0 place-items-center border border-dashed border-line-2 text-ink-2 transition-colors duration-150 hover:border-ink disabled:opacity-60"
               >
                  <PlusIcon
                     aria-hidden="true"
                     strokeWidth={1.5}
                     className="size-5"
                  />
               </button>
            ) : null}
            <span className="num ml-2 text-[14px] text-ink-3">
               {photos.length} of {MAX_PHOTOS}
            </span>
         </div>
         <input
            ref={pickRef}
            type="file"
            multiple
            accept={PHOTO_TYPES.join(',')}
            className="sr-only"
            aria-label="Add another photograph"
            onChange={(event) => void add(event.target.files)}
         />
         {error ? (
            <p className="text-[13px] text-destructive" role="alert">
               {error}
            </p>
         ) : null}
      </div>
   );
}
