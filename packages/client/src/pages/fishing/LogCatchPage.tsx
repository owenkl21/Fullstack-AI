import axios from 'axios';
import { Show, SignInButton } from '@clerk/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { R2ImagePicker } from '@/components/r2-image-picker';

export function LogCatchPage() {
   const navigate = useNavigate();
   const [isSaving, setIsSaving] = useState(false);
   const [images, setImages] = useState<{ storageKey: string; url: string }[]>(
      []
   );

   const submitCatch = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);

      const payload = {
         title: String(formData.get('title') ?? ''),
         caughtAt: String(formData.get('caughtAt') ?? ''),
         notes: String(formData.get('notes') ?? '') || null,
         siteId: String(formData.get('siteId') ?? '') || null,
         speciesId: String(formData.get('speciesId') ?? '') || null,
         gearId: String(formData.get('gearId') ?? '') || null,
         weather: String(formData.get('weather') ?? '') || null,
         waterTemp: Number(formData.get('waterTemp')) || null,
         depth: Number(formData.get('depth')) || null,
         count: Number(formData.get('count')) || 1,
         length: Number(formData.get('length')) || null,
         weight: Number(formData.get('weight')) || null,
         images,
      };

      try {
         setIsSaving(true);
         const { data } = await axios.post('/api/catches', payload);
         toast({ title: 'Catch logged!', variant: 'success' });
         navigate(`/catches/${data.catch.id}`);
      } catch (error) {
         console.error(error);
         toast({
            title: 'Unable to log catch',
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
                  onSubmit={submitCatch}
                  className="grid gap-3 rounded-lg border p-4"
               >
                  <h1 className="text-2xl font-semibold">Log a catch</h1>
                  <input
                     name="title"
                     placeholder="Catch title"
                     className="rounded border p-2"
                     required
                  />
                  <input
                     name="caughtAt"
                     type="datetime-local"
                     className="rounded border p-2"
                     required
                  />
                  <textarea
                     name="notes"
                     placeholder="Notes"
                     className="rounded border p-2"
                  />
                  <input
                     name="siteId"
                     placeholder="Optional siteId"
                     className="rounded border p-2"
                  />
                  <input
                     name="gearId"
                     placeholder="Optional gearId"
                     className="rounded border p-2"
                  />
                  <input
                     name="speciesId"
                     placeholder="Optional speciesId"
                     className="rounded border p-2"
                  />
                  <input
                     name="weather"
                     placeholder="Optional weather"
                     className="rounded border p-2"
                  />
                  <div className="grid gap-3 sm:grid-cols-3">
                     <input
                        name="waterTemp"
                        placeholder="Water temp"
                        type="number"
                        step="0.1"
                        className="rounded border p-2"
                     />
                     <input
                        name="depth"
                        placeholder="Depth"
                        type="number"
                        step="0.1"
                        className="rounded border p-2"
                     />
                     <input
                        name="count"
                        placeholder="Count"
                        type="number"
                        min={1}
                        defaultValue={1}
                        className="rounded border p-2"
                     />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                     <input
                        name="length"
                        placeholder="Length"
                        type="number"
                        step="0.1"
                        className="rounded border p-2"
                     />
                     <input
                        name="weight"
                        placeholder="Weight"
                        type="number"
                        step="0.1"
                        className="rounded border p-2"
                     />
                  </div>
                  <R2ImagePicker
                     scope="catch"
                     label="Catch images"
                     maxItems={8}
                     value={images}
                     onChange={setImages}
                  />
                  <Button type="submit" disabled={isSaving}>
                     {isSaving ? 'Saving...' : 'Save catch'}
                  </Button>
               </form>
            </Show>
            <Show when="signed-out">
               <div className="rounded-lg border p-4">
                  <p className="mb-3">Sign in to log a catch.</p>
                  <SignInButton mode="modal">
                     <Button>Sign in</Button>
                  </SignInButton>
               </div>
            </Show>
         </main>
      </div>
   );
}
