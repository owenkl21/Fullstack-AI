import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ViewfinderCircleIcon } from '@heroicons/react/24/outline';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { Button } from '@/components/ui/button';
import { L, createMap, pinIcon, refreshSize } from '@/lib/leaflet';
import {
   formatCoordinate,
   parseGoogleMapsCoordinates,
   readPosition,
   type MapPosition,
} from '@/lib/maps';

type MapLocationPickerProps = {
   latitude: string;
   longitude: string;
   onChange: (latitude: number, longitude: number) => void;
};

/* The country the first anglers fish, rather than a continent they do not. */
const DEFAULT_CENTER: MapPosition = { lat: -30.5595, lng: 22.9375 };
const DEFAULT_ZOOM = 5;
const FOCUSED_ZOOM = 14;
/* About a tenth of a metre: closer than this is the same pin. */
const SAME_POSITION = 0.000001;

/**
 * One pin, four ways to set it: tap the map, drag the pin, paste a link from Maps,
 * or ask for your own position. The map never asks for a position on its own, and
 * where it cannot be drawn the two coordinate fields take over.
 *
 * Day and night need no work here: the tile pane is filtered by a :root rule, so
 * the map follows the theme without JavaScript watching for it.
 */
export function MapLocationPicker({
   latitude,
   longitude,
   onChange,
}: MapLocationPickerProps) {
   const fieldId = useId();
   const mapContainerRef = useRef<HTMLDivElement | null>(null);
   const mapRef = useRef<LeafletMap | null>(null);
   const markerRef = useRef<Marker | null>(null);
   const lastSentRef = useRef<MapPosition | null>(null);
   const onChangeRef = useRef(onChange);
   const startRef = useRef<MapPosition | null>(
      readPosition(latitude, longitude)
   );

   /*
    * Leaflet needs no script, no key and no network to draw, so there is no
    * loading state to show. This only ever flips if constructing the map
    * throws, and then the typed fields take over.
    */
   const [mapFailed, setMapFailed] = useState(false);
   const [isLocating, setIsLocating] = useState(false);
   const [locationError, setLocationError] = useState<string | null>(null);
   const [link, setLink] = useState('');
   const [linkError, setLinkError] = useState<string | null>(null);
   const [linkNote, setLinkNote] = useState<string | null>(null);
   /* The typed fields hold a draft only while they are being typed in. */
   const [draft, setDraft] = useState<{ lat: string; lng: string } | null>(
      null
   );
   const [typedError, setTypedError] = useState<string | null>(null);

   useEffect(() => {
      onChangeRef.current = onChange;
   }, [onChange]);

   const position = readPosition(latitude, longitude);

   const send = useCallback((next: MapPosition) => {
      lastSentRef.current = next;
      onChangeRef.current(next.lat, next.lng);
   }, []);

   const setPin = useCallback((next: MapPosition, recentre = true) => {
      const map = mapRef.current;

      if (!map) {
         return;
      }

      if (markerRef.current) {
         markerRef.current.setLatLng([next.lat, next.lng]);
      } else {
         const marker = L.marker([next.lat, next.lng], {
            icon: pinIcon(),
            draggable: true,
            title: 'The pin for this spot',
            keyboard: true,
         }).addTo(map);

         marker.on('dragend', () => {
            const moved = marker.getLatLng();

            lastSentRef.current = { lat: moved.lat, lng: moved.lng };
            onChangeRef.current(moved.lat, moved.lng);
         });

         markerRef.current = marker;
      }

      if (recentre) {
         map.panTo([next.lat, next.lng]);

         if (map.getZoom() < FOCUSED_ZOOM) {
            map.setZoom(FOCUSED_ZOOM);
         }
      }
   }, []);

   useEffect(() => {
      const node = mapContainerRef.current;

      if (!node || mapRef.current) {
         return;
      }

      let observer: ResizeObserver | null = null;

      try {
         const start = startRef.current;
         const map = createMap(node, {
            centre: start ?? DEFAULT_CENTER,
            zoom: start ? FOCUSED_ZOOM : DEFAULT_ZOOM,
         });

         mapRef.current = map;

         if (start) {
            setPin(start, false);
         }

         map.on('click', (event) => {
            const next = { lat: event.latlng.lat, lng: event.latlng.lng };

            setPin(next);
            send(next);
         });

         observer = new ResizeObserver(() => refreshSize(map));
         observer.observe(node);
      } catch (error) {
         console.error(error);
         // Deferred: setting state straight from an effect body cascades a
         // render, and this is a report from an external system, not a value
         // React already knows.
         queueMicrotask(() => setMapFailed(true));
      }

      return () => {
         observer?.disconnect();
         markerRef.current = null;
         mapRef.current?.remove();
         mapRef.current = null;
      };
   }, [send, setPin]);

   /* The pin follows the form, but not the keystroke it just sent itself. */
   useEffect(() => {
      if (mapFailed) {
         return;
      }

      const next = readPosition(latitude, longitude);

      if (!next) {
         return;
      }

      const last = lastSentRef.current;

      if (
         last &&
         Math.abs(last.lat - next.lat) < SAME_POSITION &&
         Math.abs(last.lng - next.lng) < SAME_POSITION
      ) {
         return;
      }

      setPin(next);
   }, [latitude, longitude, mapFailed, setPin]);

   const useMyPosition = () => {
      if (!navigator.geolocation) {
         setLocationError(
            'This browser will not share your position. Tap the map to place the pin instead.'
         );
         return;
      }

      setIsLocating(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
         ({ coords }) => {
            const next = { lat: coords.latitude, lng: coords.longitude };
            setPin(next);
            send(next);
            setIsLocating(false);
         },
         () => {
            setIsLocating(false);
            setLocationError(
               'Could not get your position. Allow location in your browser, or tap the map to place the pin.'
            );
         },
         { enableHighAccuracy: true, timeout: 10000 }
      );
   };

   const applyLink = (value: string) => {
      if (!value.trim()) {
         setLinkError(null);
         setLinkNote(null);
         return;
      }

      const parsed = parseGoogleMapsCoordinates(value);

      if (!parsed) {
         setLinkNote(null);
         setLinkError(
            'That link carries no position. Open the spot in Maps and copy the link from there.'
         );
         return;
      }

      const next = { lat: parsed.parsedLatitude, lng: parsed.parsedLongitude };
      setPin(next);
      send(next);
      setLinkError(null);
      setLinkNote('Position taken from the link.');
   };

   const applyTyped = (lat: string, lng: string) => {
      setDraft(null);

      if (!lat.trim() && !lng.trim()) {
         setTypedError(null);
         return;
      }

      const next = readPosition(lat, lng);

      if (!next) {
         setDraft({ lat, lng });
         setTypedError(
            'Latitude runs from -90 to 90 and longitude from -180 to 180. Both are needed.'
         );
         return;
      }

      setTypedError(null);
      setPin(next);
      send(next);
   };

   const typed = draft ?? { lat: latitude, lng: longitude };

   const readout = position
      ? `${formatCoordinate(position.lat)}, ${formatCoordinate(position.lng)}`
      : 'No position recorded';

   return (
      <div className="grid gap-4">
         {mapFailed ? (
            <p className="text-[15px] text-ink-2">
               The map cannot be drawn here. Type the position, paste a link
               from Maps, or use your own position.
            </p>
         ) : (
            <div className="map-surface relative aspect-[3/2] w-full border border-line">
               <div ref={mapContainerRef} className="absolute inset-0" />
               <button
                  type="button"
                  onClick={useMyPosition}
                  disabled={isLocating}
                  aria-label={
                     isLocating ? 'Finding your position' : 'Use my position'
                  }
                  title={
                     isLocating ? 'Finding your position' : 'Use my position'
                  }
                  className="absolute bottom-3 left-3 z-[400] grid size-11 place-items-center rounded-full border border-line bg-background text-ink transition-transform duration-150 [transition-timing-function:var(--ease)] active:scale-[0.96] disabled:opacity-50"
               >
                  <ViewfinderCircleIcon
                     className="size-6"
                     strokeWidth={1.5}
                     aria-hidden="true"
                  />
               </button>
            </div>
         )}

         {mapFailed ? (
            <div className="grid gap-4 sm:grid-cols-2">
               <div className="grid gap-2">
                  <label className="lab" htmlFor={`${fieldId}-lat`}>
                     Latitude
                  </label>
                  <input
                     id={`${fieldId}-lat`}
                     className="input-line num text-[16px]"
                     inputMode="decimal"
                     value={typed.lat}
                     placeholder="-34.127500"
                     onChange={(event) =>
                        setDraft({ lat: event.target.value, lng: typed.lng })
                     }
                     onBlur={(event) =>
                        applyTyped(event.target.value, typed.lng)
                     }
                  />
               </div>
               <div className="grid gap-2">
                  <label className="lab" htmlFor={`${fieldId}-lng`}>
                     Longitude
                  </label>
                  <input
                     id={`${fieldId}-lng`}
                     className="input-line num text-[16px]"
                     inputMode="decimal"
                     value={typed.lng}
                     placeholder="18.448700"
                     onChange={(event) =>
                        setDraft({ lat: typed.lat, lng: event.target.value })
                     }
                     onBlur={(event) =>
                        applyTyped(typed.lat, event.target.value)
                     }
                  />
               </div>
            </div>
         ) : (
            <p className="text-[15px] text-ink-2">
               Tap the map to place the pin, then drag it onto the water you
               fish. On a phone, move the map with two fingers.
            </p>
         )}

         {typedError ? (
            <p className="text-[15px] text-destructive">{typedError}</p>
         ) : null}

         <div className="grid gap-2">
            <label className="lab" htmlFor={`${fieldId}-link`}>
               Or paste a link from Maps
            </label>
            <input
               id={`${fieldId}-link`}
               className="input-line text-[16px]"
               type="url"
               inputMode="url"
               value={link}
               placeholder="https://maps.google.com/..."
               onChange={(event) => {
                  setLink(event.target.value);
                  setLinkError(null);
               }}
               onBlur={(event) => applyLink(event.target.value)}
               onPaste={(event) => {
                  const pasted = event.clipboardData.getData('text');

                  if (!pasted) {
                     return;
                  }

                  event.preventDefault();
                  setLink(pasted);
                  applyLink(pasted);
               }}
            />
            {linkError ? (
               <p className="text-[15px] text-destructive">{linkError}</p>
            ) : null}
            {linkNote ? (
               <p className="text-[15px] text-ink-2">{linkNote}</p>
            ) : null}
         </div>

         <div className="rule-dashed pt-3">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
               <span className="lab">Position</span>
               <span className="num text-[15px] text-ink">{readout}</span>
            </p>
            <p aria-live="polite" className="text-[15px] text-ink-2">
               {isLocating ? 'Finding your position.' : null}
            </p>
            {locationError ? (
               <p className="text-[15px] text-destructive">{locationError}</p>
            ) : null}
         </div>

         {mapFailed ? (
            <Button
               type="button"
               variant="outline"
               onClick={useMyPosition}
               disabled={isLocating}
               className="justify-self-start"
            >
               Use my position
            </Button>
         ) : null}
      </div>
   );
}
