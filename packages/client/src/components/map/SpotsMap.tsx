import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { usePhone } from '@/lib/media';
import type {
   LatLng,
   LeafletMouseEvent,
   Map as LeafletMap,
   Marker,
} from 'leaflet';
import { ViewfinderCircleIcon } from '@heroicons/react/24/outline';
import {
   L,
   clusterGroup,
   createMap,
   dropPin,
   foundPin,
   herePin,
   kindPin,
   refreshSize,
   setBaseLayer,
   stopMapEvents,
   type BaseLayer,
} from '@/lib/leaflet';
import { MapLegend, MapToolbar } from '@/components/map/MapToolbar';
import {
   formatCoords,
   formatDay,
   plural,
} from '@/components/fishing/record/format';
import type { SpotRating } from '@/components/fishing/reviews/reviews-api';
import { waterTypeWord } from '@/components/fishing/rows/format';
import { popupCard } from '@/components/map/popup';
import { PinCard } from '@/components/map/PinCard';
import { PointMenu, type MapPoint } from '@/components/map/PointMenu';
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
   waterType?: string | null;
   lastCatchAt?: string | null;
   rating?: SpotRating | null;
   /* The fish most caught there, most first. */
   species?: { id: string; name: string; count: number }[];
   /* PRIVATE: only its owner is ever handed it, and the card says so. */
   visibility?: string | null;
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

/*
 * How long a tap waits before its menu opens. Leaflet reports a double click
 * as click, click, dblclick, so the first click cannot know it is alone. A
 * quarter of a second is long enough for the second one to arrive and short
 * enough that the menu still feels like an answer to the tap.
 */
const TAP_DELAY = 250;
/* A press and hold can arrive as a contextmenu and then a click as well,
   depending on the platform. The click inside this window is the same press. */
const HOLD_ECHO = 400;
/* A slow double click opens the menu and then zooms. A menu this young, under
   a double click, was never wanted. */
const YOUNG_MENU = 600;

/* The desktop menu, and the room it keeps from each edge of the map: the
   search or the toolbar above, the zoom on the right, the control row below. */
const MENU_WIDTH = 288;
const MENU_CLEAR = { top: 68, right: 68, left: 12 };

/* How far a spot's pin rises above the point it marks (kindPin). */
const PIN_HEAD = 46;
/* Spots closer than this on the screen at the deepest zoom are one point:
   no view parts them, so their cluster fans out instead. */
const SAME_POINT = 30;

/* Shown once per browser, so the gesture is taught and then left alone. */
const HINT_KEY = 'map-tap-hint';

/* Leaflet lets the world repeat, so a tap on a copy of it reports a longitude
   past 180. The figures that leave the map are the real ones. */
const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

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
 * One gesture does everything else. A tap on open map, which is to say not on
 * a pin, not the end of a drag and not half of a double tap, puts a sight on
 * that exact point and opens one small menu for it: log a catch there, save
 * it as a spot, drop a private mark, or read the forecast. A press and hold,
 * or a right click, is another way to the same menu rather than a behaviour
 * of its own. There used to be a toggle that armed the next tap and a "Log
 * here" that logged the middle of the view whatever had been tapped; both are
 * gone, because a button on a toolbar has no point to be about.
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

/* The pin whose card is open. */
type Tapped =
   | { kind: 'mine'; spot: SpotPin }
   | { kind: 'other'; spot: PublicSpot }
   | { kind: 'waypoint'; point: Waypoint }
   | { kind: 'poi'; poi: Poi };

/*
 * The point the menu is open on. `lng` is the real longitude, which is what
 * every action uses; `drawLng` is where it was tapped on a map whose world
 * can repeat, which is where the sight and the menu have to stand.
 */
