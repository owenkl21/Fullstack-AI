import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ViewfinderCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ImageUploader, type RejectedFile } from '@/components/ImageUploader';
import { Img } from '@/components/Img';
import { FramedPhoto } from '@/components/FramedPhoto';
import { FrameTool, type FramingResult } from '@/components/FrameTool';
import {
   makeImageVariants,
   type ResizedVariant,
   type VariantName,
} from '@/lib/images';

type Scope = 'catch' | 'site' | 'avatar' | 'banner' | 'gear';

type UploadedImage = {
   storageKey: string;
   url: string;
   /* The two resized copies, for anything that draws this photograph smaller
    * than it was taken. Optional so a record loaded from an older payload
    * still passes straight through here. */
   cardUrl?: string | null;
   thumbUrl?: string | null;
   /* How a catch photograph sits in its frame (lib/framing.ts). All three
    * null, or absent, until the angler frames it. Only the catch scope writes
    * them; the file itself is never touched. */
   focusX?: number | null;
   focusY?: number | null;
   zoom?: number | null;
};

type Props = {
   scope: Scope;
   /** Names the group for screen readers. The block itself reads "Add photos". */
   label: string;
   multiple?: boolean;
   maxItems?: number;
   value: UploadedImage[];
   onChange: (value: UploadedImage[]) => void;
   disabled?: boolean;
   /** Lets the parent hold its save action while a photo is still going up. */
   onUploadingChange?: (isUploading: boolean) => void;
   /**
    * The files as picked, before anything is uploaded. For reading what the
    * camera wrote into them, such as when the shutter went.
    */
   onFiles?: (files: File[]) => void;
};

type QueueItem = {
   id: string;
   file: File;
   name: string;
   previewUrl: string;
   progress: number;
   status: 'uploading' | 'failed';
   /* Framed while it was still going up. Carried onto the photograph the
    * moment the upload settles, so a slow signal never holds the tool. */
   framing?: FramingResult | null;
};

const UNFRAMED: FramingResult = { focusX: null, focusY: null, zoom: null };

const MAX_BYTES = 10 * 1024 * 1024;

type SignedVariant = {
   variant: VariantName;
   storageKey: string;
   contentType: string;
   uploadUrl: string;
};

const uploadOne = async (
   scope: Scope,
   file: File,
   onProgress: (percent: number) => void
): Promise<UploadedImage> => {
   /*
    * Resize first, then ask for the keys, so a photograph the browser cannot
    * decode fails before anything has been signed. The card and the thumb are
    * a few tens of kilobytes between them, so the original is still all of the
    * upload and the progress rule can go on measuring only that.
    *
    * lib/exif.ts has already been over the file by this point: the picker
    * hands every picked file to its caller before it hands it here, and a
    * canvas keeps pixels and drops tags.
    */
   let variants: ResizedVariant[] = [];
   try {
      variants = await makeImageVariants(file);
   } catch (error) {
      /* Not fatal. The original goes up on its own and the app reads it at
       * full size, which is exactly what it did before any of this existed. */
      console.warn('Could not make smaller copies of this photo', error);
   }

   const { data: signed } = await axios.post('/api/uploads/sign', {
      scope,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      variants: variants.map((entry) => entry.variant),
   });

   // Straight to R2 on the presigned URL, so the bytes never pass through the
   // API. Needs the bucket CORS policy to allow PUT from this origin.
   await axios.put(signed.uploadUrl, file, {
      headers: { 'Content-Type': file.type },
      onUploadProgress: (event) => {
         const total = event.total ?? file.size;
         if (!total) {
            return;
         }
         onProgress(Math.min(99, Math.round((event.loaded / total) * 100)));
      },
   });

   /*
    * The small ones after the original and in parallel. If one of them does
    * not make it the photograph is still saved and still readable: the record
    * holds the base key, and anything missing beside it is rebuilt by
    * audit/backfill-images.mjs.
    */
   const signedVariants: SignedVariant[] = signed.variants ?? [];
   await Promise.all(
      variants.map(async (made) => {
         const target = signedVariants.find(
            (entry) => entry.variant === made.variant
         );
         if (!target) return;

         try {
            await axios.put(target.uploadUrl, made.blob, {
               headers: { 'Content-Type': target.contentType },
            });
         } catch (error) {
            console.warn(`The ${made.variant} copy did not go up`, error);
         }
      })
   );

   return {
      storageKey: signed.storageKey,
      url: signed.readUrl,
      cardUrl: signed.cardReadUrl ?? null,
      thumbUrl: signed.thumbReadUrl ?? null,
   };
};

/*
 * One picker for every scope. Photos go up the moment they are picked, each tile
 * carrying its own progress rule, its own retry and its own remove, so a slow
 * photo never holds the whole form and a failed one says which file and why.
 */
