import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LeafletMouseEvent, Map as LeafletMap, Marker } from 'leaflet';
import { L, createMap, kindPin, refreshSize } from '@/lib/leaflet';
import { fetchPois, type Poi } from '@/lib/overpass';
import { usePosition } from '@/lib/position';
import {
   createWaypoint,
   deleteWaypoint,
   fetchWaypoints,
   WAYPOINT_KINDS,
   type Waypoint,
   type WaypointKind,
} from './waypoints-api';

export type SpotPin = {
   id: string;
   name: string;
   latitude: number;
   longitude: number;
   catchCount: number;
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
const POI_MIN_ZOOM = 10;

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
export function SpotsMap({
   spots,
   onOpen,
}: {
   spots: SpotPin[];
   onOpen: (id: string) => void;
}) {
   const holder = useRef<HTMLDivElement | null>(null);
   const map = useRef<LeafletMap | null>(null);
   const onOpenRef = useRef(onOpen);

   const spotLayer = useRef<L.LayerGroup | null>(null);
   const waypointLayer = useRef<L.LayerGroup | null>(null);
   const poiLayer = useRef<L.LayerGroup | null>(null);

   /* Only to decide where to open, never to ask for a position: the map is
    * not a reason to put a permission prompt in front of somebody. */
   const { fix } = usePosition({ auto: false });

   const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
   const [pois, setPois] = useState<Poi[]>([]);
   const [showPois, setShowPois] = useState(true);
   const [showWaypoints, setShowWaypoints] = useState(true);
   const [dropping, setDropping] = useState<{
      lat: number;
      lng: number;
   } | null>(null);

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

      const created = createMap(node, opening);
      map.current = created;

      spotLayer.current = L.layerGroup().addTo(created);
      waypointLayer.current = L.layerGroup().addTo(created);
      poiLayer.current = L.layerGroup().addTo(created);

      const markers: Marker[] = spots.map((spot) => {
         const marker = L.marker([spot.latitude, spot.longitude], {
            icon: kindPin('spot', spot.catchCount),
            title: spot.name,
         }).addTo(spotLayer.current!);

         /*
          * Built as DOM rather than an HTML string, so a spot named with a
          * bracket or an ampersand cannot break out of the popup.
          */
         const popup = document.createElement('div');
         const title = document.createElement('p');
         title.className = 'lab';
         title.textContent = spot.name;
         const count = document.createElement('p');
         count.className = 'num text-[15px]';
         count.textContent =
            spot.catchCount === 1 ? '1 catch' : `${spot.catchCount} catches`;
         const open = document.createElement('button');
         open.type = 'button';
         open.className = 'g-tracked mt-1 text-[15px] text-teal-text';
         open.textContent = 'Open the spot';
         open.addEventListener('click', () => onOpenRef.current(spot.id));
         popup.append(title, count, open);

         marker.bindPopup(popup);
         return marker;
      });

      if (markers.length > 1) {
         created.fitBounds(L.featureGroup(markers).getBounds().pad(0.15));
      }

      /* A long press on a phone, a right click on a desktop. */
      const onLongPress = (event: LeafletMouseEvent) => {
         setDropping({ lat: event.latlng.lat, lng: event.latlng.lng });
      };
      created.on('contextmenu', onLongPress);

      const observer = new ResizeObserver(() => refreshSize(created));
      observer.observe(node);

      return () => {
         observer.disconnect();
         created.off('contextmenu', onLongPress);
         created.remove();
         map.current = null;
         spotLayer.current = null;
         waypointLayer.current = null;
         poiLayer.current = null;
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
         if (created.getZoom() < POI_MIN_ZOOM) {
            setPois([]);
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
            .then(setPois)
            .catch(() => setPois([]));
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
   }, [showPois, key]);

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

         const popup = document.createElement('div');
         const title = document.createElement('p');
         title.className = 'lab';
         title.textContent = point.name;
         const note = document.createElement('p');
         note.className = 'text-[15px]';
         note.textContent = point.note ?? 'Private to you.';
         const remove = document.createElement('button');
         remove.type = 'button';
         remove.className = 'g-tracked mt-1 text-[15px] text-destructive';
         remove.textContent = 'Remove';
         remove.addEventListener('click', () => {
            void deleteWaypoint(point.id).then(() =>
               setWaypoints((current) =>
                  current.filter((w) => w.id !== point.id)
               )
            );
         });
         popup.append(title, note, remove);
         marker.bindPopup(popup);
      }
   }, [waypoints, showWaypoints]);

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

         const popup = document.createElement('div');
         const title = document.createElement('p');
         title.className = 'lab';
         title.textContent = poi.name;
         const kind = document.createElement('p');
         kind.className = 'text-[15px] text-ink-2';
         kind.textContent =
            poi.kind === 'ramp'
               ? 'Slipway'
               : poi.kind === 'marina'
                 ? 'Marina'
                 : poi.kind === 'tackle'
                   ? 'Tackle shop'
                   : 'Parking';
         popup.append(title, kind);
         marker.bindPopup(popup);
      }
   }, [pois]);

   const saveWaypoint = useCallback(
      async (name: string, note: string, kind: WaypointKind) => {
         if (!dropping) return;
         const saved = await createWaypoint({
            name,
            note: note || null,
            kind,
            latitude: dropping.lat,
            longitude: dropping.lng,
         });
         setWaypoints((current) => [saved, ...current]);
         setDropping(null);
      },
      [dropping]
   );

   const toggle =
      'g-tracked inline-flex min-h-11 items-center gap-2 border px-3 text-[14px] transition-colors duration-150';

   return (
      <div className="flex flex-col gap-3">
         <div
            ref={holder}
            className="map-surface aspect-[3/2] w-full border border-line md:aspect-[2/1]"
         />

         <div className="flex flex-wrap items-center gap-2">
            <button
               type="button"
               onClick={() => setShowWaypoints((was) => !was)}
               aria-pressed={showWaypoints}
               className={`${toggle} ${showWaypoints ? 'border-ink bg-ink text-background' : 'border-line text-ink-2'}`}
            >
               My marks
            </button>
            <button
               type="button"
               onClick={() => setShowPois((was) => !was)}
               aria-pressed={showPois}
               className={`${toggle} ${showPois ? 'border-ink bg-ink text-background' : 'border-line text-ink-2'}`}
            >
               Ramps and shops
            </button>
            <p className="text-[14px] text-ink-3">
               Press and hold the map to drop a private mark.
            </p>
         </div>

         {dropping ? (
            <NewWaypoint
               onCancel={() => setDropping(null)}
               onSave={saveWaypoint}
            />
         ) : null}
      </div>
   );
}

function NewWaypoint({
   onSave,
   onCancel,
}: {
   onSave: (name: string, note: string, kind: WaypointKind) => Promise<void>;
   onCancel: () => void;
}) {
   const [name, setName] = useState('');
   const [note, setNote] = useState('');
   const [kind, setKind] = useState<WaypointKind>('MARK');
   const [busy, setBusy] = useState(false);

   return (
      <div className="border border-line p-4">
         <h3 className="g text-[22px]">Drop a mark</h3>
         <p className="mt-1 text-[14px] text-ink-3">
            Only you will ever see this.
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
