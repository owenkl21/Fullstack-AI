import { useEffect, useRef, useState } from 'react';
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
};

type MarkerInstance = {
   position: { lat: number; lng: number };
   getPosition: () => { lat: () => number; lng: () => number } | null;
   addListener: (eventName: 'dragend', handler: () => void) => void;
};

const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };

export function GoogleMapLocationPicker({
   latitude,
   longitude,
   onChange,
}: GoogleMapLocationPickerProps) {
   const mapContainerRef = useRef<HTMLDivElement | null>(null);
   const mapRef = useRef<MapInstance | null>(null);
   const markerRef = useRef<MarkerInstance | null>(null);
   const [mapError, setMapError] = useState<string | null>(null);

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

            const parsedLatitude = Number(latitude);
            const parsedLongitude = Number(longitude);
            const startPosition =
               Number.isFinite(parsedLatitude) &&
               Number.isFinite(parsedLongitude)
                  ? { lat: parsedLatitude, lng: parsedLongitude }
                  : DEFAULT_CENTER;

            const map = new mapsLibrary.Map(mapContainerRef.current, {
               center: startPosition,
               zoom:
                  startPosition.lat === DEFAULT_CENTER.lat &&
                  startPosition.lng === DEFAULT_CENTER.lng
                     ? 4
                     : 14,
            });

            const marker = new googleSdk.maps.Marker({
               position: startPosition,
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

               marker.position = { lat: nextLatitude, lng: nextLongitude };
               onChange(nextLatitude, nextLongitude);
            });

            mapRef.current = map;
            markerRef.current = marker;
            setMapError(null);
         } catch (error) {
            console.error(error);
            setMapError(
               'Google Map could not load. Set VITE_GOOGLE_MAPS_API_KEY to use the draggable pin map.'
            );
         }
      };

      void initializeMap();
   }, [onChange]);

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
      markerRef.current.position = nextPosition;
      mapRef.current.panTo(nextPosition);
   }, [latitude, longitude]);

   if (mapError) {
      return <p className="text-sm text-muted-foreground">{mapError}</p>;
   }

   return (
      <div className="grid gap-2">
         <p className="text-sm text-muted-foreground">
            Drag the pin (or click the map) to set your exact fishing site.
         </p>
         <div ref={mapContainerRef} className="h-80 w-full rounded border" />
      </div>
   );
}
