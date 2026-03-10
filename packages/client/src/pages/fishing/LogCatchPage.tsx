import axios from 'axios';
import { Show, SignInButton } from '@clerk/react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { Button } from '@/components/ui/button';
import { FishingBobberLoader } from '@/components/ui/fishing-bobber-loader';
import { toast } from '@/components/ui/use-toast';
import { R2ImagePicker } from '@/components/r2-image-picker';

type SiteOption = { id: string; name: string };
type GearOption = {
   id: string;
   name: string;
   brand: string;
   type: string;
   imageUrl: string | null;
};

const WEATHER_OPTIONS = [
   'Clear skies',
   'Partly cloudy',
   'Cloudy',
   'Raining',
   'Stormy',
   'Windy',
   'Foggy',
];

const formatForDateTimeLocal = (date: Date) => {
   const pad = (value: number) => String(value).padStart(2, '0');

   return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function LogCatchPage() {
   const navigate = useNavigate();
   const [isSaving, setIsSaving] = useState(false);
   const [images, setImages] = useState<{ storageKey: string; url: string }[]>(
      []
   );
   const [sites, setSites] = useState<SiteOption[]>([]);
   const [siteChoice, setSiteChoice] = useState('');
   const [gear, setGear] = useState<GearOption[]>([]);
   const [gearSearch, setGearSearch] = useState('');
   const [selectedGearIds, setSelectedGearIds] = useState<string[]>([]);
   const [isGearDropdownOpen, setIsGearDropdownOpen] = useState(false);
   const [caughtAt, setCaughtAt] = useState(() =>
      formatForDateTimeLocal(new Date())
   );
   const [isLoadingOptions, setIsLoadingOptions] = useState(true);

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

   const submitCatch = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const weatherValues = formData.getAll('weather').map(String);
      const isOtherSpot = siteChoice === '__other';
      const customSpot = String(formData.get('customSpot') ?? '').trim();
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

      const basePayload = {
         title: String(formData.get('title') ?? ''),
         caughtAt: parsedCaughtAt.toISOString(),
         notes:
            (isOtherSpot && customSpot
               ? `${notes ? `${notes}\n\n` : ''}Spot: ${customSpot}`
               : notes) || null,
         siteId: isOtherSpot ? null : siteChoice || null,
         weather: weatherValues.length > 0 ? weatherValues.join(', ') : null,
         waterTemp: Number(formData.get('waterTemp')) || null,
         length: Number(formData.get('length')) || null,
         weight: Number(formData.get('weight')) || null,
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
                  <input
                     name="title"
                     placeholder="Catch title"
                     className="rounded border p-2"
                     required
                  />
                  <input
                     name="caughtAt"
                     type="datetime-local"
                     value={caughtAt}
                     onChange={(event) => setCaughtAt(event.target.value)}
                     className="rounded border p-2"
                     required
                  />
                  <textarea
                     name="notes"
                     placeholder="Notes"
                     className="rounded border p-2"
                  />
                  <select
                     name="siteId"
                     value={siteChoice}
                     onChange={(event) => setSiteChoice(event.target.value)}
                     className="rounded border p-2"
                  >
                     <option value="">No fishing spot selected</option>
                     {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                           {site.name}
                        </option>
                     ))}
                     <option value="__other">Other (add new spot name)</option>
                  </select>
                  {siteChoice === '__other' && (
                     <input
                        name="customSpot"
                        placeholder="Enter fishing spot name"
                        className="rounded border p-2"
                        required
                     />
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
                        Weather
                     </legend>
                     <div className="grid gap-2 sm:grid-cols-2">
                        {WEATHER_OPTIONS.map((weather) => (
                           <label
                              key={weather}
                              className="flex items-center gap-2 text-sm"
                           >
                              <input
                                 type="checkbox"
                                 name="weather"
                                 value={weather}
                              />
                              {weather}
                           </label>
                        ))}
                     </div>
                  </fieldset>
                  <div className="grid gap-3 sm:grid-cols-3">
                     <input
                        name="waterTemp"
                        placeholder="Water temp"
                        type="number"
                        step="0.1"
                        className="rounded border p-2"
                     />
                     <input
                        name="length"
                        placeholder="Length"
                        type="number"
                        step="0.1"
                        className="rounded border p-2"
                     />
                     <input
                        name="weight"
                        placeholder="Weight"
                        type="number"
                        step="0.1"
                        className="rounded border p-2"
                     />
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
