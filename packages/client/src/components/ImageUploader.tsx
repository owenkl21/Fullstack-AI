import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ImageUploaderProps {
   aspectRatio?: number;
   maxSize?: number;
   acceptedFileTypes?: string[];
   className?: string;
   onImageCropped?: (blob: Blob) => void;
}

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

export function ImageUploader({
   aspectRatio = 1,
   maxSize = 5 * 1024 * 1024,
   acceptedFileTypes = ['image/jpeg', 'image/png', 'image/webp'],
   className,
   onImageCropped,
}: ImageUploaderProps) {
   const fileInputRef = useRef<HTMLInputElement>(null);
   const [error, setError] = useState<string | null>(null);
   const [previewImage, setPreviewImage] = useState<string | null>(null);

   const helperText = useMemo(() => {
      const maxMb = (maxSize / (1024 * 1024)).toFixed(0);
      return `Accepted: ${acceptedFileTypes.join(', ')} • Max size: ${maxMb}MB`;
   }, [acceptedFileTypes, maxSize]);

   const handleSelectImage = async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
         return;
      }

      if (!acceptedFileTypes.includes(file.type)) {
         setError('Unsupported image type. Please upload JPG, PNG, or WebP.');
         return;
      }

      if (file.size > maxSize) {
         setError(
            `File too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB.`
         );
         return;
      }

      const imageUrl = URL.createObjectURL(file);

      try {
         const croppedBlob = await createCenteredCropBlob(
            imageUrl,
            aspectRatio
         );
         setError(null);
         onImageCropped?.(croppedBlob);

         if (previewImage) {
            URL.revokeObjectURL(previewImage);
         }
         setPreviewImage(URL.createObjectURL(croppedBlob));
      } catch {
         setError('Could not process image. Please try another file.');
      } finally {
         URL.revokeObjectURL(imageUrl);
         event.currentTarget.value = '';
      }
   };

   return (
      <div className={cn('space-y-3 rounded-md border p-3', className)}>
         <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFileTypes.join(',')}
            className="hidden"
            onChange={(event) => {
               void handleSelectImage(event);
            }}
         />
         <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
         >
            Select image
         </Button>
         <p className="text-xs text-muted-foreground">{helperText}</p>

         {error && <p className="text-sm text-red-500">{error}</p>}

         {previewImage && (
            <img
               src={previewImage}
               alt="Cropped preview"
               className="h-44 w-full rounded-md border object-cover"
            />
         )}
      </div>
   );
}
