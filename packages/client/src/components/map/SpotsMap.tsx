import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhone } from '@/lib/media';
import type { LeafletMouseEvent, Map as LeafletMap, Marker } from 'leaflet';
import { ViewfinderCircleIcon } from '@heroicons/react/24/outline';
import {
   L,
   clusterGroup,
   createMap,
   dropPin,
   kindPin,
   refreshSize,
   setBaseLayer,
   type BaseLayer,
} from '@/lib/leaflet';
import { MapLegend, MapToolbar } from '@/components/map/MapToolbar';
import { popupCard } from '@/components/map/popup';
import { fetchPois, type Poi } from '@/lib/overpass';
import { requestPosition, usePosition } from '@/lib/position';
import {
   createWaypoint,
   deleteWaypoint,
   fetchWaypoints,
   WAYPOINT_KINDS,
   type Waypoint,
   type WaypointKind,
} from './waypoints-api';
import {
   markKept,
   removeSpot,
   saveSpot,
   useKept,
} from '@/components/saved/saved-api';

export type SpotPin = {
   id: string;
   name: string;
   latitude: number;
   longitude: number;
   catchCount: number;
};

/* A spot anyone may see, from the discovery endpoint. */
type PublicSpot = {
   id: string;
   name: string;
   latitude: number | null;
   longitude: number | null;
   catchCount: number;
   createdById: string;
   createdByName: string | null;
   species: { id: string; name: string; count: number }[];
};

/* The country the first anglers fish, rather than a continent they do not. */
const DEFAULT_CENTER = { lat: -30.5595, lng: 22.9375 };
const DEFAULT_ZOOM = 5;
const SINGLE_PIN_ZOOM = 12;

/*
 * Asking Overpass about half of Africa returns nothing useful and times out, so
 * points of interest only load once the map is close enough for them to mean
 * something. At zoom 10 you are looking at a stretch of coast rather than a
 * country.
 */
/*
 * Ten. At eight the box across a 1440px map is about eight degrees, and every
 * request that size took both OpenStreetMap mirrors past thirty seconds and
 * came back empty. At ten it is about two, which answers in a second. The map
 * says so below the layer switch rather than leaving the layer silently empty.
 */
const POI_MIN_ZOOM = 10;

/* What the pin being dropped is called, for a screen reader and a long press. */
const MARK_LABEL = 'The mark you are dropping. Drag it to the exact spot.';

/*
 * The map as a place to read rather than a picture of pins.
 *
 * Three layers, each answering a different question. Saved spots say where fish
 * have come from and carry the count on the pin, because that is the question
 * the map is actually being asked. Waypoints are private marks, yours alone.
 * Points of interest come from OpenStreetMap and answer where you can put a
 * boat in or buy bait, which nobody wants to log by hand.
 *
 * A long press drops a waypoint, which is the gesture every map app uses for
 * this and needs no button. Leaflet reports it as `contextmenu`, which covers
 * a right click on a desktop at the same time.
 */
export type MapFocus = {
   latitude: number;
   longitude: number;
   zoom?: number;
   /* Changes on every request, so asking for the same place twice moves twice. */
   key: number;
};

