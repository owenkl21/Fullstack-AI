import axios from 'axios';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

type Scope = 'catch' | 'site' | 'avatar';

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

   const uploadFiles = async (files: FileList | null) => {
      if (!files || files.length === 0) {
         return;
      }

      const selected = Array.from(files);
      const availableSlots = Math.max(0, maxItems - value.length);
      const toUpload = selected.slice(0, availableSlots);

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
               variant: 'default',
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

   return (
      <div className="space-y-2">
         <label className="text-sm font-medium">{label}</label>
         <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={multiple}
            disabled={isUploading}
            onChange={(event) => {
               void uploadFiles(event.target.files);
               event.currentTarget.value = '';
            }}
         />
         {isUploading && (
            <p className="text-xs text-muted-foreground">Uploading to R2...</p>
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
