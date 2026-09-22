import { useEffect, useRef, useState, type ReactNode } from 'react';
import axios from 'axios';
import { makeImageVariants } from '@/lib/images';
import { putVariants } from './upload';
import { CameraIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { usePhone } from '@/lib/media';
import { framingStyle } from '@/lib/framing';
import { FrameTool, type FramingResult } from '@/components/FrameTool';

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
   /* How it sits when it is cropped to a frame: the point that is held, as
      fractions across and down, and how far it is pushed in. All three null
      until the angler frames it (lib/framing.ts). */
   focusX?: number | null;
   focusY?: number | null;
   zoom?: number | null;
};

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

/* The framing a photograph carries, or the three nulls of one never framed. */
const framingOf = (photo: UploadedPhoto): FramingResult => ({
   focusX: photo.focusX ?? null,
   focusY: photo.focusY ?? null,
   zoom: photo.zoom ?? null,
});

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
   retake = false,
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
   /* The quiet second way in. The cell draws it only when it is given one. */
   second?: string;
   variant?: 'hero' | 'cell';
   /* Two blocks on one page need two sets of ids. */
   idPrefix?: string;
   /* On a phone, a Retake beside Change that opens the camera again: a
      competition photo that came out blurred is taken again, not hunted
      for in the camera roll. */
   retake?: boolean;
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
   const isUploadingRef = useRef(false);
   const [error, setError] = useState<string | null>(null);
   /*
    * The feed shows every photograph in a four by three frame. This is that
    * frame with the picture inside it, held where the angler framed it. The
    * framing is three numbers kept with the photo; the file is sent exactly
    * as it was picked. Frame it opens the tool, and it works on the picture
    * the browser already holds, so it does not wait for the upload.
    */
   const [framing, setFraming] = useState<FramingResult | null>(
      initial ? framingOf(initial) : null
   );
   const framingRef = useRef(framing);
   const [isFraming, setIsFraming] = useState(false);
   const uploadedRef = useRef<UploadedPhoto | null>(initial);
   const cell = variant === 'cell';

   const commitFraming = (next: FramingResult) => {
      framingRef.current = next;
      setFraming(next);
      const photo = uploadedRef.current;
      if (photo) {
         const stamped = { ...photo, ...next };
         uploadedRef.current = stamped;
         onChange(stamped);
      }
   };

   /*
    * The page can put a different photograph in this frame: another one made
    * the cover, the cover removed with others behind it, a draft read back.
    * The block then shows that one and frames that one. Without this, framing
    * after a swap stamped the numbers on the photograph that used to be here
    * and handed it back as the cover.
    */
   const initialKey = initial?.storageKey ?? null;
   useEffect(() => {
      if (!initial || isUploadingRef.current) return;
      if (uploadedRef.current?.storageKey === initial.storageKey) return;
      if (previewRef.current) {
         URL.revokeObjectURL(previewRef.current);
         previewRef.current = null;
         onPreviewUrl?.(null);
      }
      uploadedRef.current = initial;
      framingRef.current = framingOf(initial);
      setFraming(framingRef.current);
      setPreview(initial.url);
      setSettled(true);
      // Keyed on the photograph, not on the object the page rebuilds each render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [initialKey]);

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
      isUploadingRef.current = true;
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
            /* Whatever the angler framed while it was going up. */
            ...(framingRef.current ?? {
               focusX: null,
               focusY: null,
               zoom: null,
            }),
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
         isUploadingRef.current = false;
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
      /* A new photograph starts unframed, whatever the last one was given. */
      framingRef.current = null;
      setFraming(null);
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
      framingRef.current = null;
      setFraming(null);
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
            className={cn(
               'relative flex flex-col items-center justify-center overflow-hidden text-paper',
               preview
                  ? 'aspect-[4/3] bg-black-block-2'
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
                * it as the feed will crop it. The settle eases `scale`, which
                * is its own property, so the framing's transform is left to
                * land at once when the tool closes.
                */
               <img
                  src={preview}
                  alt={
                     cell
                        ? 'The measure photo you just added, whole'
                        : 'The catch you just photographed, as the feed will show it'
                  }
                  draggable={false}
                  /* The tape cell's photograph is read whole on the board,
                     centred, so it is not held on the catch default here. */
                  style={cell ? undefined : framingStyle(framing)}
                  className={cn(
                     /* And shown whole here too: a crop can take off the
                        very figure the judge has to read, and the angler
                        should see what the judge will see. */
                     'pointer-events-none absolute inset-0 h-full w-full [transition:opacity_700ms_var(--ease),scale_1400ms_var(--ease)]',
                     cell ? 'object-contain' : 'object-cover',
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
                           ? 'h-11 border border-paper/40 px-4 text-[15px] text-paper hover:border-teal'
                           : 'h-12 bg-teal px-6 text-[20px] text-teal-ink hover:brightness-95'
                     )}
                  >
                     {title}
                  </button>
                  {second && (!cell || phone) ? (
                     <button
                        type="button"
                        onClick={() => pickRef.current?.click()}
                        className={cn(
                           'g-tracked relative z-[1] text-[15px] text-paper-2 hover:text-paper',
                           cell && 'min-h-11'
                        )}
                     >
                        {second}
                     </button>
                  ) : null}
               </>
            ) : (
               <div className="absolute right-0 bottom-0 z-[1] flex bg-black-block text-paper">
                  {/* The catch's own photograph is cropped wherever it is
                      shown; the tape cell's is read whole, so it has no
                      framing to do. */}
                  {!cell ? (
                     <button
                        type="button"
                        className="g-tracked grid h-11 place-items-center border-r border-paper/20 px-3.5 text-[15px] hover:text-teal md:px-4"
                        onClick={() => setIsFraming(true)}
                     >
                        Frame it
                     </button>
                  ) : null}
                  {retake && phone ? (
                     <button
                        type="button"
                        className="g-tracked grid h-11 place-items-center border-r border-paper/20 px-3.5 text-[15px] hover:text-teal"
                        onClick={() => inputRef.current?.click()}
                     >
                        Retake
                     </button>
                  ) : null}
                  <button
                     type="button"
                     className="g-tracked grid h-11 place-items-center px-3.5 text-[15px] hover:text-teal md:px-4"
                     onClick={() => pickRef.current?.click()}
                  >
                     Change
                  </button>
                  <button
                     type="button"
                     className="g-tracked grid h-11 place-items-center border-l border-paper/20 px-3.5 text-[15px] hover:text-teal md:px-4"
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
         {!cell ? (
            <FrameTool
               open={isFraming}
               onOpenChange={setIsFraming}
               src={preview}
               framing={framing}
               onDone={commitFraming}
            />
         ) : null}
         {error ? (
            <p className="mt-2 text-[13px] text-destructive" role="alert">
               {error}
            </p>
         ) : null}
      </div>
   );
}
