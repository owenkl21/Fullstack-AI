import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';

type CatchDetail = {
   id: string;
   title: string;
   notes: string | null;
   caughtAt: string;
   weather: string | null;
   waterTemp: number | null;
   depth: number | null;
   count: number;
   length: number | null;
   weight: number | null;
   site: { id: string; name: string } | null;
   species: { commonName: string } | null;
   gear: { name: string; category: string | null } | null;
   images: { image: { id: string; url: string } }[];
};

export function CatchDetailPage() {
   const { catchId } = useParams();
   const [data, setData] = useState<CatchDetail | null>(null);

   useEffect(() => {
      const load = async () => {
         const response = await axios.get(`/api/catches/${catchId}`);
         setData(response.data.catch);
      };

      void load();
   }, [catchId]);

   return (
      <div className="min-h-screen">
         <LandingHeader />
         <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
            <FishingActionBar />
            {!data ? (
               <p>Loading catch...</p>
            ) : (
               <article className="space-y-4 rounded-lg border p-4">
                  <h1 className="text-2xl font-semibold">{data.title}</h1>
                  <p className="text-sm text-muted-foreground">
                     Caught {new Date(data.caughtAt).toLocaleString()}
                  </p>
                  <p>Species: {data.species?.commonName ?? 'Not specified'}</p>
                  <p>Gear: {data.gear?.name ?? 'Not specified'}</p>
                  <p>
                     Conditions: {data.weather ?? 'Not specified'} | Water temp:{' '}
                     {data.waterTemp ?? '—'} | Depth: {data.depth ?? '—'}
                  </p>
                  <p>
                     Size: {data.length ?? '—'} length / {data.weight ?? '—'}{' '}
                     weight | Count: {data.count}
                  </p>
                  {data.site && (
                     <p>
                        Site:{' '}
                        <Link
                           className="underline"
                           to={`/sites/${data.site.id}`}
                        >
                           {data.site.name}
                        </Link>
                     </p>
                  )}
                  {data.notes && <p>{data.notes}</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
                     {data.images.map((entry) => (
                        <img
                           key={entry.image.id}
                           src={entry.image.url}
                           alt="Catch"
                           className="h-48 w-full rounded-md object-cover"
                        />
                     ))}
                  </div>
               </article>
            )}
         </main>
      </div>
   );
}
