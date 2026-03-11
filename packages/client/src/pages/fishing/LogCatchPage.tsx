import axios from 'axios';
import { Show, SignInButton } from '@clerk/react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { GoogleMapLocationPicker } from '@/components/fishing/GoogleMapLocationPicker';
import { Button } from '@/components/ui/button';
import { FishingBobberLoader } from '@/components/ui/fishing-bobber-loader';
import { toast } from '@/components/ui/use-toast';
import { R2ImagePicker } from '@/components/r2-image-picker';

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

const formatForDateTimeLocal = (date: Date) => {
   const pad = (value: number) => String(value).padStart(2, '0');

   return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toDisplay = (value: string | number | boolean | null | undefined) =>
   value === null || value === undefined ? '' : String(value);

const formatUnit = (unit: string | undefined) => {
   if (!unit) {
      return '';
   }

   const map: Record<string, string> = {
      CELSIUS: '°C',
      FAHRENHEIT: '°F',
      KILOMETERS_PER_HOUR: 'km/h',
      MILES_PER_HOUR: 'mph',
   };

   return map[unit] ?? unit;
};

const formatCardinal = (cardinal: string | undefined) => {
   if (!cardinal) {
      return '';
   }

   const map: Record<string, string> = {
      NORTH: 'N',
      NORTH_NORTHEAST: 'NNE',
      NORTHEAST: 'NE',
      EAST_NORTHEAST: 'ENE',
      EAST: 'E',
      EAST_SOUTHEAST: 'ESE',
      SOUTHEAST: 'SE',
      SOUTH_SOUTHEAST: 'SSE',
      SOUTH: 'S',
      SOUTH_SOUTHWEST: 'SSW',
      SOUTHWEST: 'SW',
      WEST_SOUTHWEST: 'WSW',
      WEST: 'W',
      WEST_NORTHWEST: 'WNW',
      NORTHWEST: 'NW',
      NORTH_NORTHWEST: 'NNW',
   };

   return map[cardinal] ?? cardinal;
};

const formatWeatherMetric = (value: number | undefined, unit?: string) => {
   if (value === null || value === undefined) {
      return '';
   }

   const resolvedUnit = formatUnit(unit);
   return resolvedUnit ? `${value} ${resolvedUnit}` : String(value);
};

export function LogCatchPage() {
   const navigate = useNavigate();
   const [isSaving, setIsSaving] = useState(false);
   const [images, setImages] = useState<{ storageKey: string; url: string }[]>(
      []
   );
   const [sites, setSites] = useState<SiteOption[]>([]);
   const [siteChoice, setSiteChoice] = useState('');
   const [locationSearch, setLocationSearch] = useState('');
   const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
   const [gear, setGear] = useState<GearOption[]>([]);
   const [gearSearch, setGearSearch] = useState('');
   const [selectedGearIds, setSelectedGearIds] = useState<string[]>([]);
   const [isGearDropdownOpen, setIsGearDropdownOpen] = useState(false);
   const [caughtAt, setCaughtAt] = useState(() =>
      formatForDateTimeLocal(new Date())
   );
   const [isLoadingOptions, setIsLoadingOptions] = useState(true);
   const [weatherSnapshot, setWeatherSnapshot] =
      useState<WeatherSnapshot | null>(null);
   const [isWeatherLoading, setIsWeatherLoading] = useState(false);
   const [currentCoords, setCurrentCoords] = useState<{
      latitude: number;
      longitude: number;
   } | null>(null);
   const [customLatitude, setCustomLatitude] = useState('');
   const [customLongitude, setCustomLongitude] = useState('');
   const [lengthUnit, setLengthUnit] = useState<'cm' | 'ft'>('cm');
   const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

   useEffect(() => {
      const loadData = async () => {
         try {
            setIsLoadingOptions(true);
            const [{ data: siteData }, { data: gearData }] = await Promise.all([
               axios.get('/api/sites'),
               axios.get('/api/gear'),
            ]);
            setSites(siteData.sites ?? []);
            setGear(gearData.gear ?? []);
         } catch (error) {
            console.error('Unable to load fishing sites/gear', error);
            setSites([]);
            setGear([]);
            toast({
               title: 'Unable to load fishing spots',
               description:
                  'You can still save a catch without selecting a spot.',
               variant: 'error',
            });
         } finally {
            setIsLoadingOptions(false);
         }
      };

      void loadData();
   }, []);

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
      const loadWeather = async () => {
         const selectedSite = sites.find((site) => site.id === siteChoice);
         const isOtherSpot = siteChoice === '__other';
         const latitude = isOtherSpot
            ? Number(customLatitude)
            : (selectedSite?.latitude ?? currentCoords?.latitude);
         const longitude = isOtherSpot
            ? Number(customLongitude)
            : (selectedSite?.longitude ?? currentCoords?.longitude);

         if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            setWeatherSnapshot(null);
            return;
         }

         try {
            setIsWeatherLoading(true);
            const { data } = await axios.get('/api/weather/current', {
               params: { latitude, longitude },
            });
            setWeatherSnapshot(data.weather ?? null);
         } catch (error) {
            console.error('Unable to fetch weather snapshot', error);
            setWeatherSnapshot(null);
         } finally {
            setIsWeatherLoading(false);
         }
      };

      void loadWeather();
   }, [siteChoice, sites, currentCoords, customLatitude, customLongitude]);

   const setCustomCoordinates = (latitude: number, longitude: number) => {
      setCustomLatitude(latitude.toFixed(6));
      setCustomLongitude(longitude.toFixed(6));
   };

   const submitCatch = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const isOtherSpot = siteChoice === '__other';
      const customSpot = String(formData.get('customSpot') ?? '').trim();
      const normalizedLength = Number(formData.get('length')) || null;
      const normalizedWeight = Number(formData.get('weight')) || null;
      const notes = String(formData.get('notes') ?? '').trim();
      const rawCaughtAt = caughtAt.trim();

      const parsedCaughtAt = rawCaughtAt ? new Date(rawCaughtAt) : null;

      if (!parsedCaughtAt || Number.isNaN(parsedCaughtAt.getTime())) {
         toast({
            title: 'Invalid catch date/time',
            description: 'Please choose a valid date and time.',
            variant: 'error',
         });
         return;
      }

      let siteId = isOtherSpot ? null : siteChoice || null;

      if (isOtherSpot) {
         const latitude = Number(customLatitude);
         const longitude = Number(customLongitude);

         if (!customSpot) {
            toast({
               title: 'Site name is required',
               description: 'Add a name for your custom location.',
               variant: 'error',
            });
            return;
         }

         if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            toast({
               title: 'Drop a pin on the map',
               description:
                  'Choose your custom location by dropping a pin on the map.',
               variant: 'error',
            });
            return;
         }

         try {
            const { data } = await axios.post('/api/sites', {
               name: customSpot,
               latitude,
               longitude,
               description: null,
               waterType: null,
               accessNotes: null,
               images: [],
            });
            siteId = data.site.id;
         } catch (siteError) {
            console.error('Unable to create site from catch log', siteError);
            toast({
               title: 'Unable to create location',
               description: 'Please try dropping your pin again.',
               variant: 'error',
            });
            return;
         }
      }

      const basePayload = {
         title: String(formData.get('title') ?? ''),
         caughtAt: parsedCaughtAt.toISOString(),
         notes: notes || null,
         siteId,
         weather: weatherSnapshot?.weatherCondition?.description?.text ?? null,
         weatherSnapshot,
         length:
            normalizedLength === null
               ? null
               : lengthUnit === 'ft'
                 ? Number((normalizedLength * 30.48).toFixed(2))
                 : normalizedLength,
         weight:
            normalizedWeight === null
               ? null
               : weightUnit === 'lbs'
                 ? Number((normalizedWeight * 0.453592).toFixed(2))
                 : normalizedWeight,
         images,
         gearIds: selectedGearIds,
      };

      try {
         setIsSaving(true);
         const { data } = await axios.post('/api/catches', basePayload);
         toast({ title: 'Catch logged!', variant: 'success' });
         navigate(`/catches/${data.catch.id}`);
      } catch (error) {
         const shouldRetryWithoutImages =
            axios.isAxiosError(error) &&
            error.response?.status === 500 &&
            images.length > 0;

         if (shouldRetryWithoutImages) {
            try {
               const { data } = await axios.post('/api/catches', {
                  ...basePayload,
                  images: [],
               });

               toast({
                  title: 'Catch logged without images',
                  description:
                     'Your catch was saved. You can add images later while we improve upload reliability.',
               });
               navigate(`/catches/${data.catch.id}`);
               return;
            } catch (retryError) {
               console.error('Catch save retry failed', retryError);
            }
         }

         console.error(error);
         const message =
            axios.isAxiosError(error) &&
            typeof error.response?.data?.message === 'string'
               ? error.response.data.message
               : 'Check your values and try again.';

         toast({
            title: 'Unable to log catch',
            description: message,
            variant: 'error',
         });
      } finally {
         setIsSaving(false);
      }
   };

   const toggleGearSelection = (gearId: string) => {
      setSelectedGearIds((previous) =>
         previous.includes(gearId)
            ? previous.filter((id) => id !== gearId)
            : [...previous, gearId]
      );
   };

   const filteredGear = useMemo(() => {
      const normalizedSearch = gearSearch.trim().toLowerCase();

      if (!normalizedSearch) {
         return gear;
      }

      return gear.filter((entry) =>
         [entry.name, entry.brand, entry.type]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch)
      );
   }, [gear, gearSearch]);

   const filteredSites = useMemo(() => {
      const normalizedSearch = locationSearch.trim().toLowerCase();
      if (!normalizedSearch) {
         return sites;
      }

      return sites.filter((site) =>
         site.name.toLowerCase().includes(normalizedSearch)
      );
   }, [sites, locationSearch]);

   return (
      <div className="min-h-screen">
         <LandingHeader />
         <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
            <FishingActionBar />
            <Show when="signed-in">
               <form
                  onSubmit={submitCatch}
                  className="grid gap-3 rounded-lg border p-4"
               >
                  <h1 className="text-2xl font-semibold">Log a catch</h1>
                  {isLoadingOptions && (
                     <FishingBobberLoader label="Loading your fishing spots and gear..." />
                  )}
                  <label className="grid gap-1 text-sm font-medium">
                     <span>Catch title</span>
                     <input
                        name="title"
                        placeholder="Catch title"
                        className="rounded border p-2"
                        required
                     />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                     <span>Date and time</span>
                     <input
                        name="caughtAt"
                        type="datetime-local"
                        value={caughtAt}
                        onChange={(event) => setCaughtAt(event.target.value)}
                        className="rounded border p-2"
                        required
                     />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                     <span>Notes</span>
                     <textarea
                        name="notes"
                        placeholder="Notes"
                        className="rounded border p-2"
                     />
                  </label>
                  <fieldset className="grid gap-2 rounded border p-3">
                     <legend className="px-1 text-sm font-medium">
                        Location
                     </legend>
                     <Button
                        type="button"
                        variant="outline"
                        className="justify-between"
                        onClick={() =>
                           setIsLocationDropdownOpen((previous) => !previous)
                        }
                     >
                        <span>
                           {siteChoice === '__other'
                              ? 'Other (create new location)'
                              : siteChoice
                                ? (sites.find((site) => site.id === siteChoice)
                                     ?.name ?? 'Select location')
                                : 'Use current location'}
                        </span>
                        <span>{isLocationDropdownOpen ? '▲' : '▼'}</span>
                     </Button>
                     {isLocationDropdownOpen ? (
                        <div className="grid gap-2 rounded border p-2">
                           <input
                              type="search"
                              value={locationSearch}
                              onChange={(event) =>
                                 setLocationSearch(event.target.value)
                              }
                              placeholder="Search locations"
                              className="rounded border p-2 text-sm"
                           />
                           <button
                              type="button"
                              className="rounded border p-2 text-left text-sm"
                              onClick={() => {
                                 setSiteChoice('');
                                 setIsLocationDropdownOpen(false);
                              }}
                           >
                              Use current location
                           </button>
                           {filteredSites.map((site) => (
                              <button
                                 key={site.id}
                                 type="button"
                                 className="rounded border p-2 text-left text-sm"
                                 onClick={() => {
                                    setSiteChoice(site.id);
                                    setIsLocationDropdownOpen(false);
                                 }}
                              >
                                 {site.name}
                              </button>
                           ))}
                           <button
                              type="button"
                              className="rounded border p-2 text-left text-sm"
                              onClick={() => {
                                 setSiteChoice('__other');
                                 setIsLocationDropdownOpen(false);
                              }}
                           >
                              Other (add new spot)
                           </button>
                        </div>
                     ) : null}
                  </fieldset>
                  {siteChoice === '__other' && (
                     <div className="grid gap-3 rounded border p-3">
                        <label className="grid gap-1 text-sm font-medium">
                           <span>New location name</span>
                           <input
                              name="customSpot"
                              placeholder="Enter fishing spot name"
                              className="rounded border p-2"
                              required
                           />
                        </label>
                        <GoogleMapLocationPicker
                           latitude={customLatitude}
                           longitude={customLongitude}
                           onChange={setCustomCoordinates}
                        />
                     </div>
                  )}
                  <fieldset className="grid gap-2 rounded border p-3">
                     <legend className="px-1 text-sm font-medium">
                        Gear used
                     </legend>
                     <Button
                        type="button"
                        variant="outline"
                        className="justify-between"
                        onClick={() =>
                           setIsGearDropdownOpen((previous) => !previous)
                        }
                     >
                        <span>
                           {selectedGearIds.length > 0
                              ? `${selectedGearIds.length} gear selected`
                              : 'Select gear'}
                        </span>
                        <span>{isGearDropdownOpen ? '▲' : '▼'}</span>
                     </Button>
                     {isGearDropdownOpen ? (
                        <div className="grid gap-2 rounded border p-2">
                           <input
                              type="search"
                              value={gearSearch}
                              onChange={(event) =>
                                 setGearSearch(event.target.value)
                              }
                              placeholder="Search gear by name, brand, or type"
                              className="rounded border p-2 text-sm"
                           />
                           {gear.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                 No gear found in the database yet.
                              </p>
                           ) : filteredGear.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                 No gear matches your search.
                              </p>
                           ) : (
                              <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
                                 {filteredGear.map((entry) => {
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
                        </div>
                     ) : null}
                  </fieldset>
                  <fieldset className="grid gap-2 rounded border p-3">
                     <legend className="px-1 text-sm font-medium">
                        Weather snapshot{' '}
                        {isWeatherLoading ? '(loading...)' : ''}
                     </legend>
                     <div className="grid gap-2 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm font-medium">
                           <span>Temperature</span>
                           <input
                              readOnly
                              value={toDisplay(
                                 formatWeatherMetric(
                                    weatherSnapshot?.temperature?.degrees,
                                    weatherSnapshot?.temperature?.unit
                                 )
                              )}
                              className="rounded border p-2"
                           />
                        </label>
                        <label className="grid gap-1 text-sm font-medium">
                           <span>Weather description</span>
                           <input
                              readOnly
                              value={toDisplay(
                                 weatherSnapshot?.weatherCondition?.description
                                    ?.text
                              )}
                              className="rounded border p-2"
                           />
                        </label>
                        <div className="flex items-center gap-2 rounded border p-2 text-sm text-muted-foreground">
                           {weatherSnapshot?.weatherCondition?.iconBaseUri ? (
                              <img
                                 src={`${weatherSnapshot.weatherCondition.iconBaseUri}.svg`}
                                 alt={
                                    weatherSnapshot.weatherCondition.description
                                       ?.text ?? 'Weather icon'
                                 }
                                 className="h-6 w-6"
                              />
                           ) : null}
                           <span>
                              {toDisplay(
                                 weatherSnapshot?.weatherCondition?.description
                                    ?.text || 'Weather icon'
                              )}
                           </span>
                        </div>
                        <label className="grid gap-1 text-sm font-medium">
                           <span>Cloud cover</span>
                           <input
                              readOnly
                              value={toDisplay(
                                 weatherSnapshot?.cloudCover !== undefined
                                    ? `${weatherSnapshot.cloudCover}%`
                                    : ''
                              )}
                              className="rounded border p-2"
                           />
                        </label>
                        <label className="grid gap-1 text-sm font-medium">
                           <span>Wind direction</span>
                           <input
                              readOnly
                              value={toDisplay(
                                 formatCardinal(
                                    weatherSnapshot?.wind?.direction?.cardinal
                                 )
                              )}
                              className="rounded border p-2"
                           />
                        </label>
                        <label className="grid gap-1 text-sm font-medium">
                           <span>Wind speed</span>
                           <input
                              readOnly
                              value={toDisplay(
                                 formatWeatherMetric(
                                    weatherSnapshot?.wind?.speed?.value,
                                    weatherSnapshot?.wind?.speed?.unit
                                 )
                              )}
                              className="rounded border p-2"
                           />
                        </label>
                        <label className="grid gap-1 text-sm font-medium">
                           <span>Wind gust</span>
                           <input
                              readOnly
                              value={toDisplay(
                                 formatWeatherMetric(
                                    weatherSnapshot?.wind?.gust?.value,
                                    weatherSnapshot?.wind?.gust?.unit
                                 )
                              )}
                              className="rounded border p-2"
                           />
                        </label>
                        <label className="grid gap-1 text-sm font-medium">
                           <span>Precipitation chance</span>
                           <input
                              readOnly
                              value={toDisplay(
                                 weatherSnapshot?.precipitation?.probability
                                    ?.percent !== undefined
                                    ? `${weatherSnapshot.precipitation.probability.percent}%`
                                    : ''
                              )}
                              className="rounded border p-2"
                           />
                        </label>
                     </div>
                     {siteChoice === '__other' ? (
                        <p className="text-xs text-muted-foreground">
                           Weather fields are cleared for custom locations
                           without coordinates.
                        </p>
                     ) : null}
                  </fieldset>
                  <div className="grid gap-3 sm:grid-cols-2">
                     <label className="grid gap-1 text-sm font-medium">
                        <span>Length</span>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                           <input
                              name="length"
                              placeholder="Length"
                              type="number"
                              inputMode="decimal"
                              step="0.1"
                              className="rounded border p-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                              placeholder="Weight"
                              type="number"
                              inputMode="decimal"
                              step="0.1"
                              className="rounded border p-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                  <R2ImagePicker
                     scope="catch"
                     label="Catch images"
                     maxItems={8}
                     value={images}
                     onChange={setImages}
                  />
                  <Button type="submit" disabled={isSaving}>
                     {isSaving ? 'Saving...' : 'Save catch'}
                  </Button>
               </form>
            </Show>
            <Show when="signed-out">
               <div className="rounded-lg border p-4">
                  <p className="mb-3">Sign in to log a catch.</p>
                  <SignInButton mode="modal">
                     <Button>Sign in</Button>
                  </SignInButton>
               </div>
            </Show>
         </main>
      </div>
   );
}
