import axios from 'axios';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { FishingBobberLoader } from '@/components/ui/fishing-bobber-loader';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import {
   formatCardinal,
   toMetricTemperature,
   toMetricWindSpeed,
} from '@/lib/weather';

type CatchEdit = {
   title: string;
   notes: string | null;
   caughtAt: string;
   site: {
      id: string;
      latitude: number | null;
      longitude: number | null;
   } | null;
   weather: string | null;
   gears: { id: string }[];
   length: number | null;
   weight: number | null;
   weatherConditionText: string | null;
   weatherConditionIconBaseUri: string | null;
   weatherTemperatureDegrees: number | null;
   weatherTemperatureUnit: string | null;
   weatherPrecipitationProbability: number | null;
   weatherWindDirectionCardinal: string | null;
   weatherWindSpeedValue: number | null;
   weatherWindSpeedUnit: string | null;
   weatherWindGustValue: number | null;
   weatherWindGustUnit: string | null;
   weatherCloudCover: number | null;
};

type SiteOption = {
   id: string;
   name: string;
   latitude: number | null;
   longitude: number | null;
};
type GearOption = {
   id: string;
   name: string;
   brand: string;
   type: string;
   imageUrl: string | null;
};

type WeatherSnapshot = {
   weatherCondition: {
      iconBaseUri: string;
      description: { text: string };
   };
   temperature: { degrees: number; unit: string };
   precipitation: { probability: { percent: number } };
   wind: {
      direction: { cardinal: string };
      speed: { value: number; unit: string };
      gust: { value: number; unit: string };
   };
   cloudCover: number;
};

const formatWeatherMetric = (
   value: number | undefined,
   unit?: string,
   kind: 'temperature' | 'wind' = 'wind'
) => {
   if (kind === 'temperature') {
      return toMetricTemperature(value, unit) ?? '';
   }

   return toMetricWindSpeed(value, unit) ?? '';
};

