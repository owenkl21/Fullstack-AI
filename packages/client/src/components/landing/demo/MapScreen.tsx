import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { createMap, kindPin, refreshSize } from '@/lib/leaflet';
import { mapCentre, mapMarks, mapZoom } from './data';

/*
 * The map, and a real one: the same Leaflet the app runs, on the same satellite
 * tiles, with the app's own teardrop pins standing on it. Drawing a coastline
 * here would only ever be a picture of the map the app has.
 *
 * `interactive` is off, so it cannot be panned or zoomed out of the phone, and
 * it is built the first time the reader opens this screen rather than on page
 * load, so a landing page nobody taps asks for no tiles at all.
 */
export function MapScreen({ on }: { on: boolean }) {
   const holder = useRef<HTMLDivElement | null>(null);
   const map = useRef<L.Map | null>(null);
   const built = useRef(false);

   useEffect(() => {
      const node = holder.current;
      if (!on || built.current || !node) return;
      built.current = true;

      const created = createMap(node, {
         centre: mapCentre,
         zoom: mapZoom,
         interactive: false,
         base: 'satellite',
      });
      map.current = created;

      for (const mark of mapMarks) {
         L.marker([mark.lat, mark.lng], {
            icon: kindPin(mark.kind, mark.count ?? null),
            keyboard: false,
            interactive: false,
         }).addTo(created);
      }

      const observer = new ResizeObserver(() => refreshSize(created));
      observer.observe(node);

      return () => {
         observer.disconnect();
         created.remove();
         map.current = null;
         built.current = false;
      };
   }, [on]);

   return (
      <div
         ref={holder}
         role="img"
         aria-label="A satellite map of Kalk Bay with your spots, a mark, a slipway and a tackle shop on it"
         data-base="satellite"
         className="map-surface h-full w-full"
      />
   );
}
