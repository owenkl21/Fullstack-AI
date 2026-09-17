import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { cn } from '@/lib/utils';
import { CameraIcon, PhotoIcon } from '@heroicons/react/24/outline';

/*
 * The photo, taken and sent while the rest of the catch is being filled in. It uses
 * the same upload the other forms use; the shutter flashes, the picture fades in and
 * settles, and a photo still going up is the one thing that holds the save.
 */
export type UploadedPhoto = {
   storageKey: string;
   url: string;
   /* Where the eye lands when the feed crops it to its frame: fractions
      across and down. */
   focusX?: number | null;
   focusY?: number | null;
};

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
   /*
    * The feed shows every photograph in a four by three frame. This is that
    * frame, with the picture inside it, and dragging the picture moves what
    * the frame keeps. The point is kept with the photo, as fractions.
    */
   const [focus, setFocus] = useState<{ x: number; y: number }>({
      x: initial?.focusX ?? 0.5,
      y: initial?.focusY ?? 0.5,
   });
   const [ratio, setRatio] = useState<number | null>(null);
   const uploadedRef = useRef<UploadedPhoto | null>(initial);
   const frameRef = useRef<HTMLDivElement>(null);
   const dragRef = useRef<{
      x: number;
      y: number;
      fx: number;
      fy: number;
   } | null>(null);
   const FRAME = 4 / 3;

   const commitFocus = (next: { x: number; y: number }) => {
      setFocus(next);
      const photo = uploadedRef.current;
      if (photo) {
         const stamped = { ...photo, focusX: next.x, focusY: next.y };
         uploadedRef.current = stamped;
         onChange(stamped);
      }
   };

   const onFramePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      dragRef.current = {
         x: event.clientX,
         y: event.clientY,
         fx: focus.x,
         fy: focus.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
   };
   const onFramePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const frame = frameRef.current;
      if (!drag || !frame || ratio === null) return;
      const box = frame.getBoundingClientRect();
      /* How much of the picture the frame cannot hold, on the axis that
         overflows; a drag across the whole frame moves the focus by that. */
      const wider = ratio > FRAME;
      const spare = wider
         ? box.width * (ratio / FRAME) - box.width
         : box.height * (FRAME / ratio) - box.height;
      if (spare <= 0) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      const clamp = (v: number) => Math.min(1, Math.max(0, v));
      setFocus(
         wider
            ? { x: clamp(drag.fx - dx / spare), y: 0.5 }
            : { x: 0.5, y: clamp(drag.fy - dy / spare) }
      );
   };
   const onFramePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      commitFocus(focus);
   };

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
         const uploaded = {
            storageKey: signed.storageKey,
            url: signed.readUrl,
            focusX: focus.x,
            focusY: focus.y,
         };
         uploadedRef.current = uploaded;
         onChange(uploaded);
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
      setRatio(null);
      setFocus({ x: 0.5, y: 0.5 });
      uploadedRef.current = null;
      onChange(null);
      if (inputRef.current) {
         inputRef.current.value = '';
      }
   };

   return (
      <div className="flex flex-col gap-2">
         <div
            id="quicklog-photo-zone"
            ref={preview ? frameRef : undefined}
            role={preview ? 'img' : undefined}
            aria-label={
               preview ? 'The photograph as the feed will show it' : undefined
            }
            onPointerDown={preview ? onFramePointerDown : undefined}
            onPointerMove={preview ? onFramePointerMove : undefined}
            onPointerUp={preview ? onFramePointerUp : undefined}
            onPointerCancel={preview ? onFramePointerUp : undefined}
            className={cn(
               'relative flex items-center gap-4 overflow-hidden bg-black-block p-5 text-paper',
               preview
                  ? 'aspect-[4/3] cursor-grab touch-none p-0 select-none active:cursor-grabbing'
                  : 'min-h-[145px]'
            )}
         >
            {preview ? (
               /*
                * The feed's own frame, four by three, with the picture inside
                * it. Dragging the picture chooses what the frame keeps; the
                * point travels with the photo and the feed crops to it.
                */
               <img
                  src={preview}
                  alt="The catch you just photographed"
                  draggable={false}
                  onLoad={(event) =>
                     setRatio(
                        event.currentTarget.naturalWidth /
                           Math.max(1, event.currentTarget.naturalHeight)
                     )
                  }
                  style={{
                     objectPosition: `${Math.round(focus.x * 100)}% ${Math.round(focus.y * 100)}%`,
                  }}
                  className={cn(
                     'pointer-events-none absolute inset-0 h-full w-full object-cover [transition:opacity_700ms_var(--ease),transform_1400ms_var(--ease)]',
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
               aria-label="Take a photo"
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
               <>
                  <span
                     aria-hidden="true"
                     className="hidden size-[52px] shrink-0 place-items-center border border-paper/30 text-teal sm:grid"
                  >
                     <CameraIcon className="size-6" strokeWidth={1.6} />
                  </span>
                  <div className="relative z-[1] min-w-0">
                     <h3 className="g text-[22px] leading-none">
                        Add a catch photo
                     </h3>
                     <p className="mt-1 text-[12px] text-paper-2">
                        Optional. You can add one later.
                     </p>
                     <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                           type="button"
                           className="g-tracked inline-flex min-h-10 items-center gap-2 border border-paper bg-paper px-3 text-[15px] text-ink transition-[filter] duration-150 hover:brightness-95"
                           onClick={() => pickRef.current?.click()}
                        >
                           <PhotoIcon aria-hidden="true" className="size-4" />
                           Choose photo
                        </button>
                        <button
                           type="button"
                           className="g-tracked inline-flex min-h-10 items-center gap-2 border border-paper/50 px-3 text-[15px] text-paper transition-colors duration-150 hover:border-teal"
                           onClick={() => inputRef.current?.click()}
                        >
                           <CameraIcon aria-hidden="true" className="size-4" />
                           Take photo
                        </button>
                     </div>
                  </div>
               </>
            ) : (
               <>
                  <span className="pointer-events-none absolute top-2.5 left-2.5 z-[1] bg-ink/80 px-2 py-1 text-[11px] tracking-[0.12em] text-paper uppercase">
                     {ratio !== null && Math.abs(ratio - FRAME) > 0.02
                        ? 'As the feed shows it. Drag to place.'
                        : 'As the feed shows it'}
                  </span>
                  <div
                     className="absolute right-2.5 bottom-2.5 z-[1] flex items-center gap-3 bg-ink px-2.5"
                     onPointerDown={(event) => event.stopPropagation()}
                  >
                     <button
                        type="button"
                        className="g-tracked inline-flex h-10 items-center text-[15px] text-paper hover:text-teal"
                        onClick={() => pickRef.current?.click()}
                     >
                        Change
                     </button>
                     <button
                        type="button"
                        className="g-tracked inline-flex h-10 items-center text-[15px] text-paper hover:text-teal"
                        onClick={clear}
                     >
                        Remove
                     </button>
                  </div>
               </>
            )}
            {isUploading ? (
               <span
                  style={{ width: `${progress}%` }}
                  className="absolute bottom-0 left-0 z-[1] h-[2px] bg-teal transition-[width] duration-150"
                  aria-hidden="true"
               />
            ) : null}
         </div>
         {isUploading ? (
            <p className="text-[12px] text-ink-3" aria-live="polite">
               Sending the photo, {progress}%.
            </p>
         ) : null}
         {error ? (
            <p className="text-[13px] text-destructive" role="alert">
               {error}
            </p>
         ) : null}
      </div>
   );
}