export function R2ImagePicker({
   scope,
   label,
   value,
   onChange,
   maxItems = 8,
   // A scope that allows more than one photo takes more than one. The old default
   // keyed off the scope name, which quietly made the 12-photo spot picker single.
   multiple = maxItems > 1,
   disabled = false,
   onUploadingChange,
   onFiles,
}: Props) {
   const [queue, setQueue] = useState<QueueItem[]>([]);
   const [rejected, setRejected] = useState<RejectedFile[]>([]);

   // Uploads finish out of order, so every completion reads the newest value.
   const valueRef = useRef(value);
   valueRef.current = value;
   const queueRef = useRef(queue);
   queueRef.current = queue;
   const onChangeRef = useRef(onChange);
   onChangeRef.current = onChange;
   const onFilesRef = useRef(onFiles);
   onFilesRef.current = onFiles;

   const takesMany = multiple && maxItems > 1;
   const limit = takesMany ? maxItems : 1;
   const isUploading = queue.some((item) => item.status === 'uploading');

   /*
    * A catch photograph is cropped to a frame wherever it is shown, so a catch
    * gets Frame it on every tile. A spot's, gear's or the angler's own picture
    * is drawn whole or centred as it always was, and the tool would be noise.
    */
   const frames = scope === 'catch';
   /* Which tile the tool is open on: a photograph by its key, or one still
    * going up by its place in the queue. */
   const [framingTarget, setFramingTarget] = useState<
      | { kind: 'uploaded'; storageKey: string }
      | { kind: 'queued'; id: string }
      | null
   >(null);
   /*
    * The picked files as the browser holds them, kept by the key the bucket
    * gave each once it is up. The tool draws from these rather than the
    * bucket's copy, which is a round trip away and, on a thin signal, not
    * there yet. Let go when the picker goes.
    */
   const localUrls = useRef(new Map<string, string>());

   useEffect(() => {
      onUploadingChange?.(isUploading);
   }, [isUploading, onUploadingChange]);

   useEffect(
      () => () => {
         queue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
         localUrls.current.forEach((url) => URL.revokeObjectURL(url));
         localUrls.current.clear();
      },
      // Only on unmount: individual previews are revoked as each tile leaves.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
   );

   const settle = useCallback(
      (item: QueueItem, uploaded: UploadedImage) => {
         const current = valueRef.current;
         /* Whatever was framed while it went up, read off the queue at this
          * moment rather than off the item the upload began with. */
         const framed = frames
            ? {
                 ...uploaded,
                 ...(queueRef.current.find((entry) => entry.id === item.id)
                    ?.framing ?? UNFRAMED),
              }
            : uploaded;
         const next = takesMany
            ? [...current, framed].slice(0, maxItems)
            : [framed];
         onChangeRef.current(next);
         setQueue((entries) => entries.filter((entry) => entry.id !== item.id));
         if (frames) {
            localUrls.current.set(uploaded.storageKey, item.previewUrl);
         } else {
            URL.revokeObjectURL(item.previewUrl);
         }
         /* The tool follows the tile it was opened on across the settle. */
         setFramingTarget((was) =>
            was?.kind === 'queued' && was.id === item.id
               ? { kind: 'uploaded', storageKey: uploaded.storageKey }
               : was
         );
      },
      [frames, maxItems, takesMany]
   );

   const run = useCallback(
      async (item: QueueItem) => {
         try {
            const uploaded = await uploadOne(scope, item.file, (percent) => {
               setQueue((entries) =>
                  entries.map((entry) =>
                     entry.id === item.id
                        ? { ...entry, progress: percent }
                        : entry
                  )
               );
            });
            settle(item, uploaded);
         } catch (error) {
            console.error('Photo upload failed', error);
            setQueue((entries) =>
               entries.map((entry) =>
                  entry.id === item.id
                     ? { ...entry, status: 'failed', progress: 0 }
                     : entry
               )
            );
         }
      },
      [scope, settle]
   );

   const addFiles = useCallback(
      (files: File[]) => {
         onFilesRef.current?.(files);
         setRejected([]);

         const used = valueRef.current.length + queue.length;
         const slots = Math.max(0, limit - used);

         if (slots === 0) {
            // A single-photo scope swaps the photo instead of refusing the pick.
            if (!takesMany) {
               const [file] = files;
               if (!file) return;
               const item: QueueItem = {
                  id: crypto.randomUUID(),
                  file,
                  name: file.name,
                  previewUrl: URL.createObjectURL(file),
                  progress: 0,
                  status: 'uploading',
               };
               setQueue([item]);
               void run(item);
               return;
            }

            setRejected(
               files.map((file) => ({
                  name: file.name,
                  message: 'Remove a photo to make room for this one.',
               }))
            );
            return;
         }

         const taken = files.slice(0, slots);
         const spare = files.slice(slots);

         if (spare.length > 0) {
            setRejected(
               spare.map((file) => ({
                  name: file.name,
                  message: `Only ${slots} more ${slots === 1 ? 'fits' : 'fit'} here.`,
               }))
            );
         }

         const items: QueueItem[] = taken.map((file) => ({
            id: crypto.randomUUID(),
            file,
            name: file.name,
            previewUrl: URL.createObjectURL(file),
            progress: 0,
            status: 'uploading',
         }));

         setQueue((entries) => (takesMany ? [...entries, ...items] : items));
         items.forEach((item) => void run(item));
      },
      [limit, queue.length, run, takesMany]
   );

   const retry = (item: QueueItem) => {
      setQueue((entries) =>
         entries.map((entry) =>
            entry.id === item.id
               ? { ...entry, status: 'uploading', progress: 0 }
               : entry
         )
      );
      void run({ ...item, status: 'uploading', progress: 0 });
   };

   const dropQueued = (item: QueueItem) => {
      URL.revokeObjectURL(item.previewUrl);
      setQueue((entries) => entries.filter((entry) => entry.id !== item.id));
   };

   const removeUploaded = (storageKey: string) => {
      const local = localUrls.current.get(storageKey);
      if (local) {
         URL.revokeObjectURL(local);
         localUrls.current.delete(storageKey);
      }
      onChange(value.filter((entry) => entry.storageKey !== storageKey));
   };

   /* The tool's picture and figures for whichever tile it is open on. */
   const framingUploaded =
      framingTarget?.kind === 'uploaded'
         ? (value.find(
              (entry) => entry.storageKey === framingTarget.storageKey
           ) ?? null)
         : null;
   const framingQueued =
      framingTarget?.kind === 'queued'
         ? (queue.find((entry) => entry.id === framingTarget.id) ?? null)
         : null;
   const framingSrc = framingUploaded
      ? (localUrls.current.get(framingUploaded.storageKey) ??
        framingUploaded.cardUrl ??
        framingUploaded.url)
      : (framingQueued?.previewUrl ?? null);
   const framingNow = framingUploaded ?? framingQueued?.framing ?? null;

   const reframe = (next: FramingResult) => {
      if (framingTarget?.kind === 'uploaded') {
         const key = framingTarget.storageKey;
         onChange(
            valueRef.current.map((entry) =>
               entry.storageKey === key ? { ...entry, ...next } : entry
            )
         );
      } else if (framingTarget?.kind === 'queued') {
         const id = framingTarget.id;
         setQueue((entries) =>
            entries.map((entry) =>
               entry.id === id ? { ...entry, framing: next } : entry
            )
         );
      }
   };

   /*
    * Frame it, in the corner of a tile. A 44px reach around the mark; the
    * word beside it once the tile is wide enough to hold the word and Make
    * cover together.
    */
   const frameButton = (label: string, onClick: () => void) => (
      <button
         type="button"
         aria-label={label}
         disabled={disabled}
         onClick={onClick}
         className="g-tracked flex h-11 shrink-0 items-center gap-1.5 bg-black-block/70 px-3 text-[15px] text-paper transition-[background-color,color] duration-150 [transition-timing-function:var(--ease)] hover:bg-black-block hover:text-teal disabled:opacity-50"
      >
         <ViewfinderCircleIcon
            className="size-5"
            strokeWidth={1.5}
            aria-hidden="true"
         />
         <span className="hidden sm:inline">Frame it</span>
      </button>
   );

   const makeCover = (storageKey: string) => {
      const picked = value.find((entry) => entry.storageKey === storageKey);
      if (!picked) return;
      onChange([
         picked,
         ...value.filter((entry) => entry.storageKey !== storageKey),
      ]);
   };

   const total = value.length + queue.length;

   return (
      <div role="group" aria-label={label} className="flex flex-col gap-4">
         <ImageUploader
            heading={takesMany ? 'Add photos' : 'Add a photo'}
            multiple={takesMany}
            maxSize={MAX_BYTES}
            disabled={disabled}
            count={total}
            max={limit}
            onFiles={addFiles}
            onRejected={setRejected}
         />

         {total > 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
               {value.map((image, index) => (
                  <li
                     key={image.storageKey}
                     className="relative aspect-[4/3] bg-bg-2"
                  >
                     <Img
                        src={image.url}
                        cardSrc={image.cardUrl}
                        thumbSrc={image.thumbUrl}
                        alt={`Photo ${index + 1}`}
                        fill
                        sizes="(min-width: 640px) 33vw, 50vw"
                        /* The tile is the feed's own frame, so a catch is
                           cropped here exactly as the feed will crop it. */
                        framing={frames ? image : undefined}
                     />
                     {takesMany && index === 0 ? (
                        <span className="g-tracked absolute top-0 left-0 bg-teal px-2 py-1 text-[15px] text-teal-ink">
                           Cover
                        </span>
                     ) : null}
                     <button
                        type="button"
                        aria-label={`Remove photo ${index + 1}`}
                        disabled={disabled}
                        onClick={() => removeUploaded(image.storageKey)}
                        className="absolute top-1.5 right-1.5 flex size-9 items-center justify-center rounded-full bg-black-block/70 text-paper transition-[background-color] duration-150 [transition-timing-function:var(--ease)] hover:bg-black-block disabled:opacity-50"
                     >
                        <XMarkIcon
                           className="size-5"
                           strokeWidth={1.5}
                           aria-hidden="true"
                        />
                     </button>
                     {takesMany && index > 0 ? (
                        <button
                           type="button"
                           onClick={() => makeCover(image.storageKey)}
                           className="g-tracked absolute bottom-0 left-0 flex h-11 items-center bg-black-block/70 px-3 text-[15px] text-paper transition-[background-color] duration-150 [transition-timing-function:var(--ease)] hover:bg-black-block"
                        >
                           Make cover
                        </button>
                     ) : null}
                     {frames ? (
                        <span className="absolute right-0 bottom-0 flex">
                           {frameButton(`Frame photo ${index + 1}`, () =>
                              setFramingTarget({
                                 kind: 'uploaded',
                                 storageKey: image.storageKey,
                              })
                           )}
                        </span>
                     ) : null}
                  </li>
               ))}

               {queue.map((item, at) => (
                  <li key={item.id} className="relative aspect-[4/3] bg-bg-2">
                     {frames ? (
                        <FramedPhoto
                           src={item.previewUrl}
                           alt=""
                           framing={item.framing}
                           className="size-full"
                           imgClassName="opacity-60"
                        />
                     ) : (
                        <img
                           src={item.previewUrl}
                           alt=""
                           className="h-full w-full object-cover opacity-60"
                        />
                     )}
                     {frames && item.status === 'uploading' ? (
                        /* Framing does not wait for the bytes: the tool works
                           on the file the browser already holds. */
                        <span className="absolute right-0 bottom-[2px] flex">
                           {frameButton(
                              `Frame photo ${value.length + at + 1}`,
                              () =>
                                 setFramingTarget({
                                    kind: 'queued',
                                    id: item.id,
                                 })
                           )}
                        </span>
                     ) : null}
                     <button
                        type="button"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => dropQueued(item)}
                        className="absolute top-1.5 right-1.5 flex size-9 items-center justify-center rounded-full bg-black-block/70 text-paper transition-[background-color] duration-150 [transition-timing-function:var(--ease)] hover:bg-black-block"
                     >
                        <XMarkIcon
                           className="size-5"
                           strokeWidth={1.5}
                           aria-hidden="true"
                        />
                     </button>

                     {item.status === 'uploading' ? (
                        <div
                           aria-hidden="true"
                           className="absolute right-0 bottom-0 left-0 h-[2px] bg-line"
                        >
                           <div
                              className="h-full bg-teal transition-[width] duration-300 [transition-timing-function:var(--ease)]"
                              style={{ width: `${item.progress}%` }}
                           />
                        </div>
                     ) : (
                        <button
                           type="button"
                           onClick={() => retry(item)}
                           className="g-tracked absolute right-0 bottom-0 left-0 bg-teal py-1.5 text-[15px] text-teal-ink"
                        >
                           Try again
                        </button>
                     )}
                  </li>
               ))}
            </ul>
         ) : null}

         {queue.some((item) => item.status === 'failed') ? (
            <ul role="alert" className="flex flex-col gap-1">
               {queue
                  .filter((item) => item.status === 'failed')
                  .map((item) => (
                     <li key={item.id} className="text-[14px] text-destructive">
                        <span className="font-medium">{item.name}</span> did not
                        go up. Check your signal and try again.
                     </li>
                  ))}
            </ul>
         ) : null}

         {rejected.length > 0 ? (
            <ul role="alert" className="flex flex-col gap-1">
               {rejected.map((entry) => (
                  <li key={entry.name} className="text-[14px] text-destructive">
                     <span className="font-medium">{entry.name}</span>{' '}
                     {entry.message}
                  </li>
               ))}
            </ul>
         ) : null}

         {frames ? (
            <FrameTool
               open={framingSrc !== null}
               onOpenChange={(open) => {
                  if (!open) setFramingTarget(null);
               }}
               src={framingSrc}
               framing={framingNow}
               onDone={reframe}
            />
         ) : null}
      </div>
   );
}
