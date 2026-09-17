import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
   MagnifyingGlassIcon,
   ViewfinderCircleIcon,
} from '@heroicons/react/24/outline';
import type { Map as LeafletMap } from 'leaflet';
import { Button } from '@/components/ui/button';
import {
   BASE_LAYERS,
   createMap,
   refreshSize,
   setBaseLayer,
   type BaseLayer,
} from '@/lib/leaflet';
import {
   formatCoordinate,
   parseGoogleMapsCoordinates,
   readPosition,
   type MapPosition,
} from '@/lib/maps';
import { cn } from '@/lib/utils';
import { usePhone } from '@/lib/media';

type MapLocationPickerProps = {
   latitude: string;
   longitude: string;
   onChange: (latitude: number, longitude: number) => void;
   className?: string;
   /* The map box alone, for a parent that wants it to bleed to its edges. */
   mapClassName?: string;
};

/* The country the first anglers fish, rather than a continent they do not. */
const DEFAULT_CENTER: MapPosition = { lat: -30.5595, lng: 22.9375 };
const DEFAULT_ZOOM = 5;
const FOCUSED_ZOOM = 15;
/* About a tenth of a metre: closer than this is the same pin. */
const SAME_POSITION = 0.000001;

type Found = { label: string; lat: number; lng: number };

/*
 * The product's own place search, the same one the forecast uses: real
 * places, farms, dams and harbours as well as towns, the near ones first.
 */
const searchPlaces = async (
   q: string,
   signal: AbortSignal,
   near: MapPosition | null
): Promise<Found[]> => {
   const params = new URLSearchParams({ q });
   if (near) {
      params.set('lat', near.lat.toFixed(4));
      params.set('lng', near.lng.toFixed(4));
   }
   const res = await fetch(`/api/places/search?${params.toString()}`, {
      signal,
      headers: { Accept: 'application/json' },
   });
   if (!res.ok) return [];
   const { places } = (await res.json()) as {
      places?: {
         name: string;
         region: string | null;
         country: string | null;
         kind?: string | null;
         latitude: number;
         longitude: number;
      }[];
   };
   return (places ?? []).map((p) => ({
      label: [p.name, p.kind, p.region, p.country].filter(Boolean).join(' · '),
      lat: p.latitude,
      lng: p.longitude,
   }));
};

/* A typed pair, "-34.1275, 18.4487", in either order of care. */
const readPair = (text: string): MapPosition | null => {
   const m = text
      .trim()
      .match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
   return m ? readPosition(m[1] ?? '', m[2] ?? '') : null;
};

/**
 * The pin is fixed and the map moves under it.
 *
 * Dropping a pin by tapping a small map on a phone is a game of skill, and
 * dragging one with a mouse is fiddly. Moving the map until the crosshair
 * sits on the water is neither: pan, pinch, scroll, and the position is
 * wherever the map came to rest. Search, a pasted Maps link, a typed pair
 * or your own position all just move the map.
 */