export function EditCatchPage() {
   const { catchId } = useParams();
   const navigate = useNavigate();
   const [item, setItem] = useState<CatchEdit | null>(null);
   const [sites, setSites] = useState<SiteOption[]>([]);
   const [gear, setGear] = useState<GearOption[]>([]);
   const [selectedGearIds, setSelectedGearIds] = useState<string[]>([]);
   const [weatherSnapshot, setWeatherSnapshot] =
      useState<WeatherSnapshot | null>(null);
   const [weatherOverview, setWeatherOverview] = useState('');
   const [isWeatherLoading, setIsWeatherLoading] = useState(false);
   const [currentCoords, setCurrentCoords] = useState<{
      latitude: number;
      longitude: number;
   } | null>(null);
   const [lengthValue, setLengthValue] = useState('');
   const [weightValue, setWeightValue] = useState('');
   const [lengthUnit, setLengthUnit] = useState<'cm' | 'ft'>('cm');
   const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

   useEffect(() => {
      if (!navigator.geolocation) {
         return;
      }

      navigator.geolocation.getCurrentPosition(
         (position) => {
            setCurrentCoords({
               latitude: position.coords.latitude,
               longitude: position.coords.longitude,
            });
         },
         () => {
            setCurrentCoords(null);
         }
      );
   }, []);

   useEffect(() => {
      const load = async () => {
         const [{ data: catchData }, { data: siteData }, { data: gearData }] =
            await Promise.all([
               axios.get(`/api/catches/${catchId}`),
               axios.get('/api/sites'),
               axios.get('/api/gear'),
            ]);
         setItem(catchData.catch);
         setSites(siteData.sites ?? []);
         setGear(gearData.gear ?? []);
         setWeatherOverview(catchData.catch.weather ?? '');
         if (catchData.catch.length !== null) {
            setLengthValue(String(catchData.catch.length));
         }
         if (catchData.catch.weight !== null) {
            setWeightValue(String(catchData.catch.weight));
         }
         setSelectedGearIds(
            (catchData.catch.gears ?? []).map(
               (entry: { id: string }) => entry.id
            )
         );

         if (catchData.catch.weatherConditionText) {
            setWeatherSnapshot({
               weatherCondition: {
                  iconBaseUri:
                     catchData.catch.weatherConditionIconBaseUri ?? '',
                  description: { text: catchData.catch.weatherConditionText },
               },
               temperature: {
                  degrees: catchData.catch.weatherTemperatureDegrees ?? 0,
                  unit: catchData.catch.weatherTemperatureUnit ?? 'CELSIUS',
               },
               precipitation: {
                  probability: {
                     percent:
                        catchData.catch.weatherPrecipitationProbability ?? 0,
                  },
               },
               wind: {
                  direction: {
                     cardinal:
                        catchData.catch.weatherWindDirectionCardinal ?? '',
                  },
                  speed: {
                     value: catchData.catch.weatherWindSpeedValue ?? 0,
                     unit:
                        catchData.catch.weatherWindSpeedUnit ??
                        'KILOMETERS_PER_HOUR',
                  },
                  gust: {
                     value: catchData.catch.weatherWindGustValue ?? 0,
                     unit:
                        catchData.catch.weatherWindGustUnit ??
                        'KILOMETERS_PER_HOUR',
                  },
               },
               cloudCover: catchData.catch.weatherCloudCover ?? 0,
            });
         }
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
         weather: weatherOverview.trim() || null,
         weatherSnapshot,
         length:
            Number(lengthValue) > 0
               ? lengthUnit === 'ft'
                  ? Number((Number(lengthValue) * 30.48).toFixed(2))
                  : Number(lengthValue)
               : null,
         weight:
            Number(weightValue) > 0
               ? weightUnit === 'lbs'
                  ? Number((Number(weightValue) * 0.453592).toFixed(2))
                  : Number(weightValue)
               : null,
         gearIds: selectedGearIds,
      });

      toast({ title: 'Catch updated', variant: 'success' });
      navigate(`/catches/${catchId}`);
   };

   const toggleGearSelection = (gearId: string) => {
      setSelectedGearIds((previous) =>
         previous.includes(gearId)
            ? previous.filter((id) => id !== gearId)
            : [...previous, gearId]
      );
   };

   const loadLatestConditions = async () => {
      const selectedSite = sites.find((site) => site.id === item?.site?.id);
      const latitude =
         selectedSite?.latitude ??
         item?.site?.latitude ??
         currentCoords?.latitude;
      const longitude =
         selectedSite?.longitude ??
         item?.site?.longitude ??
         currentCoords?.longitude;

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
         toast({
            title: 'No coordinates available',
            description:
               'Pick a site with coordinates or enable location access.',
            variant: 'error',
         });
         return;
      }

      try {
         setIsWeatherLoading(true);
         const { data } = await axios.get('/api/weather/current', {
            params: { latitude, longitude },
         });
         setWeatherSnapshot(data.weather ?? null);
         setWeatherOverview(
            data.weather?.weatherCondition?.description?.text ?? ''
         );
         toast({ title: 'Conditions updated', variant: 'success' });
      } catch (error) {
         console.error('Unable to refresh weather conditions', error);
         toast({
            title: 'Unable to update conditions',
            description: 'Please try again in a moment.',
            variant: 'error',
         });
      } finally {
         setIsWeatherLoading(false);
      }
   };

   return (
      <div className="min-h-screen">
         <LandingHeader />
         <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
            <FishingActionBar />
            {!item ? (
               <FishingBobberLoader label="Loading catch editor..." />
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
                  <fieldset className="grid gap-2 rounded border p-3">
                     <legend className="px-1 text-sm font-medium">
                        Gear used
                     </legend>
                     {gear.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                           No gear found in the database yet.
                        </p>
                     ) : (
                        <div className="grid gap-2">
                           {gear.map((entry) => {
                              const selected = selectedGearIds.includes(
                                 entry.id
                              );

                              return (
                                 <label
                                    key={entry.id}
                                    className="flex cursor-pointer items-center gap-3 rounded border p-2"
                                 >
                                    <input
                                       type="checkbox"
                                       checked={selected}
                                       onChange={() =>
                                          toggleGearSelection(entry.id)
                                       }
                                    />
                                    {entry.imageUrl ? (
                                       <img
                                          src={entry.imageUrl}
                                          alt={entry.name}
                                          className="h-10 w-10 rounded border object-cover"
                                       />
                                    ) : null}
                                    <span className="text-sm">
                                       <span className="font-medium">
                                          {entry.name}
                                       </span>{' '}
                                       <span className="text-muted-foreground">
                                          • {entry.brand} •{' '}
                                          {entry.type.toLowerCase()}
                                       </span>
                                    </span>
                                 </label>
                              );
                           })}
                        </div>
                     )}
                  </fieldset>
                  <fieldset className="grid gap-3 rounded border p-3">
                     <legend className="px-1 text-sm font-medium">
                        Conditions
                     </legend>
                     <Button
                        type="button"
                        variant="outline"
                        onClick={() => void loadLatestConditions()}
                        disabled={isWeatherLoading}
                     >
                        {isWeatherLoading
                           ? 'Loading conditions...'
                           : 'Load latest conditions'}
                     </Button>
                     <label className="grid gap-1 text-sm font-medium">
                        <span>Overview</span>
                        <input
                           name="weather"
                           value={weatherOverview}
                           onChange={(event) =>
                              setWeatherOverview(event.target.value)
                           }
                           className="rounded border p-2"
                        />
                     </label>
                     <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm font-medium">
                           <span>Temperature</span>
                           <input
                              readOnly
                              value={formatWeatherMetric(
                                 weatherSnapshot?.temperature?.degrees,
                                 weatherSnapshot?.temperature?.unit,
                                 'temperature'
                              )}
                              className="rounded border p-2"
                           />
                        </label>
                        <label className="grid gap-1 text-sm font-medium">
                           <span>Cloud cover</span>
                           <input
                              readOnly
                              value={
                                 weatherSnapshot?.cloudCover !== undefined
                                    ? `${weatherSnapshot.cloudCover}%`
                                    : ''
                              }
                              className="rounded border p-2"
                           />
                        </label>
                        <label className="grid gap-1 text-sm font-medium">
                           <span>Wind</span>
                           <input
                              readOnly
                              value={`${formatCardinal(weatherSnapshot?.wind?.direction?.cardinal)} ${formatWeatherMetric(weatherSnapshot?.wind?.speed?.value, weatherSnapshot?.wind?.speed?.unit)}`.trim()}
                              className="rounded border p-2"
                           />
                        </label>
                        <label className="grid gap-1 text-sm font-medium">
                           <span>Wind gust</span>
                           <input
                              readOnly
                              value={formatWeatherMetric(
                                 weatherSnapshot?.wind?.gust?.value,
                                 weatherSnapshot?.wind?.gust?.unit
                              )}
                              className="rounded border p-2"
                           />
                        </label>
                     </div>
                  </fieldset>
                  <div className="grid gap-3 sm:grid-cols-2">
                     <label className="grid gap-1 text-sm font-medium">
                        <span>Length</span>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                           <input
                              name="length"
                              value={lengthValue}
                              onChange={(event) =>
                                 setLengthValue(event.target.value)
                              }
                              type="number"
                              inputMode="decimal"
                              step="0.1"
                              className="rounded border p-2"
                           />
                           <select
                              value={lengthUnit}
                              onChange={(event) =>
                                 setLengthUnit(
                                    event.target.value as 'cm' | 'ft'
                                 )
                              }
                              className="rounded border p-2"
                           >
                              <option value="cm">cm</option>
                              <option value="ft">ft</option>
                           </select>
                        </div>
                     </label>
                     <label className="grid gap-1 text-sm font-medium">
                        <span>Weight</span>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                           <input
                              name="weight"
                              value={weightValue}
                              onChange={(event) =>
                                 setWeightValue(event.target.value)
                              }
                              type="number"
                              inputMode="decimal"
                              step="0.1"
                              className="rounded border p-2"
                           />
                           <select
                              value={weightUnit}
                              onChange={(event) =>
                                 setWeightUnit(
                                    event.target.value as 'kg' | 'lbs'
                                 )
                              }
                              className="rounded border p-2"
                           >
                              <option value="kg">kg</option>
                              <option value="lbs">lbs</option>
                           </select>
                        </div>
                     </label>
                  </div>
                  <Button type="submit">Save changes</Button>
               </form>
            )}
         </main>
      </div>
   );
}
