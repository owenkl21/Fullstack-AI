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

   const hasCoordinates = data?.latitude != null && data?.longitude != null;
   const mapUrl = hasCoordinates
      ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}&z=13&output=embed`
      : null;
   const openMapUrl = hasCoordinates
      ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}`
      : null;

   return (
      <div className="min-h-screen">
         <LandingHeader />
         <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
            <FishingActionBar />
            {!data ? (
               <FishingBobberLoader label="Loading site details..." />
            ) : (
               <article className="space-y-6 rounded-lg border p-4">
                  <section className="grid gap-4 md:grid-cols-[240px_1fr] md:items-start">
                     <div>
                        {data.images[0]?.image.url ? (
                           <img
                              src={data.images[0].image.url}
                              alt={data.name}
                              className="aspect-[4/3] w-full rounded-md object-cover"
                           />
                        ) : (
                           <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md border text-sm text-muted-foreground">
                              No image yet
                           </div>
                        )}
                     </div>
                     <div className="space-y-2">
                        <h1 className="text-2xl font-semibold">{data.name}</h1>
                        <p>{data.description ?? 'No description yet.'}</p>
                        <p>Water type: {data.waterType ?? 'Not specified'}</p>
                        <p>
                           Access notes: {data.accessNotes ?? 'Not specified'}
                        </p>
                     </div>
                  </section>

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

                  {hasCoordinates ? (
                     <section className="space-y-2">
                        <a
                           className="text-sm underline"
                           href={openMapUrl!}
                           target="_blank"
                           rel="noreferrer"
                        >
                           Open map location
                        </a>
                        <iframe
                           title={`Map of ${data.name}`}
                           src={mapUrl!}
                           className="h-72 w-full rounded-md border"
                           loading="lazy"
                           referrerPolicy="no-referrer-when-downgrade"
                        />
                     </section>
                  ) : null}
               </article>
            )}
         </main>
      </div>
   );
}