type OpenPoint = MapPoint & {
   drawLng: number;
   source: 'tap' | 'found';
   /* A keyboard opened it, so the keyboard should land in it. */
   byKey?: boolean;
};

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
   /* Spots saved from the map since it opened, for a page that does not put
      them back in `spots` itself. */
   const [added, setAdded] = useState<SpotPin[]>([]);

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
   /*
    * The point the menu is open on, from a tap or from the search. One at a
    * time: a second tap is about the first menu, not a second one.
    */
   const [point, setPoint] = useState<OpenPoint | null>(null);
   const pointRef = useRef(point);
   pointRef.current = point;
   /* When it opened and how, which is what tells a press and hold's trailing
      click and a slow double click apart from a tap that means something. */
   const opening = useRef<{ at: number; by: 'tap' | 'hold' | 'key' | 'found' }>(
      { at: 0, by: 'tap' }
   );
   /* The zoom the menu opened at, so a long way in or out can close it. */
   const openZoom = useRef(DEFAULT_ZOOM);
   const popupClosedAt = useRef(0);
   const menu = useRef<HTMLDivElement | null>(null);
   const pointSheet = useRef<HTMLDivElement | null>(null);
   /* Whether the menu is the modal sheet, where the map cannot move under
      it, or the popover, where it can. */
   const phoneRef = useRef(phone);
   phoneRef.current = phone;
   const [locating, setLocating] = useState(false);
   /* One line over the water, for the few things the map has to say. */
   const [notice, setNotice] = useState<string | null>(null);
   const noticeTimer = useRef<number | null>(null);
   /* What the reader tapped, as a card. Phones get the app's sheet; a
    * desktop keeps Leaflet's popover, which is where a mouse expects it. */
   const [tapped, setTapped] = useState<Tapped | null>(null);

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

   /*
    * Yours, including anything saved from the map since it opened. The map
    * page puts a new spot back into `spots` itself; the map inside My spots
    * does not, and a spot that was just saved has to land on the water it was
    * saved from either way.
    */
   const drawn = [
      ...spots,
      ...added.filter((extra) => !spots.some((spot) => spot.id === extra.id)),
   ];

   // Rebuild the pins only when the positions actually change, not on every
   // parent render, since the list above re-filters as you type.
   const key = drawn
      .map((s) => `${s.id}:${s.latitude}:${s.longitude}`)
      .sort()
      .join('|');
   const spotsRef = useRef(drawn);
   spotsRef.current = drawn;

   /* ---------- The map itself, built once ---------- */

   const startRef = useRef({ base, wheelZoom, full });

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
      /* The map answers a tap on a cluster itself (onCluster below). */
      const clusters = clusterGroup({
         zoomToBoundsOnClick: false,
         spiderfyOnMaxZoom: false,
      }).addTo(created);
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

      /*
       * Whether a press on the map began with a popover or the search's list
       * of results up. That press is putting it away, as a tap that closes a
       * pin's card is, and the click it ends in must not open a menu as well.
       * Read on the window before anything else hears the press, because what
       * it closes can be gone from the page by the time the map hears it.
       */
      let dismissing = false;
      /* A cluster fanned out round one point (onCluster below) is put away
         by the next press on the map in just the same way. */
      let fanned = false;
      const notePress = (event: PointerEvent) => {
         if (!node.contains(event.target as Node)) return;
         dismissing =
            fanned ||
            Boolean(
               document.querySelector(
                  '[data-radix-popper-content-wrapper], [role="listbox"]'
               )
            );
      };
      window.addEventListener('pointerdown', notePress, {
         capture: true,
         passive: true,
      });

      /*
       * One gesture: a tap on open map opens the menu for that point.
       *
       * Leaflet's own `click` is the only judge of what a tap is. It already
       * withholds the click that ends a drag, a pinch never produces one, and
       * a pin or a cluster keeps its click to itself, so a second detector
       * built on pointer events here could only disagree with it.
       *
       * What Leaflet cannot know is whether a click is alone. A double click
       * arrives as click, click, dblclick, so the menu waits a quarter of a
       * second, and anything that shows the tap was the start of something
       * else (a second click, a drag, a zoom) calls it off.
       */
      let pending: number | null = null;
      const cancelTap = () => {
         if (pending === null) return;
         window.clearTimeout(pending);
         pending = null;
      };

      const openAt = (at: LatLng, by: 'tap' | 'hold' | 'key') => {
         opening.current = { at: Date.now(), by };
         openZoom.current = created.getZoom();
         /* One thing open at a time: the menu replaces a pin's card. */
         created.closePopup();
         setTapped(null);
         setNotice(null);
         setPoint({
            lat: at.lat,
            lng: wrapLng(at.lng),
            drawLng: at.lng,
            source: 'tap',
            byKey: by === 'key',
         });
      };

      /* While a mark is being named, a tap or a hold moves it. That is the
         way of placing a pin people reach for first when it landed a street
         off, next to dragging it. */
      const moveMark = (at: LatLng) => {
         markPin.current?.setLatLng(at);
         setMark({ lat: at.lat, lng: at.lng });
      };

      /* A press and hold on a phone, a right click on a desktop: the same
         menu, at once, because neither can be half of a double click. */
      const onHold = (event: LeafletMouseEvent) => {
         cancelTap();
         if (markingRef.current) {
            moveMark(event.latlng);
            return;
         }
         openAt(event.latlng, 'hold');
      };
      created.on('contextmenu', onHold);

      const onTap = (event: LeafletMouseEvent) => {
         if (dismissing) return;
         if (markingRef.current) {
            moveMark(event.latlng);
            return;
         }

         const now = Date.now();
         const young = now - opening.current.at;

         /* The second click of a double click, by the browser's count or by
            landing while the first is still waiting. It is a zoom. */
         if (pending !== null || (event.originalEvent?.detail ?? 1) > 1) {
            cancelTap();
            if (pointRef.current && young < YOUNG_MENU) setPoint(null);
            return;
         }

         /* The click some platforms send after the contextmenu of one press
            and hold. The menu is already open on it. */
         if (opening.current.by === 'hold' && young < HOLD_ECHO) return;

         /* This tap closed a pin's card, and that is all it was for. */
         if (now - popupClosedAt.current < 80) return;

         /* A tap elsewhere closes the menu rather than moving it. */
         if (pointRef.current) {
            setPoint(null);
            return;
         }

         const at = event.latlng;
         pending = window.setTimeout(() => {
            pending = null;
            openAt(at, 'tap');
         }, TAP_DELAY);
      };
      created.on('click', onTap);

      const onDoubleClick = () => {
         cancelTap();
         if (pointRef.current && Date.now() - opening.current.at < YOUNG_MENU)
            setPoint(null);
      };
      created.on('dblclick', onDoubleClick);
      created.on('dragstart zoomstart', cancelTap);

      /* A pin's card and the point menu are one thing open at a time. */
      const onPopupOpen = () => {
         cancelTap();
         setPoint(null);
      };
      const onPopupClose = () => {
         popupClosedAt.current = Date.now();
      };
      created.on('popupopen', onPopupOpen);
      created.on('popupclose', onPopupClose);

      /*
       * A tap on a cluster opens it onto the water its spots are on.
       *
       * The plugin's own answer went wrong two ways. Spots that stayed in one
       * cluster all the way down to the last clustered zoom were fanned out
       * where they stood, at whatever zoom the tap came in at: a pair a few
       * hundred metres apart, tapped from the whole coast, opened as two pins
       * on legs kilometres out to sea, round a cluster left at a third of its
       * strength. Every other cluster was fitted to the very edge of the map,
       * under the search at the top and the control row at the foot, with a
       * pin's head rising above the top. So the view is fitted here instead,
       * to where the spots really are, inside the part of the map left clear.
       * Only spots that are one point even at the deepest zoom, where no view
       * could part them, are fanned out.
       */
      const onCluster = (event: L.LeafletEvent) => {
         const { layer: cluster, originalEvent } = event as L.LeafletEvent & {
            layer: L.MarkerCluster;
            originalEvent?: KeyboardEvent;
         };
         const byKey = event.type === 'clusterkeypress';
         if (byKey && originalEvent?.key !== 'Enter') return;
         cancelTap();
         const bounds = cluster.getBounds();
         const deepest = created.getMaxZoom();
         const spread = created
            .project(bounds.getNorthEast(), deepest)
            .subtract(created.project(bounds.getSouthWest(), deepest));
         if (
            Math.abs(spread.x) < SAME_POINT &&
            Math.abs(spread.y) < SAME_POINT
         ) {
            cluster.spiderfy();
            fanned = true;
            /* The tap focused the disc it landed on, and the disc stays up
               behind the fan. A ring round it is for the keyboard only. */
            if (!byKey) cluster.getElement()?.blur();
         } else {
            const { full: whole } = startRef.current;
            const hand = phoneRef.current;
            created.fitBounds(bounds, {
               paddingTopLeft: [
                  28,
                  (whole || !hand ? MENU_CLEAR.top : 12) + PIN_HEAD,
               ],
               paddingBottomRight: [28, whole ? (hand ? 92 : 108) : 24],
               maxZoom: deepest,
            });
         }
         /* Back to the map for a keyboard, as the plugin did. */
         if (byKey) node.focus();
      };
      clusters.on('clusterclick clusterkeypress', onCluster);
      /* Folded, by that press or by a zoom: the next tap is a tap again. */
      const onFold = () => {
         fanned = false;
      };
      clusters.on('unspiderfied', onFold);

      /*
       * Moving the map a long way closes the menu: two zoom levels from where
       * it opened, or the point gone from the view. Short of that the menu
       * follows its point. The sheet on a phone is modal, so the only moves
       * under it are this component's own and none of them count.
       */
      const onSettle = () => {
         const open = pointRef.current;
         if (!open || phoneRef.current) return;
         if (
            Math.abs(created.getZoom() - openZoom.current) >= 2 ||
            !created.getBounds().contains([open.lat, open.drawLng])
         )
            setPoint(null);
      };
      created.on('moveend', onSettle);

      /*
       * The keyboard's way in. Arrow keys already move the map and plus and
       * minus zoom it, so the one point a keyboard can choose is the middle
       * of the view, and Enter asks about it. Only on the map itself: Enter
       * on a pin is that pin's own click.
       */
      const onKey = (event: KeyboardEvent) => {
         if (event.key !== 'Enter' || event.target !== node) return;
         if (markingRef.current) return;
         event.preventDefault();
         cancelTap();
         openAt(created.getCenter(), 'key');
      };
      node.addEventListener('keydown', onKey);

      const observer = new ResizeObserver(() => refreshSize(created));
      observer.observe(node);

      setMapReady((n) => n + 1);

      return () => {
         observer.disconnect();
         node.removeEventListener('pointerdown', takeOver);
         node.removeEventListener('wheel', takeOver);
         window.removeEventListener('pointerdown', notePress, {
            capture: true,
         });
         created.off('moveend', onMoveEnd);
         cancelTap();
         node.removeEventListener('keydown', onKey);
         created.off('contextmenu', onHold);
         created.off('click', onTap);
         created.off('dblclick', onDoubleClick);
         created.off('dragstart zoomstart', cancelTap);
         created.off('popupopen', onPopupOpen);
         created.off('popupclose', onPopupClose);
         clusters.off('clusterclick clusterkeypress', onCluster);
         clusters.off('unspiderfied', onFold);
         created.off('moveend', onSettle);
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
               /* The same words the phone's card uses for a spot kept to
                  yourself: the desktop popover is the owner's map too. */
               kicker:
                  spot.visibility === 'PRIVATE'
                     ? 'Your spot, only you'
                     : 'Your spot',
               title: spot.name,
               accent: 'var(--teal)',
               rating: spot.rating,
               facts: [
                  {
                     mark: 'fish',
                     value:
                        spot.catchCount === 0
                           ? 'No catches logged here yet'
                           : plural(spot.catchCount, 'catch', 'catches'),
                  },
                  {
                     mark: 'calendar',
                     value: spot.lastCatchAt
                        ? `Last fished ${formatDay(spot.lastCatchAt)}`
                        : '',
                     quiet: true,
                  },
                  {
                     mark: 'pin',
                     value: formatCoords(spot.latitude, spot.longitude) ?? '',
                     quiet: true,
                     figures: true,
                  },
               ],
               tags: spotTags(spot),
               actions: [
                  {
                     label: 'Open',
                     tone: 'primary',
                     onClick: () => onOpenRef.current(spot.id),
                  },
                  {
                     label: 'Forecast here',
                     onClick: () =>
                        navigateRef.current(
                           `/forecast?lat=${spot.latitude.toFixed(4)}&lng=${spot.longitude.toFixed(4)}&name=${encodeURIComponent(spot.name)}`
                        ),
                  },
               ],
            }),
            /* The card is drawn 290 wide. With two short actions its content
               alone would come out narrower. */
            { ...POPUP, minWidth: 290 }
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
    * lands as a real pin carrying the name, and the same menu a tap opens
    * opens on it, because the things worth doing there are the same things.
    * The pin stays when the menu closes, since it is still the answer to what
    * is in the field; clearing the field is what takes it off the map.
    */
   useEffect(() => {
      const created = map.current;
      if (!created) return;

      foundMarker.current?.remove();
      foundMarker.current = null;
      if (!found) {
         setPoint((open) => (open?.source === 'found' ? null : open));
         return;
      }

      readerMoved.current = true;
      opened.current = true;

      const ask = () => {
         opening.current = { at: Date.now(), by: 'found' };
         created.closePopup();
         setTapped(null);
         setPoint({
            lat: found.latitude,
            lng: found.longitude,
            drawLng: found.longitude,
            name: found.name,
            where:
               [found.kind, found.region].filter(Boolean).join(', ') || null,
            source: 'found',
         });
      };

      const pin = L.marker([found.latitude, found.longitude], {
         icon: foundPin(found.name),
         title: found.name,
         keyboard: true,
         riseOnHover: true,
         zIndexOffset: 800,
      }).addTo(created);
      pin.on('click', ask);
      foundMarker.current = pin;
      ask();

      return () => {
         pin.remove();
         foundMarker.current = null;
      };
   }, [found, mapReady]);

   /*
    * The sight on a tapped point, for as long as its menu is open. A found
    * place has its own pin, so it gets no sight. It takes no clicks: a tap on
    * it is a tap elsewhere, which closes the menu.
    */
   const sightAt =
      point?.source === 'tap' ? `${point.lat},${point.drawLng}` : null;
   useEffect(() => {
      const created = map.current;
      const open = pointRef.current;
      if (!created || !sightAt || !open) return;

      const sight = L.marker([open.lat, open.drawLng], {
         icon: herePin(),
         interactive: false,
         keyboard: false,
         zIndexOffset: 900,
      }).addTo(created);

      return () => {
         sight.remove();
      };
   }, [sightAt, mapReady]);

   /*
    * Bring the point and its menu into one view.
    *
    * A found place is flown to, close enough to see the gullies. A tapped
    * point is already on the screen and a desktop leaves it where it is. On a
    * phone the sheet covers the foot of the map, so either way the point is
    * lifted into the water left above it; a sheet's height is measured rather
    * than assumed, and capped, since a sheet can be taller than what is left.
    */
   useEffect(() => {
      const created = map.current;
      if (!created || !point) return;

      const frame = () => {
         /* A frame is long enough for the map to have gone. */
         if (!created.getPane('mapPane')) return;
         const size = created.getSize();
         const holderBox = created.getContainer().getBoundingClientRect();
         /*
          * The room kept clear at the top. The search floats there on the
          * whole-screen map; a map inside a page has nothing over its top
          * edge, and on a phone the strip of it left above the sheet is
          * short, so spending the search's room there pushed the point back
          * under the sheet it was being lifted out of.
          */
         const top = full ? MENU_CLEAR.top + 40 : 24;
         const cover = phone
            ? Math.min(
                 Math.max(
                    0,
                    (pointSheet.current?.offsetHeight ?? 340) -
                       (window.innerHeight - holderBox.bottom)
                 ),
                 /* Always a strip of water left to stand the point in. */
                 full ? size.y * 0.6 : size.y - top - 72
              )
            : 0;

         if (point.source === 'found') {
            const zoom = Math.max(created.getZoom(), FOUND_ZOOM);
            openZoom.current = zoom;
            const lift = phone ? (cover - MENU_CLEAR.top) / 2 : 0;
            const centre = created.unproject(
               created.project([point.lat, point.drawLng], zoom).add([0, lift]),
               zoom
            );
            created.setView(centre, zoom, { animate: true });
            return;
         }

         if (!phone) return;
         created.panInside([point.lat, point.drawLng], {
            paddingTopLeft: [40, top],
            paddingBottomRight: [40, Math.round(cover) + 48],
         });
      };

      if (!phone) {
         frame();
         return;
      }
      /* The sheet mounts a render after it is asked for, so its height is
         read on the next frame rather than in this one. */
      const waiting = window.requestAnimationFrame(frame);
      return () => window.cancelAnimationFrame(waiting);
      // The point alone: `phone` flipping under an open menu is a resize, not
      // a reason to move the map again.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [point]);

   /*
    * Where the desktop menu stands: beside its point, inside the map.
    *
    * To the right of the point and level with it, flipped to the left where
    * the right has no room, and kept clear of the search, the zoom and the
    * control row. It is placed by hand rather than by state, because the map
    * reports a move on every frame of a drag and a render per frame is what
    * makes a popover trail the thing it is pinned to.
    */
   useEffect(() => {
      const created = map.current;
      const node = menu.current;
      if (!created || !node || !point || phone) return;

      /* Clear of the control row and of the attribution line, which the
         imagery's licence wants left readable. */
      const clearBottom = full ? 108 : 26;
      /* Room for whichever marker is on the point: a sight, or a teardrop. */
      const gap = point.source === 'found' ? 30 : 26;

      const place = () => {
         const at = created.latLngToContainerPoint([point.lat, point.drawLng]);
         const size = created.getSize();
         const wide = node.offsetWidth;
         const tall = node.offsetHeight;

         let side: 'right' | 'left' = 'right';
         let x = at.x + gap;
         if (x + wide > size.x - MENU_CLEAR.right) {
            side = 'left';
            x = at.x - gap - wide;
         }
         x = Math.max(
            MENU_CLEAR.left,
            Math.min(x, size.x - MENU_CLEAR.right - wide)
         );
         const y = Math.max(
            MENU_CLEAR.top,
            Math.min(at.y - 34, size.y - clearBottom - tall)
         );

         node.dataset.side = side;
         node.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      };

      /* A zoom animates the map under the menu, and a menu that waits for the
         end of it and then jumps looks broken. It steps out and back in. */
      const hide = () => {
         node.style.opacity = '0';
      };
      const show = () => {
         place();
         node.style.opacity = '1';
      };

      show();
      created.on('move resize', place);
      created.on('zoomstart', hide);
      created.on('zoomend', show);
      /* Naming a spot makes the menu taller, which can push it off the foot. */
      const observer = new ResizeObserver(place);
      observer.observe(node);

      return () => {
         created.off('move resize', place);
         created.off('zoomstart', hide);
         created.off('zoomend', show);
         observer.disconnect();
      };
   }, [point, phone, full]);

   /*
    * Escape and a press anywhere else close the desktop menu. A press on the
    * map is left to the map, which knows a drag from a tap; the sheet on a
    * phone brings both of these with it.
    */
   useEffect(() => {
      if (!point || phone) return;

      const onKey = (event: KeyboardEvent) => {
         if (event.key !== 'Escape') return;
         const from = event.target as HTMLElement | null;
         /* Escape in the search field is about the list under it. */
         if (from instanceof HTMLInputElement && !menu.current?.contains(from))
            return;
         setPoint(null);
         /* Back to the map, which is where a keyboard came from. */
         holder.current?.focus({ preventScroll: true });
      };
      /* A press, or Tab carrying the keyboard out of the menu, as leaving any
         menu does. */
      const onPress = (event: PointerEvent | FocusEvent) => {
         const at = event.target as Node | null;
         if (!at || menu.current?.contains(at)) return;
         if (holder.current?.contains(at)) return;
         setPoint(null);
      };

      document.addEventListener('keydown', onKey);
      document.addEventListener('pointerdown', onPress);
      document.addEventListener('focusin', onPress);
      return () => {
         document.removeEventListener('keydown', onKey);
         document.removeEventListener('pointerdown', onPress);
         document.removeEventListener('focusin', onPress);
      };
   }, [point, phone]);

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
            longitude: wrapLng(at.lng),
         });
         setWaypoints((current) => [saved, ...current]);
         setMark(null);
      },
      []
   );

   /* A point, kept as one of your own spots, without leaving the map. */
   const saveSpotAt = useCallback(
      async (at: OpenPoint, name: string) => {
         try {
            const { data } = await axios.post<{
               site?: { id: string };
               id?: string;
            }>('/api/sites', {
               name,
               latitude: at.lat,
               longitude: at.lng,
               visibility: 'PRIVATE',
            });
            const id = data.site?.id ?? data.id;
            toast({
               title: 'Spot saved.',
               description: `${name} is in your spots.`,
               variant: 'success',
            });
            if (id) {
               const spot: SpotPin = {
                  id,
                  name,
                  latitude: at.lat,
                  longitude: at.lng,
                  catchCount: 0,
                  waterType: null,
                  lastCatchAt: null,
                  rating: null,
                  species: [],
                  /* Saved private above, so its card says so at once. */
                  visibility: 'PRIVATE',
               };
               setAdded((current) => [...current, spot]);
               onSpotSaved?.(spot);
            }
            setPoint(null);
            /* The place has become a spot, which is a better pin than the
               one the search put down. */
            if (at.source === 'found') onClearFound?.();
         } catch {
            toast({
               title: 'Not saved.',
               description: 'The spot did not reach us. Try again.',
               variant: 'error',
            });
         }
      },
      [onClearFound, onSpotSaved]
   );

   const closeCard = useCallback(() => {
      setTapped(null);
   }, []);

   /* The card for whatever is open, in React, so Keep and Kept are live. */
   const card = useMemo(() => {
      if (!tapped) return null;

      if (tapped.kind === 'mine') {
         const spot = tapped.spot;
         return (
            <PinCard
               kicker={
                  spot.visibility === 'PRIVATE'
                     ? 'Your spot, only you'
                     : 'Your spot'
               }
               title={spot.name}
               rating={spot.rating}
               facts={[
                  { value: catchLine(spot.catchCount) },
                  {
                     value: formatCoords(spot.latitude, spot.longitude) ?? '',
                     quiet: true,
                     figures: true,
                  },
               ]}
               tags={spotTags(spot)}
               /* Two actions in one row. The sheet still closes on a tap
                  outside it or on Escape. */
               actions={[
                  {
                     label: 'Open',
                     tone: 'primary',
                     onClick: () => {
                        closeCard();
                        onOpenRef.current(spot.id);
                     },
                  },
                  {
                     label: 'Forecast here',
                     onClick: () =>
                        navigate(
                           `/forecast?lat=${spot.latitude.toFixed(4)}&lng=${spot.longitude.toFixed(4)}&name=${encodeURIComponent(spot.name)}`
                        ),
                  },
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

      return null;
   }, [tapped, kept.spots, closeCard, navigate]);

   /*
    * The menu for the open point. Every action takes the point itself, which
    * is the whole repair: "Log here" used to read the middle of the view.
    */
   const pointMenu = point ? (
      <PointMenu
         /* A new point is a new menu: no half typed name carried across. */
         key={`${point.source}:${point.lat},${point.lng}`}
         point={point}
         takeFocus={phone ? false : point.byKey ? 'row' : 'menu'}
         onLog={() =>
            navigate(
               `/log?lat=${point.lat.toFixed(5)}&lng=${point.lng.toFixed(5)}`
            )
         }
         onForecast={() =>
            navigate(
               `/forecast?lat=${point.lat.toFixed(4)}&lng=${point.lng.toFixed(4)}` +
                  (point.name ? `&name=${encodeURIComponent(point.name)}` : '')
            )
         }
         onMark={() => {
            setPoint(null);
            /* The searched pin would stand on top of the one being named. */
            if (point.source === 'found') onClearFound?.();
            setMark({ lat: point.lat, lng: point.drawLng });
         }}
         onSaveSpot={(name) => saveSpotAt(point, name)}
         onClose={() => {
            setPoint(null);
            if (!phone) holder.current?.focus({ preventScroll: true });
         }}
      />
   ) : null;

   /* Nothing saved, nothing public near, nothing marked: say what to do. */
   const bare =
      full &&
      mapReady > 0 &&
      !found &&
      !mark &&
      !point &&
      drawn.length === 0 &&
      discovered.length === 0 &&
      waypoints.length === 0;
   const bareRef = useRef(bare);
   bareRef.current = bare;

   /*
    * The gesture, said once. A tap that opens a menu is not something a
    * reader can see by looking, and the controls that used to stand in for it
    * are gone, so the first visit gets one line in the map's own voice and no
    * visit after it does. The empty map says the same thing in its card, so
    * it is left out there.
    */
   useEffect(() => {
      if (!full || !mapReady) return;
      let seen = true;
      try {
         seen = localStorage.getItem(HINT_KEY) === 'seen';
      } catch {
         /* Storage is off. Saying it every visit would be worse than never. */
      }
      if (seen) return;
      const timer = window.setTimeout(() => {
         if (bareRef.current || pointRef.current || markingRef.current) return;
         /* Said in the reader's own gesture: a mouse clicks. */
         say(
            `${phoneRef.current ? 'Tap' : 'Click'} anywhere on the map to log, save or mark that point.`
         );
         try {
            localStorage.setItem(HINT_KEY, 'seen');
         } catch {
            /* Nothing to do about it. */
         }
      }, 1600);
      return () => window.clearTimeout(timer);
   }, [full, mapReady, say]);

   const guard = useCallback((element: HTMLElement | null) => {
      stopMapEvents(element);
   }, []);

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
               /* Leaflet makes the map a tab stop and says nothing about it.
                  It is a widget that takes its own keys, so it says so, and
                  says which keys. */
               role="application"
               aria-label="Map. Arrow keys move it, plus and minus zoom, and Enter opens what you can do at the middle of the view."
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
                     Find a place by name, or start where you are standing.{' '}
                     {phone ? 'Tap' : 'Click'} anywhere on the map to log, save
                     or mark that point.
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

            {/*
             * The point menu on a desktop: a popover beside the point. It is
             * a sibling of the map rather than a child of it, so Leaflet never
             * sees a click on it, and it sits under the search so a list of
             * results still opens over it. The outer box is moved by hand as
             * the map moves; the inner one carries the entrance, because one
             * element cannot be translated into place and animated in at once.
             */}
            {point && !phone ? (
               <div
                  ref={menu}
                  role="dialog"
                  aria-label={
                     point.name
                        ? `What to do at ${point.name}`
                        : 'What to do at this point'
                  }
                  style={{ width: MENU_WIDTH, opacity: 0 }}
                  className="map-point-menu group absolute top-0 left-0 z-[580] transition-opacity duration-150 [transition-timing-function:var(--ease)]"
               >
                  <div className="map-point-menu-in border border-line bg-background text-ink shadow-[0_6px_22px_rgba(11,9,9,0.3)] group-data-[side=left]:border-r-[3px] group-data-[side=left]:border-r-teal group-data-[side=right]:border-l-[3px] group-data-[side=right]:border-l-teal">
                     {pointMenu}
                  </div>
               </div>
            ) : null}

            {/* The one line the map ever says for itself. On the phone it
                stops short of the plus and minus, which stand in the same
                corner; it used to run under them and cover the minus. On a
                desktop it is as wide as what it says, over the control row
                it belongs with, rather than a strip across a wide screen. */}
            {notice ? (
               <p
                  ref={guard}
                  aria-live="polite"
                  className={
                     'absolute bottom-[92px] left-3 z-[560] border border-line bg-background px-3 py-2 text-center text-[14px] text-ink-2 ' +
                     (phone
                        ? full
                           ? 'right-[64px]'
                           : 'right-3'
                        : 'max-w-[calc(100%-24px)]')
                  }
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

               {/*
                * Every card sits on the black plate, whatever the pin, so one
                * sheet has one ground. The sheet goes black as well, so the
                * strip over the home bar is not a white band under the plate.
                */}
               {/*
                * The point menu on a phone: the same sheet a pin's card uses,
                * on the same black plate, with rows a thumb can hit. A tap on
                * the dimmed map closes it, which is the tap elsewhere.
                */}
               <Sheet
                  open={Boolean(point)}
                  onOpenChange={(open) => {
                     if (!open) setPoint(null);
                  }}
                  title={
                     point?.name
                        ? `What to do at ${point.name}`
                        : 'What to do at this point'
                  }
                  className="on-black"
               >
                  <div
                     ref={pointSheet}
                     className="thread-scroll blk blk-plain relative min-h-0 overflow-y-auto pt-3"
                  >
                     <span
                        aria-hidden="true"
                        className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 bg-paper/30"
                     />
                     {pointMenu}
                  </div>
               </Sheet>

               <Sheet
                  open={Boolean(tapped)}
                  onOpenChange={(open) => {
                     if (!open) closeCard();
                  }}
                  title="What is here"
                  className="on-black"
               >
                  <div className="thread-scroll blk blk-plain relative min-h-0 overflow-y-auto pt-3">
                     <span
                        aria-hidden="true"
                        className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 bg-paper/30"
                     />
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

/* What your own spot is known for: the water, then the fish most caught
   there. A tag is its own key, so a repeat is dropped. */
const spotTags = (spot: SpotPin) => [
   ...new Set(
      [
         waterTypeWord(spot.waterType),
         ...(spot.species ?? []).slice(0, 3).map((species) => species.name),
      ].filter((tag): tag is string => Boolean(tag))
   ),
];

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
