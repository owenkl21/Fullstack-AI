import { useEffect, useMemo, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { L, createMap, pinIcon, refreshSize } from '@/lib/leaflet';

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
 * Every saved spot on one map. Each pin opens its own name, its catch count and
 * a way through to the spot, so the map is a route into the records rather than
 * a picture of them.
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

   useEffect(() => {
      onOpenRef.current = onOpen;
   }, [onOpen]);

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

      const created = createMap(node, {
         centre: spots[0]
            ? { lat: spots[0].latitude, lng: spots[0].longitude }
            : DEFAULT_CENTER,
         zoom: spots.length === 1 ? SINGLE_PIN_ZOOM : DEFAULT_ZOOM,
      });
      map.current = created;

      const markers = spots.map((spot) => {
         const marker = L.marker([spot.latitude, spot.longitude], {
            icon: pinIcon(),
            title: spot.name,
         }).addTo(created);

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

      const observer = new ResizeObserver(() => refreshSize(created));
      observer.observe(node);

      return () => {
         observer.disconnect();
         created.remove();
         map.current = null;
      };
      // `key` stands in for the positions; `spots` itself changes identity on
      // every keystroke in the search field above.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [key]);

   return (
      <div
         ref={holder}
         className="map-surface aspect-[3/2] w-full border border-line md:aspect-[2/1]"
      />
   );
}