export function MapLocationPicker({
   latitude,
   longitude,
   onChange,
   className,
   mapClassName,
}: MapLocationPickerProps) {
   const fieldId = useId();
   const phone = usePhone();
   const mapContainerRef = useRef<HTMLDivElement | null>(null);
   const mapRef = useRef<LeafletMap | null>(null);
   const lastSentRef = useRef<MapPosition | null>(null);
   /*
    * Moves made by this code (following the form, Leaflet's own resize
    * nudge) are not the reader's. A short silent window after each one
    * keeps the resulting moveend from being reported as a dropped pin,
    * which would then outrank a photograph's own position.
    */
   const silentUntil = useRef(0);
   const hush = () => {
      silentUntil.current = Date.now() + 500;
   };
   const onChangeRef = useRef(onChange);
   const startRef = useRef<MapPosition | null>(
      readPosition(latitude, longitude)
   );
   const searchRequest = useRef<AbortController | null>(null);

   const [mapFailed, setMapFailed] = useState(false);
   const [moving, setMoving] = useState(false);
   const [base, setBase] = useState<BaseLayer>('satellite');
   const [isLocating, setIsLocating] = useState(false);
   const [note, setNote] = useState<string | null>(null);
   const [problem, setProblem] = useState<string | null>(null);
   const [query, setQuery] = useState('');
   const [found, setFound] = useState<Found[] | null>(null);
   const [searching, setSearching] = useState(false);
   /* The typed fields hold a draft only while they are being typed in. */
   const [draft, setDraft] = useState<{ lat: string; lng: string } | null>(
      null
   );

   useEffect(() => {
      onChangeRef.current = onChange;
   }, [onChange]);

   const position = readPosition(latitude, longitude);

   const send = useCallback((next: MapPosition) => {
      lastSentRef.current = next;
      onChangeRef.current(next.lat, next.lng);
   }, []);

   /* Fly the map so its centre is the position; moveend then sends it. */
   const goTo = useCallback((next: MapPosition, zoomIn = true) => {
      const map = mapRef.current;
      if (!map) {
         lastSentRef.current = next;
         onChangeRef.current(next.lat, next.lng);
         return;
      }
      const zoom = zoomIn
         ? Math.max(map.getZoom(), FOCUSED_ZOOM)
         : map.getZoom();
      map.setView([next.lat, next.lng], zoom, { animate: true });
   }, []);

   useEffect(() => {
      const node = mapContainerRef.current;
      if (!node || mapRef.current) return;

      let observer: ResizeObserver | null = null;

      try {
         const start = startRef.current;
         const map = createMap(node, {
            centre: start ?? DEFAULT_CENTER,
            zoom: start ? FOCUSED_ZOOM : DEFAULT_ZOOM,
            wheelZoom: true,
         });
         mapRef.current = map;

         map.on('movestart', () => setMoving(true));
         map.on('moveend', () => {
            setMoving(false);
            if (Date.now() < silentUntil.current) return;
            const c = map.getCenter();
            const next = { lat: c.lat, lng: c.lng };
            const last = lastSentRef.current;
            if (
               last &&
               Math.abs(last.lat - next.lat) < SAME_POSITION &&
               Math.abs(last.lng - next.lng) < SAME_POSITION
            )
               return;
            send(next);
         });

         observer = new ResizeObserver(() => {
            hush();
            refreshSize(map);
         });
         observer.observe(node);
      } catch (error) {
         console.error(error);
         queueMicrotask(() => setMapFailed(true));
      }

      return () => {
         observer?.disconnect();
         mapRef.current?.remove();
         mapRef.current = null;
      };
   }, [send]);

   /* The map follows the form, but not the move it just reported itself. */
   useEffect(() => {
      if (mapFailed) return;
      const next = readPosition(latitude, longitude);
      if (!next) return;
      const last = lastSentRef.current;
      if (
         last &&
         Math.abs(last.lat - next.lat) < SAME_POSITION &&
         Math.abs(last.lng - next.lng) < SAME_POSITION
      )
         return;
      lastSentRef.current = next;
      hush();
      mapRef.current?.setView(
         [next.lat, next.lng],
         Math.max(mapRef.current.getZoom(), FOCUSED_ZOOM),
         { animate: false }
      );
   }, [latitude, longitude, mapFailed]);

   const useMyPosition = () => {
      if (!navigator.geolocation) {
         setProblem('This browser will not share your position.');
         return;
      }
      setIsLocating(true);
      setProblem(null);
      navigator.geolocation.getCurrentPosition(
         ({ coords }) => {
            goTo({ lat: coords.latitude, lng: coords.longitude });
            setIsLocating(false);
            setNote('Centred on your position.');
         },
         () => {
            setIsLocating(false);
            setProblem(
               'Could not get your position. Allow location in your browser, or move the map yourself.'
            );
         },
         { enableHighAccuracy: true, timeout: 10000 }
      );
   };

   const runSearch = async (text: string) => {
      const q = text.trim();
      setNote(null);
      setProblem(null);
      setFound(null);
      if (!q) return;

      const link = parseGoogleMapsCoordinates(q);
      if (link) {
         goTo({ lat: link.parsedLatitude, lng: link.parsedLongitude });
         setNote('Position taken from the link.');
         setQuery('');
         return;
      }
      const pair = readPair(q);
      if (pair) {
         goTo(pair);
         setQuery('');
         return;
      }

      searchRequest.current?.abort();
      const controller = new AbortController();
      searchRequest.current = controller;
      setSearching(true);
      try {
         const centre = mapRef.current?.getCenter();
         const places = await searchPlaces(
            q,
            controller.signal,
            centre ? { lat: centre.lat, lng: centre.lng } : null
         );
         if (controller.signal.aborted) return;
         if (places.length === 0) {
            setProblem('Nothing found by that name. Try the nearest town.');
         } else if (places.length === 1 && places[0]) {
            goTo(places[0]);
            setQuery('');
         } else {
            setFound(places);
         }
      } catch (error) {
         if (!controller.signal.aborted) {
            console.error(error);
            setProblem('The search did not answer. Move the map by hand.');
         }
      } finally {
         if (!controller.signal.aborted) setSearching(false);
      }
   };

   const cycleBase = () => {
      const order: BaseLayer[] = ['satellite', 'terrain', 'plain'];
      const next =
         order[(order.indexOf(base) + 1) % order.length] ?? 'satellite';
      setBase(next);
      if (mapRef.current) setBaseLayer(mapRef.current, next);
   };

   const applyTyped = (lat: string, lng: string) => {
      setDraft(null);
      if (!lat.trim() && !lng.trim()) {
         setProblem(null);
         return;
      }
      const next = readPosition(lat, lng);
      if (!next) {
         setDraft({ lat, lng });
         setProblem(
            'Latitude runs from -90 to 90 and longitude from -180 to 180. Both are needed.'
         );
         return;
      }
      setProblem(null);
      send(next);
   };

   const typed = draft ?? { lat: latitude, lng: longitude };
   const readout = position
      ? `${formatCoordinate(position.lat)}, ${formatCoordinate(position.lng)}`
      : 'Move the map to set it';
   const baseLabel =
      BASE_LAYERS.find((b) => b.value === base)?.label ?? 'Satellite';
   const control =
      'grid h-11 place-items-center border border-line bg-background text-ink shadow-[0_1px_0_var(--line)] transition-[transform,background-color] duration-150 [transition-timing-function:var(--ease)] hover:bg-bg-2 active:scale-[0.96] disabled:opacity-50';

   /* The search. Enter asks; a link or a typed pair goes straight there. */
   const form = (
      <form
         role="search"
         className={cn(
            'z-[400]',
            phone ? 'relative mb-2' : 'absolute top-3 right-3 left-3'
         )}
         onSubmit={(event) => {
            event.preventDefault();
            void runSearch(query);
         }}
      >
         <div className="flex h-11 items-center border border-line bg-background shadow-[0_1px_0_var(--line)] focus-within:border-ink">
            <MagnifyingGlassIcon
               aria-hidden="true"
               className="ml-3 size-5 shrink-0 text-ink-3"
            />
            <input
               id={`${fieldId}-search`}
               type="search"
               value={query}
               onChange={(event) => {
                  setQuery(event.target.value);
                  setFound(null);
               }}
               onPaste={(event) => {
                  const pasted = event.clipboardData.getData('text');
                  if (
                     pasted &&
                     (parseGoogleMapsCoordinates(pasted) || readPair(pasted))
                  ) {
                     event.preventDefault();
                     void runSearch(pasted);
                  }
               }}
               autoComplete="off"
               aria-label="Search a place, or paste a link from Maps"
               placeholder="Search a place, or paste a Maps link"
               className="h-full min-w-0 flex-1 bg-transparent px-3 text-[16px] text-ink outline-none placeholder:text-ink-3"
            />
            <button
               type="submit"
               disabled={searching || !query.trim()}
               className="g-tracked h-full shrink-0 px-3 text-[16px] text-ink-2 hover:text-ink disabled:opacity-40"
            >
               {searching ? 'Looking' : 'Go'}
            </button>
         </div>
         {found ? (
            <ul
               role="listbox"
               aria-label="Places found"
               className="thread-scroll absolute right-0 left-0 z-[401] mt-1 max-h-[220px] overflow-auto border border-line bg-background shadow-[0_8px_24px_rgba(11,9,9,0.18)]"
            >
               {found.map((place) => (
                  <li key={`${place.lat},${place.lng}`}>
                     <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => {
                           goTo(place);
                           setFound(null);
                           setQuery('');
                        }}
                        className="block w-full truncate border-t border-line px-3 py-2.5 text-left text-[15px] text-ink first:border-t-0 hover:bg-bg-2"
                     >
                        {place.label}
                     </button>
                  </li>
               ))}
            </ul>
         ) : null}
      </form>
   );

   return (
      <div className={cn('grid gap-3', className)}>
         {mapFailed ? (
            <p className="text-[15px] text-ink-2">
               The map cannot be drawn here. Type the position or use your own.
            </p>
         ) : (
            <div className={cn(phone && 'flex flex-col')}>
               {phone ? form : null}
               <div
                  className={cn(
                     'map-surface relative h-[340px] overflow-hidden border border-line sm:h-[440px]',
                     mapClassName
                  )}
               >
                  <div ref={mapContainerRef} className="absolute inset-0" />
                  {!phone ? form : null}

                  {/* The pin. Fixed at the centre; the map moves under it. */}
                  <div
                     aria-hidden="true"
                     className="pointer-events-none absolute top-1/2 left-1/2 z-[400]"
                  >
                     <span
                        className={cn(
                           'absolute top-0 left-0 block size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/45 blur-[1.5px] transition-transform duration-200 [transition-timing-function:var(--ease)]',
                           moving ? 'scale-[1.6]' : 'scale-100'
                        )}
                     />
                     <svg
                        width="36"
                        height="46"
                        viewBox="0 0 36 46"
                        className={cn(
                           'absolute top-0 left-0 -translate-x-1/2 -translate-y-full transition-transform duration-200 [transition-timing-function:var(--ease)] drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]',
                           moving && '-translate-y-[calc(100%+10px)]'
                        )}
                     >
                        <path
                           d="M18 45C18 45 3.5 28.6 3.5 18a14.5 14.5 0 1 1 29 0C32.5 28.6 18 45 18 45Z"
                           fill="var(--teal)"
                           stroke="#f4f1ec"
                           strokeWidth="2.5"
                           strokeLinejoin="round"
                        />
                        <circle cx="18" cy="18" r="4" fill="#06232a" />
                     </svg>
                     <span className="absolute top-0 left-0 block h-px w-10 -translate-x-1/2 bg-white/70 mix-blend-difference" />
                     <span className="absolute top-0 left-0 block h-10 w-px -translate-y-1/2 bg-white/70 mix-blend-difference" />
                  </div>
               </div>
               <div
                  className={cn(
                     'z-[400] flex gap-2',
                     phone ? 'mt-2' : 'absolute bottom-3 left-3'
                  )}
               >
                  <button
                     type="button"
                     onClick={useMyPosition}
                     disabled={isLocating}
                     aria-label={
                        isLocating ? 'Finding your position' : 'Use my position'
                     }
                     title="Use my position"
                     className={cn(control, 'w-11')}
                  >
                     <ViewfinderCircleIcon
                        className="size-6"
                        strokeWidth={1.5}
                        aria-hidden="true"
                     />
                  </button>
                  <button
                     type="button"
                     onClick={cycleBase}
                     aria-label={`Base map: ${baseLabel}. Change`}
                     className={cn(control, 'g-tracked px-3 text-[15px]')}
                  >
                     {baseLabel}
                  </button>
               </div>
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
         ) : null}

         <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="flex flex-wrap items-baseline gap-x-3">
               <span className="lab">Pin</span>
               <span
                  className={cn(
                     'num text-[15px]',
                     position ? 'text-ink' : 'text-ink-3'
                  )}
               >
                  {readout}
               </span>
            </p>
            {!mapFailed ? (
               <p className="text-[14px] text-ink-3">
                  Move the map until the pin sits on the water. Scroll or pinch
                  to zoom.
               </p>
            ) : null}
         </div>
         <p aria-live="polite" className="text-[15px] text-ink-2 empty:hidden">
            {isLocating ? 'Finding your position.' : note}
         </p>
         {problem ? (
            <p className="text-[15px] text-destructive">{problem}</p>
         ) : null}
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
