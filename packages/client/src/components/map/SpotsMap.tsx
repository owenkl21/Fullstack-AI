import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { usePhone } from '@/lib/media';
import type { LeafletMouseEvent, Map as LeafletMap, Marker } from 'leaflet';
import { ViewfinderCircleIcon } from '@heroicons/react/24/outline';
import {
   L,
   clusterGroup,
   createMap,
   dropPin,
   foundPin,
   kindPin,
   refreshSize,
   setBaseLayer,
   stopMapEvents,
   type BaseLayer,
} from '@/lib/leaflet';
import { MapLegend, MapToolbar } from '@/components/map/MapToolbar';
import { popupCard } from '@/components/map/popup';
import { PinCard, type CardAction } from '@/components/map/PinCard';
import { Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/use-toast';
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

/* A place a search found: a pin you can act on, not a pan. */
export type FoundPlace = {
   id: string;
   name: string;
   latitude: number;
   longitude: number;
   region?: string | null;
   kind?: string | null;
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
/* Close enough to see the gullies, which is what a search is asked for. */
const FOUND_ZOOM = 13;

const POPUP = { maxWidth: 320, minWidth: 240 };

/*
 * Asking Overpass about half of Africa returns nothing useful and times out, so
 * points of interest only load once the map is close enough for them to mean
 * something. At ten the box across a 1440px map is about two degrees, which
 * answers in a second; at eight it took both mirrors past thirty seconds and
 * came back empty.
 */
const POI_MIN_ZOOM = 10;

/* What the pin being dropped is called, for a screen reader and a long press. */
const MARK_LABEL = 'The mark you are dropping. Drag it to the exact spot.';

/*
 * The map as a place to read rather than a picture of pins.
 *
 * Four layers, each answering a different question. Saved spots say where fish
 * have come from and carry the count on the pin, because that is the question
 * the map is actually being asked. Waypoints are private marks, yours alone.
 * Points of interest come from OpenStreetMap and answer where you can put a
 * boat in or buy bait. A searched place is the fourth: a real pin with the name
 * on it and a card of things to do with it, rather than a view that moved.
 *
 * A long press drops a waypoint, which is the gesture every map app uses for
 * this and needs no button. Leaflet reports it as `contextmenu`, which covers
 * a right click on a desktop at the same time.
 *
 * The map itself is built once, on mount, and never again. It used to be torn
 * down and rebuilt whenever the spots arrived or a position fix landed, which
 * threw away whatever the reader had just done: the first tap of Locate moved
 * the map and the rebuild moved it straight back, so Locate appeared to do
 * nothing at all until you tapped it twice.
 */
export type MapFocus = {
   latitude: number;
   longitude: number;
   zoom?: number;
   /* Changes on every request, so asking for the same place twice moves twice. */
   key: number;
};

/* What is open in the card: a pin, or the place a search found. */
type Tapped =
   | { kind: 'mine'; spot: SpotPin }
   | { kind: 'other'; spot: PublicSpot }
   | { kind: 'waypoint'; point: Waypoint }
   | { kind: 'poi'; poi: Poi }
   | { kind: 'found' };

export function SpotsMap({
   spots,
   onOpen,
   wheelZoom = false,
   focus = null,
   fill = false,
   full = false,
   found = null,
   onClearFound,
   onMove,
   onFindPlace,
   onSpotSaved,
}: {
   spots: SpotPin[];
   onOpen: (id: string) => void;
   /** On where the map is the whole page. Off inside a scrolling one, where a
    * wheel over the map would hijack the scroll. */
   wheelZoom?: boolean;
   /** Somewhere to go: the angler's own position, mostly. */
   focus?: MapFocus | null;
   /**
    * Take the height the parent gives instead of measuring a share of the
    * viewport. On a page that is nothing but a map this is what keeps the
    * whole instrument, controls included, inside one screen; the map that sits
    * in the middle of My spots still asks for its own height.
    */
   fill?: boolean;
   /**
    * The map is the screen.
    *
    * On a phone a map inside a column, under a heading and a search and above
    * a row of controls, is a third of a screen of water: you cannot see where
    * the next point is, so you cannot decide anything, which is the only
    * reason to open a map. Here the water runs corner to corner and every
    * control floats on it.
    */
   full?: boolean;
   /** The place a search landed on, drawn as a pin with its name on it. */
   found?: FoundPlace | null;
   onClearFound?: () => void;
   /** Where the map is looking, so the page can rank a search against it. */
   onMove?: (centre: { latitude: number; longitude: number }) => void;
   /** Send the reader to the page's own search field. */
   onFindPlace?: () => void;
   /** A spot saved from the map, so the page can put it on straight away. */
   onSpotSaved?: (spot: SpotPin) => void;
}) {
   const holder = useRef<HTMLDivElement | null>(null);
   const map = useRef<LeafletMap | null>(null);

   const onOpenRef = useRef(onOpen);
   const onMoveRef = useRef(onMove);
   onMoveRef.current = onMove;
   const kept = useKept();
   const keptRef = useRef(kept.spots);
   keptRef.current = kept.spots;

   const spotLayer = useRef<L.MarkerClusterGroup | null>(null);
   const waypointLayer = useRef<L.LayerGroup | null>(null);
   const poiLayer = useRef<L.LayerGroup | null>(null);
   /* The one cluster group holds both families, so yours and theirs cluster
    * together rather than landing on top of each other. These are the markers
    * this component put in it, kept apart so each can be redrawn alone. */
   const mineMarkers = useRef<Marker[]>([]);
   const othersMarkers = useRef<Marker[]>([]);
   const foundMarker = useRef<Marker | null>(null);

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
   const navigateRef = useRef(navigate);
   navigateRef.current = navigate;
   const phone = usePhone();
   const [base, setBase] = useState<BaseLayer>('satellite');
   /*
    * Bumped when the map is built. Every layer's draw effect depends on it,
    * because data can arrive before the map does: the waypoints fetch would
    * resolve, the draw effect would find no layer to draw into and bail, and
    * then never run again.
    */
   const [mapReady, setMapReady] = useState(0);
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
   /* One line over the water, for the few things the map has to say. */
   const [notice, setNotice] = useState<string | null>(null);
   const noticeTimer = useRef<number | null>(null);
   /* What the reader tapped, as a card. Phones get the app's sheet; a
    * desktop keeps Leaflet's popover, which is where a mouse expects it. */
   const [tapped, setTapped] = useState<Tapped | null>(null);
   /* The spot being saved out of a searched place. */
   const [naming, setNaming] = useState(false);
   const [spotName, setSpotName] = useState('');
   const [savingSpot, setSavingSpot] = useState(false);

   /*
    * Has the reader taken hold of the map? Nothing this component decides may
    * undo something a person did, so the opening view is only ever applied
    * while this is false.
    */
   const readerMoved = useRef(false);
   const opened = useRef(false);

   const say = useCallback((line: string) => {
      setNotice(line);
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(null), 6000);
   }, []);

   /* Go to where the angler is standing, from either copy of the controls. */
   const goToMe = useCallback(() => {
      readerMoved.current = true;
      setLocating(true);
      void requestPosition()
         .then((next) => {
            if (next && map.current) {
               map.current.setView([next.latitude, next.longitude], 13);
               return;
            }
            say('Location is off for this site. Search for a place instead.');
         })
         .finally(() => setLocating(false));
   }, [say]);

   useEffect(() => {
      onOpenRef.current = onOpen;
   }, [onOpen]);

   useEffect(
      () => () => {
         if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
      },
      []
   );

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

   /*
    * What each spot is known for, by id, yours included.
    *
    * The fish filter used to test other anglers' spots only, so choosing
    * Galjoen emptied the map of everyone else's pins and left every one of
    * yours standing whatever it had ever caught. The public list carries the
    * species of your own spots too, so both families answer the same question.
    */
   const speciesOf = useMemo(() => {
      const table = new Map<string, string[]>();
      for (const spot of discovered)
         table.set(
            spot.id,
            spot.species.map((s) => s.id)
         );
      return table;
   }, [discovered]);

   const passesFilter = useCallback(
      (id: string) =>
         species.length === 0 ||
         (speciesOf.get(id) ?? []).some((s) => species.includes(s)),
      [species, speciesOf]
   );

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
   const spotsRef = useRef(spots);
   spotsRef.current = spots;

   /* ---------- The map itself, built once ---------- */

   const startRef = useRef({ base, wheelZoom });

   useEffect(() => {
      const node = holder.current;
      if (!node) return;

      const created = createMap(node, {
         centre: DEFAULT_CENTER,
         zoom: DEFAULT_ZOOM,
         base: startRef.current.base,
         wheelZoom: startRef.current.wheelZoom,
      });
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
      mineMarkers.current = [];
      othersMarkers.current = [];

      const onMoveEnd = () => {
         const centre = created.getCenter();
         onMoveRef.current?.({
            latitude: centre.lat,
            longitude: centre.lng,
         });
      };
      created.on('moveend', onMoveEnd);

      /*
       * A hand on the map outranks anything this component would like to do
       * with it. A tap, a drag or a wheel is enough: from there the view is
       * the reader's and the opening fit never runs.
       */
      const takeOver = () => {
         readerMoved.current = true;
      };
      node.addEventListener('pointerdown', takeOver, { passive: true });
      node.addEventListener('wheel', takeOver, { passive: true });

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

      setMapReady((n) => n + 1);

      return () => {
         observer.disconnect();
         node.removeEventListener('pointerdown', takeOver);
         node.removeEventListener('wheel', takeOver);
         created.off('moveend', onMoveEnd);
         created.off('contextmenu', onLongPress);
         created.off('click', onTap);
         created.remove();
         map.current = null;
         spotLayer.current = null;
         waypointLayer.current = null;
         poiLayer.current = null;
         mineMarkers.current = [];
         othersMarkers.current = [];
      };
   }, []);

   /*
    * Where to open, once.
    *
    * Your own spots arrive a moment after the page does, so the map cannot
    * know at build time where to look. It opens on the country, and the first
    * thing it learns moves it there: a stored position fix if there is one,
    * otherwise the bounds of your spots. Either way it happens once, and never
    * after the reader has touched the map.
    */
   useEffect(() => {
      const created = map.current;
      if (!created || opened.current || readerMoved.current) return;

      if (fix) {
         opened.current = true;
         created.setView([fix.latitude, fix.longitude], SINGLE_PIN_ZOOM, {
            animate: false,
         });
         return;
      }

      const mine = spotsRef.current;
      if (!mine.length) return;
      opened.current = true;
      if (mine.length === 1 && mine[0]) {
         created.setView(
            [mine[0].latitude, mine[0].longitude],
            SINGLE_PIN_ZOOM,
            { animate: false }
         );
         return;
      }
      created.fitBounds(
         L.latLngBounds(
            mine.map(
               (spot) => [spot.latitude, spot.longitude] as [number, number]
            )
         ).pad(0.15),
         { animate: false }
      );
      // `key` stands in for the positions; `spots` itself changes identity on
      // every render of the page above.
   }, [key, fix, mapReady]);

   /*
    * One plus and minus, not two. The stylesheet hides Leaflet's own pair
    * under a coarse pointer and this map draws its own where a thumb can
    * reach them, so on a narrow screen Leaflet's copy comes off the map
    * altogether rather than standing in the corner saying the same thing.
    */
   useEffect(() => {
      const created = map.current;
      if (!created?.zoomControl) return;
      if (phone && full) created.zoomControl.remove();
      else created.zoomControl.addTo(created);
   }, [phone, full, mapReady]);

   /* Go where the page points, whenever it points somewhere new. */
   useEffect(() => {
      if (!focus || !map.current) return;
      readerMoved.current = true;
      opened.current = true;
      map.current.setView([focus.latitude, focus.longitude], focus.zoom ?? 12, {
         animate: true,
      });
      // The key alone: the same place asked for twice should move twice.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [focus?.key, mapReady]);

   /* ---------- What is drawn on it ---------- */

   /* Your own spots. */
   useEffect(() => {
      const layer = spotLayer.current;
      if (!layer) return;

      layer.removeLayers(mineMarkers.current);
      mineMarkers.current = [];

      for (const spot of spotsRef.current) {
         if (!passesFilter(spot.id)) continue;

         const marker = L.marker([spot.latitude, spot.longitude], {
            icon: kindPin('spot', spot.catchCount),
            title: spot.name,
         }).addTo(layer);
         mineMarkers.current.push(marker);

         if (phone) {
            marker.on('click', () => setTapped({ kind: 'mine', spot }));
            continue;
         }

         marker.bindPopup(
            popupCard({
               kicker: 'Your spot',
               title: spot.name,
               accent: 'var(--teal)',
               facts: [
                  { mark: 'fish', value: catchLine(spot.catchCount) },
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
                        navigateRef.current(
                           `/log?lat=${spot.latitude.toFixed(5)}&lng=${spot.longitude.toFixed(5)}`
                        ),
                  },
                  {
                     label: 'Forecast',
                     onClick: () =>
                        navigateRef.current(
                           `/forecast?lat=${spot.latitude.toFixed(4)}&lng=${spot.longitude.toFixed(4)}&name=${encodeURIComponent(spot.name)}`
                        ),
                  },
               ],
            }),
            POPUP
         );
      }
   }, [key, passesFilter, phone, mapReady]);

   /*
    * Other anglers' spots, filtered by the fish you are after.
    *
    * Drawn in the neutral tone rather than teal, so your own marks stay the
    * loudest thing on your own map.
    */
   useEffect(() => {
      const layer = spotLayer.current;
      if (!layer) return;

      /* Only this component's markers for others come out; yours stay. */
      layer.removeLayers(othersMarkers.current);
      othersMarkers.current = [];
      if (!showOthers) return;

      const mine = new Set(spotsRef.current.map((s) => s.id));

      for (const spot of discovered) {
         if (mine.has(spot.id)) continue;
         if (spot.latitude == null || spot.longitude == null) continue;
         if (!passesFilter(spot.id)) continue;

         const marker = L.marker([spot.latitude, spot.longitude], {
            icon: kindPin('other', spot.catchCount),
            title: spot.name,
         }).addTo(layer);
         othersMarkers.current.push(marker);

         if (phone) {
            marker.on('click', () => setTapped({ kind: 'other', spot }));
            continue;
         }

         marker.bindPopup(
            popupCard({
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
               tags: spot.species.slice(0, 4).map((s) => s.name),
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
                        navigateRef.current(
                           `/forecast?lat=${spot.latitude!.toFixed(4)}&lng=${spot.longitude!.toFixed(4)}&name=${encodeURIComponent(spot.name)}`
                        ),
                  },
               ],
            }),
            POPUP
         );
      }
   }, [discovered, showOthers, passesFilter, key, phone, mapReady]);

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

         if (phone) {
            marker.on('click', () => setTapped({ kind: 'waypoint', point }));
            continue;
         }

         marker.bindPopup(
            popupCard({
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
                        navigateRef.current(
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
            }),
            POPUP
         );
      }
   }, [waypoints, showWaypoints, phone, mapReady]);

   /* Points of interest follow the view, because panning somewhere new is
    * exactly when you want to know what is there. */
   useEffect(() => {
      const created = map.current;
      if (!created || !showPois) return;

      let controller: AbortController | null = null;
      let timer: number | null = null;

      const load = () => {
         /*
          * Too far out to ask, but what is drawn stays drawn. Clearing here is
          * why places seemed to vanish: zoom in, they load; zoom out a step,
          * gone. Pins outside the view cost nothing, and the next successful
          * fetch replaces them.
          */
         if (created.getZoom() < POI_MIN_ZOOM) return;

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
   }, [showPois, mapReady]);

   /* Draw the points of interest. */
   useEffect(() => {
      const layer = poiLayer.current;
      if (!layer) return;

      layer.clearLayers();
      if (!showPois) return;

      for (const poi of pois) {
         const marker = L.marker([poi.latitude, poi.longitude], {
            icon: kindPin(poi.kind),
            title: poi.name,
         }).addTo(layer);

         if (phone) {
            marker.on('click', () => setTapped({ kind: 'poi', poi }));
            continue;
         }

         marker.bindPopup(
            popupCard({
               kicker: poiWord(poi),
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
                        navigateRef.current(
                           `/forecast?lat=${poi.latitude.toFixed(4)}&lng=${poi.longitude.toFixed(4)}&name=${encodeURIComponent(poi.name)}`
                        ),
                  },
               ],
            }),
            POPUP
         );
      }
   }, [pois, showPois, phone, mapReady]);

   /*
    * The place a search found.
    *
    * A search used to pan the map and clear the field, so the answer to "where
    * is Struisbaai" was a view that had moved and nothing to act on. Now it
    * lands as a real pin carrying the name, the card opens on it, and the
    * things worth doing there are one tap away.
    */
   useEffect(() => {
      const created = map.current;
      if (!created) return;

      foundMarker.current?.remove();
      foundMarker.current = null;
      if (!found) return;

      readerMoved.current = true;
      opened.current = true;

      const pin = L.marker([found.latitude, found.longitude], {
         icon: foundPin(found.name),
         title: found.name,
         keyboard: true,
         riseOnHover: true,
         zIndexOffset: 800,
      }).addTo(created);
      pin.on('click', () => setTapped({ kind: 'found' }));
      foundMarker.current = pin;

      created.setView(
         [found.latitude, found.longitude],
         Math.max(created.getZoom(), FOUND_ZOOM),
         { animate: true }
      );
      setTapped({ kind: 'found' });
      setNaming(false);
      setSpotName(found.name);

      return () => {
         pin.remove();
         foundMarker.current = null;
      };
   }, [found, mapReady]);

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
       * The naming panel covers the foot of the screen, so the pin is lifted
       * into the clear part above it. Without this a mark dropped low on the
       * screen is named blind, which is the whole complaint. The panel's own
       * height is measured rather than assumed, and capped at rather more than
       * half the map, since a sheet can be taller than the water left over.
       */
      const tall = created.getSize().y;
      const cover = Math.min(
         panel.current?.getBoundingClientRect().height || 280,
         tall * 0.55
      );
      created.panInside([at.lat, at.lng], {
         paddingTopLeft: [40, 40],
         paddingBottomRight: [40, Math.round(cover) + 24],
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

   /* A searched place, kept as one of your own spots, without leaving the map. */
   const saveFoundAsSpot = useCallback(async () => {
      if (!found) return;
      const name = spotName.trim() || found.name;
      setSavingSpot(true);
      try {
         const { data } = await axios.post<{
            site?: { id: string };
            id?: string;
         }>('/api/sites', {
            name,
            latitude: found.latitude,
            longitude: found.longitude,
            visibility: 'PRIVATE',
         });
         const id = data.site?.id ?? data.id;
         toast({
            title: 'Spot saved.',
            description: `${name} is in your spots.`,
            variant: 'success',
         });
         if (id)
            onSpotSaved?.({
               id,
               name,
               latitude: found.latitude,
               longitude: found.longitude,
               catchCount: 0,
            });
         setTapped(null);
         setNaming(false);
         onClearFound?.();
      } catch {
         toast({
            title: 'Not saved.',
            description: 'The spot did not reach us. Try again.',
            variant: 'error',
         });
      } finally {
         setSavingSpot(false);
      }
   }, [found, onClearFound, onSpotSaved, spotName]);

   const closeCard = useCallback(() => {
      setTapped(null);
      setNaming(false);
   }, []);

   /* The card for whatever is open, in React, so Keep and Kept are live. */
   const card = useMemo(() => {
      if (!tapped) return null;

      if (tapped.kind === 'mine') {
         const spot = tapped.spot;
         return (
            <PinCard
               kicker="Your spot"
               title={spot.name}
               facts={[
                  { value: catchLine(spot.catchCount) },
                  {
                     value: `${spot.latitude.toFixed(4)}, ${spot.longitude.toFixed(4)}`,
                     quiet: true,
                     figures: true,
                  },
               ]}
               actions={[
                  {
                     label: 'Open the spot',
                     tone: 'primary',
                     onClick: () => {
                        closeCard();
                        onOpenRef.current(spot.id);
                     },
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
                  { label: 'Close', onClick: closeCard },
               ]}
            />
         );
      }

      if (tapped.kind === 'other') {
         const spot = tapped.spot;
         const isKept = kept.spots.has(spot.id);
         return (
            <PinCard
               kicker="Another angler's spot"
               title={spot.name}
               facts={[
                  {
                     value: spot.createdByName
                        ? `Saved by ${spot.createdByName}`
                        : 'Saved by another angler',
                     quiet: true,
                  },
                  {
                     value: spot.catchCount
                        ? `${spot.catchCount} public ${spot.catchCount === 1 ? 'catch' : 'catches'}`
                        : 'No public catches yet',
                  },
               ]}
               tags={spot.species.slice(0, 4).map((s) => s.name)}
               actions={[
                  {
                     label: 'Open the spot',
                     tone: 'primary',
                     onClick: () => {
                        closeCard();
                        onOpenRef.current(spot.id);
                     },
                  },
                  {
                     label: isKept ? 'Kept' : 'Keep',
                     onClick: () => {
                        void (isKept ? removeSpot(spot.id) : saveSpot(spot.id))
                           .then(() => markKept('spot', spot.id, !isKept))
                           .catch(() => undefined);
                     },
                  },
                  {
                     label: 'Forecast',
                     onClick: () =>
                        navigate(
                           `/forecast?lat=${spot.latitude!.toFixed(4)}&lng=${spot.longitude!.toFixed(4)}&name=${encodeURIComponent(spot.name)}`
                        ),
                  },
                  { label: 'Close', onClick: closeCard },
               ]}
            />
         );
      }

      if (tapped.kind === 'waypoint') {
         const point = tapped.point;
         return (
            <PinCard
               kicker="Your mark"
               title={point.name}
               facts={[
                  point.note
                     ? { value: point.note }
                     : { value: 'Private to you', quiet: true },
                  {
                     value: `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`,
                     quiet: true,
                     figures: true,
                  },
               ]}
               actions={[
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
                        closeCard();
                        void deleteWaypoint(point.id).then(() =>
                           setWaypoints((current) =>
                              current.filter((w) => w.id !== point.id)
                           )
                        );
                     },
                  },
                  { label: 'Close', onClick: closeCard },
               ]}
            />
         );
      }

      if (tapped.kind === 'poi') {
         const poi = tapped.poi;
         return (
            <PinCard
               kicker={poiWord(poi)}
               title={poi.name}
               facts={[{ value: 'From OpenStreetMap', quiet: true }]}
               actions={[
                  {
                     label: 'Forecast',
                     tone: 'primary',
                     onClick: () =>
                        navigate(
                           `/forecast?lat=${poi.latitude.toFixed(4)}&lng=${poi.longitude.toFixed(4)}&name=${encodeURIComponent(poi.name)}`
                        ),
                  },
                  {
                     label: 'Log here',
                     onClick: () =>
                        navigate(
                           `/log?lat=${poi.latitude.toFixed(5)}&lng=${poi.longitude.toFixed(5)}`
                        ),
                  },
                  { label: 'Close', onClick: closeCard },
               ]}
            />
         );
      }

      if (!found) return null;

      const where = [found.kind, found.region].filter(Boolean).join(', ');
      const actions: CardAction[] = naming
         ? [
              {
                 label: savingSpot ? 'Saving' : 'Save the spot',
                 tone: 'primary',
                 disabled: savingSpot || !spotName.trim(),
                 onClick: () => void saveFoundAsSpot(),
              },
              { label: 'Cancel', onClick: () => setNaming(false) },
           ]
         : [
              {
                 label: 'Save as a spot',
                 tone: 'primary',
                 onClick: () => setNaming(true),
              },
              {
                 label: 'Log a catch here',
                 onClick: () =>
                    navigate(
                       `/log?lat=${found.latitude.toFixed(5)}&lng=${found.longitude.toFixed(5)}`
                    ),
              },
              {
                 label: 'Forecast',
                 onClick: () =>
                    navigate(
                       `/forecast?lat=${found.latitude.toFixed(4)}&lng=${found.longitude.toFixed(4)}&name=${encodeURIComponent(found.name)}`
                    ),
              },
              {
                 label: 'Dismiss',
                 onClick: () => {
                    closeCard();
                    onClearFound?.();
                 },
              },
           ];

      return (
         <PinCard
            kicker="Found"
            title={found.name}
            facts={[
               ...(where ? [{ value: where, quiet: true }] : []),
               {
                  value: `${found.latitude.toFixed(5)}, ${found.longitude.toFixed(5)}`,
                  quiet: true,
                  figures: true,
               },
            ]}
            actions={actions}
         >
            {naming ? (
               <div className="mt-3">
                  <label htmlFor="found-spot-name" className="lab">
                     Call it
                  </label>
                  <input
                     id="found-spot-name"
                     value={spotName}
                     onChange={(event) => setSpotName(event.target.value)}
                     className="input-line mt-1 text-[16px]"
                  />
               </div>
            ) : null}
         </PinCard>
      );
   }, [
      tapped,
      found,
      naming,
      spotName,
      savingSpot,
      kept.spots,
      closeCard,
      navigate,
      onClearFound,
      saveFoundAsSpot,
   ]);

   /* Nothing saved, nothing public near, nothing marked: say what to do. */
   const bare =
      full &&
      mapReady > 0 &&
      !found &&
      !mark &&
      spots.length === 0 &&
      discovered.length === 0 &&
      waypoints.length === 0;

   const guard = useCallback((element: HTMLElement | null) => {
      stopMapEvents(element);
   }, []);

   const logAtCentre = () => {
      const centre = map.current?.getCenter();
      if (centre)
         navigate(
            `/log?lat=${centre.lat.toFixed(5)}&lng=${centre.lng.toFixed(5)}`
         );
   };

   const toolbarProps = {
      base,
      onBase: (next: BaseLayer) => {
         setBase(next);
         if (map.current) setBaseLayer(map.current, next);
      },
      species,
      onSpecies: setSpecies,
      speciesOptions: speciesOptions.map((s) => ({
         value: s.id,
         label: s.name,
      })),
      layers: { others: showOthers, marks: showWaypoints, places: showPois },
      onLayer: (which: 'others' | 'marks' | 'places') => {
         if (which === 'others') setShowOthers((was) => !was);
         if (which === 'marks') setShowWaypoints((was) => !was);
         if (which === 'places') setShowPois((was) => !was);
      },
      dropping: armed,
      onDrop: () => setArmed((was) => !was),
      onLogHere: logAtCentre,
   };

   return (
      <div
         className={
            full
               ? /* The screen itself. Nothing is stacked, everything floats. */
                 'relative size-full'
               : fill
                 ? /*
                    * flex-1, not h-full. The page gives this column a
                    * min-height rather than a height, and a percentage height
                    * against an ancestor that has no definite height of its own
                    * resolves to nothing: the map came out zero pixels tall and
                    * the page rendered a heading over blank paper.
                    */
                   'flex min-h-0 flex-1 flex-col gap-3'
                 : 'flex flex-col gap-3'
         }
      >
         <div
            className={
               full
                  ? 'absolute inset-0'
                  : fill
                    ? 'relative min-h-0 flex-1'
                    : 'relative'
            }
         >
            <div
               ref={holder}
               /* The base is on the element so the night rule can leave a
                  photograph alone and only invert the drawn maps. */
               data-base={base}
               /* Told it is the screen, so the stylesheet can move Leaflet's
                  own corners clear of the search and the bar that float on it. */
               data-full={full ? 'true' : undefined}
               className={
                  'map-surface ' +
                  (full
                     ? 'absolute inset-0'
                     : fill
                       ? 'absolute inset-0 border border-line'
                       : 'h-[62vh] min-h-[380px] w-full border border-line')
               }
            />

            {/*
             * The legend and the round locate control belong to the map that
             * sits inside a page. On the full screen map the bar carries
             * Locate and the layers sheet carries the legend, so neither
             * floats where the attribution or the bar would cut it.
             */}
            {!phone && !full ? <MapLegend /> : null}
            {!phone ? (
               <MapToolbar
                  placement="overlay"
                  anchor={full ? 'bottom' : 'top'}
                  {...toolbarProps}
                  onLocate={full ? goToMe : undefined}
                  locating={locating}
               />
            ) : null}

            {!phone && !full ? (
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
             * A plus and a minus, back on the phone.
             *
             * The stylesheet hides Leaflet's own pair under a coarse pointer,
             * which left pinch as the only way to zoom, and a pinch needs two
             * hands. These are the house control at a thumb's size, clear of
             * the attribution line and the bar.
             */}
            {phone && full ? (
               <div
                  ref={guard}
                  className="absolute right-2 bottom-[116px] z-[560] flex flex-col"
               >
                  <button
                     type="button"
                     aria-label="Zoom in"
                     onClick={() => {
                        readerMoved.current = true;
                        map.current?.zoomIn();
                     }}
                     className="g grid size-11 place-items-center border border-line bg-background text-[24px] text-ink active:bg-bg-2"
                  >
                     +
                  </button>
                  <button
                     type="button"
                     aria-label="Zoom out"
                     onClick={() => {
                        readerMoved.current = true;
                        map.current?.zoomOut();
                     }}
                     className="g grid size-11 place-items-center border border-line border-t-0 bg-background text-[24px] text-ink active:bg-bg-2"
                  >
                     −
                  </button>
               </div>
            ) : null}

            {/* A map with nothing on it, and the two ways to put something
                there. It goes as soon as anything lands. */}
            {bare ? (
               <div
                  ref={guard}
                  className="absolute top-[72px] right-3 left-3 z-[560] border border-line bg-background p-4 md:right-auto md:left-3 md:w-[340px]"
               >
                  <p className="g text-[24px]">Nothing on the water yet</p>
                  <p className="mt-1.5 text-[15px] text-ink-2">
                     Find a place by name, or start where you are standing.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                     {onFindPlace ? (
                        <button
                           type="button"
                           onClick={onFindPlace}
                           className="g-tracked inline-flex min-h-11 flex-1 items-center justify-center bg-ink px-4 text-[16px] text-background"
                        >
                           Find a place
                        </button>
                     ) : null}
                     <button
                        type="button"
                        onClick={goToMe}
                        className="g-tracked inline-flex min-h-11 flex-1 items-center justify-center border border-line px-4 text-[16px] text-ink"
                     >
                        Use where I am
                     </button>
                  </div>
               </div>
            ) : null}

            {/* The card for a searched place. On a desktop it stands above
                the control row at the foot, where it cannot cover the list of
                results the reader is still choosing from. */}
            {!phone && tapped?.kind === 'found' ? (
               <div
                  ref={guard}
                  className="absolute bottom-[92px] left-3 z-[620] w-[340px] border border-line bg-background"
               >
                  {card}
               </div>
            ) : null}

            {/* The one line the map ever says for itself. */}
            {notice ? (
               <p
                  ref={guard}
                  aria-live="polite"
                  className="absolute inset-x-3 bottom-[92px] z-[560] border border-line bg-background px-3 py-2 text-center text-[14px] text-ink-2"
               >
                  {notice}
               </p>
            ) : null}

            {/*
             * Naming the mark. On a phone it is the app's sheet, which brings
             * the scrim, the escape key and a tap outside with it; it used to
             * be a bare block that covered the control bar and put Save
             * eighteen pixels above the navigation.
             */}
            {mark && !phone ? (
               <div
                  ref={panel}
                  className="thread-scroll absolute inset-x-0 bottom-0 z-[700] max-h-[78%] overflow-y-auto border-t border-line bg-background"
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
            /*
             * On a full screen map the bar floats on the water rather than
             * sitting under it, and it keeps a thumb's width of water around
             * it. Flush to the foot it landed hard against the navigation bar
             * below, whose teal marker for the current page came up directly
             * under Locate and read as though Locate were switched on.
             */
            <MapToolbar
               placement="bar"
               className={full ? 'absolute inset-x-2 bottom-6 z-[600]' : ''}
               {...toolbarProps}
               onLocate={goToMe}
               locating={locating}
            />
         ) : null}

         {phone ? (
            <>
               <Sheet
                  open={Boolean(mark)}
                  onOpenChange={(open) => {
                     if (!open) setMark(null);
                  }}
                  title="Drop a mark"
               >
                  <div
                     ref={panel}
                     className="thread-scroll min-h-0 overflow-y-auto"
                  >
                     {mark ? (
                        <NewWaypoint
                           at={mark}
                           onCancel={() => setMark(null)}
                           onSave={saveWaypoint}
                        />
                     ) : null}
                  </div>
               </Sheet>

               <Sheet
                  open={Boolean(tapped)}
                  onOpenChange={(open) => {
                     if (!open) closeCard();
                  }}
                  title="What is here"
               >
                  <div className="thread-scroll min-h-0 overflow-y-auto">
                     {card}
                  </div>
               </Sheet>
            </>
         ) : null}
      </div>
   );
}

const catchLine = (count: number) =>
   count === 0
      ? 'No catches logged here yet'
      : count === 1
        ? '1 catch logged here'
        : `${count} catches logged here`;

const poiWord = (poi: Poi) =>
   poi.kind === 'ramp'
      ? 'Slipway'
      : poi.kind === 'marina'
        ? 'Marina'
        : poi.kind === 'tackle'
          ? 'Tackle shop'
          : 'Parking';

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
         {/* What is about to be saved, in the same figures the record uses. */}
         <p className="num mt-1.5 text-[14px] text-ink-2">
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
