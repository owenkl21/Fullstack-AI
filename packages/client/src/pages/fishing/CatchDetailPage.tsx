import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { FishingBobberLoader } from '@/components/ui/fishing-bobber-loader';
import { Button } from '@/components/ui/button';

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
   gears: {
      id: string;
      name: string;
      brand: string;
      type: string;
      imageUrl: string | null;
   }[];
   images: { image: { id: string; url: string } }[];
};

export function CatchDetailPage() {
   const { catchId } = useParams();
   const [data, setData] = useState<CatchDetail | null>(null);
   const [activeImage, setActiveImage] = useState(0);

   useEffect(() => {
      const load = async () => {
         const response = await axios.get(`/api/catches/${catchId}`);
         setData(response.data.catch);
      };

      void load();
   }, [catchId]);

   const images = useMemo(() => data?.images ?? [], [data?.images]);
   const canSlide = images.length > 1;

   return (
      <div className="min-h-screen">
         <LandingHeader />
         <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
            <FishingActionBar />
            {!data ? (
               <FishingBobberLoader label="Loading catch details..." />
            ) : (
               <article className="overflow-hidden rounded-xl border bg-white">
                  <div className="relative bg-black">
                     {images.length > 0 ? (
                        <img
                           src={images[activeImage]?.image.url}
                           alt="Catch"
                           className="h-96 w-full bg-muted object-contain"
                        />
                     ) : (
                        <div className="flex h-96 items-center justify-center text-sm text-slate-300">
                           No images uploaded
                        </div>
                     )}
                     {canSlide && (
                        <>
                           <Button
                              type="button"
                              size="sm"
                              className="absolute left-3 top-1/2 -translate-y-1/2"
                              onClick={() =>
                                 setActiveImage((prev) =>
                                    prev === 0 ? images.length - 1 : prev - 1
                                 )
                              }
                           >
                              Prev
                           </Button>
                           <Button
                              type="button"
                              size="sm"
                              className="absolute right-3 top-1/2 -translate-y-1/2"
                              onClick={() =>
                                 setActiveImage((prev) =>
                                    prev === images.length - 1 ? 0 : prev + 1
                                 )
                              }
                           >
                              Next
                           </Button>
                        </>
                     )}
                  </div>
                  <div className="space-y-3 p-4">
                     <h1 className="text-2xl font-semibold">{data.title}</h1>
                     <p className="text-sm text-muted-foreground">
                        Caught {new Date(data.caughtAt).toLocaleString()}
                     </p>
                     <p>
                        Species: {data.species?.commonName ?? 'Not specified'}
                     </p>
                     <div className="space-y-2">
                        <p className="font-medium">Gear</p>
                        {data.gears.length === 0 ? (
                           <p>Not specified</p>
                        ) : (
                           <div className="grid gap-2">
                              {data.gears.map((gear) => (
                                 <div
                                    key={gear.id}
                                    className="flex items-center gap-3 rounded border p-2"
                                 >
                                    {gear.imageUrl ? (
                                       <img
                                          src={gear.imageUrl}
                                          alt={gear.name}
                                          className="h-10 w-10 rounded border bg-muted object-contain"
                                       />
                                    ) : null}
                                    <p className="text-sm">
                                       <span className="font-medium">
                                          {gear.name}
                                       </span>{' '}
                                       <span className="text-muted-foreground">
                                          • {gear.brand} •{' '}
                                          {gear.type.toLowerCase()}
                                       </span>
                                    </p>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                     <p>
                        Conditions: {data.weather ?? 'Not specified'} | Water
                        temp: {data.waterTemp ?? '—'}
                     </p>
                     <p>
                        Size: {data.length ?? '—'} length / {data.weight ?? '—'}{' '}
                        weight
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
                     {data.notes && (
                        <p className="whitespace-pre-line">{data.notes}</p>
                     )}
                  </div>
               </article>
            )}
         </main>
      </div>
   );
}
