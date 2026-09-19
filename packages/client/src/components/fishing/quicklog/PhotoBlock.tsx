import { useEffect, useRef, useState, type ReactNode } from 'react';
import axios from 'axios';
import { makeImageVariants } from '@/lib/images';
import { putVariants } from './upload';
import { CameraIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { usePhone } from '@/lib/media';

/*
 * The photo, taken and sent while the rest of the catch is being filled in. It uses
 * the same upload the other forms use; the shutter flashes, the picture fades in and
 * settles, and a photo still going up is the one thing that holds the save.
 *
 * Two shapes. `hero` is the catch's own photograph: a four by three frame in
 * black with the teal corner tab, the camera glyph, a teal block to take one
 * and a quiet line to choose one instead. `cell` is the competition's tape or
 * scale picture: a shorter block with a single outlined button, because it is
 * a second ask under a first one and must not shout as loud.
 *
 * Whatever sits directly under the frame (the namer's band) is butted against
 * the picture with no gap, so the two read as one object.
 */
export type UploadedPhoto = {
   storageKey: string;
   url: string;
   /* The two smaller copies made in the browser at upload time; null when
      the browser could not make them. */
   cardUrl?: string | null;
   thumbUrl?: string | null;
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
   onPreviewUrl,
   initial = null,
   title = 'Take a photo',
   second = 'Choose one instead',
   variant = 'hero',
   idPrefix = 'quicklog-photo',
   children,
   className,
}: {
   onChange: (photo: UploadedPhoto | null) => void;
   onBusyChange: (busy: boolean) => void;
   /* The file as picked, before the upload, for what the camera wrote in it. */
   onFile?: (file: File) => void;
   /*
    * The picture as the browser already has it, for anything else on the page
    * that wants to show it. The address the upload gives back points at a
    * derivative the bucket makes in its own time, so a preview drawn from it
    * is a broken picture for the first few seconds.
    */
   onPreviewUrl?: (url: string | null) => void;
   /* A photo already sent up, when a draft is reopened. */
   initial?: UploadedPhoto | null;
   /* The words on the block's own button. */
   title?: string;
   /* The quiet second way in, on the hero frame only. */
   second?: string;
   variant?: 'hero' | 'cell';
   /* Two blocks on one page need two sets of ids. */
   idPrefix?: string;
   /* The namer's band, butted against the bottom of the picture. */
   children?: ReactNode;
   className?: string;
}) {
   const phone = usePhone();
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
   const cell = variant === 'cell';

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

   /*
    * The object URL is let go when this block goes, unless the page took a
    * copy of it: on a phone this block is unmounted every time the angler
    * steps forward, and the card on step 3 is drawn from the same picture.
    */
   const keepsPreview = Boolean(onPreviewUrl);
   useEffect(() => {
      return () => {
         if (previewRef.current && !keepsPreview) {
            URL.revokeObjectURL(previewRef.current);
         }
      };
   }, [keepsPreview]);

   const showPreview = (file: File) => {
      if (previewRef.current) {
         URL.revokeObjectURL(previewRef.current);
      }
      const url = URL.createObjectURL(file);
      previewRef.current = url;
      setPreview(url);
      onPreviewUrl?.(url);
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
         /* The two smaller copies first, so a photograph the browser cannot
            decode fails before anything is signed. Not fatal: the original
            is the upload, the copies are what the feed and the rows ask for. */
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
            variants?: Parameters<typeof putVariants>[1];
         }>('/api/uploads/sign', {
            scope: 'catch',
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            variants: variants.map((entry) => entry.variant),
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
         await putVariants(variants, signed.variants ?? []);
         const uploaded = {
            storageKey: signed.storageKey,
            url: signed.readUrl,
            cardUrl: signed.cardReadUrl ?? null,
            thumbUrl: signed.thumbReadUrl ?? null,
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
      onPreviewUrl?.(null);
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

   /* The camera on a phone; a desktop has none, so both ways in would put up
      the same file dialog and only one of them is offered. */
   const openCamera = () =>
      phone ? inputRef.current?.click() : pickRef.current?.click();

   const inputs = (
      <>
         <input
            ref={inputRef}
            id={idPrefix}
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
      </>
   );

   return (
      <div className={cn('flex flex-col', className)}>
         <div
            id={`${idPrefix}-zone`}
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
               'relative flex flex-col items-center justify-center overflow-hidden text-paper',
               preview
                  ? 'aspect-[4/3] cursor-grab touch-none bg-black-block-2 select-none active:cursor-grabbing'
                  : cell
                    ? 'h-[150px] gap-3.5 bg-black-block-2'
                    : 'aspect-[4/3] gap-4 bg-black-block'
            )}
         >
            {/* The teal corner tab, 22px, on the hero frame only: the tape
                cell sits under a card that already carries one. */}
            {!cell && !preview ? (
               <span
                  aria-hidden="true"
                  className="absolute top-0 right-0 z-[1] size-0 border-t-[22px] border-l-[22px] border-t-teal border-l-transparent"
               />
            ) : null}
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
            {inputs}
            {!preview ? (
               <>
                  <CameraIcon
                     aria-hidden="true"
                     strokeWidth={1.5}
                     className={cn(
                        'relative z-[1] text-paper-2',
                        cell ? 'size-[26px]' : 'size-8'
                     )}
                  />
                  <button
                     type="button"
                     onClick={openCamera}
                     className={cn(
                        'g-tracked relative z-[1] grid place-items-center transition-[filter,border-color] duration-150',
                        cell
                           ? 'h-10 border border-paper/40 px-4 text-[15px] text-paper hover:border-teal'
                           : 'h-12 bg-teal px-6 text-[20px] text-teal-ink hover:brightness-95'
                     )}
                  >
                     {title}
                  </button>
                  {!cell && second ? (
                     <button
                        type="button"
                        onClick={() => pickRef.current?.click()}
                        className="g-tracked relative z-[1] text-[15px] text-paper-2 hover:text-paper"
                     >
                        {second}
                     </button>
                  ) : null}
               </>
            ) : (
               <div
                  className="absolute right-0 bottom-0 z-[1] flex bg-black-block text-paper"
                  onPointerDown={(event) => event.stopPropagation()}
               >
                  <button
                     type="button"
                     className="g-tracked grid h-10 place-items-center px-3.5 text-[15px] hover:text-teal md:h-11 md:px-4"
                     onClick={() => pickRef.current?.click()}
                  >
                     Change
                  </button>
                  <button
                     type="button"
                     className="g-tracked grid h-10 place-items-center border-l border-paper/20 px-3.5 text-[15px] hover:text-teal md:h-11 md:px-4"
                     onClick={clear}
                  >
                     Remove
                  </button>
               </div>
            )}
            {isUploading ? (
               <span
                  style={{ width: `${progress}%` }}
                  className="absolute bottom-0 left-0 z-[2] h-[2px] bg-teal transition-[width] duration-150"
                  aria-hidden="true"
               />
            ) : null}
            {/* The upload speaks through the bar and through the save button;
                it does not need a sentence of its own. */}
            <span className="sr-only" aria-live="polite">
               {isUploading ? `Sending the photo, ${progress}%.` : ''}
            </span>
         </div>
         {children}
         {error ? (
            <p className="mt-2 text-[13px] text-destructive" role="alert">
               {error}
            </p>
         ) : null}
      </div>
   );
}
