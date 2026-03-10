import axios from 'axios';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FishingBobberLoader } from '@/components/ui/fishing-bobber-loader';
import { toast } from '@/components/ui/use-toast';
import { ImageUploader } from '@/components/ImageUploader';

type Scope = 'catch' | 'site' | 'avatar' | 'gear';

type UploadedImage = {
   storageKey: string;
   url: string;
};

type Props = {
   scope: Scope;
   label: string;
   multiple?: boolean;
   maxItems?: number;
   value: UploadedImage[];
   onChange: (value: UploadedImage[]) => void;
};

const isSupportedImage = (file: File) =>
   ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);

export function R2ImagePicker({
   scope,
   label,
   value,
   onChange,
   multiple = true,
   maxItems = 8,
}: Props) {
   const [isUploading, setIsUploading] = useState(false);

   const uploadFiles = async (files: File[]) => {
      if (!files.length) {
         return;
      }

      const availableSlots = Math.max(0, maxItems - value.length);
      const toUpload = files.slice(0, availableSlots);

      if (toUpload.length === 0) {
         toast({
            title: `Maximum ${maxItems} images allowed.`,
            variant: 'error',
         });
         return;
      }

      try {
         setIsUploading(true);
         const uploaded: UploadedImage[] = [];
         const failedFiles: string[] = [];

         for (const file of toUpload) {
            if (!isSupportedImage(file)) {
               failedFiles.push(file.name);
               toast({
                  title: `${file.name} skipped`,
                  description: 'Only JPG, PNG, and WebP are allowed.',
                  variant: 'error',
               });
               continue;
            }

            try {
               const { data: signed } = await axios.post('/api/uploads/sign', {
                  scope,
                  fileName: file.name,
                  contentType: file.type,
                  sizeBytes: file.size,
               });

               const uploadResponse = await axios.put(
                  '/api/uploads/proxy',
                  file,
                  {
                     params: {
                        storageKey: signed.storageKey,
                        contentType: file.type,
                     },
                     headers: {
                        'Content-Type': file.type,
                     },
                  }
               );

               uploaded.push({
                  storageKey: uploadResponse.data.storageKey,
                  url: uploadResponse.data.readUrl,
               });
            } catch (error) {
               console.error(error);
               failedFiles.push(file.name);
            }
         }

         if (uploaded.length > 0) {
            onChange(multiple ? [...value, ...uploaded] : [uploaded[0]]);
         }

         if (failedFiles.length === 0) {
            toast({ title: 'Image upload complete.', variant: 'success' });
         } else if (uploaded.length > 0) {
            toast({
               title: 'Partial upload complete',
               description: `${uploaded.length} uploaded, ${failedFiles.length} failed.`,
            });
         } else {
            toast({
               title: 'Upload failed',
               description: 'Could not upload image to Cloudflare R2.',
               variant: 'error',
            });
         }
      } finally {
         setIsUploading(false);
      }
   };

   const onImageCropped = async (blob: Blob) => {
      if (!multiple && value.length >= 1) {
         toast({
            title: 'Only one image is allowed here.',
            description: 'Remove the current image to upload a new one.',
            variant: 'error',
         });
         return;
      }

      const file = new File([blob], `cropped-${Date.now()}.jpg`, {
         type: blob.type || 'image/jpeg',
      });
      await uploadFiles([file]);
   };

   return (
      <div className="space-y-2">
         <label className="text-sm font-medium">{label}</label>
         <ImageUploader
            maxSize={10 * 1024 * 1024}
            acceptedFileTypes={['image/jpeg', 'image/png', 'image/webp']}
            onImageCropped={(blob) => {
               void onImageCropped(blob);
            }}
            className="max-w-lg"
         />
         {isUploading && (
            <FishingBobberLoader label="Uploading to R2..." compact />
         )}
         {value.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
               {value.map((image, index) => (
                  <div key={image.storageKey} className="space-y-1">
                     <img
                        src={image.url}
                        alt={`${label} ${index + 1}`}
                        className="h-36 w-full rounded border object-cover"
                     />
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                           onChange(
                              value.filter(
                                 (entry) =>
                                    entry.storageKey !== image.storageKey
                              )
                           )
                        }
                     >
                        Remove
                     </Button>
                  </div>
               ))}
            </div>
         )}
      </div>
   );
}
