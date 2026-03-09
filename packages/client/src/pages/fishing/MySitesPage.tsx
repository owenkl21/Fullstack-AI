import axios from 'axios';
import { Show } from '@clerk/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

type SiteSummary = { id: string; name: string; catchCount: number };

export function MySitesPage() {
   const [items, setItems] = useState<SiteSummary[]>([]);

   useEffect(() => {
      const load = async () => {
         try {
            const { data } = await axios.get('/api/sites/me');
            setItems(data.sites ?? []);
         } catch (error) {
            console.error(error);
            toast({ title: 'Unable to load your sites', variant: 'error' });
         }
      };

      void load();
   }, []);

   const deleteSite = async (siteId: string) => {
      if (!window.confirm('Delete this location?')) {
         return;
      }

      await axios.delete(`/api/sites/${siteId}`);
      setItems((prev) => prev.filter((entry) => entry.id !== siteId));
      toast({ title: 'Location deleted', variant: 'success' });
   };

   return (
      <div className="min-h-screen">
         <LandingHeader />
         <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
            <FishingActionBar />
            <Show when="signed-in">
               <section className="space-y-3 rounded-lg border p-4">
                  <h1 className="text-2xl font-semibold">My locations</h1>
                  {items.length === 0 ? (
                     <p className="text-sm text-muted-foreground">
                        No locations yet.
                     </p>
                  ) : (
                     items.map((entry) => (
                        <div
                           key={entry.id}
                           className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"
                        >
                           <div>
                              <Link
                                 className="font-medium underline"
                                 to={`/sites/${entry.id}`}
                              >
                                 {entry.name}
                              </Link>
                              <p className="text-sm text-muted-foreground">
                                 {entry.catchCount} catches logged
                              </p>
                           </div>
                           <div className="flex gap-2">
                              <Button asChild size="sm" variant="outline">
                                 <Link to={`/sites/${entry.id}/edit`}>
                                    Edit
                                 </Link>
                              </Button>
                              <Button
                                 size="sm"
                                 variant="destructive"
                                 onClick={() => void deleteSite(entry.id)}
                              >
                                 Delete
                              </Button>
                           </div>
                        </div>
                     ))
                  )}
               </section>
            </Show>
         </main>
      </div>
   );
}