export function SpotsMap({
   spots,
   onOpen,
   wheelZoom = false,
   focus = null,
   fill = false,
}: {
   spots: SpotPin[];
   onOpen: (id: string) => void;
   /** On where the map is the whole page. Off inside a scrolling one, where a
    * wheel over the map would hijack the scroll. */
   wheelZoom?: boolean;
   /** Somewhere to go: a searched place, or the angler's own position. */
   focus?: MapFocus | null;
   /**
    * Take the height the parent gives instead of measuring a share of the
    * viewport. On a page that is nothing but a map this is what keeps the
    * whole instrument, controls included, inside one screen; the map that sits
    * in the middle of My spots still asks for its own height.
    */
   fill?: boolean;
}) {
   const holder = useRef<HTMLDivElement | null>(null);
   const map = useRef<LeafletMap | null>(null);

   /* Go where the page points, whenever it points somewhere new. */
   useEffect(() => {
      if (!focus || !map.current) return;
      map.current.setView([focus.latitude, focus.longitude], focus.zoom ?? 12, {
         animate: true,
      });
   }, [focus?.key]);
   const onOpenRef = useRef(onOpen);
   const kept = useKept();
   const keptRef = useRef(kept.spots);
   keptRef.current = kept.spots;

   const spotLayer = useRef<L.MarkerClusterGroup | null>(null);
   const waypointLayer = useRef<L.LayerGroup | null>(null);
   const poiLayer = useRef<L.LayerGroup | null>(null);
   /* The same cluster group as your own spots, so the two families cluster
    * together; these are the markers this component put in it for others. */
   const othersLayer = useRef<L.MarkerClusterGroup | null>(null);
   const othersMarkers = useRef<Marker[]>([]);

   /* Only to decide where to open, never to ask for a position: the map is
    * not a reason to put a permission prompt in front of somebody. */
   const { fix } = usePosition({ auto: false });

   const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
   /* Spots other anglers have made public. The map is worth opening before you
    * have saved anything of your own, which is the whole point of a map. */
   const [discovered, setDiscovered] = useState<PublicSpot[]>([]);
   const [showOthers, setShowOthers] = useState(true);
   const [species, setSpecies] = useState<string[]>([]);
   const navigate = useNavigate();
   const phone = usePhone();
   const [base, setBase] = useState<BaseLayer>('satellite');
   /*
    * Bumped when the map is built. Every layer's draw effect depends on it,
    * because data can arrive before the map does: the waypoints fetch would
    * resolve, the draw effect would find no layer to draw into and bail, and
    * then never run again. Marks appeared or did not depending on which
    * request won, which is the worst kind of bug to reproduce.
    */
   const [mapReady, setMapReady] = useState(0);
   /* Tracked so the places hint can say whether the map is close enough. */
   const [zoomLevel, setZoomLevel] = useState<number>(0);
   const [pois, setPois] = useState<Poi[]>([]);
   const [showPois, setShowPois] = useState(true);
   const [showWaypoints, setShowWaypoints] = useState(true);
   /*
    * The mark being dropped: where it stands right now, not where it landed.
    * It used to be read-only state under a form printed below the map, so an
    * angler dropped a mark, lost sight of it, and named a place they could no
    * longer see. Now it is a real draggable pin and this follows the pin.
    */
   const [mark, setMark] = useState<{ lat: number; lng: number } | null>(null);
   const markRef = useRef(mark);
   markRef.current = mark;
   const marking = mark !== null;
   const markingRef = useRef(marking);
   markingRef.current = marking;
   const markPin = useRef<Marker | null>(null);
   const panel = useRef<HTMLDivElement | null>(null);
   /* The pin button arms the next tap to drop a mark, for anyone who does
    * not know about the long press. */
   const [armed, setArmed] = useState(false);
   const armedRef = useRef(false);
   armedRef.current = armed;
   const [locating, setLocating] = useState(false);

   /* Go to where the angler is standing, from either copy of the controls. */
   const goToMe = useCallback(() => {
      setLocating(true);
      void requestPosition()
         .then((next) => {
            if (next && map.current) {
               map.current.setView([next.latitude, next.longitude], 13);
            }
         })
         .finally(() => setLocating(false));
   }, []);

   useEffect(() => {
      onOpenRef.current = onOpen;
   }, [onOpen]);

   useEffect(() => {
      const controller = new AbortController();
      fetchWaypoints(controller.signal)
         .then(setWaypoints)
         .catch(() => setWaypoints([]));
      return () => controller.abort();
   }, []);

   useEffect(() => {
      const controller = new AbortController();
      fetch('/api/sites', { signal: controller.signal, credentials: 'include' })
         .then((r) => (r.ok ? r.json() : { sites: [] }))
         .then((data: { sites?: PublicSpot[] } | PublicSpot[]) => {
            /* The endpoint wraps its list. Reading it as a bare array meant
             * this layer was always empty, which is why other anglers' spots
             * never appeared. */
            const rows = Array.isArray(data) ? data : (data.sites ?? []);
            setDiscovered(rows);
         })
         .catch(() => setDiscovered([]));
      return () => controller.abort();
   }, []);

   /* The fish these spots are known for, so the filter offers real options. */
   const speciesOptions = useMemo(() => {
      const seen = new Map<string, string>();
      for (const spot of discovered) {
         for (const s of spot.species) seen.set(s.id, s.name);
      }
      return [...seen.entries()]
         .map(([id, name]) => ({ id, name }))
         .sort((a, b) => a.name.localeCompare(b.name));
   }, [discovered]);

   // Rebuild the pins only when the positions actually change, not on every
   // parent render, since the list above re-filters as you type.
   const key = useMemo(
      () =>
         spots
            .map((s) => `${s.id}:${s.latitude}:${s.longitude}`)
            .sort()
            .join('|'),
      [spots]
   );

   useEffect(() => {
      const node = holder.current;

      if (!node) {
         return;
      }

      /*
       * Where to open. A saved spot wins, because that is what the reader
       * asked to see. Failing that, where the angler is standing: opening on
       * the whole country shows nothing useful and sits below the zoom at
       * which ramps and shops load, so a new angler would meet an empty map
       * of South Africa. Only then the country.
       */
      const opening = spots[0]
         ? {
              centre: { lat: spots[0].latitude, lng: spots[0].longitude },
              zoom: spots.length === 1 ? SINGLE_PIN_ZOOM : DEFAULT_ZOOM,
           }
         : fix
           ? {
                centre: { lat: fix.latitude, lng: fix.longitude },
                zoom: SINGLE_PIN_ZOOM,
             }
           : { centre: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };

      const created = createMap(node, { ...opening, base, wheelZoom });
      map.current = created;

      /*
       * Leaflet puts the zoom in the top left, which is the exact corner the
       * toolbar stands in on a desktop, so the two sat on top of each other.
       * The zoom moves across; the toolbar keeps the corner it reads from.
       */
      created.zoomControl?.setPosition('topright');

      /* Spots cluster at low zoom; marks and places do not, there are never
         enough of them in one view to need it. */
      const clusters = clusterGroup().addTo(created);
      spotLayer.current = clusters;
      waypointLayer.current = L.layerGroup().addTo(created);
      poiLayer.current = L.layerGroup().addTo(created);
      othersLayer.current = clusters;
      othersMarkers.current = [];
      setMapReady((n) => n + 1);

      const markers: Marker[] = spots.map((spot) => {
         const marker = L.marker([spot.latitude, spot.longitude], {
            icon: kindPin('spot', spot.catchCount),
            title: spot.name,
         }).addTo(spotLayer.current!);

         const card = popupCard({
            kicker: 'Your spot',
            title: spot.name,
            accent: 'var(--teal)',
            facts: [
               {
                  mark: 'fish',
                  value:
                     spot.catchCount === 0
                        ? 'No catches logged here yet'
                        : spot.catchCount === 1
                          ? '1 catch logged here'
                          : `${spot.catchCount} catches logged here`,
               },
               {
                  mark: 'pin',
                  value: `${spot.latitude.toFixed(4)}, ${spot.longitude.toFixed(4)}`,
                  quiet: true,
               },
            ],
            actions: [
               {
                  label: 'Open the spot',
                  tone: 'primary',
                  onClick: () => onOpenRef.current(spot.id),
               },
               {
                  label: 'Log here',
                  onClick: () =>
                     navigate(
                        `/log?lat=${spot.latitude.toFixed(5)}&lng=${spot.longitude.toFixed(5)}`
                     ),
               },
               {
                  label: 'Forecast',
                  onClick: () =>
                     navigate(
                        `/forecast?lat=${spot.latitude.toFixed(4)}&lng=${spot.longitude.toFixed(4)}&name=${encodeURIComponent(spot.name)}`
                     ),
               },
            ],
         });
         marker.bindPopup(card, { maxWidth: 320, minWidth: 240 });
         return marker;
      });

      if (markers.length > 1) {
         created.fitBounds(L.featureGroup(markers).getBounds().pad(0.15));
      }

      setZoomLevel(created.getZoom());
      created.on('zoomend', () => setZoomLevel(created.getZoom()));

      /* A long press on a phone, a right click on a desktop. */
      const onLongPress = (event: LeafletMouseEvent) => {
         setMark({ lat: event.latlng.lat, lng: event.latlng.lng });
      };
      created.on('contextmenu', onLongPress);
      const onTap = (event: LeafletMouseEvent) => {
         const { lat, lng } = event.latlng;
         /*
          * While a mark is being named, a tap moves it. That is the third way
          * of placing a pin, next to dragging it and arming the button, and it
          * is the one people reach for first when the pin landed a street off.
          */
         if (markingRef.current) {
            markPin.current?.setLatLng([lat, lng]);
            setMark({ lat, lng });
            return;
         }
         if (!armedRef.current) return;
         setArmed(false);
         setMark({ lat, lng });
      };
      created.on('click', onTap);

      const observer = new ResizeObserver(() => refreshSize(created));
      observer.observe(node);

      return () => {
         observer.disconnect();
         created.off('contextmenu', onLongPress);
         created.off('click', onTap);
         created.remove();
         map.current = null;
         spotLayer.current = null;
         waypointLayer.current = null;
         poiLayer.current = null;
         othersLayer.current = null;
      };
      // `key` stands in for the positions; `spots` itself changes identity on
      // every keystroke in the search field above.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      // The opening position is read once, when the map is built. A fix that
      // lands later pans it rather than rebuilding the whole map.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [key, Boolean(fix)]);

   /* Points of interest follow the view, because panning somewhere new is
    * exactly when you want to know what is there. */
   useEffect(() => {
      const created = map.current;
      if (!created || !showPois) {
         setPois([]);
         return;
      }

      let controller: AbortController | null = null;
      let timer: number | null = null;

      const load = () => {
         /*
          * Too far out to ask, but what is drawn stays drawn. Clearing here is
          * why places seemed to vanish: zoom in, they load; zoom out a step,
          * gone. Pins outside the view cost nothing, and the next successful
          * fetch replaces them.
          */
         if (created.getZoom() < POI_MIN_ZOOM) {
            return;
         }

         controller?.abort();
         controller = new AbortController();
         const b = created.getBounds();
         void fetchPois(
            {
               south: b.getSouth(),
               west: b.getWest(),
               north: b.getNorth(),
               east: b.getEast(),
            },
            controller.signal
         )
            /* A failed request keeps the places already drawn. Clearing them
             * on failure is what made slipways appear and then vanish. */
            .then((next) => {
               if (next !== null) setPois(next);
            })
            .catch(() => {});
      };

      /* Panning fires constantly, and Overpass is community run and throttles,
       * so it is asked once the map has settled rather than on every frame. */
      const settle = () => {
         if (timer) window.clearTimeout(timer);
         timer = window.setTimeout(load, 700);
      };

      created.on('moveend', settle);
      settle();

      return () => {
         created.off('moveend', settle);
         if (timer) window.clearTimeout(timer);
         controller?.abort();
      };
   }, [showPois, key, mapReady]);

   /*
    * Other anglers' spots, filtered by the fish you are after.
    *
    * Drawn in the neutral tone rather than teal, so your own marks stay the
    * loudest thing on your own map.
    */
   useEffect(() => {
      const layer = othersLayer.current;
      if (!layer) return;

      /* Only this component's markers for others come out; yours stay. */
      layer.removeLayers(othersMarkers.current);
      othersMarkers.current = [];
      if (!showOthers) return;

      const mine = new Set(spots.map((s) => s.id));

      for (const spot of discovered) {
         if (mine.has(spot.id)) continue;
         if (spot.latitude == null || spot.longitude == null) continue;
         if (
            species.length &&
            !spot.species.some((s) => species.includes(s.id))
         )
            continue;

         const marker = L.marker([spot.latitude, spot.longitude], {
            icon: kindPin('other', spot.catchCount),
            title: spot.name,
         }).addTo(layer);
         othersMarkers.current.push(marker);

         const top = spot.species.slice(0, 4).map((s) => s.name);
         const card = popupCard({
            kicker: "Another angler's spot",
            title: spot.name,
            accent: '#14110f',
            facts: [
               {
                  mark: 'user',
                  value: spot.createdByName
                     ? `Saved by ${spot.createdByName}`
                     : 'Saved by another angler',
                  quiet: true,
               },
               {
                  mark: 'fish',
                  value: spot.catchCount
                     ? `${spot.catchCount} public ${spot.catchCount === 1 ? 'catch' : 'catches'}`
                     : 'No public catches yet',
               },
            ],
            tags: top,
            actions: [
               {
                  label: 'Open the spot',
                  tone: 'primary',
                  onClick: () => onOpenRef.current(spot.id),
               },
               {
                  label: keptRef.current.has(spot.id) ? 'Kept' : 'Keep',
                  onClick: (button) => {
                     const was = keptRef.current.has(spot.id);
                     button.disabled = true;
                     (was ? removeSpot(spot.id) : saveSpot(spot.id))
                        .then(() => {
                           markKept('spot', spot.id, !was);
                           button.textContent = was ? 'Keep' : 'Kept';
                        })
                        .catch(() => undefined)
                        .finally(() => {
                           button.disabled = false;
                        });
                  },
               },
               {
                  label: 'Forecast',
                  onClick: () =>
                     navigate(
                        `/forecast?lat=${spot.latitude!.toFixed(4)}&lng=${spot.longitude!.toFixed(4)}&name=${encodeURIComponent(spot.name)}`
                     ),
               },
            ],
         });
         marker.bindPopup(card, { maxWidth: 320, minWidth: 240 });
      }
   }, [discovered, showOthers, species, spots, mapReady]);

   /* Draw the waypoints. */
   useEffect(() => {
      const layer = waypointLayer.current;
      if (!layer) return;

      layer.clearLayers();
      if (!showWaypoints) return;

      for (const point of waypoints) {
         const marker = L.marker([point.latitude, point.longitude], {
            icon: kindPin('waypoint'),
            title: point.name,
         }).addTo(layer);

         const card = popupCard({
            kicker: 'Your mark',
            title: point.name,
            accent: '#f4f1ec',
            facts: [
               point.note
                  ? { mark: 'note', value: point.note }
                  : { mark: 'flag', value: 'Private to you', quiet: true },
            ],
            actions: [
               {
                  label: 'Log here',
                  tone: 'primary',
                  onClick: () =>
                     navigate(
                        `/log?lat=${point.latitude.toFixed(5)}&lng=${point.longitude.toFixed(5)}`
                     ),
               },
               {
                  label: 'Remove',
                  tone: 'danger',
                  onClick: () => {
                     void deleteWaypoint(point.id).then(() =>
                        setWaypoints((current) =>
                           current.filter((w) => w.id !== point.id)
                        )
                     );
                  },
               },
            ],
         });
         marker.bindPopup(card, { maxWidth: 320, minWidth: 240 });
      }
   }, [waypoints, showWaypoints, mapReady]);

   /* Draw the points of interest. */
   useEffect(() => {
      const layer = poiLayer.current;
      if (!layer) return;

      layer.clearLayers();

      for (const poi of pois) {
         const marker = L.marker([poi.latitude, poi.longitude], {
            icon: kindPin(poi.kind),
            title: poi.name,
         }).addTo(layer);

         const word =
            poi.kind === 'ramp'
               ? 'Slipway'
               : poi.kind === 'marina'
                 ? 'Marina'
                 : poi.kind === 'tackle'
                   ? 'Tackle shop'
                   : 'Parking';
         const card = popupCard({
            kicker: word,
            title: poi.name,
            accent:
               poi.kind === 'ramp'
                  ? '#1f6fb2'
                  : poi.kind === 'marina'
                    ? '#1d3557'
                    : poi.kind === 'tackle'
                      ? '#c97b1c'
                      : '#4a4542',
            facts: [
               {
                  mark:
                     poi.kind === 'ramp'
                        ? 'ramp'
                        : poi.kind === 'marina'
                          ? 'anchor'
                          : poi.kind === 'tackle'
                            ? 'hook'
                            : 'parking',
                  value: 'From OpenStreetMap',
                  quiet: true,
               },
            ],
            actions: [
               {
                  label: 'Forecast',
                  onClick: () =>
                     navigate(
                        `/forecast?lat=${poi.latitude.toFixed(4)}&lng=${poi.longitude.toFixed(4)}&name=${encodeURIComponent(poi.name)}`
                     ),
               },
            ],
         });
         marker.bindPopup(card, { maxWidth: 320, minWidth: 240 });
      }
   }, [pois, mapReady]);

   /*
    * The pin you are dropping, as a real marker.
    *
    * It wears the same teardrop a saved spot wears, because the pin dragged
    * here is the pin found here afterwards. The effect runs when the naming
    * starts and when it ends, never while the pin is being moved: reading the
    * position out of a ref rather than the dependency list is what stops the
    * marker being torn down and rebuilt under the thumb that is dragging it.
    */
   useEffect(() => {
      const created = map.current;
      if (!created) return;
      const at = markRef.current;
      if (!at) return;

      const pin = L.marker([at.lat, at.lng], {
         icon: dropPin(),
         draggable: true,
         /* Reachable by tab, so the pin is not a mouse-only control. */
         keyboard: true,
         /* Dragged to the edge, the map comes along rather than stopping. */
         autoPan: true,
         autoPanPadding: [36, 36],
         riseOnHover: true,
         title: MARK_LABEL,
      }).addTo(created);
      pin.on('dragend', () => {
         const to = pin.getLatLng();
         setMark({ lat: to.lat, lng: to.lng });
      });
      const element = pin.getElement();
      if (element) {
         element.setAttribute('role', 'button');
         element.setAttribute('aria-label', MARK_LABEL);
      }
      markPin.current = pin;

      /*
       * The naming panel covers the foot of the map, so the pin is lifted into
       * the clear part above it. Without this a mark dropped low on the screen
       * is named blind, which is the whole complaint.
       */
      created.panInside([at.lat, at.lng], {
         paddingTopLeft: [40, 40],
         paddingBottomRight: [40, 280],
      });

      /*
       * And the panel itself is brought into the screen. On the map page it is
       * already there; inside a scrolling page, such as My spots, the foot of
       * the map can be anywhere, including under the fixed bar. The panel
       * carries a scroll margin the height of that bar, so the browser stops
       * short of it rather than parking Save underneath it.
       */
      panel.current?.scrollIntoView({
         block: 'end',
         behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
      });

      return () => {
         pin.remove();
         markPin.current = null;
      };
   }, [marking, mapReady]);

   const saveWaypoint = useCallback(
      async (name: string, note: string, kind: WaypointKind) => {
         const at = markRef.current;
         if (!at) return;
         const saved = await createWaypoint({
            name,
            note: note || null,
            kind,
            latitude: at.lat,
            longitude: at.lng,
         });
         setWaypoints((current) => [saved, ...current]);
         setMark(null);
      },
      []
   );

   return (
      <div
         className={
            fill
               ? /*
                  * flex-1, not h-full. The page gives this column a
                  * min-height rather than a height, and a percentage height
                  * against an ancestor that has no definite height of its own
                  * resolves to nothing: the map came out zero pixels tall and
                  * the page rendered a heading over blank paper. Growing into
                  * the room the flex column has left asks no such question.
                  */
                 'flex min-h-0 flex-1 flex-col gap-3'
               : 'flex flex-col gap-3'
         }
      >
         {/*
          * Taller than it was. The old box was a two to one strip, which is a
          * picture of a map rather than a map: you could not pan without losing
          * your place. It takes real height now and the controls sit under it.
          */}
         <div className={fill ? 'relative min-h-0 flex-1' : 'relative'}>
            <div
               ref={holder}
               /* The base is on the element so the night rule can leave a
                  photograph alone and only invert the drawn maps. */
               data-base={base}
               className={
                  'map-surface border border-line ' +
                  (fill
                     ? /*
                        * Pinned to its box rather than asked for all of its
                        * height. The box is a flex item, and a percentage
                        * height against a parent whose own height comes from
                        * flex resolves to nothing in the pass that lays this
                        * out: the map came back two pixels tall, which is its
                        * own border and no map at all.
                        */
                       'absolute inset-0'
                     : 'h-[62vh] min-h-[380px] w-full')
               }
            />

            {/*
             * Nothing floats over the map on a phone.
             *
             * The legend and the locate control used to sit in the map's
             * bottom right corner, and a map that runs to the foot of the
             * screen puts that corner underneath the fixed bar, so both were
             * half a control with a bar through them. On a phone they move
             * into the row under the map, where they cannot collide with
             * anything; on a desktop there is no bar and they stay where a
             * map reader expects to find them.
             */}
            {!phone ? <MapLegend /> : null}
            {!phone ? (
               <MapToolbar
                  placement="overlay"
                  base={base}
                  onBase={(next) => {
                     setBase(next);
                     if (map.current) setBaseLayer(map.current, next);
                  }}
                  species={species}
                  onSpecies={setSpecies}
                  speciesOptions={speciesOptions.map((s) => ({
                     value: s.id,
                     label: s.name,
                  }))}
                  layers={{
                     others: showOthers,
                     marks: showWaypoints,
                     places: showPois,
                  }}
                  onLayer={(key) => {
                     if (key === 'others') setShowOthers((was) => !was);
                     if (key === 'marks') setShowWaypoints((was) => !was);
                     if (key === 'places') setShowPois((was) => !was);
                  }}
                  dropping={armed}
                  onDrop={() => setArmed((was) => !was)}
                  onLogHere={() => {
                     /*
                      * The quick log, with the pin already where the map is
                      * looking. The full form was the wrong landing: a long page
                      * that did not even read the pin.
                      */
                     const centre = map.current?.getCenter();
                     if (centre)
                        navigate(
                           `/log?lat=${centre.lat.toFixed(5)}&lng=${centre.lng.toFixed(5)}`
                        );
                  }}
               />
            ) : null}

            {!phone ? (
               <button
                  type="button"
                  onClick={goToMe}
                  aria-label="Go to where I am"
                  className="absolute right-3 bottom-8 z-[500] grid size-11 place-items-center border border-line bg-background text-ink transition-transform duration-150 [transition-timing-function:var(--ease)] active:scale-[0.96]"
               >
                  <ViewfinderCircleIcon aria-hidden="true" className="size-6" />
               </button>
            ) : null}

            {/*
             * Naming the mark, at the foot of the map rather than under it.
             *
             * The panel used to print below the whole map, which on a phone is
             * a screen and a half away from the pin it is about, so the last
             * thing an angler saw before typing a name was a map they had
             * scrolled off. Here the pin stays in sight the whole time and the
             * map has already lifted it clear of this panel.
             */}
            {mark ? (
               <div
                  ref={panel}
                  className="thread-scroll absolute inset-x-0 bottom-0 z-[600] max-h-[78%] scroll-mb-[calc(64px+env(safe-area-inset-bottom))] overflow-y-auto border-t border-line bg-background md:scroll-mb-0"
               >
                  <NewWaypoint
                     at={mark}
                     onCancel={() => setMark(null)}
                     onSave={saveWaypoint}
                  />
               </div>
            ) : null}
         </div>

         {phone ? (
            <MapToolbar
               placement="bar"
               base={base}
               onBase={(next) => {
                  setBase(next);
                  if (map.current) setBaseLayer(map.current, next);
               }}
               species={species}
               onSpecies={setSpecies}
               speciesOptions={speciesOptions.map((s) => ({
                  value: s.id,
                  label: s.name,
               }))}
               layers={{
                  others: showOthers,
                  marks: showWaypoints,
                  places: showPois,
               }}
               onLayer={(key) => {
                  if (key === 'others') setShowOthers((was) => !was);
                  if (key === 'marks') setShowWaypoints((was) => !was);
                  if (key === 'places') setShowPois((was) => !was);
               }}
               dropping={armed}
               onDrop={() => setArmed((was) => !was)}
               onLocate={goToMe}
               locating={locating}
               onLogHere={() => {
                  /*
                   * The quick log, with the pin already where the map is
                   * looking. The full form was the wrong landing: a long page
                   * that did not even read the pin.
                   */
                  const centre = map.current?.getCenter();
                  if (centre)
                     navigate(
                        `/log?lat=${centre.lat.toFixed(5)}&lng=${centre.lng.toFixed(5)}`
                     );
               }}
            />
         ) : null}

         <p className="text-[14px] text-ink-3">
            {showPois && zoomLevel > 0 && zoomLevel < POI_MIN_ZOOM
               ? 'Zoom in for slipways and tackle shops.'
               : ''}{' '}
            Press and hold the map, or use the mark control, to drop a private
            mark. Drag the pin to put it exactly where you mean.
         </p>
      </div>
   );
}

function NewWaypoint({
   at,
   onSave,
   onCancel,
}: {
   /* Where the pin is standing, which is what gets saved. */
   at: { lat: number; lng: number };
   onSave: (name: string, note: string, kind: WaypointKind) => Promise<void>;
   onCancel: () => void;
}) {
   const [name, setName] = useState('');
   const [note, setNote] = useState('');
   const [kind, setKind] = useState<WaypointKind>('MARK');
   const [busy, setBusy] = useState(false);

   return (
      <div className="p-4">
         <h3 className="g text-[22px]">Drop a mark</h3>
         <p className="mt-1 text-[14px] text-ink-3">
            Only you will ever see this. Drag the pin if it is not quite right.
         </p>
         {/* What is about to be saved, in the same figures the record uses. */}
         <p className="num mt-1 text-[14px] text-ink-2">
            {at.lat.toFixed(5)}, {at.lng.toFixed(5)}
         </p>

         <div className="mt-3 flex flex-col gap-3">
            <div>
               <label htmlFor="wp-name" className="lab">
                  What it is
               </label>
               <input
                  id="wp-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Gully behind the point"
                  className="input-line mt-1 text-[16px]"
               />
            </div>

            <div>
               <label htmlFor="wp-note" className="lab">
                  A note
               </label>
               <input
                  id="wp-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Fish it two hours before high."
                  className="input-line mt-1 text-[16px]"
               />
            </div>

            <div>
               <span className="lab">Kind</span>
               <div
                  className="mt-1 flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-label="Kind of mark"
               >
                  {WAYPOINT_KINDS.map((option) => (
                     <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={kind === option.value}
                        onClick={() => setKind(option.value)}
                        className={
                           'g-tracked inline-flex h-11 items-center border px-3.5 text-[15px] transition-colors duration-150 ' +
                           (kind === option.value
                              ? 'border-ink bg-ink text-background'
                              : 'border-line text-ink-2 hover:border-ink hover:text-ink')
                        }
                     >
                        {option.label}
                     </button>
                  ))}
               </div>
            </div>

            <div className="flex flex-wrap gap-3">
               <button
                  type="button"
                  disabled={busy || !name.trim()}
                  onClick={() => {
                     setBusy(true);
                     void onSave(name.trim(), note.trim(), kind).finally(() =>
                        setBusy(false)
                     );
                  }}
                  className="g-tracked inline-flex min-h-11 items-center bg-teal px-5 text-[16px] text-teal-ink disabled:opacity-60"
               >
                  {busy ? 'Saving' : 'Save the mark'}
               </button>
               <button
                  type="button"
                  onClick={onCancel}
                  className="g-tracked inline-flex min-h-11 items-center border border-line px-5 text-[16px]"
               >
                  Cancel
               </button>
            </div>
         </div>
      </div>
   );
}
