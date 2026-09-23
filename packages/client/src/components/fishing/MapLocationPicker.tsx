import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
   ArrowsPointingInIcon,
   ArrowsPointingOutIcon,
   MagnifyingGlassIcon,
   ViewfinderCircleIcon,
} from '@heroicons/react/24/outline';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import { PlaceSearch } from '@/components/forecast/PlaceSearch';
import type { PlaceHit } from '@/components/forecast/forecast-api';
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
import { formatCoordinate, readPosition, type MapPosition } from '@/lib/maps';
import { requestPosition, usePosition } from '@/lib/position';
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
   /*
    * The wheel zooms the map. Off unless asked for, because a map in the
    * middle of a long form should let the page scroll past it. Add a spot
    * asks: there the map is the job, and a wheel that did nothing over it
    * read as a map that could not be zoomed at all.
    */
   wheelZoom?: boolean;
   /*
    * How close the map goes when it is sent to a position. A catch wants the
    * bay around the pin; a spot wants the gully itself, as close as the
    * imagery has pictures for.
    */
   closeZoom?: number;
   /*
    * With no position on the form, open on the best one known rather than on
    * the whole country: the last fix this device shared, refreshed without a
    * prompt where that was already allowed. Only the view moves. No pin is
    * dropped and nothing is reported, because where the angler is sitting is
    * not where the spot is until they say so.
    */
   seek?: boolean;
};

/* The country the first anglers fish, rather than a continent they do not. */
const DEFAULT_CENTER: MapPosition = { lat: -30.5595, lng: 22.9375 };
const DEFAULT_ZOOM = 5;
const FOCUSED_ZOOM = 15;
/*
 * Where a seeking picker opens when the device has never said where it is:
 * the Cape's south coast from Table Bay round to Hermanus, which is water
 * most of the first anglers fish and close enough in to read as a coast
 * rather than as a country.
 */
const COAST_CENTER: MapPosition = { lat: -34.2, lng: 18.85 };
const COAST_ZOOM = 9;
/*
 * A named place is a town or a beach rather than a point, so it is shown one
 * step further out than an exact position: close enough to pick the gully,
 * far enough to see which side of the harbour it is on.
 */
const NAMED_ZOOM_BACKOFF = 1;
/* About a tenth of a metre: closer than this is the same pin. */
const SAME_POSITION = 0.000001;
/* One arrow key press. Short enough to sit the pin on a gully mouth. */
const NUDGE_METRES = 10;
const METRES_PER_DEGREE = 111320;
/*
 * How long a tap waits to find out whether it was half of a double tap. Two
 * taps zoom the map, and without the wait the first of them had already moved
 * the pin to wherever the zoom was aimed.
 */
const TAP_WAIT_MS = 250;

