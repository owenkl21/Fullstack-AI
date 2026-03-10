import axios from 'axios';
import { Show } from '@clerk/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { FishingBobberLoader } from '@/components/ui/fishing-bobber-loader';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

type GearItem = {
   id: string;
   name: string;
   brand: string;
   type: string;
   imageUrl: string | null;
};

export function MyGearPage() {
   const [items, setItems] = useState<GearItem[]>([]);
   const [isLoading, setIsLoading] = useState(true);

   useEffect(() => {
      const load = async () => {
         try {
            setIsLoading(true);
            const { data } = await axios.get('/api/gear/me');
            setItems(data.gear ?? []);
         } catch (error) {
            console.error(error);
            toast({ title: 'Unable to load your gear', variant: 'error' });
         } finally {
            setIsLoading(false);
         }
      };

      void load();
   }, []);

   const deleteGear = async (gearId: string) => {
      if (!window.confirm('Delete this gear item?')) {
         return;
      }

      await axios.delete(`/api/gear/${gearId}`);
      setItems((prev) => prev.filter((entry) => entry.id !== gearId));
      toast({ title: 'Gear deleted', variant: 'success' });
   };

   return (
      <div className="min-h-screen">
         <LandingHeader />
         <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
            <FishingActionBar />
            <Show when="signed-in">
               <section className="space-y-3 rounded-lg border p-4">
                  <h1 className="text-2xl font-semibold">My gear</h1>
                  {isLoading ? (
                     <FishingBobberLoader label="Loading your gear..." />
                  ) : items.length === 0 ? (
                     <p className="text-sm text-muted-foreground">
                        No gear yet.
                     </p>
                  ) : (
                     items.map((entry) => (
                        <div
                           key={entry.id}
                           className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
                        >
                           <div className="flex items-center gap-3">
                              {entry.imageUrl ? (
                                 <img
                                    src={entry.imageUrl}
                                    alt={entry.name}
                                    className="h-12 w-12 rounded border bg-muted object-contain"
                                 />
                              ) : null}
                              <div>
                                 <p className="font-medium">{entry.name}</p>
                                 <p className="text-sm text-muted-foreground">
                                    {entry.brand} • {entry.type.toLowerCase()}
                                 </p>
                              </div>
                           </div>
                           <div className="flex gap-2">
                              <Button asChild size="sm" variant="outline">
                                 <Link to={`/gear/${entry.id}/edit`}>Edit</Link>
                              </Button>
                              <Button
                                 size="sm"
                                 variant="destructive"
                                 onClick={() => void deleteGear(entry.id)}
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
