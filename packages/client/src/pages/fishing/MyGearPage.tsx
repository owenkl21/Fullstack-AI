import axios from 'axios';
import { Show } from '@clerk/react';
import { useEffect, useMemo, useState } from 'react';
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
   const pageSize = 10;
   const [items, setItems] = useState<GearItem[]>([]);
   const [searchTerm, setSearchTerm] = useState('');
   const [page, setPage] = useState(1);
   const [isLoading, setIsLoading] = useState(true);

   const filteredItems = useMemo(() => {
      const query = searchTerm.trim().toLowerCase();
      if (!query) {
         return items;
      }

      return items.filter((entry) =>
         [entry.name, entry.brand, entry.type].some((value) =>
            value.toLowerCase().includes(query)
         )
      );
   }, [items, searchTerm]);

   const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
   const pagedItems = filteredItems.slice(
      (page - 1) * pageSize,
      page * pageSize
   );

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

   useEffect(() => {
      setPage(1);
   }, [searchTerm]);

   useEffect(() => {
      if (page > totalPages) {
         setPage(totalPages);
      }
   }, [page, totalPages]);

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
                  <input
                     className="w-full rounded border px-3 py-2 text-sm"
                     value={searchTerm}
                     onChange={(event) => setSearchTerm(event.target.value)}
                     placeholder="Search gear"
                  />
                  {isLoading ? (
                     <FishingBobberLoader label="Loading your gear..." />
                  ) : filteredItems.length === 0 ? (
                     <p className="text-sm text-muted-foreground">
                        No gear found.
                     </p>
                  ) : (
                     pagedItems.map((entry) => (
                        <div
                           key={entry.id}
                           className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
                        >
                           <div className="flex items-center gap-3">
                              {entry.imageUrl ? (
                                 <img
                                    src={entry.imageUrl}
                                    alt={entry.name}
                                    className="h-12 w-12 rounded border object-cover"
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
                  {filteredItems.length > pageSize ? (
                     <div className="flex items-center justify-between pt-2">
                        <p className="text-sm text-muted-foreground">
                           Page {page} of {totalPages}
                        </p>
                        <div className="flex gap-2">
                           <Button
                              size="sm"
                              variant="outline"
                              disabled={page === 1}
                              onClick={() => setPage((current) => current - 1)}
                           >
                              Previous
                           </Button>
                           <Button
                              size="sm"
                              variant="outline"
                              disabled={page === totalPages}
                              onClick={() => setPage((current) => current + 1)}
                           >
                              Next
                           </Button>
                        </div>
                     </div>
                  ) : null}
               </section>
            </Show>
         </main>
      </div>
   );
}
