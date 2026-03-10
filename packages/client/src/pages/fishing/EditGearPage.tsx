import axios from 'axios';
import { Show } from '@clerk/react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

type GearItem = {
   id: string;
   name: string;
   brand: string;
   type: string;
   imageUrl: string | null;
};

export function EditGearPage() {
   const { gearId } = useParams();
   const navigate = useNavigate();
   const [gear, setGear] = useState<GearItem | null>(null);
   const [images, setImages] = useState<{ storageKey: string; url: string }[]>(
      []
   );

   useEffect(() => {
      const load = async () => {
         try {
            const { data } = await axios.get('/api/gear/me');
            const found = (data.gear ?? []).find(
               (entry: GearItem) => entry.id === gearId
            );
            if (!found) {
               toast({ title: 'Gear not found', variant: 'error' });
               navigate('/gear/me');
               return;
            }
            setGear(found);
         } catch (error) {
            console.error(error);
            toast({ title: 'Unable to load gear', variant: 'error' });
         }
      };

      void load();
   }, [gearId, navigate]);

   const submitGear = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!gearId) return;

      const formData = new FormData(event.currentTarget);
      const payload: {
         name: string;
         brand: string;
         type: string;
         image?: { storageKey: string; url: string } | null;
      } = {
         name: String(formData.get('name') ?? ''),
         brand: String(formData.get('brand') ?? ''),
         type: String(formData.get('type') ?? 'ROD'),
      };

      if (images[0]) {
         payload.image = images[0];
      }

      await axios.put(`/api/gear/${gearId}`, payload);

      toast({ title: 'Gear updated', variant: 'success' });
      navigate('/gear/me');
   };

   return (
      <div className="min-h-screen">
         <LandingHeader />
         <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
            <FishingActionBar />
            <Show when="signed-in">
               {gear ? (
                  <form
                     onSubmit={submitGear}
                     className="grid gap-3 rounded-lg border p-4"
                  >
                     <h1 className="text-2xl font-semibold">Edit gear</h1>
                     <input
                        name="name"
                        defaultValue={gear.name}
                        className="rounded border p-2"
                        required
                     />
                     <input
                        name="brand"
                        defaultValue={gear.brand}
                        className="rounded border p-2"
                        required
                     />
                     <select
                        name="type"
                        className="rounded border p-2"
                        defaultValue={gear.type}
                        required
                     >
                        {GEAR_TYPES.map((gearType) => (
                           <option key={gearType} value={gearType}>
                              {gearType.charAt(0) +
                                 gearType.slice(1).toLowerCase()}
                           </option>
                        ))}
                     </select>
                     {gear.imageUrl && images.length === 0 ? (
                        <img
                           src={gear.imageUrl}
                           alt={gear.name}
                           className="h-40 w-40 rounded border object-cover"
                        />
                     ) : null}
                     <R2ImagePicker
                        scope="gear"
                        label="Replace image"
                        value={images}
                        onChange={setImages}
                        multiple={false}
                        maxItems={1}
                     />
                     <Button type="submit">Save changes</Button>
                  </form>
               ) : null}
            </Show>
         </main>
      </div>
   );
}
