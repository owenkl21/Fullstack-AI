import axios from 'axios';
import { Show } from '@clerk/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { FishingBobberLoader } from '@/components/ui/fishing-bobber-loader';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

type CatchSummary = {
   id: string;
   title: string;
   caughtAt: string;
   count: number;
   length: number | null;
   weight: number | null;
   site: { id: string; name: string } | null;
   images: { image: { id: string; url: string } }[];
};

export function MyCatchesPage() {
   const [items, setItems] = useState<CatchSummary[]>([]);
   const [isLoading, setIsLoading] = useState(true);

   useEffect(() => {
      const load = async () => {
         try {
            setIsLoading(true);
            const { data } = await axios.get('/api/catches/me');
            setItems(data.catches ?? []);
         } catch (error) {
            console.error(error);
            toast({ title: 'Unable to load your catches', variant: 'error' });
         } finally {
            setIsLoading(false);
         }
      };

      void load();
   }, []);

   const deleteCatch = async (catchId: string) => {
      if (!window.confirm('Delete this catch?')) {
         return;
      }

      await axios.delete(`/api/catches/${catchId}`);
      setItems((prev) => prev.filter((entry) => entry.id !== catchId));
      toast({ title: 'Catch deleted', variant: 'success' });
   };

   return (
      <div className="min-h-screen">
         <LandingHeader />
         <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
            <FishingActionBar />
            <Show when="signed-in">
               <section className="space-y-3 rounded-lg border p-4">
                  <h1 className="text-2xl font-semibold">My catches</h1>
                  {isLoading ? (
                     <FishingBobberLoader label="Loading your catches..." />
                  ) : items.length === 0 ? (
                     <p className="text-sm text-muted-foreground">
                        No catches yet.
                     </p>
                  ) : (
                     items.map((entry) => (
                        <div
                           key={entry.id}
                           className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
                        >
                           <div className="flex min-w-0 items-center gap-3">
                              {entry.images[0]?.image.url ? (
                                 <img
                                    src={entry.images[0].image.url}
                                    alt={entry.title}
                                    className="h-14 w-14 rounded-md border object-cover"
                                 />
                              ) : (
                                 <div className="flex h-14 w-14 items-center justify-center rounded-md border text-xs text-muted-foreground">
                                    No img
                                 </div>
                              )}
                              <div>
                                 <Link
                                    className="font-medium underline"
                                    to={`/catches/${entry.id}`}
                                 >
                                    {entry.title}
                                 </Link>
                                 <p className="text-sm text-muted-foreground">
                                    {entry.count} catches •{' '}
                                    {new Date(entry.caughtAt).toLocaleString()}{' '}
                                    • {entry.site?.name ?? 'No site'}
                                 </p>
                                 <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                    <div className="rounded-lg border bg-slate-50 p-2">
                                       <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                          Length
                                       </p>
                                       <p className="text-sm font-semibold text-slate-900">
                                          {entry.length !== null
                                             ? `${entry.length} cm`
                                             : '—'}
                                       </p>
                                    </div>
                                    <div className="rounded-lg border bg-slate-50 p-2">
                                       <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                          Weight
                                       </p>
                                       <p className="text-sm font-semibold text-slate-900">
                                          {entry.weight !== null
                                             ? `${entry.weight} kg`
                                             : '—'}
                                       </p>
                                    </div>
                                 </div>
                              </div>
                           </div>
                           <div className="flex gap-2">
                              <Button asChild size="sm" variant="outline">
                                 <Link to={`/catches/${entry.id}/edit`}>
                                    Edit
                                 </Link>
                              </Button>
                              <Button
                                 size="sm"
                                 variant="destructive"
                                 onClick={() => void deleteCatch(entry.id)}
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
