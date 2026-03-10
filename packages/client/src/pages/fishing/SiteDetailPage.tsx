import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { FishingBobberLoader } from '@/components/ui/fishing-bobber-loader';

type SiteDetail = {
   id: string;
   name: string;
   description: string | null;
   latitude: number | null;
   longitude: number | null;
   waterType: string | null;
   accessNotes: string | null;
   images: { image: { id: string; url: string } }[];
   catches: {
      id: string;
      title: string;
      caughtAt: string;
      species: { commonName: string } | null;
      createdBy: { displayName: string; username: string };
   }[];
};

export function SiteDetailPage() {
   const { siteId } = useParams();
   const [data, setData] = useState<SiteDetail | null>(null);

   useEffect(() => {
      const load = async () => {
         const response = await axios.get(`/api/sites/${siteId}`);
         setData(response.data.site);
      };

      void load();
   }, [siteId]);

   return (
      <div className="min-h-screen">
         <LandingHeader />
         <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
            <FishingActionBar />
            {!data ? (
               <FishingBobberLoader label="Loading site details..." />
            ) : (
               <article className="space-y-4 rounded-lg border p-4">
                  <h1 className="text-2xl font-semibold">{data.name}</h1>
                  <p>{data.description ?? 'No description yet.'}</p>
                  <p>Water type: {data.waterType ?? 'Not specified'}</p>
                  <p>
                     Coordinates: {data.latitude ?? '—'},{' '}
                     {data.longitude ?? '—'}
                  </p>
                  {data.latitude && data.longitude && (
                     <a
                        className="underline"
                        href={`https://www.google.com/maps?q=${data.latitude},${data.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                     >
                        Open map location
                     </a>
                  )}
                  <p>Access notes: {data.accessNotes ?? 'Not specified'}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                     {data.images.map((entry) => (
                        <img
                           key={entry.image.id}
                           src={entry.image.url}
                           alt="Site"
                           className="h-48 w-full rounded-md bg-muted object-contain"
                        />
                     ))}
                  </div>
                  <section className="space-y-2">
                     <h2 className="text-lg font-semibold">
                        Recent catches at this site
                     </h2>
                     {data.catches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                           No catches logged for this site yet.
                        </p>
                     ) : (
                        data.catches.map((catchItem) => (
                           <Link
                              key={catchItem.id}
                              to={`/catches/${catchItem.id}`}
                              className="block rounded border p-3 hover:bg-muted/50"
                           >
                              <p className="font-medium">{catchItem.title}</p>
                              <p className="text-sm text-muted-foreground">
                                 {new Date(catchItem.caughtAt).toLocaleString()}{' '}
                                 •{' '}
                                 {catchItem.species?.commonName ??
                                    'Unknown species'}
                              </p>
                           </Link>
                        ))
                     )}
                  </section>
               </article>
            )}
         </main>
      </div>
   );
}
