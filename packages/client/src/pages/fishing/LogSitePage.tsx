import axios from 'axios';
import { Show, SignInButton } from '@clerk/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { R2ImagePicker } from '@/components/r2-image-picker';

export function LogSitePage() {
   const navigate = useNavigate();
   const [isSaving, setIsSaving] = useState(false);
   const [images, setImages] = useState<{ storageKey: string; url: string }[]>(
      []
   );

   const submitSite = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);

      const payload = {
         name: String(formData.get('name') ?? ''),
         description: String(formData.get('description') ?? '') || null,
         latitude: Number(formData.get('latitude')) || null,
         longitude: Number(formData.get('longitude')) || null,
         waterType: String(formData.get('waterType') ?? '') || null,
         accessNotes: String(formData.get('accessNotes') ?? '') || null,
         images,
      };

      try {
         setIsSaving(true);
         const { data } = await axios.post('/api/sites', payload);
         toast({ title: 'Fishing site logged!', variant: 'success' });
         navigate(`/sites/${data.site.id}`);
      } catch (error) {
         console.error(error);
         toast({
            title: 'Unable to log fishing site',
            description: 'Check your values and try again.',
            variant: 'error',
         });
      } finally {
         setIsSaving(false);
      }
   };

   return (
      <div className="min-h-screen">
         <LandingHeader />
         <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
            <FishingActionBar />
            <Show when="signed-in">
               <form
                  onSubmit={submitSite}
                  className="grid gap-3 rounded-lg border p-4"
               >
                  <h1 className="text-2xl font-semibold">Log fishing site</h1>
                  <input
                     name="name"
                     placeholder="Site name"
                     className="rounded border p-2"
                     required
                  />
                  <textarea
                     name="description"
                     placeholder="Description"
                     className="rounded border p-2"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                     <input
                        name="latitude"
                        placeholder="Latitude"
                        type="number"
                        step="0.000001"
                        className="rounded border p-2"
                     />
                     <input
                        name="longitude"
                        placeholder="Longitude"
                        type="number"
                        step="0.000001"
                        className="rounded border p-2"
                     />
                  </div>
                  <select
                     name="waterType"
                     className="rounded border p-2"
                     defaultValue=""
                  >
                     <option value="">Optional water type</option>
                     <option value="FRESHWATER">Freshwater</option>
                     <option value="SALTWATER">Saltwater</option>
                     <option value="BRACKISH">Brackish</option>
                     <option value="OTHER">Other</option>
                  </select>
                  <textarea
                     name="accessNotes"
                     placeholder="Access notes"
                     className="rounded border p-2"
                  />
                  <R2ImagePicker
                     scope="site"
                     label="Site images"
                     maxItems={12}
                     value={images}
                     onChange={setImages}
                  />
                  <Button type="submit" disabled={isSaving}>
                     {isSaving ? 'Saving...' : 'Save site'}
                  </Button>
               </form>
            </Show>
            <Show when="signed-out">
               <div className="rounded-lg border p-4">
                  <p className="mb-3">Sign in to log a fishing site.</p>
                  <SignInButton mode="modal">
                     <Button>Sign in</Button>
                  </SignInButton>
               </div>
            </Show>
         </main>
      </div>
   );
}
