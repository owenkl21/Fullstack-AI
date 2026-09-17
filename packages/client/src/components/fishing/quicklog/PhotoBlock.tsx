import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { cn } from '@/lib/utils';

/*
 * The photo, taken and sent while the rest of the catch is being filled in. It uses
 * the same upload the other forms use; the shutter flashes, the picture fades in and
 * settles, and a photo still going up is the one thing that holds the save.
 */
export type UploadedPhoto = { storageKey: string; url: string };

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

export function PhotoBlock({
   onChange,
   onBusyChange,
   onFile,
   initial = null,
}: {
   onChange: (photo: UploadedPhoto | null) => void;
   onBusyChange: (busy: boolean) => void;
   /* The file as picked, before the upload, for what the camera wrote in it. */
   onFile?: (file: File) => void;
   /* A photo already sent up, when a draft is reopened. */
   initial?: UploadedPhoto | null;
}) {
   const inputRef = useRef<HTMLInputElement>(null);
   const pickRef = useRef<HTMLInputElement>(null);
   const previewRef = useRef<string | null>(null);
   const [preview, setPreview] = useState<string | null>(initial?.url ?? null);
   const [settled, setSettled] = useState(Boolean(initial));
   const [flash, setFlash] = useState(false);
   const [progress, setProgress] = useState(0);
   const [isUploading, setIsUploading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      return () => {
         if (previewRef.current) {
            URL.revokeObjectURL(previewRef.current);
         }
      };
   }, []);

   const showPreview = (file: File) => {
      if (previewRef.current) {
         URL.revokeObjectURL(previewRef.current);
      }
      const url = URL.createObjectURL(file);
      previewRef.current = url;
      setPreview(url);
      setSettled(false);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 420);
      requestAnimationFrame(() =>
         requestAnimationFrame(() => setSettled(true))
      );
   };

   const upload = async (file: File) => {
      setError(null);
      setProgress(0);
      setIsUploading(true);
      onBusyChange(true);
      try {
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
         // Straight to R2 on the presigned URL. The bytes never pass through
         // the API, so the size cap is ours rather than a host's. Needs the
         // bucket CORS policy to allow PUT from this origin.
         await axios.put(signed.uploadUrl, file, {
            headers: { 'Content-Type': file.type },
            onUploadProgress: (event) => {
               if (event.total) {
                  setProgress(Math.round((event.loaded / event.total) * 100));
               }
            },
         });
         onChange({ storageKey: signed.storageKey, url: signed.readUrl });
      } catch {
         onChange(null);
         setError(
            'The photo did not go up. Take it again, or save the catch without it.'
         );
      } finally {
         setIsUploading(false);
         onBusyChange(false);
      }
   };

   const onSelect = (file: File | undefined) => {
      if (!file) {
         return;
      }
      if (!ACCEPTED.includes(file.type)) {
         setError('That kind of photo will not go up. Use a JPG, PNG or WebP.');
         return;
      }
      if (file.size > MAX_BYTES) {
         setError('That photo is over 10 MB. Take it again at a smaller size.');
         return;
      }
      onFile?.(file);
      showPreview(file);
      void upload(file);
      // Cleared so taking the same photo twice still fires a change.
      if (inputRef.current) inputRef.current.value = '';
      if (pickRef.current) pickRef.current.value = '';
   };

   const clear = () => {
      if (previewRef.current) {
         URL.revokeObjectURL(previewRef.current);
         previewRef.current = null;
      }
      setPreview(null);
      setProgress(0);
      setError(null);
      onChange(null);
      if (inputRef.current) {
         inputRef.current.value = '';
      }
   };

   const control =
      'g-tracked relative z-[1] inline-flex h-11 items-center border border-paper/50 bg-black-block/45 px-5 text-[20px] text-paper transition-[background-color,transform] duration-150 [transition-timing-function:var(--ease)] active:scale-[0.98]';

   return (
      <div className="flex flex-col gap-2">
         <label className="lab" htmlFor="quicklog-photo">
            Photo
         </label>
         <div className="relative flex h-[200px] items-center justify-center overflow-hidden bg-black-block">
            {preview ? (
               <img
                  src={preview}
                  alt="The catch you just photographed"
                  className={cn(
                     'absolute inset-0 h-full w-full object-cover [transition:opacity_700ms_var(--ease),transform_1400ms_var(--ease)]',
                     settled
                        ? 'scale-100 opacity-100'
                        : 'scale-[1.04] opacity-0'
                  )}
               />
            ) : null}
            {flash ? (
               <span
                  className="shutter pointer-events-none absolute inset-0 bg-paper"
                  aria-hidden="true"
               />
            ) : null}
            <input
               ref={inputRef}
               id="quicklog-photo"
               type="file"
               accept={ACCEPTED.join(',')}
               capture="environment"
               className="sr-only"
               onChange={(event) => onSelect(event.target.files?.[0])}
            />
            {/* The same picker without `capture`: the camera roll, for a
                fish photographed before the phone came out of the bag. */}
            <input
               ref={pickRef}
               type="file"
               accept={ACCEPTED.join(',')}
               className="sr-only"
               aria-label="Choose a photo"
               onChange={(event) => onSelect(event.target.files?.[0])}
            />
            {!preview ? (
               <div className="relative z-[1] flex flex-wrap items-center justify-center gap-3">
                  <button
                     type="button"
                     className={control}
                     onClick={() => inputRef.current?.click()}
                  >
                     Take a photo
                  </button>
                  <button
                     type="button"
                     className={cn(control, 'border-paper/30 bg-transparent')}
                     onClick={() => pickRef.current?.click()}
                  >
                     Choose one
                  </button>
               </div>
            ) : null}
            {isUploading ? (
               <span
                  style={{ width: `${progress}%` }}
                  className="absolute bottom-0 left-0 z-[1] h-[2px] bg-teal transition-[width] duration-150"
                  aria-hidden="true"
               />
            ) : null}
         </div>
         {preview ? (
            <div className="flex flex-wrap items-center gap-4">
               <button
                  type="button"
                  className="g-tracked inline-flex h-11 items-center text-[18px] text-ink-2 hover:text-ink"
                  onClick={() => inputRef.current?.click()}
               >
                  Take another
               </button>
               <button
                  type="button"
                  className="g-tracked inline-flex h-11 items-center text-[18px] text-ink-2 hover:text-ink"
                  onClick={() => pickRef.current?.click()}
               >
                  Choose one
               </button>
               <button
                  type="button"
                  className="g-tracked inline-flex h-11 items-center text-[18px] text-ink-2 hover:text-ink"
                  onClick={clear}
               >
                  Remove
               </button>
               {isUploading ? (
                  <span
                     className="num text-[14px] text-ink-3"
                     aria-live="polite"
                  >
                     Sending the photo, {progress}%
                  </span>
               ) : null}
            </div>
         ) : null}
         {error ? (
            <p className="text-[14px] text-destructive" role="alert">
               {error}
            </p>
         ) : null}
      </div>
   );
}
