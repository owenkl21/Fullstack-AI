import axios from 'axios';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { FishingBobberLoader } from '@/components/ui/fishing-bobber-loader';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

type SiteEdit = {
   name: string;
   description: string | null;
   latitude: number | null;
   longitude: number | null;
   waterType: string | null;
   accessNotes: string | null;
};

export function EditSitePage() {
   const { siteId } = useParams();
   const navigate = useNavigate();
   const [item, setItem] = useState<SiteEdit | null>(null);
   const [isSaving, setIsSaving] = useState(false);
   const [isDetectingLocation, setIsDetectingLocation] = useState(false);
   const [googleMapsLink, setGoogleMapsLink] = useState('');
   const [latitude, setLatitude] = useState('');
   const [longitude, setLongitude] = useState('');

   const setCoordinates = (nextLatitude: number, nextLongitude: number) => {
      setLatitude(nextLatitude.toFixed(6));
      setLongitude(nextLongitude.toFixed(6));
   };

   const detectCurrentLocation = () => {
      if (!navigator.geolocation) {
         toast({
            title: 'Location is unavailable',
            description: 'Your browser does not support geolocation.',
            variant: 'error',
         });
         return;
      }

      setIsDetectingLocation(true);
      navigator.geolocation.getCurrentPosition(
         ({ coords }) => {
            setCoordinates(coords.latitude, coords.longitude);
            toast({
               title: 'Location added',
               description:
                  'Latitude and longitude were filled from your device.',
               variant: 'success',
            });
            setIsDetectingLocation(false);
         },
         () => {
            toast({
               title: 'Could not get your location',
               description:
                  'Please allow location access, or pin your site using a Google Maps link.',
               variant: 'error',
            });
            setIsDetectingLocation(false);
         },
         {
            enableHighAccuracy: true,
            timeout: 10000,
         }
      );
   };

   const parseGoogleMapsCoordinates = (mapsLink: string) => {
      const decodedLink = decodeURIComponent(mapsLink);
      const patterns = [
         /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
         /[?&](?:q|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
         /(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      ];

      for (const pattern of patterns) {
         const match = decodedLink.match(pattern);

         if (!match) {
            continue;
         }

         const parsedLatitude = Number(match[1]);
         const parsedLongitude = Number(match[2]);

         if (
            Number.isFinite(parsedLatitude) &&
            Number.isFinite(parsedLongitude) &&
            parsedLatitude >= -90 &&
            parsedLatitude <= 90 &&
            parsedLongitude >= -180 &&
            parsedLongitude <= 180
         ) {
            return { parsedLatitude, parsedLongitude };
         }
      }

      return null;
   };

   const extractCoordinatesFromMapsLink = () => {
      if (!googleMapsLink.trim()) {
         toast({
            title: 'Add a Google Maps link first',
            description: 'Paste the link, then extract coordinates.',
            variant: 'error',
         });
         return;
      }

      const coordinates = parseGoogleMapsCoordinates(googleMapsLink);

      if (!coordinates) {
         toast({
            title: 'Could not read coordinates from that link',
            description:
               'Use a Google Maps share link that includes latitude and longitude.',
            variant: 'error',
         });
         return;
      }

      setCoordinates(coordinates.parsedLatitude, coordinates.parsedLongitude);
      toast({
         title: 'Pin coordinates added',
         description:
            'Latitude and longitude were pulled from your Google Maps pin.',
         variant: 'success',
      });
   };

   useEffect(() => {
      const load = async () => {
         const { data } = await axios.get(`/api/sites/${siteId}`);
         setItem(data.site);
         setLatitude(
            data.site.latitude !== null ? String(data.site.latitude) : ''
         );
         setLongitude(
            data.site.longitude !== null ? String(data.site.longitude) : ''
         );
      };

      void load();
   }, [siteId]);

   const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!siteId) return;
      const formData = new FormData(event.currentTarget);

      try {
         setIsSaving(true);
         await axios.put(`/api/sites/${siteId}`, {
            name: String(formData.get('name') ?? ''),
            description: String(formData.get('description') ?? '') || null,
            latitude: Number(latitude) || null,
            longitude: Number(longitude) || null,
            waterType: String(formData.get('waterType') ?? '') || null,
            accessNotes: String(formData.get('accessNotes') ?? '') || null,
         });

         toast({ title: 'Location updated', variant: 'success' });
         navigate(`/sites/${siteId}`);
      } catch (error) {
         console.error(error);
         toast({
            title: 'Unable to update location',
            description: 'Please check your values and try again.',
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
            {!item ? (
               <FishingBobberLoader label="Loading location..." />
            ) : (
               <form
                  onSubmit={onSubmit}
                  className="grid gap-3 rounded-lg border p-4"
               >
                  <h1 className="text-2xl font-semibold">Edit location</h1>
                  <input
                     name="name"
                     placeholder="Site name"
                     defaultValue={item.name}
                     className="rounded border p-2"
                     required
                  />
                  <textarea
                     name="description"
                     placeholder="Description"
                     defaultValue={item.description ?? ''}
                     className="rounded border p-2"
                  />
                  <div className="grid gap-2 rounded border p-3">
                     <p className="text-sm font-medium">Location options</p>
                     <div className="flex flex-wrap gap-2">
                        <Button
                           type="button"
                           variant="outline"
                           onClick={detectCurrentLocation}
                           disabled={isDetectingLocation}
                        >
                           {isDetectingLocation
                              ? 'Detecting location...'
                              : 'Use my current location'}
                        </Button>
                        <a
                           href="https://www.google.com/maps"
                           target="_blank"
                           rel="noreferrer"
                        >
                           <Button type="button" variant="outline">
                              Open Google Maps (free)
                           </Button>
                        </a>
                     </div>
                     <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input
                           value={googleMapsLink}
                           onChange={(event) =>
                              setGoogleMapsLink(event.target.value)
                           }
                           placeholder="Paste Google Maps pin/share link"
                           className="rounded border p-2"
                        />
                        <Button
                           type="button"
                           variant="outline"
                           onClick={extractCoordinatesFromMapsLink}
                        >
                           Extract pin
                        </Button>
                     </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                     <input
                        name="latitude"
                        placeholder="Latitude"
                        type="number"
                        step="0.000001"
                        value={latitude}
                        onChange={(event) => setLatitude(event.target.value)}
                        className="rounded border p-2"
                     />
                     <input
                        name="longitude"
                        placeholder="Longitude"
                        type="number"
                        step="0.000001"
                        value={longitude}
                        onChange={(event) => setLongitude(event.target.value)}
                        className="rounded border p-2"
                     />
                  </div>
                  <select
                     name="waterType"
                     defaultValue={item.waterType ?? ''}
                     className="rounded border p-2"
                  >
                     <option value="">Optional water type</option>
                     <option value="FRESHWATER">Freshwater</option>
                     <option value="SALTWATER">Saltwater</option>
                     <option value="BRACKISH">Brackish</option>
                     <option value="OTHER">Other</option>
                  </select>
                  <textarea
                     name="accessNotes"
                     placeholder="Access notes"
                     defaultValue={item.accessNotes ?? ''}
                     className="rounded border p-2"
                  />
                  <Button type="submit" disabled={isSaving}>
                     {isSaving ? 'Saving...' : 'Save changes'}
                  </Button>
               </form>
            )}
         </main>
      </div>
   );
}