const PIN_LABEL =
   'The pin. Drag it, or move it ten metres a press with the arrow keys.';

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
   wheelZoom = false,
   closeZoom = FOCUSED_ZOOM,
   seek = false,
}: MapLocationPickerProps) {
   const fieldId = useId();
   const mapContainerRef = useRef<HTMLDivElement | null>(null);
   const mapRef = useRef<LeafletMap | null>(null);
   const markerRef = useRef<LeafletMarker | null>(null);
   const searchField = useRef<HTMLInputElement | null>(null);
   const onChangeRef = useRef(onChange);
   /* The position on the form when the picker opened, read once. */
   const [start] = useState(() => readPosition(latitude, longitude));
   const startRef = useRef<MapPosition | null>(start);
   /* The last position this picker put on the form, or took from it. */
   const lastSentRef = useRef<MapPosition | null>(start);
   /* Once the reader has moved the map or the pin, the view is theirs. */
   const touchedRef = useRef(false);
   /* Read once when the map is made; later changes come through the props. */
   const optionsRef = useRef({ wheelZoom, closeZoom, seek, compact });

   /*
    * The device's last known position, shared with the rest of the product.
    * Asking for it here never puts up a prompt: `auto` only refreshes where
    * the browser has already been told yes.
    */
   const { fix } = usePosition({ auto: seek });
   const fixRef = useRef(fix);

   const [mapFailed, setMapFailed] = useState(false);
   const [base, setBase] = useState<BaseLayer>('satellite');
   const [isLocating, setIsLocating] = useState(false);
   const [note, setNote] = useState<string | null>(null);
   const [problem, setProblem] = useState<string | null>(null);
   const [searchOpen, setSearchOpen] = useState(false);
   /*
    * The whole screen, for putting a pin down with room to see the water. A
    * 200 pixel map on a phone is a keyhole; this is the same map, the pin
    * and everything on it kept, laid over the page until Done.
    */
   const [full, setFull] = useState(false);
   /* Where the pin is while it is in the hand, so the readout follows it. */
   const [dragAt, setDragAt] = useState<MapPosition | null>(null);
   /* Where the map is looking, so of two Kommetjies the near one is first. */
   const [near, setNear] = useState<{
      latitude: number;
      longitude: number;
   } | null>(null);
   /* The typed fields hold a draft only while they are being typed in. */
   const [draft, setDraft] = useState<{ lat: string; lng: string } | null>(
      null
   );

   useEffect(() => {
      onChangeRef.current = onChange;
   }, [onChange]);

   const position = readPosition(latitude, longitude);
   /* The pin stands wherever the form has a position: every way of putting
      it down reports to the form, and the form's answer is what is drawn. */
   const hasPin = Boolean(position);

   /* The one way out to the form. Nothing else calls onChange. */
   const report = useCallback((next: MapPosition) => {
      lastSentRef.current = next;
      touchedRef.current = true;
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
         /* The readout follows the pin while it is held, not only when it is
            let go: the figures moving is how you know the drag is doing
            something. The form only hears about where it lands. */
         marker.on('drag', () => {
            const held = marker.getLatLng();
            setDragAt({ lat: held.lat, lng: held.lng });
         });
         marker.on('dragend', () => {
            const at2 = marker.getLatLng();
            setDragAt(null);
            report({ lat: at2.lat, lng: at2.lng });
         });
         markerRef.current = marker;
         const el = marker.getElement();
         if (el) {
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', PIN_LABEL);
            el.addEventListener('keydown', onPinKey);
         }
      },
      [onPinKey, report]
   );

   /*
    * Bring a position into view. Never reports: moving the map is not a move.
    *
    * Zooming in only ever goes closer: a map already standing at the gully
    * is not pulled back out to fly to a point ten metres away. `settle` is
    * the exception, for a named place: a town looked at from a street away
    * is a street, not a town, so the view goes to that zoom whichever way.
    */
   const flyTo = useCallback(
      (
         next: MapPosition,
         zoomIn = true,
         target = closeZoom,
         settle = false
      ) => {
         const map = mapRef.current;
         if (!map) return;
         /* Never past what the base on screen has pictures for. */
         const zoom = zoomIn
            ? Math.min(
                 settle ? target : Math.max(map.getZoom(), target),
                 map.getMaxZoom()
              )
            : map.getZoom();
         if (reduceMotion()) {
            map.setView([next.lat, next.lng], zoom, { animate: false });
            return;
         }
         map.flyTo([next.lat, next.lng], zoom, { duration: 0.9 });
      },
      [closeZoom]
   );

   /* A position the reader chose: pin, view and form, in that order. */
   const put = useCallback(
      (next: MapPosition, zoomIn = true, target?: number, settle = false) => {
         placePin(next);
         flyTo(next, zoomIn, target, settle);
         report(next);
      },
      [flyTo, placePin, report]
   );

   useEffect(() => {
      const node = mapContainerRef.current;
      if (!node || mapRef.current) return;

      let observer: ResizeObserver | null = null;
      let tapTimer: number | null = null;
      const touched = () => {
         touchedRef.current = true;
      };
      const options = optionsRef.current;

      try {
         const start = startRef.current;
         const known = options.seek ? fixRef.current : null;
         /*
          * The best position there is, in order: the one on the form, the
          * last one this device shared, then a stretch of coast. Only the
          * first of those is a pin. A spot opens as close as the imagery
          * goes; a guess at where the reader is opens one step further out.
          */
         const view = start
            ? { centre: start, zoom: options.closeZoom }
            : known
              ? {
                   centre: { lat: known.latitude, lng: known.longitude },
                   zoom: Math.max(options.closeZoom - 1, FOCUSED_ZOOM),
                }
              : options.seek
                ? { centre: COAST_CENTER, zoom: COAST_ZOOM }
                : { centre: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };

         const map = createMap(node, {
            ...view,
            /*
             * The wheel belongs to the page unless the form says the map is
             * the job (see `wheelZoom` above). The plus and minus, a pinch
             * and a double tap zoom either way.
             */
            wheelZoom: options.wheelZoom,
         });
         mapRef.current = map;
         if (start) placePin(start);

         /*
          * The plus and minus move to the top right on the full picker. The
          * top left carries a margin meant for the big map's toolbar, which
          * left them floating a third of the way down a map with no toolbar
          * on it. The compact map keeps the left: its own controls sit right.
          */
         if (!options.compact) map.zoomControl?.setPosition('topright');

         /*
          * Tapping the map is the other way to put the pin somewhere. The tap
          * waits a moment first, because two taps are a zoom and the first of
          * them must not drag the pin across the bay to wherever the zoom
          * was aimed.
          */
         map.on('click', (event) => {
            if (tapTimer !== null) window.clearTimeout(tapTimer);
            const { lat, lng } = event.latlng;
            tapTimer = window.setTimeout(() => {
               tapTimer = null;
               placePin({ lat, lng });
               report({ lat, lng });
            }, TAP_WAIT_MS);
         });
         map.on('dblclick', () => {
            if (tapTimer !== null) window.clearTimeout(tapTimer);
            tapTimer = null;
         });

         /* Where the map is looking, rounded, so the search ranks against it
            without asking again for every hundred metres of panning. */
         map.on('moveend', () => {
            const centre = map.getCenter();
            const next = {
               latitude: Math.round(centre.lat * 20) / 20,
               longitude: Math.round(centre.lng * 20) / 20,
            };
            setNear((current) =>
               current &&
               current.latitude === next.latitude &&
               current.longitude === next.longitude
                  ? current
                  : next
            );
         });

         /* The reader's own hand on the map, as opposed to this code's. */
         for (const type of ['pointerdown', 'wheel', 'keydown', 'touchstart'])
            node.addEventListener(type, touched, { passive: true });

         observer = new ResizeObserver(() => refreshSize(map));
         observer.observe(node);
      } catch (error) {
         console.error(error);
         queueMicrotask(() => setMapFailed(true));
      }

      return () => {
         observer?.disconnect();
         if (tapTimer !== null) window.clearTimeout(tapTimer);
         for (const type of ['pointerdown', 'wheel', 'keydown', 'touchstart'])
            node.removeEventListener(type, touched);
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
         return;
      }
      if (samePlace(lastSentRef.current, next)) return;
      lastSentRef.current = next;
      placePin(next);
      flyTo(next);
   }, [latitude, longitude, mapFailed, flyTo, placePin]);

   /*
    * A fix that lands after the map is up: the device had none stored, or the
    * stored one was stale and a fresh reading came in behind it. The view
    * goes there once, quietly, and only while the map is still as this code
    * left it. A reader who has already panned, zoomed or dropped a pin is
    * somewhere on purpose and is left there.
    */
   useEffect(() => {
      fixRef.current = fix;
      const map = mapRef.current;
      if (!seek || !fix || !map) return;
      if (touchedRef.current || markerRef.current || startRef.current) return;
      map.setView(
         [fix.latitude, fix.longitude],
         Math.max(closeZoom - 1, FOCUSED_ZOOM),
         { animate: false }
      );
   }, [seek, fix, closeZoom]);

   /*
    * Through the shared position (lib/position) rather than the browser
    * directly, so the fix is kept: the next form that opens with no pin, this
    * one included, opens on it instead of on a stretch of coast.
    */
   const useMyPosition = () => {
      if (!navigator.geolocation) {
         setProblem('This browser will not share your position.');
         return;
      }
      setIsLocating(true);
      setProblem(null);
      void requestPosition().then((found) => {
         setIsLocating(false);
         if (!found) {
            setProblem(
               'Could not get your position. Allow location in your browser, or tap the map yourself.'
            );
            return;
         }
         put({ lat: found.latitude, lng: found.longitude });
         setNote('The pin is on your position.');
      });
   };

   /*
    * A place chosen in the search: the pin goes there and the map goes in
    * close. A typed pair or a pasted link is an exact position and gets the
    * full zoom; a name is a town or a beach, so it stops a step short and
    * says that the pin still wants dragging to the mark itself.
    */
   const pickPlace = (place: PlaceHit) => {
      const exact = place.id.startsWith('at:');
      setProblem(null);
      put(
         { lat: place.latitude, lng: place.longitude },
         true,
         exact
            ? closeZoom
            : Math.max(closeZoom - NAMED_ZOOM_BACKOFF, FOCUSED_ZOOM),
         !exact
      );
      setNote(
         exact
            ? 'The pin is on that position.'
            : `The pin is on ${place.name}. Drag it to the exact mark.`
      );
      if (compact) setSearchOpen(false);
   };

   const cycleBase = () => {
      const order: BaseLayer[] = ['satellite', 'terrain', 'plain'];
      const next =
         order[(order.indexOf(base) + 1) % order.length] ?? 'satellite';
      setBase(next);
      const map = mapRef.current;
      if (!map) return;
      setBaseLayer(map, next);
      /*
       * Terrain stops at 17 and the map may be standing at 18, where that
       * layer draws nothing at all: a grey box where the map was. Step back
       * to the closest the new base has.
       */
      const limit = (
         map as LeafletMap & { __base?: { options: { maxZoom?: number } } }
      ).__base?.options.maxZoom;
      if (typeof limit === 'number' && map.getZoom() > limit) {
         map.setZoom(limit, { animate: !reduceMotion() });
      }
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
   const shown = dragAt ?? position;
   const pair = shown
      ? `${formatCoordinate(shown.lat)}, ${formatCoordinate(shown.lng)}`
      : 'No pin yet';
   const baseLabel =
      BASE_LAYERS.find((b) => b.value === base)?.label ?? 'Satellite';
   /*
    * Square and 44px, the same control as Leaflet's own plus and minus sitting
    * in the corner of the map above them. A round button here would be the one
    * circle on a page of squares.
    */
   /* The map is told its new size once the box has it, and again when the
      page has settled; the page under it does not scroll while it is open. */
   const surfaceRef = useRef<HTMLDivElement | null>(null);
   useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      /*
       * A parent that is moved or faded (a step sliding in, a reveal) makes
       * itself the box a fixed element is fixed to, and the map filled that
       * instead of the screen. Those parents are held still while it is
       * open, and given back exactly as they were after.
       */
      const held: { node: HTMLElement; style: string }[] = [];
      if (full) {
         let node = surfaceRef.current?.parentElement ?? null;
         while (node && node !== document.body) {
            const s = getComputedStyle(node);
            if (
               s.transform !== 'none' ||
               /* Tailwind's moves are these three, not transform. */
               s.translate !== 'none' ||
               s.scale !== 'none' ||
               s.rotate !== 'none' ||
               s.filter !== 'none' ||
               s.perspective !== 'none' ||
               /transform|filter/.test(s.willChange) ||
               /paint|layout|strict|content/.test(s.contain)
            ) {
               held.push({ node, style: node.getAttribute('style') ?? '' });
               node.style.transform = 'none';
               node.style.translate = 'none';
               node.style.scale = 'none';
               node.style.rotate = 'none';
               node.style.filter = 'none';
               node.style.perspective = 'none';
               node.style.willChange = 'auto';
               node.style.contain = 'none';
            }
            node = node.parentElement;
         }
      }
      const giveBack = () =>
         held.forEach(({ node, style }) =>
            style
               ? node.setAttribute('style', style)
               : node.removeAttribute('style')
         );
      const frame = requestAnimationFrame(() => map.invalidateSize());
      const later = window.setTimeout(() => map.invalidateSize(), 260);
      if (!full) {
         return () => {
            cancelAnimationFrame(frame);
            window.clearTimeout(later);
         };
      }
      const was = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const onKey = (event: KeyboardEvent) => {
         if (event.key === 'Escape') setFull(false);
      };
      window.addEventListener('keydown', onKey);
      return () => {
         cancelAnimationFrame(frame);
         window.clearTimeout(later);
         document.body.style.overflow = was;
         window.removeEventListener('keydown', onKey);
         giveBack();
      };
   }, [full]);

   const control =
      'grid h-11 place-items-center border border-line bg-background text-ink transition-[transform,background-color] duration-150 [transition-timing-function:var(--ease)] hover:bg-bg-2 active:scale-[0.96] disabled:opacity-50';

   const fullButton = (
      <button
         type="button"
         onClick={() => setFull((was) => !was)}
         aria-pressed={full}
         aria-label={full ? 'Leave full screen' : 'Full screen map'}
         title={full ? 'Leave full screen' : 'Full screen map'}
         className={cn(control, 'size-10')}
      >
         {full ? (
            <ArrowsPointingInIcon
               className="size-5"
               strokeWidth={1.5}
               aria-hidden="true"
            />
         ) : (
            <ArrowsPointingOutIcon
               className="size-5"
               strokeWidth={1.5}
               aria-hidden="true"
            />
         )}
      </button>
   );

   const guard = useCallback((element: HTMLElement | null) => {
      stopMapEvents(element);
   }, []);

   /*
    * The product's one place search, the same field the forecast and the big
    * map use: it looks things up as you type, the glass is the button it
    * looks like, Enter takes the first result, the arrows walk the list,
    * Escape shuts it and the cross empties it. A pasted Maps link or a typed
    * pair of figures goes straight to the pin.
    *
    * This picker used to carry a search of its own that only ran on Enter or
    * on a small GO at the far end of the field, beside a magnifier that was a
    * drawing. People pressed the drawing, nothing happened, and the search
    * read as broken. Two searches was also one more than the product needs.
    *
    * It sits inside the page's own form on Add a spot and on Log a catch. The
    * field is not a form of its own, and with the glass switched on it keeps
    * every Enter to itself, so a search never saves the page around it.
    */
   const search = (
      <PlaceSearch
         className="w-full"
         /* This picker has its own way to the reader's position, worded. */
         showMine={false}
         onUseMine={useMyPosition}
         searchButton
         clearable
         placeholder="Search a beach or a town"
         near={near}
         inputRef={searchField}
         onPick={pickPlace}
      />
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
         {fullButton}
         <button
            type="button"
            onClick={() => {
               setSearchOpen((open) => !open);
               if (!searchOpen) {
                  requestAnimationFrame(() => searchField.current?.focus());
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

   /*
    * Under the map, in flow: where I am, and which map to draw. The locate
    * control carries its words as well as its mark. As a bare viewfinder it
    * was one more drawing to guess at, on a form whose whole job is this map.
    */
   const controls = (
      <div className="mt-2 flex flex-wrap gap-2">
         <button
            type="button"
            onClick={useMyPosition}
            disabled={isLocating}
            title="Put the pin where I am"
            className={cn(
               control,
               'g-tracked grid-flow-col gap-2 px-3 text-[15px]'
            )}
         >
            <ViewfinderCircleIcon
               className="size-5"
               strokeWidth={1.5}
               aria-hidden="true"
            />
            {isLocating ? 'Finding you' : 'Where I am'}
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
               {compact ? (
                  searchOpen ? (
                     <div className="mb-2">{search}</div>
                  ) : null
               ) : (
                  <div className="mb-2">{search}</div>
               )}
               <div
                  /* The base is on the element so the night rule can leave a
                     photograph alone and only invert the drawn maps. */
                  data-base={base}
                  /* Which picker this is, so the stylesheet can keep the plus
                     and minus on the full one under a finger as well. */
                  data-picker={compact ? 'compact' : 'full'}
                  /* Where the pin stands and what it stands on, readable by
                     the audit scripts without reaching into Leaflet. */
                  data-pin={
                     position
                        ? `${position.lat.toFixed(5)},${position.lng.toFixed(5)}`
                        : ''
                  }
                  data-source={source ?? ''}
                  ref={surfaceRef}
                  className={cn(
                     'map-surface relative h-[280px] overflow-hidden border border-line md:h-[320px]',
                     mapClassName,
                     full && 'fixed inset-0 z-[1100] h-auto border-0 md:h-auto'
                  )}
               >
                  <div ref={mapContainerRef} className="absolute inset-0" />
                  {compact || full ? overlay : null}
                  {/* The full picker keeps its controls under the map, so
                      its way to full screen sits on the map on its own. */}
                  {!compact && !full ? (
                     /* Top left: the zoom sits top right on this one. */
                     <div className="absolute top-2 left-2 z-[500]">
                        {fullButton}
                     </div>
                  ) : null}
                  {full ? (
                     <div className="absolute inset-x-0 bottom-0 z-[500] flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
                        <Button
                           type="button"
                           className="min-w-[160px] text-[20px]"
                           onClick={() => setFull(false)}
                        >
                           Done
                        </Button>
                     </div>
                  ) : null}
                  {/*
                   * Said on the map itself while it is empty, where the eye
                   * already is, and gone the moment there is a pin: a pin
                   * explains itself. It takes no taps, so the water under it
                   * is still water you can drop the pin on.
                   */}
                  {!compact && !hasPin ? (
                     <p
                        aria-hidden="true"
                        className="picker-hint g-tracked pointer-events-none absolute bottom-8 left-1/2 z-[500] -translate-x-1/2 border border-line bg-background px-3 py-1.5 text-[15px] whitespace-nowrap text-ink"
                     >
                        Tap the map to drop the pin
                     </p>
                  ) : null}
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

         {showReadout ? (
            <p
               /* Quiet while the pin is in the hand: the figures change sixty
                  times a second and nobody wants them read out. */
               aria-live={dragAt ? 'off' : 'polite'}
               className="flex flex-wrap items-baseline gap-x-3"
            >
               <span className="lab">Pin</span>
               <span
                  className={cn(
                     'num text-[15px]',
                     shown ? 'text-ink' : 'text-ink-3'
                  )}
               >
                  {shown && source && !dragAt ? `${source} · ${pair}` : pair}
               </span>
            </p>
         ) : null}
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
