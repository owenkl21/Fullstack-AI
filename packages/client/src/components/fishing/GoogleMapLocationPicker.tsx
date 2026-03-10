import { useCallback, useEffect, useRef, useState } from 'react';
import { loadGoogleMapsScript } from '@/lib/maps';

type GoogleMapLocationPickerProps = {
   latitude: string;
   longitude: string;
   onChange: (latitude: number, longitude: number) => void;
};

type MapInstance = {
   addListener: (
      eventName: 'click',
      handler: (event: {
         latLng?: { lat: () => number; lng: () => number } | null;
      }) => void
   ) => void;
   panTo: (position: { lat: number; lng: number }) => void;
   setZoom: (zoom: number) => void;
};

type MarkerInstance = {
   position: { lat: number; lng: number };
   getPosition: () => { lat: () => number; lng: () => number } | null;
   setPosition: (position: { lat: number; lng: number }) => void;
   addListener: (eventName: 'dragend', handler: () => void) => void;
};

const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };
const DEFAULT_ZOOM = 4;
const FOCUSED_ZOOM = 14;

export function GoogleMapLocationPicker({
   latitude,
   longitude,
   onChange,
}: GoogleMapLocationPickerProps) {
   const mapContainerRef = useRef<HTMLDivElement | null>(null);
   const mapRef = useRef<MapInstance | null>(null);
   const markerRef = useRef<MarkerInstance | null>(null);
   const [mapError, setMapError] = useState<string | null>(null);
   const [locationStatus, setLocationStatus] = useState<
      'idle' | 'loading' | 'error'
   >('idle');

   const centerOnCurrentLocation = useCallback(() => {
      if (!navigator.geolocation || !mapRef.current || !markerRef.current) {
         setLocationStatus('error');
         return;
      }

      setLocationStatus('loading');

      navigator.geolocation.getCurrentPosition(
         (position) => {
            const nextPosition = {
               lat: position.coords.latitude,
               lng: position.coords.longitude,
            };

            markerRef.current?.setPosition(nextPosition);
            mapRef.current?.panTo(nextPosition);
            mapRef.current?.setZoom(FOCUSED_ZOOM);
            onChange(nextPosition.lat, nextPosition.lng);
            setLocationStatus('idle');
         },
         () => {
            setLocationStatus('error');
         }
      );
   }, [onChange]);

   useEffect(() => {
      const initializeMap = async () => {
         if (!mapContainerRef.current) {
            return;
         }

         try {
            const googleSdk = await loadGoogleMapsScript();
            const mapsLibrary = (await googleSdk.maps.importLibrary(
               'maps'
            )) as {
               Map: new (
                  mapDiv: HTMLElement,
                  opts?: {
                     center?: { lat: number; lng: number };
                     zoom?: number;
                  }
               ) => MapInstance;
            };

            const map = new mapsLibrary.Map(mapContainerRef.current, {
               center: DEFAULT_CENTER,
               zoom: DEFAULT_ZOOM,
            });

            const marker = new googleSdk.maps.Marker({
               position: DEFAULT_CENTER,
               map,
               draggable: true,
               title: 'Fishing site pin',
            }) as MarkerInstance;

            marker.addListener('dragend', () => {
               const position = marker.getPosition();

               if (!position) {
                  return;
               }

               onChange(position.lat(), position.lng());
            });

            map.addListener('click', (event) => {
               if (!event.latLng) {
                  return;
               }

               const nextLatitude = event.latLng.lat();
               const nextLongitude = event.latLng.lng();

               marker.setPosition({ lat: nextLatitude, lng: nextLongitude });
               map.panTo({ lat: nextLatitude, lng: nextLongitude });
               map.setZoom(FOCUSED_ZOOM);
               onChange(nextLatitude, nextLongitude);
            });

            mapRef.current = map;
            markerRef.current = marker;
            setMapError(null);
            centerOnCurrentLocation();
         } catch (error) {
            console.error(error);
            setMapError(
               'Google Map could not load. Set VITE_GOOGLE_MAPS_API_KEY to use the draggable pin map.'
            );
         }
      };

      void initializeMap();
   }, [centerOnCurrentLocation, onChange]);

   useEffect(() => {
      if (!mapRef.current || !markerRef.current) {
         return;
      }

      const parsedLatitude = Number(latitude);
      const parsedLongitude = Number(longitude);

      if (
         !Number.isFinite(parsedLatitude) ||
         !Number.isFinite(parsedLongitude)
      ) {
         return;
      }

      const nextPosition = { lat: parsedLatitude, lng: parsedLongitude };
      markerRef.current.setPosition(nextPosition);
      mapRef.current.panTo(nextPosition);
      mapRef.current.setZoom(FOCUSED_ZOOM);
   }, [latitude, longitude]);

   if (mapError) {
      return <p className="text-sm text-muted-foreground">{mapError}</p>;
   }

   return (
      <div className="grid gap-2">
         <p className="text-sm text-muted-foreground">
            Drag the pin (or click the map) to set your exact fishing site.
         </p>
         <div>
            <button
               type="button"
               onClick={centerOnCurrentLocation}
               disabled={locationStatus === 'loading'}
               className="rounded border px-3 py-1 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
               {locationStatus === 'loading'
                  ? 'Getting current location...'
                  : 'Use current location'}
            </button>
            {locationStatus === 'error' ? (
               <p className="mt-1 text-xs text-muted-foreground">
                  We couldn&apos;t access your location. You can still place the
                  pin manually.
               </p>
            ) : null}
         </div>
         <div ref={mapContainerRef} className="h-80 w-full rounded border" />
      </div>
   );
}
