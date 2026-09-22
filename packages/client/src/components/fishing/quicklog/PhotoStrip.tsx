import { useEffect, useRef, useState } from 'react';
import { PlusIcon, ViewfinderCircleIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { FramedPhoto } from '@/components/FramedPhoto';
import { FrameTool } from '@/components/FrameTool';
import type { UploadedPhoto } from './PhotoBlock';
import { MAX_PHOTOS, PHOTO_TYPES, photoProblem, uploadPhoto } from './upload';

/*
 * The rest of the photographs.
 *
 * The first one is the cover: it is the picture in the frame above, the one
 * the feed crops and the one a competition puts on the board. The others sit
 * beside it as thumbnails; tapping one makes it the cover, which is also how
 * one is taken out of the frame without losing it.
 *
 * Every one of them is cropped to the feed's frame when the card is swiped,
 * so every one of them can be framed. The cover is framed in the block above,
 * where it is drawn large; the others carry a small viewfinder of their own.
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
   /* Which photograph the framing tool is open on, by its key. */
   const [framingKey, setFramingKey] = useState<string | null>(null);

   /*
    * The files picked in this sitting, as the browser holds them, by the key
    * the bucket gave each. The address an upload answers with is a copy the
    * bucket makes in its own time, so the thumbnail and the framing tool draw
    * from the file already here. Let go when the strip goes.
    */
   const localUrls = useRef(new Map<string, string>());
   useEffect(() => {
      const held = localUrls.current;
      return () => {
         held.forEach((url) => URL.revokeObjectURL(url));
         held.clear();
      };
   }, []);

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
         made.forEach((photo, i) => {
            const file = chosen[i];
            if (file) {
               localUrls.current.set(
                  photo.storageKey,
                  URL.createObjectURL(file)
               );
            }
         });
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

   const sourceOf = (photo: UploadedPhoto, index: number) =>
      (index === 0 && coverPreview) ||
      localUrls.current.get(photo.storageKey) ||
      photo.url;

   const framed = framingKey
      ? (photos.find((photo) => photo.storageKey === framingKey) ?? null)
      : null;

   return (
      <div className={cn('flex flex-col gap-2', className)}>
         <div className="flex items-center gap-2">
            {photos.map((photo, i) => (
               <div
                  key={photo.storageKey}
                  className="relative h-[66px] w-[88px] shrink-0"
               >
                  <button
                     type="button"
                     onClick={() => makeCover(i)}
                     aria-label={
                        i === 0
                           ? 'The cover photograph'
                           : `Make photograph ${i + 1} the cover`
                     }
                     className="relative block size-full overflow-hidden"
                  >
                     <FramedPhoto
                        src={sourceOf(photo, i)}
                        alt=""
                        framing={photo}
                        className="size-full"
                     />
                     {i === 0 ? (
                        <span className="lab absolute top-0 left-0 bg-teal px-1.5 py-1 text-[11px] tracking-[0.14em] text-teal-ink">
                           Cover
                        </span>
                     ) : null}
                  </button>
                  {/* A 44px reach around a small mark, in the corner the
                      Cover tab never uses. Beside the button, not inside it:
                      a button cannot hold another. The reach hangs 8px out
                      past the corner, into the gap, so the middle of the
                      thumbnail still makes it the cover. */}
                  {i > 0 ? (
                     <button
                        type="button"
                        onClick={() => setFramingKey(photo.storageKey)}
                        aria-label={`Frame photograph ${i + 1}`}
                        className="group absolute -top-2 -right-2 grid size-11 items-start justify-items-end pt-2 pr-2"
                     >
                        <span className="grid size-7 place-items-center bg-black-block/80 text-paper transition-colors duration-150 group-hover:text-teal">
                           <ViewfinderCircleIcon
                              aria-hidden="true"
                              strokeWidth={1.5}
                              className="size-[18px]"
                           />
                        </span>
                     </button>
                  ) : null}
               </div>
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
         <FrameTool
            open={framed !== null}
            onOpenChange={(open) => {
               if (!open) setFramingKey(null);
            }}
            src={framed ? sourceOf(framed, photos.indexOf(framed)) : null}
            framing={framed}
            onDone={(next) =>
               onChange(
                  photos.map((photo) =>
                     photo.storageKey === framingKey
                        ? { ...photo, ...next }
                        : photo
                  )
               )
            }
         />
         {error ? (
            <p className="text-[13px] text-destructive" role="alert">
               {error}
            </p>
         ) : null}
      </div>
   );
}
