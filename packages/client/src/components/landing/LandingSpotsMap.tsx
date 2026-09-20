import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { createMap, kindPin, refreshSize } from '@/lib/leaflet';
import { cn } from '@/lib/utils';

/*
 * A real map, with the app's real pins standing on it.
 *
 * This was a drawn plate: a flat shape with a hand made coastline and the
 * pins placed as percentages. It read as a diagram of a map rather than a
 * map, which is exactly what it was. This is the same Leaflet map the app
 * runs, on the same satellite tiles, centred on False Bay, with `interactive`
 * off so it cannot be panned, zoomed or dragged past. A picture you cannot
 * touch, made of the real thing.
 *
 * The pins are `kindPin` from the app, so the teardrops, the colours and the
 * catch counts are the product's own vocabulary rather than a copy of it.
 */
const CENTRE = { lat: -34.1512, lng: 18.4436 };

type Mark = {
   key: string;
   kind: 'spot' | 'other' | 'waypoint' | 'ramp' | 'marina' | 'tackle';
   lat: number;
   lng: number;
   count?: number;
   /* Yours, so the privacy control moves it. */
   mine?: boolean;
};

const MARKS: Mark[] = [
   {
      key: 'kalk',
      kind: 'spot',
      lat: -34.1277,
      lng: 18.4468,
      count: 12,
      mine: true,
   },
   {
      key: 'fish',
      kind: 'spot',
      lat: -34.1806,
      lng: 18.4325,
      count: 4,
      mine: true,
   },
   { key: 'other-1', kind: 'other', lat: -34.1041, lng: 18.4712 },
   { key: 'other-2', kind: 'other', lat: -34.1963, lng: 18.4661 },
   { key: 'mark', kind: 'waypoint', lat: -34.1394, lng: 18.4077, mine: true },
   { key: 'ramp', kind: 'ramp', lat: -34.1187, lng: 18.4331 },
   { key: 'marina', kind: 'marina', lat: -34.1648, lng: 18.4172 },
   { key: 'tackle', kind: 'tackle', lat: -34.1108, lng: 18.4556 },
];

export function LandingSpotsMap({
   shown,
   className,
}: {
   /* Which privacy setting the reader has picked, from the control above. */
   shown: 'exact' | 'km' | 'off';
   className?: string;
}) {
   const holder = useRef<HTMLDivElement | null>(null);
   const map = useRef<L.Map | null>(null);
   const mine = useRef<L.Layer[]>([]);
   const rings = useRef<L.Circle[]>([]);

   useEffect(() => {
      const node = holder.current;
      if (!node) return;

      const created = createMap(node, {
         centre: CENTRE,
         zoom: 12,
         interactive: false,
         base: 'satellite',
      });
      map.current = created;

      for (const mark of MARKS) {
         const marker = L.marker([mark.lat, mark.lng], {
            icon: kindPin(mark.kind, mark.count ?? null),
            keyboard: false,
            interactive: false,
         }).addTo(created);
         if (mark.mine) mine.current.push(marker);

         if (mark.mine && mark.kind === 'spot') {
            /* The kilometre a blurred spot is shown within, drawn the way the
               app draws it: a dashed teal ring, not a shaded disc. */
            const ring = L.circle([mark.lat, mark.lng], {
               radius: 1000,
               color: 'var(--teal)',
               weight: 1.5,
               dashArray: '5 5',
               fill: false,
               interactive: false,
            });
            rings.current.push(ring);
         }
      }

      const observer = new ResizeObserver(() => refreshSize(created));
      observer.observe(node);

      return () => {
         observer.disconnect();
         created.remove();
         map.current = null;
         mine.current = [];
         rings.current = [];
      };
   }, []);

   /* Exact leaves your pins where they are. Within a km adds the ring. Off the
      map takes your own pins away and leaves everyone else's. */
   useEffect(() => {
      const created = map.current;
      if (!created) return;
      for (const layer of mine.current) {
         const el = (layer as L.Marker).getElement();
         if (el) el.style.opacity = shown === 'off' ? '0' : '1';
      }
      for (const ring of rings.current) {
         if (shown === 'km') ring.addTo(created);
         else ring.remove();
      }
   }, [shown]);

   return (
      <div
         ref={holder}
         role="img"
         aria-label="A map of False Bay with spots, marks, a slipway, a marina and a tackle shop"
         data-base="satellite"
         className={cn(
            'map-surface w-full',
            'aspect-[5/6] sm:aspect-[2/1] lg:aspect-[21/9]',
            className
         )}
      />
   );
}
