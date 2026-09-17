import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { L, createMap, kindPin, refreshSize } from '@/lib/leaflet';
import { cn } from '@/lib/utils';

/*
 * The map on a record.
 *
 * It used to be a still: a read-only embed, on the reasoning that a record is
 * for reading. In practice a spot page with a map you cannot move is a map you
 * cannot read, because the one thing anyone does with a spot's map is drag it
 * along the ledge to see what is either side. So it pans and zooms now, on
 * satellite, with the spot's own pin. The wheel stays off inside a scrolling
 * page, where a wheel over the map would hijack the scroll; the buttons and a
 * pinch still zoom.
 *
 * The name is kept because the callers already use it.
 */
export function StaticMap({
   latitude,
   longitude,
   label,
   zoom = 14,
   count,
   className,
}: {
   latitude: number;
   longitude: number;
   label: string;
   zoom?: number;
   /** Catches recorded here, shown inside the pin. */
   count?: number | null;
   className?: string;
}) {
   const holder = useRef<HTMLDivElement | null>(null);
   const map = useRef<LeafletMap | null>(null);

   useEffect(() => {
      const node = holder.current;
      if (!node) return;

      const created = createMap(node, {
         centre: { lat: latitude, lng: longitude },
         zoom,
         interactive: true,
         wheelZoom: false,
         base: 'satellite',
      });
      map.current = created;

      L.marker([latitude, longitude], {
         icon: kindPin('spot', count ?? null),
         title: label,
         keyboard: false,
      }).addTo(created);

      const observer = new ResizeObserver(() => refreshSize(created));
      observer.observe(node);

      return () => {
         observer.disconnect();
         created.remove();
         map.current = null;
      };
   }, [latitude, longitude, zoom, label, count]);

   return (
      <div
         ref={holder}
         role="img"
         aria-label={label}
         data-base="satellite"
         className={cn(
            'map-surface aspect-[3/2] w-full border border-line md:aspect-[2/1]',
            className
         )}
      />
   );
}
