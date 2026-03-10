import axios from 'axios';
import { Show, SignInButton } from '@clerk/react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { R2ImagePicker } from '@/components/r2-image-picker';

type SiteOption = { id: string; name: string };

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
   const [caughtAt, setCaughtAt] = useState(() =>
      formatForDateTimeLocal(new Date())
   );

   useEffect(() => {
      const loadSites = async () => {
         try {
            const { data } = await axios.get('/api/sites');
            setSites(data.sites ?? []);
         } catch (error) {
            console.error('Unable to load fishing sites', error);
            setSites([]);
            toast({
               title: 'Unable to load fishing spots',
               description:
                  'You can still save a catch without selecting a spot.',
               variant: 'error',
            });
         }
      };

      void loadSites();
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
