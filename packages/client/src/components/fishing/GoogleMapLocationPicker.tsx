import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ViewfinderCircleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import {
   buildMapStyle,
   canDrawMap,
   formatCoordinate,
   loadGoogleMapsScript,
   parseGoogleMapsCoordinates,
   readPosition,
   type MapPosition,
} from '@/lib/maps';
import { useTheme } from '@/lib/theme';

type GoogleMapLocationPickerProps = {
   latitude: string;
   longitude: string;
   onChange: (latitude: number, longitude: number) => void;
};

type MapsListener = { remove: () => void };

type MapInstance = {
   addListener: (
      eventName: 'click',
      handler: (event: {
         latLng?: { lat: () => number; lng: () => number } | null;
      }) => void
   ) => MapsListener;
   panTo: (position: MapPosition) => void;
   setZoom: (zoom: number) => void;
   getZoom: () => number | undefined;
   setOptions: (options: Record<string, unknown>) => void;
};

type MarkerInstance = {
   getPosition: () => { lat: () => number; lng: () => number } | null;
   setPosition: (position: MapPosition) => void;
   setMap: (map: MapInstance | null) => void;
   addListener: (eventName: 'dragend', handler: () => void) => MapsListener;
};

type MarkerConstructor = new (
   options: Record<string, unknown>
) => MarkerInstance;

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
 */
export function GoogleMapLocationPicker({
   latitude,
   longitude,
   onChange,
}: GoogleMapLocationPickerProps) {
   const theme = useTheme();
   const fieldId = useId();
   const mapContainerRef = useRef<HTMLDivElement | null>(null);
   const mapRef = useRef<MapInstance | null>(null);
   const markerRef = useRef<MarkerInstance | null>(null);
   const markerConstructorRef = useRef<MarkerConstructor | null>(null);
   const markerListenerRef = useRef<MapsListener | null>(null);
   const lastSentRef = useRef<MapPosition | null>(null);
   const onChangeRef = useRef(onChange);
   const startRef = useRef<MapPosition | null>(
      readPosition(latitude, longitude)
   );
   const themeRef = useRef(theme);

   const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
      canDrawMap() ? 'loading' : 'unavailable'
   );
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

   useEffect(() => {
      themeRef.current = theme;
   }, [theme]);

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
         markerRef.current.setPosition(next);
      } else if (markerConstructorRef.current) {
         const marker = new markerConstructorRef.current({
            position: next,
            map,
            draggable: true,
            title: 'The pin for this spot',
         });

         markerListenerRef.current = marker.addListener('dragend', () => {
            const moved = marker.getPosition();

            if (!moved) {
               return;
            }

            lastSentRef.current = { lat: moved.lat(), lng: moved.lng() };
            onChangeRef.current(moved.lat(), moved.lng());
         });

         markerRef.current = marker;
      }

      if (recentre) {
         map.panTo(next);

         if ((map.getZoom() ?? 0) < FOCUSED_ZOOM) {
            map.setZoom(FOCUSED_ZOOM);
         }
      }
   }, []);

   useEffect(() => {
      if (!canDrawMap()) {
         return;
      }

      let isCancelled = false;
      const listeners: MapsListener[] = [];

      const drawMap = async () => {
         try {
            const googleSdk = await loadGoogleMapsScript();
            const mapsLibrary = (await googleSdk.maps.importLibrary(
               'maps'
            )) as {
               Map: new (
                  mapDiv: HTMLElement,
                  options?: Record<string, unknown>
               ) => MapInstance;
            };

            if (isCancelled || !mapContainerRef.current) {
               return;
            }

            const start = startRef.current;
            const map = new mapsLibrary.Map(mapContainerRef.current, {
               center: start ?? DEFAULT_CENTER,
               zoom: start ? FOCUSED_ZOOM : DEFAULT_ZOOM,
               gestureHandling: 'cooperative',
               disableDefaultUI: true,
               zoomControl: true,
               clickableIcons: false,
               styles: buildMapStyle(themeRef.current),
            });

            mapRef.current = map;
            markerConstructorRef.current = googleSdk.maps
               .Marker as unknown as MarkerConstructor;

            if (start) {
               setPin(start, false);
            }

            listeners.push(
               map.addListener('click', (event) => {
                  if (!event.latLng) {
                     return;
                  }

                  const next = {
                     lat: event.latLng.lat(),
                     lng: event.latLng.lng(),
                  };

                  setPin(next);
                  send(next);
               })
            );

            setStatus('ready');
         } catch (error) {
            console.error(error);
            setStatus('unavailable');
         }
      };

      void drawMap();

      return () => {
         isCancelled = true;
         listeners.forEach((listener) => listener.remove());
         markerListenerRef.current?.remove();
         markerListenerRef.current = null;
         markerRef.current?.setMap(null);
         markerRef.current = null;
         mapRef.current = null;
      };
   }, [send, setPin]);

   /* The pin follows the form, but not the keystroke it just sent itself. */
   useEffect(() => {
      if (status !== 'ready') {
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
   }, [latitude, longitude, setPin, status]);

   useEffect(() => {
      if (status !== 'ready') {
         return;
      }

      mapRef.current?.setOptions({ styles: buildMapStyle(theme) });
   }, [status, theme]);

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
         {status === 'unavailable' ? (
            <p className="text-[15px] text-ink-2">
               The map cannot be drawn here. Type the position, paste a link
               from Maps, or use your own position.
            </p>
         ) : (
            <div className="relative aspect-[3/2] w-full border border-line bg-bg-2">
               <div ref={mapContainerRef} className="absolute inset-0" />
               {status === 'loading' ? (
                  <div className="absolute inset-0 grid place-items-center">
                     <span className="lab">Drawing the map</span>
                  </div>
               ) : null}
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
                  className="absolute bottom-3 left-3 grid size-11 place-items-center rounded-full border border-line bg-background text-ink transition-transform duration-150 [transition-timing-function:var(--ease)] active:scale-[0.96] disabled:opacity-50"
               >
                  <ViewfinderCircleIcon
                     className="size-6"
                     strokeWidth={1.5}
                     aria-hidden="true"
                  />
               </button>
            </div>
         )}

         {status === 'unavailable' ? (
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

         {status === 'unavailable' ? (
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
