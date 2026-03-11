import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { FishingBobberLoader } from '@/components/ui/fishing-bobber-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type CatchDetail = {
   id: string;
   title: string;
   notes: string | null;
   caughtAt: string;
   weather: string | null;
   weatherConditionText: string | null;
   weatherTemperatureDegrees: number | null;
   weatherTemperatureUnit: string | null;
   weatherPrecipitationProbability: number | null;
   weatherWindDirectionCardinal: string | null;
   weatherWindSpeedValue: number | null;
   weatherWindSpeedUnit: string | null;
   weatherWindGustValue: number | null;
   weatherWindGustUnit: string | null;
   weatherCloudCover: number | null;
   weatherRelativeHumidity: number | null;
   weatherUvIndex: number | null;
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

   const conditions = useMemo(() => {
      if (!data) {
         return [];
      }

      return [
         {
            label: 'Overview',
            value: data.weather ?? data.weatherConditionText,
         },
         {
            label: 'Temperature',
            value:
               data.weatherTemperatureDegrees !== null
                  ? `${data.weatherTemperatureDegrees} ${data.weatherTemperatureUnit ?? ''}`.trim()
                  : null,
         },
         {
            label: 'Precipitation',
            value:
               data.weatherPrecipitationProbability !== null
                  ? `${data.weatherPrecipitationProbability}%`
                  : null,
         },
         {
            label: 'Wind',
            value:
               data.weatherWindSpeedValue !== null
                  ? `${data.weatherWindDirectionCardinal ?? ''} ${data.weatherWindSpeedValue} ${data.weatherWindSpeedUnit ?? ''}`.trim()
                  : null,
         },
         {
            label: 'Wind gusts',
            value:
               data.weatherWindGustValue !== null
                  ? `${data.weatherWindGustValue} ${data.weatherWindGustUnit ?? ''}`.trim()
                  : null,
         },
         {
            label: 'Cloud cover',
            value:
               data.weatherCloudCover !== null
                  ? `${data.weatherCloudCover}%`
                  : null,
         },
         {
            label: 'Humidity',
            value:
               data.weatherRelativeHumidity !== null
                  ? `${data.weatherRelativeHumidity}%`
                  : null,
         },
         {
            label: 'UV index',
            value:
               data.weatherUvIndex !== null
                  ? String(data.weatherUvIndex)
                  : null,
         },
      ].filter((item) => Boolean(item.value));
   }, [data]);

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
                           className="h-96 w-full object-cover"
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
                                          className="h-10 w-10 rounded border object-cover"
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
                     <Card className="gap-3 py-4">
                        <CardHeader className="px-4">
                           <CardTitle>Conditions</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4">
                           {conditions.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                 No conditions recorded.
                              </p>
                           ) : (
                              <div className="grid gap-2 sm:grid-cols-2">
                                 {conditions.map((condition) => (
                                    <div
                                       key={condition.label}
                                       className="rounded border p-2"
                                    >
                                       <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                          {condition.label}
                                       </p>
                                       <p className="text-sm font-medium">
                                          {condition.value}
                                       </p>
                                    </div>
                                 ))}
                              </div>
                           )}
                        </CardContent>
                     </Card>
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
