import axios from 'axios';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { FishingBobberLoader } from '@/components/ui/fishing-bobber-loader';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

type SiteEdit = {
   name: string;
   description: string | null;
   latitude: number | null;
   longitude: number | null;
   waterType: string | null;
   accessNotes: string | null;
};

export function EditSitePage() {
   const { siteId } = useParams();
   const navigate = useNavigate();
   const [item, setItem] = useState<SiteEdit | null>(null);

   useEffect(() => {
      const load = async () => {
         const { data } = await axios.get(`/api/sites/${siteId}`);
         setItem(data.site);
      };

      void load();
   }, [siteId]);

   const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!siteId) return;
      const formData = new FormData(event.currentTarget);

      await axios.put(`/api/sites/${siteId}`, {
         name: String(formData.get('name') ?? ''),
         description: String(formData.get('description') ?? '') || null,
         latitude: Number(formData.get('latitude')) || null,
         longitude: Number(formData.get('longitude')) || null,
         waterType: String(formData.get('waterType') ?? '') || null,
         accessNotes: String(formData.get('accessNotes') ?? '') || null,
      });

      toast({ title: 'Location updated', variant: 'success' });
      navigate(`/sites/${siteId}`);
   };

   return (
      <div className="min-h-screen">
         <LandingHeader />
         <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
            <FishingActionBar />
            {!item ? (
               <FishingBobberLoader label="Loading location..." />
            ) : (
               <form
                  onSubmit={onSubmit}
                  className="grid gap-3 rounded-lg border p-4"
               >
                  <h1 className="text-2xl font-semibold">Edit location</h1>
                  <input
                     name="name"
                     defaultValue={item.name}
                     className="rounded border p-2"
                     required
                  />
                  <textarea
                     name="description"
                     defaultValue={item.description ?? ''}
                     className="rounded border p-2"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                     <input
                        name="latitude"
                        defaultValue={item.latitude ?? ''}
                        type="number"
                        step="0.000001"
                        className="rounded border p-2"
                     />
                     <input
                        name="longitude"
                        defaultValue={item.longitude ?? ''}
                        type="number"
                        step="0.000001"
                        className="rounded border p-2"
                     />
                  </div>
                  <select
                     name="waterType"
                     defaultValue={item.waterType ?? ''}
                     className="rounded border p-2"
                  >
                     <option value="">Optional water type</option>
                     <option value="FRESHWATER">Freshwater</option>
                     <option value="SALTWATER">Saltwater</option>
                     <option value="BRACKISH">Brackish</option>
                     <option value="OTHER">Other</option>
                  </select>
                  <textarea
                     name="accessNotes"
                     defaultValue={item.accessNotes ?? ''}
                     className="rounded border p-2"
                  />
                  <Button type="submit">Save changes</Button>
               </form>
            )}
         </main>
      </div>
   );
}
