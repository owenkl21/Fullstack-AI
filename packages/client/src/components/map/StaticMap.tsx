import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { L, createMap, pinIcon, refreshSize } from '@/lib/leaflet';
import { cn } from '@/lib/utils';

/*
 * The read-only map on a record. Replaces the Google embed iframe, so the page
 * no longer hands the reader's position and referrer to a third party in a
 * frame we do not control.
 *
 * Not interactive on purpose: a record is for reading. The "Open in Maps" link
 * beside it stays as the one tap out to imagery and directions.
 */
export function StaticMap({
   latitude,
   longitude,
   label,
   zoom = 14,
   className,
}: {
   latitude: number;
   longitude: number;
   label: string;
   zoom?: number;
   className?: string;
}) {
   const holder = useRef<HTMLDivElement | null>(null);
   const map = useRef<LeafletMap | null>(null);

   useEffect(() => {
      const node = holder.current;
      if (!node || map.current) {
         return;
      }

      const created = createMap(node, {
         centre: { lat: latitude, lng: longitude },
         zoom,
         interactive: false,
      });
      L.marker([latitude, longitude], {
         icon: pinIcon(),
         keyboard: false,
         interactive: false,
      }).addTo(created);
      map.current = created;

      // Leaflet measures its container once, and this one is laid out by an
      // aspect ratio that settles after first paint.
      const observer = new ResizeObserver(() => refreshSize(created));
      observer.observe(node);

      return () => {
         observer.disconnect();
         created.remove();
         map.current = null;
      };
   }, [latitude, longitude, zoom]);

   return (
      <div
         ref={holder}
         role="img"
         aria-label={label}
         className={cn(
            'map-surface aspect-[3/2] w-full border border-line',
            className
         )}
      />
   );
}
