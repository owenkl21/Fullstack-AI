import axios from 'axios';
import { Show, SignInButton } from '@clerk/react';
import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { R2ImagePicker } from '@/components/r2-image-picker';
import { GoogleMapLocationPicker } from '@/components/fishing/GoogleMapLocationPicker';

export function LogSitePage() {
   const navigate = useNavigate();
   const [isSaving, setIsSaving] = useState(false);
   const [latitude, setLatitude] = useState('');
   const [longitude, setLongitude] = useState('');
   const [images, setImages] = useState<{ storageKey: string; url: string }[]>(
      []
   );

   const setCoordinates = useCallback(
      (nextLatitude: number, nextLongitude: number) => {
         setLatitude(nextLatitude.toFixed(6));
         setLongitude(nextLongitude.toFixed(6));
      },
      []
   );

   const submitSite = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);

      const payload = {
         name: String(formData.get('name') ?? ''),
         description: String(formData.get('description') ?? '') || null,
         latitude: Number(latitude) || null,
         longitude: Number(longitude) || null,
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
                  <div className="grid gap-1">
                     <label htmlFor="site-name" className="text-sm font-medium">
                        Site name
                     </label>
                     <input
                        id="site-name"
                        name="name"
                        placeholder="Site name"
                        className="rounded border p-2"
                        required
                     />
                  </div>
                  <div className="grid gap-1">
                     <label
                        htmlFor="site-description"
                        className="text-sm font-medium"
                     >
                        Description
                     </label>
                     <textarea
                        id="site-description"
                        name="description"
                        placeholder="Description"
                        className="rounded border p-2"
                     />
                  </div>
                  <GoogleMapLocationPicker
                     latitude={latitude}
                     longitude={longitude}
                     onChange={setCoordinates}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                     <div className="grid gap-1">
                        <label
                           htmlFor="site-latitude"
                           className="text-sm font-medium"
                        >
                           Latitude
                        </label>
                        <input
                           id="site-latitude"
                           name="latitude"
                           placeholder="Latitude"
                           type="number"
                           step="0.000001"
                           value={latitude}
                           onChange={(event) => setLatitude(event.target.value)}
                           className="rounded border p-2"
                        />
                     </div>
                     <div className="grid gap-1">
                        <label
                           htmlFor="site-longitude"
                           className="text-sm font-medium"
                        >
                           Longitude
                        </label>
                        <input
                           id="site-longitude"
                           name="longitude"
                           placeholder="Longitude"
                           type="number"
                           step="0.000001"
                           value={longitude}
                           onChange={(event) =>
                              setLongitude(event.target.value)
                           }
                           className="rounded border p-2"
                        />
                     </div>
                  </div>
                  <div className="grid gap-1">
                     <label
                        htmlFor="site-water-type"
                        className="text-sm font-medium"
                     >
                        Water type
                     </label>
                     <select
                        id="site-water-type"
                        name="waterType"
                        className="rounded border p-2"
                        defaultValue=""
                     >
                        <option value="">Select water type</option>
                        <option value="FRESHWATER">Freshwater</option>
                        <option value="SALTWATER">Saltwater</option>
                     </select>
                  </div>
                  <div className="grid gap-1">
                     <label
                        htmlFor="site-access-notes"
                        className="text-sm font-medium"
                     >
                        Access notes
                     </label>
                     <textarea
                        id="site-access-notes"
                        name="accessNotes"
                        placeholder="Access notes"
                        className="rounded border p-2"
                     />
                  </div>
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
