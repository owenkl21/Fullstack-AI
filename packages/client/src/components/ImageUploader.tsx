import {
   type ChangeEvent,
   useCallback,
   useEffect,
   useRef,
   useState,
} from 'react';
import { CameraIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type RejectedFile = { name: string; message: string };

interface ImageUploaderProps {
   /** Centre-crops the picked file to this ratio before handing it over. */
   aspectRatio?: number;
   maxSize?: number;
   acceptedFileTypes?: string[];
   className?: string;
   /** One file at a time, cropped when a ratio is set. Kept for existing callers. */
   onImageCropped?: (blob: Blob) => void;
   /** Every accepted file at once. Preferred where the scope takes more than one. */
   onFiles?: (files: File[]) => void;
   /** Rejections are handed up so they can sit under the grid with everything else. */
   onRejected?: (rejected: RejectedFile[]) => void;
   multiple?: boolean;
   disabled?: boolean;
   /** Reads "3 of 8" beside the heading. */
   count?: number;
   max?: number;
   heading?: string;
}

const MB = 1024 * 1024;

async function createCenteredCropBlob(imageSrc: string, aspectRatio: number) {
   const image = new Image();
   image.src = imageSrc;

   await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
   });

   const sourceAspectRatio = image.width / image.height;
   let cropWidth = image.width;
   let cropHeight = image.height;

   if (sourceAspectRatio > aspectRatio) {
      cropWidth = image.height * aspectRatio;
   } else {
      cropHeight = image.width / aspectRatio;
   }

   const cropX = (image.width - cropWidth) / 2;
   const cropY = (image.height - cropHeight) / 2;

   const canvas = document.createElement('canvas');
   canvas.width = Math.round(cropWidth);
   canvas.height = Math.round(cropHeight);

   const context = canvas.getContext('2d');
   if (!context) {
      throw new Error('Could not create canvas context');
   }

   context.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
   );

   return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
         if (!blob) {
            reject(new Error('Could not create cropped image'));
            return;
         }

         resolve(blob);
      }, 'image/jpeg');
   });
}

/*
 * The one photo control: a black block that takes a tap, a drop or a paste.
 * It never names a file format the way a machine does and it never shows a
 * dashed box that refuses a drop.
 */
