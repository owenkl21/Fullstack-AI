import axios from 'axios';
import { Show, SignInButton } from '@clerk/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { R2ImagePicker } from '@/components/r2-image-picker';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const GEAR_TYPES = [
   'ROD',
   'REEL',
   'BAIT',
   'LURE',
   'LINE',
   'HOOK',
   'WEIGHTS',
] as const;

export function LogGearPage() {
   const navigate = useNavigate();
   const [isSaving, setIsSaving] = useState(false);
   const [images, setImages] = useState<{ storageKey: string; url: string }[]>(
      []
   );

   const submitGear = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);

      const payload = {
         name: String(formData.get('name') ?? ''),
         brand: String(formData.get('brand') ?? ''),
         type: String(formData.get('type') ?? 'ROD'),
         image: images[0] ?? null,
      };

      try {
         setIsSaving(true);
         await axios.post('/api/gear', payload);
         toast({ title: 'Gear saved', variant: 'success' });
         navigate('/gear/me');
      } catch (error) {
         console.error(error);
         toast({ title: 'Unable to save gear', variant: 'error' });
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
                  onSubmit={submitGear}
                  className="grid gap-3 rounded-lg border p-4"
               >
                  <h1 className="text-2xl font-semibold">Add gear</h1>
                  <input
                     name="name"
                     placeholder="Gear name"
                     className="rounded border p-2"
                     required
                  />
                  <input
                     name="brand"
                     placeholder="Brand"
                     className="rounded border p-2"
                     required
                  />
                  <select
                     name="type"
                     className="rounded border p-2"
                     defaultValue="ROD"
                     required
                  >
                     {GEAR_TYPES.map((gearType) => (
                        <option key={gearType} value={gearType}>
                           {gearType.charAt(0) +
                              gearType.slice(1).toLowerCase()}
                        </option>
                     ))}
                  </select>
                  <R2ImagePicker
                     scope="gear"
                     label="Gear image"
                     value={images}
                     onChange={setImages}
                     multiple={false}
                     maxItems={1}
                  />
                  <Button type="submit" disabled={isSaving}>
                     {isSaving ? 'Saving...' : 'Save gear'}
                  </Button>
               </form>
            </Show>
            <Show when="signed-out">
               <div className="rounded-lg border p-4">
                  <p className="mb-3">Sign in to add gear.</p>
                  <SignInButton mode="modal">
                     <Button>Sign in</Button>
                  </SignInButton>
               </div>
            </Show>
         </main>
      </div>
   );
}
