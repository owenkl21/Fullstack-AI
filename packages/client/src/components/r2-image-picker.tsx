import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ImageUploader, type RejectedFile } from '@/components/ImageUploader';

type Scope = 'catch' | 'site' | 'avatar' | 'gear';

type UploadedImage = {
   storageKey: string;
   url: string;
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
};

type QueueItem = {
   id: string;
   file: File;
   name: string;
   previewUrl: string;
   progress: number;
   status: 'uploading' | 'failed';
};

const MAX_BYTES = 10 * 1024 * 1024;

const uploadOne = async (
   scope: Scope,
   file: File,
   onProgress: (percent: number) => void
): Promise<UploadedImage> => {
   const { data: signed } = await axios.post('/api/uploads/sign', {
      scope,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
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

   return {
      storageKey: signed.storageKey,
      url: signed.readUrl,
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
}: Props) {
   const [queue, setQueue] = useState<QueueItem[]>([]);
   const [rejected, setRejected] = useState<RejectedFile[]>([]);

   // Uploads finish out of order, so every completion reads the newest value.
   const valueRef = useRef(value);
   valueRef.current = value;
   const onChangeRef = useRef(onChange);
   onChangeRef.current = onChange;

   const takesMany = multiple && maxItems > 1;
   const limit = takesMany ? maxItems : 1;
   const isUploading = queue.some((item) => item.status === 'uploading');

   useEffect(() => {
      onUploadingChange?.(isUploading);
   }, [isUploading, onUploadingChange]);

   useEffect(
      () => () => {
         queue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      },
      // Only on unmount: individual previews are revoked as each tile leaves.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
   );

   const settle = useCallback(
      (item: QueueItem, uploaded: UploadedImage) => {
         const current = valueRef.current;
         const next = takesMany
            ? [...current, uploaded].slice(0, maxItems)
            : [uploaded];
         onChangeRef.current(next);
         setQueue((entries) => entries.filter((entry) => entry.id !== item.id));
         URL.revokeObjectURL(item.previewUrl);
      },
      [maxItems, takesMany]
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
      onChange(value.filter((entry) => entry.storageKey !== storageKey));
   };

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
                     <img
                        src={image.url}
                        alt={`Photo ${index + 1}`}
                        width={400}
                        height={300}
                        loading="lazy"
                        className="h-full w-full object-cover"
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
                           className="g-tracked absolute right-0 bottom-0 left-0 bg-black-block/70 py-1.5 text-[15px] text-paper transition-[background-color] duration-150 [transition-timing-function:var(--ease)] hover:bg-black-block"
                        >
                           Make cover
                        </button>
                     ) : null}
                  </li>
               ))}

               {queue.map((item) => (
                  <li key={item.id} className="relative aspect-[4/3] bg-bg-2">
                     <img
                        src={item.previewUrl}
                        alt=""
                        className="h-full w-full object-cover opacity-60"
                     />
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
      </div>
   );
}
