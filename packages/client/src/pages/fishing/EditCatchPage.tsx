import axios from 'axios';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

type CatchEdit = {
   title: string;
   notes: string | null;
   caughtAt: string;
   site: { id: string } | null;
   weather: string | null;
   waterTemp: number | null;
   length: number | null;
   weight: number | null;
};

type SiteOption = { id: string; name: string };

export function EditCatchPage() {
   const { catchId } = useParams();
   const navigate = useNavigate();
   const [item, setItem] = useState<CatchEdit | null>(null);
   const [sites, setSites] = useState<SiteOption[]>([]);

   useEffect(() => {
      const load = async () => {
         const [{ data: catchData }, { data: siteData }] = await Promise.all([
            axios.get(`/api/catches/${catchId}`),
            axios.get('/api/sites'),
         ]);
         setItem(catchData.catch);
         setSites(siteData.sites ?? []);
      };

      void load();
   }, [catchId]);

   const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!catchId) return;
      const formData = new FormData(event.currentTarget);

      await axios.put(`/api/catches/${catchId}`, {
         title: String(formData.get('title') ?? ''),
         notes: String(formData.get('notes') ?? '') || null,
         caughtAt: new Date(
            String(formData.get('caughtAt') ?? '')
         ).toISOString(),
         siteId: String(formData.get('siteId') ?? '') || null,
         weather: String(formData.get('weather') ?? '') || null,
         waterTemp: Number(formData.get('waterTemp')) || null,
         length: Number(formData.get('length')) || null,
         weight: Number(formData.get('weight')) || null,
      });

      toast({ title: 'Catch updated', variant: 'success' });
      navigate(`/catches/${catchId}`);
   };

   return (
      <div className="min-h-screen">
         <LandingHeader />
         <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
            <FishingActionBar />
            {!item ? (
               <p>Loading...</p>
            ) : (
               <form
                  onSubmit={onSubmit}
                  className="grid gap-3 rounded-lg border p-4"
               >
                  <h1 className="text-2xl font-semibold">Edit catch</h1>
                  <input
                     name="title"
                     defaultValue={item.title}
                     className="rounded border p-2"
                     required
                  />
                  <input
                     name="caughtAt"
                     type="datetime-local"
                     defaultValue={item.caughtAt.slice(0, 16)}
                     className="rounded border p-2"
                     required
                  />
                  <textarea
                     name="notes"
                     defaultValue={item.notes ?? ''}
                     className="rounded border p-2"
                  />
                  <select
                     name="siteId"
                     defaultValue={item.site?.id ?? ''}
                     className="rounded border p-2"
                  >
                     <option value="">No fishing spot selected</option>
                     {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                           {site.name}
                        </option>
                     ))}
                  </select>
                  <input
                     name="weather"
                     defaultValue={item.weather ?? ''}
                     className="rounded border p-2"
                  />
                  <div className="grid gap-3 sm:grid-cols-3">
                     <input
                        name="waterTemp"
                        defaultValue={item.waterTemp ?? ''}
                        type="number"
                        step="0.1"
                        className="rounded border p-2"
                     />
                     <input
                        name="length"
                        defaultValue={item.length ?? ''}
                        type="number"
                        step="0.1"
                        className="rounded border p-2"
                     />
                     <input
                        name="weight"
                        defaultValue={item.weight ?? ''}
                        type="number"
                        step="0.1"
                        className="rounded border p-2"
                     />
                  </div>
                  <Button type="submit">Save changes</Button>
               </form>
            )}
         </main>
      </div>
   );
}
