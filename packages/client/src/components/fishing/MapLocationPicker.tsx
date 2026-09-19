import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
   MagnifyingGlassIcon,
   ViewfinderCircleIcon,
} from '@heroicons/react/24/outline';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import { Button } from '@/components/ui/button';
import {
   BASE_LAYERS,
   L,
   createMap,
   dropPin,
   refreshSize,
   setBaseLayer,
   stopMapEvents,
   type BaseLayer,
} from '@/lib/leaflet';
import {
   formatCoordinate,
   parseGoogleMapsCoordinates,
   readPair,
   readPosition,
   type MapPosition,
} from '@/lib/maps';
import { cn } from '@/lib/utils';

type MapLocationPickerProps = {
   latitude: string;
   longitude: string;
   onChange: (latitude: number, longitude: number) => void;
   className?: string;
   /* The map box alone, for a parent that wants it to bleed to its edges. */
   mapClassName?: string;
   /*
    * The coordinate readout under the map. A parent that prints the position
    * itself, as the fast log's receipt line does, turns it off rather than
    * showing the same pair twice.
    */
   readout?: boolean;
   /*
    * Where the position came from, in the words the record uses: `From the
    * photograph`, `Phone fix`. Printed before the coordinates so the readout
    * is the one place that says what this pin is standing on.
    */
   source?: string | null;
   /*
    * A small map inside a form: the search folds behind a button on the map,
    * the locate and base controls sit on the map too, and nothing is said
    * under it. The quick log uses this; the full form has room for the rest.
    */
   compact?: boolean;
};

/* The country the first anglers fish, rather than a continent they do not. */
const DEFAULT_CENTER: MapPosition = { lat: -30.5595, lng: 22.9375 };
const DEFAULT_ZOOM = 5;
const FOCUSED_ZOOM = 15;
/* About a tenth of a metre: closer than this is the same pin. */
const SAME_POSITION = 0.000001;
/* One arrow key press. Short enough to sit the pin on a gully mouth. */
const NUDGE_METRES = 10;
const METRES_PER_DEGREE = 111320;

const PIN_LABEL =
   'The pin. Drag it, or move it ten metres a press with the arrow keys.';

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
      label: [p.name, [p.kind, p.region, p.country].filter(Boolean).join(', ')]
         .filter(Boolean)
         .join(' · '),
      lat: p.latitude,
      lng: p.longitude,
   }));
};

/*
 * A link, rather than anything with two numbers in it. The link parser's last
 * pattern matches any "5, 6" inside a string, so "Shop 5, 6th Avenue" would
 * otherwise become a position in the Gulf of Guinea.
 */
const LINK = /^(https?:\/\/|www\.)|maps\.app|goo\.gl|google\.[a-z.]+\/maps/i;

const readLink = (text: string) =>
   LINK.test(text.trim()) ? parseGoogleMapsCoordinates(text) : null;

const samePlace = (a: MapPosition | null, b: MapPosition) =>
   Boolean(
      a &&
      Math.abs(a.lat - b.lat) < SAME_POSITION &&
      Math.abs(a.lng - b.lng) < SAME_POSITION
   );

const reduceMotion = () =>
   typeof window !== 'undefined' &&
   window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A pin you can take hold of.
 *
 * It used to be a crosshair painted over the middle of the map, with the map
 * sliding underneath it. That reads as a target rather than a pin: there is
 * nothing to grab, dragging moves the world instead of the mark, and a
 * position arriving from a photograph moved nothing anyone could see. Now the
 * pin is a real marker, the same teardrop a saved spot wears, and there are
 * three ways to put it somewhere: drag it, tap the map, or name the place in
 * the search. Dragging the map pans the map and leaves the pin where it was.
 *
 * Only the reader's own moves are reported. A drag end and a tap are the
 * whole of that; everything this code does to the marker itself is silent, so
 * the form's own updates can never come back as a dropped pin and outrank the
 * photograph that caused them. The first view is not a move either.
 */