export function ImageUploader({
   aspectRatio,
   maxSize = 10 * MB,
   acceptedFileTypes = ['image/jpeg', 'image/png', 'image/webp'],
   className,
   onImageCropped,
   onFiles,
   onRejected,
   multiple = false,
   disabled = false,
   count,
   max,
   heading = 'Add photos',
}: ImageUploaderProps) {
   const libraryInputRef = useRef<HTMLInputElement>(null);
   const cameraInputRef = useRef<HTMLInputElement>(null);
   const zoneRef = useRef<HTMLDivElement>(null);
   const [isDragging, setIsDragging] = useState(false);
   const [localRejected, setLocalRejected] = useState<RejectedFile[]>([]);

   const maxMb = Math.round(maxSize / MB);

   const report = useCallback(
      (rejected: RejectedFile[]) => {
         if (onRejected) {
            onRejected(rejected);
            return;
         }
         setLocalRejected(rejected);
      },
      [onRejected]
   );

   const accept = useCallback(
      async (picked: File[]) => {
         if (disabled || picked.length === 0) {
            return;
         }

         const rejected: RejectedFile[] = [];
         const kept: File[] = [];

         for (const file of picked) {
            if (!acceptedFileTypes.includes(file.type)) {
               rejected.push({
                  name: file.name,
                  message: 'Save it as a JPG, PNG or WebP and try again.',
               });
               continue;
            }

            if (file.size > maxSize) {
               rejected.push({
                  name: file.name,
                  message: `Too large. Send a version under ${maxMb} MB.`,
               });
               continue;
            }

            kept.push(file);
         }

         report(rejected);

         if (kept.length === 0) {
            return;
         }

         if (onFiles) {
            onFiles(kept);
            return;
         }

         if (!onImageCropped) {
            return;
         }

         for (const file of kept) {
            if (!aspectRatio) {
               onImageCropped(file);
               continue;
            }

            const imageUrl = URL.createObjectURL(file);
            try {
               onImageCropped(
                  await createCenteredCropBlob(imageUrl, aspectRatio)
               );
            } catch {
               report([
                  {
                     name: file.name,
                     message: 'This photo could not be read. Try another one.',
                  },
               ]);
            } finally {
               URL.revokeObjectURL(imageUrl);
            }
         }
      },
      [
         acceptedFileTypes,
         aspectRatio,
         disabled,
         maxMb,
         maxSize,
         onFiles,
         onImageCropped,
         report,
      ]
   );

   const handleSelect = (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const picked = Array.from(input.files ?? []);
      // Cleared straight away so picking the same file twice still fires.
      input.value = '';
      void accept(picked);
   };

   /* Paste works anywhere on the page, as long as the person is not typing. */
   useEffect(() => {
      if (disabled) {
         return;
      }

      const onPaste = (event: ClipboardEvent) => {
         const active = document.activeElement;
         const isTyping =
            active instanceof HTMLInputElement ||
            active instanceof HTMLTextAreaElement ||
            (active instanceof HTMLElement && active.isContentEditable);

         if (isTyping && !zoneRef.current?.contains(active)) {
            return;
         }

         const files = Array.from(event.clipboardData?.files ?? []);
         if (files.length === 0) {
            return;
         }

         event.preventDefault();
         void accept(multiple ? files : files.slice(0, 1));
      };

      document.addEventListener('paste', onPaste);
      return () => document.removeEventListener('paste', onPaste);
   }, [accept, disabled, multiple]);

   const rejected = onRejected ? [] : localRejected;
   // A one-photo scope never locks: picking again swaps the photo in place.
   const atLimit =
      typeof max === 'number' &&
      max > 1 &&
      typeof count === 'number' &&
      count >= max;

   return (
      <div className={cn('flex flex-col gap-3', className)}>
         <input
            ref={libraryInputRef}
            type="file"
            accept={acceptedFileTypes.join(',')}
            multiple={multiple}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleSelect}
         />
         <input
            ref={cameraInputRef}
            type="file"
            accept={acceptedFileTypes.join(',')}
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleSelect}
         />

         <div
            ref={zoneRef}
            data-dragging={isDragging ? 'true' : undefined}
            onDragOver={(event) => {
               if (disabled) return;
               event.preventDefault();
               setIsDragging(true);
            }}
            onDragLeave={(event) => {
               if (event.currentTarget.contains(event.relatedTarget as Node)) {
                  return;
               }
               setIsDragging(false);
            }}
            onDrop={(event) => {
               event.preventDefault();
               setIsDragging(false);
               if (disabled) return;
               const files = Array.from(event.dataTransfer?.files ?? []);
               void accept(multiple ? files : files.slice(0, 1));
            }}
            className={cn(
               'blk blk-plain relative p-5 outline-2 -outline-offset-2 outline-transparent transition-[outline-color] duration-150 [transition-timing-function:var(--ease)]',
               isDragging && 'outline-teal',
               disabled && 'opacity-60'
            )}
         >
            <div className="flex items-baseline justify-between gap-4">
               <h3 className="g text-[26px] text-paper">{heading}</h3>
               {typeof count === 'number' &&
               typeof max === 'number' &&
               max > 1 ? (
                  <span className="lab num text-paper-2">
                     {count} of {max}
                  </span>
               ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
               <button
                  type="button"
                  aria-label="Take a photo"
                  disabled={disabled || atLimit}
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex size-11 items-center justify-center rounded-full border border-paper-2/50 text-paper transition-[background-color] duration-150 [transition-timing-function:var(--ease)] hover:bg-paper/10 disabled:pointer-events-none disabled:opacity-50 md:hidden"
               >
                  <CameraIcon
                     className="size-6"
                     strokeWidth={1.5}
                     aria-hidden="true"
                  />
               </button>
               <Button
                  type="button"
                  variant="paper"
                  disabled={disabled || atLimit}
                  onClick={() => libraryInputRef.current?.click()}
               >
                  Choose photos
               </Button>
               <span className="hidden text-[14px] text-paper-2 md:inline">
                  Or drop them here, or paste.
               </span>
            </div>

            {atLimit ? (
               <p className="mt-3 text-[14px] text-paper-2">
                  That is all the photos this one takes. Remove one to add
                  another.
               </p>
            ) : null}
         </div>

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