export function MapLocationPicker({
   latitude,
   longitude,
   onChange,
   className,
   mapClassName,
   readout: showReadout = true,
   source = null,
   compact = false,
}: MapLocationPickerProps) {
   const fieldId = useId();
   const mapContainerRef = useRef<HTMLDivElement | null>(null);
   const mapRef = useRef<LeafletMap | null>(null);
   const markerRef = useRef<LeafletMarker | null>(null);
   const onChangeRef = useRef(onChange);
   const startRef = useRef<MapPosition | null>(
      readPosition(latitude, longitude)
   );
   /* The last position this picker put on the form, or took from it. */
   const lastSentRef = useRef<MapPosition | null>(startRef.current);
   const searchRequest = useRef<AbortController | null>(null);

   const [mapFailed, setMapFailed] = useState(false);
   const [hasPin, setHasPin] = useState(Boolean(startRef.current));
   const [base, setBase] = useState<BaseLayer>('satellite');
   const [isLocating, setIsLocating] = useState(false);
   const [note, setNote] = useState<string | null>(null);
   const [problem, setProblem] = useState<string | null>(null);
   const [query, setQuery] = useState('');
   const [searchOpen, setSearchOpen] = useState(false);
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

   /* The one way out to the form. Nothing else calls onChange. */
   const report = useCallback((next: MapPosition) => {
      lastSentRef.current = next;
      onChangeRef.current(next.lat, next.lng);
   }, []);

   /*
    * Arrow keys on the focused pin. A marker is reachable by tab, and Leaflet
    * would otherwise pan the map under it, which moves everything except the
    * thing the keys are pointed at. Ten metres a press, ten times that with
    * shift, and the map only follows when the pin would leave the view.
    */
   const onPinKey = useCallback(
      (event: KeyboardEvent) => {
         const marker = markerRef.current;
         if (!marker) return;
         const steps: Record<string, [number, number]> = {
            ArrowUp: [0, 1],
            ArrowDown: [0, -1],
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
         };
         const step = steps[event.key];
         if (!step) return;
         event.preventDefault();
         event.stopPropagation();
         const at = marker.getLatLng();
         const metres = event.shiftKey ? NUDGE_METRES * 10 : NUDGE_METRES;
         const shrink = Math.max(Math.cos((at.lat * Math.PI) / 180), 0.05);
         const next: MapPosition = {
            lat: at.lat + (step[1] * metres) / METRES_PER_DEGREE,
            lng: at.lng + (step[0] * metres) / (METRES_PER_DEGREE * shrink),
         };
         marker.setLatLng([next.lat, next.lng]);
         mapRef.current?.panInside([next.lat, next.lng], {
            padding: [48, 48],
         });
         report(next);
      },
      [report]
   );

   /* The pin, put down or moved. Silent: the callers say what to report. */
   const placePin = useCallback(
      (at: MapPosition) => {
         const map = mapRef.current;
         if (!map) return;
         const standing = markerRef.current;
         if (standing) {
            standing.setLatLng([at.lat, at.lng]);
            return;
         }
         const marker = L.marker([at.lat, at.lng], {
            icon: dropPin(),
            draggable: true,
            /* Reachable by tab, which is what makes the arrow keys possible. */
            keyboard: true,
            /* Dragged to the edge, the map comes along rather than stopping. */
            autoPan: true,
            autoPanPadding: [36, 36],
            riseOnHover: true,
            title: PIN_LABEL,
         }).addTo(map);
         marker.on('dragend', () => {
            const at2 = marker.getLatLng();
            report({ lat: at2.lat, lng: at2.lng });
         });
         markerRef.current = marker;
         const el = marker.getElement();
         if (el) {
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', PIN_LABEL);
            el.addEventListener('keydown', onPinKey);
         }
         setHasPin(true);
      },
      [onPinKey, report]
   );

   /* Bring a position into view. Never reports: moving the map is not a move. */
   const flyTo = useCallback((next: MapPosition, zoomIn = true) => {
      const map = mapRef.current;
      if (!map) return;
      const zoom = zoomIn
         ? Math.max(map.getZoom(), FOCUSED_ZOOM)
         : map.getZoom();
      if (reduceMotion()) {
         map.setView([next.lat, next.lng], zoom, { animate: false });
         return;
      }
      map.flyTo([next.lat, next.lng], zoom, { duration: 0.9 });
   }, []);

   /* A position the reader chose: pin, view and form, in that order. */
   const put = useCallback(
      (next: MapPosition, zoomIn = true) => {
         placePin(next);
         flyTo(next, zoomIn);
         report(next);
      },
      [flyTo, placePin, report]
   );

   useEffect(() => {
      const node = mapContainerRef.current;
      if (!node || mapRef.current) return;

      let observer: ResizeObserver | null = null;

      try {
         const start = startRef.current;
         const map = createMap(node, {
            centre: start ?? DEFAULT_CENTER,
            zoom: start ? FOCUSED_ZOOM : DEFAULT_ZOOM,
            /*
             * The wheel belongs to the page. A map sitting inside a form is
             * not the page, so scrolling past it should move the form rather
             * than zoom the imagery; the plus and minus and a pinch still
             * zoom. This is lib/leaflet's own default, stated here because
             * this picker used to override it.
             */
            wheelZoom: false,
         });
         mapRef.current = map;
         if (start) placePin(start);

         /* Tapping the map is the other way to put the pin somewhere. */
         map.on('click', (event) => {
            const { lat, lng } = event.latlng;
            placePin({ lat, lng });
            report({ lat, lng });
         });

         observer = new ResizeObserver(() => refreshSize(map));
         observer.observe(node);
      } catch (error) {
         console.error(error);
         queueMicrotask(() => setMapFailed(true));
      }

      return () => {
         observer?.disconnect();
         markerRef.current = null;
         mapRef.current?.remove();
         mapRef.current = null;
      };
   }, [placePin, report]);

   /*
    * The map follows the form. A phone fix or a photograph's own position
    * arrives this way, and the pin has to be seen to land on it, so the map
    * flies rather than jumping. The move it just reported itself is skipped,
    * or the pin would chase its own tail.
    */
   useEffect(() => {
      if (mapFailed) return;
      const next = readPosition(latitude, longitude);
      if (!next) {
         markerRef.current?.remove();
         markerRef.current = null;
         setHasPin(false);
         return;
      }
      if (samePlace(lastSentRef.current, next)) return;
      lastSentRef.current = next;
      placePin(next);
      flyTo(next);
   }, [latitude, longitude, mapFailed, flyTo, placePin]);

   const useMyPosition = () => {
      if (!navigator.geolocation) {
         setProblem('This browser will not share your position.');
         return;
      }
      setIsLocating(true);
      setProblem(null);
      navigator.geolocation.getCurrentPosition(
         ({ coords }) => {
            put({ lat: coords.latitude, lng: coords.longitude });
            setIsLocating(false);
            setNote('The pin is on your position.');
         },
         () => {
            setIsLocating(false);
            setProblem(
               'Could not get your position. Allow location in your browser, or tap the map yourself.'
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

      /*
       * A typed pair is read before a link is looked for. The link parser's
       * last pattern matches a bare pair too, so "-34.1275, 18.4487" landed on
       * the right position and told the reader it had come from a link.
       */
      const pair = readPair(q);
      if (pair) {
         put(pair);
         setQuery('');
         return;
      }
      const link = readLink(q);
      if (link) {
         put({ lat: link.parsedLatitude, lng: link.parsedLongitude });
         setNote('The pin is on the position from the link.');
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
            put(places[0]);
            setQuery('');
         } else {
            setFound(places);
         }
      } catch (error) {
         if (!controller.signal.aborted) {
            console.error(error);
            setProblem('The search did not answer. Tap the map instead.');
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
      put(next);
   };

   const typed = draft ?? { lat: latitude, lng: longitude };
   const pair = position
      ? `${formatCoordinate(position.lat)}, ${formatCoordinate(position.lng)}`
      : 'No pin yet';
   const baseLabel =
      BASE_LAYERS.find((b) => b.value === base)?.label ?? 'Satellite';
   /*
    * Square and 44px, the same control as Leaflet's own plus and minus sitting
    * in the corner of the map above them. A round button here would be the one
    * circle on a page of squares.
    */
   const control =
      'grid h-11 place-items-center border border-line bg-background text-ink transition-[transform,background-color] duration-150 [transition-timing-function:var(--ease)] hover:bg-bg-2 active:scale-[0.96] disabled:opacity-50';

   const guard = useCallback((element: HTMLElement | null) => {
      stopMapEvents(element);
   }, []);

   /* Said only while there is nothing on the map; a pin explains itself. */
   const hint = hasPin ? null : 'Tap the map to drop the pin.';

   /*
    * The search sits on top of the map and shares its edge, so the two read as
    * one instrument rather than a field that happens to be near a picture.
    * Enter asks; a link or a typed pair goes straight there.
    *
    * It is a div and not a form on purpose. This picker is dropped inside the
    * page's own form on Add a spot and on the full Log a catch, and a form
    * inside a form is not a thing HTML has: the browser hands the field to
    * the outer form, so Enter reloaded the page with an empty query string
    * and the search never ran. Enter is read off the field instead, which
    * works the same wherever the picker is put.
    */
   const ask = () => {
      if (searching || !query.trim()) return;
      void runSearch(query);
   };

   const form = (
      <div role="search" className="relative z-[400]">
         <div className="flex h-11 items-center border border-line bg-background focus-within:border-ink">
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
                  if (pasted && (readPair(pasted) || readLink(pasted))) {
                     event.preventDefault();
                     void runSearch(pasted);
                  }
               }}
               onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  /* Never let it reach the page's own form. */
                  event.preventDefault();
                  ask();
               }}
               autoComplete="off"
               aria-label="Search a place, or paste a link from Maps"
               placeholder="Search, or paste a Maps link"
               className="h-full min-w-0 flex-1 bg-transparent px-3 text-[16px] text-ink outline-none placeholder:text-ink-3"
            />
            <button
               type="button"
               onClick={ask}
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
               className="thread-scroll absolute right-0 left-0 z-[401] mt-1 max-h-[220px] overflow-auto border border-line bg-background"
            >
               {found.map((place) => (
                  <li key={`${place.lat},${place.lng}`}>
                     <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => {
                           put(place);
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
      </div>
   );

   const BASE_SHORT: Record<BaseLayer, string> = {
      satellite: 'Sat',
      terrain: 'Ter',
      plain: 'Map',
      streets: 'Str',
   };
   /* On the map, top right, for the compact form: search, where I am, base. */
   const overlay = (
      /*
       * A row along the top edge, not a column down the side. Stacked, the
       * third control ran past the foot of a 200px map and the fixed NEXT bar
       * on the log cut it in half; across, the overlay is 40 pixels tall
       * whatever height the map is given.
       */
      <div
         ref={guard}
         className="absolute top-2 right-2 z-[500] flex flex-row-reverse gap-2"
      >
         <button
            type="button"
            onClick={() => {
               setSearchOpen((open) => !open);
               if (!searchOpen) {
                  requestAnimationFrame(() =>
                     document
                        .querySelector<HTMLInputElement>(
                           `#${CSS.escape(fieldId)}-search`
                        )
                        ?.focus()
                  );
               }
            }}
            aria-expanded={searchOpen}
            aria-label="Search for a place"
            title="Search for a place"
            className={cn(control, 'size-10')}
         >
            <MagnifyingGlassIcon
               className="size-5"
               strokeWidth={1.5}
               aria-hidden="true"
            />
         </button>
         <button
            type="button"
            onClick={useMyPosition}
            disabled={isLocating}
            aria-label={
               isLocating ? 'Finding your position' : 'Put the pin where I am'
            }
            title="Put the pin where I am"
            className={cn(control, 'size-10')}
         >
            <ViewfinderCircleIcon
               className="size-5"
               strokeWidth={1.5}
               aria-hidden="true"
            />
         </button>
         <button
            type="button"
            onClick={cycleBase}
            aria-label={`Base map: ${baseLabel}. Change`}
            title={`Base map: ${baseLabel}`}
            className={cn(control, 'g-tracked size-10 text-[12px]')}
         >
            {BASE_SHORT[base]}
         </button>
      </div>
   );

   /* Under the map, in flow: where I am, and which map to draw. */
   const controls = (
      <div className="mt-2 flex gap-2">
         <button
            type="button"
            onClick={useMyPosition}
            disabled={isLocating}
            aria-label={
               isLocating ? 'Finding your position' : 'Put the pin where I am'
            }
            title="Put the pin where I am"
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
   );

   return (
      <div className={cn('grid gap-3', className)}>
         {mapFailed ? (
            <p className="text-[15px] text-ink-2">
               The map cannot be drawn here. Type the position or use your own.
            </p>
         ) : (
            <div className="flex flex-col">
               {compact ? (searchOpen ? form : null) : form}
               <div
                  /* The base is on the element so the night rule can leave a
                     photograph alone and only invert the drawn maps. */
                  data-base={base}
                  /* Where the pin stands and what it stands on, readable by
                     the audit scripts without reaching into Leaflet. */
                  data-pin={
                     position
                        ? `${position.lat.toFixed(5)},${position.lng.toFixed(5)}`
                        : ''
                  }
                  data-source={source ?? ''}
                  className={cn(
                     'map-surface relative h-[280px] overflow-hidden border border-line md:h-[320px]',
                     compact && !searchOpen ? '' : 'border-t-0',
                     mapClassName
                  )}
               >
                  <div ref={mapContainerRef} className="absolute inset-0" />
                  {compact ? overlay : null}
               </div>
               {compact ? null : controls}
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
            {showReadout ? (
               <p
                  aria-live="polite"
                  className="flex flex-wrap items-baseline gap-x-3"
               >
                  <span className="lab">Pin</span>
                  <span
                     className={cn(
                        'num text-[15px]',
                        position ? 'text-ink' : 'text-ink-3'
                     )}
                  >
                     {position && source ? `${source} · ${pair}` : pair}
                  </span>
               </p>
            ) : null}
            {!mapFailed && hint && !compact ? (
               <p className="text-[14px] text-ink-3">{hint}</p>
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
