import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { createMap, kindPin } from '@/lib/leaflet';
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

/*
 * Where the satellite picture is one clean photograph, and so where the frame
 * is allowed to be.
 *
 * Esri's imagery is stitched from sources, and two of the seams sit right
 * here. West of about 18.28 the ocean tiles come from an older, softer source,
 * with a hard vertical edge and a pale ghost of a coastline in the sea; it is
 * the same at every zoom. Out in False Bay, Seal Island sits in a black disc
 * near 18.58. The old frame, wide at zoom 12, had both in it. The frame now
 * never leaves this box: on a wide screen that means one zoom closer, which
 * is also the zoom a shore angler actually reads the coast at.
 */
const CLEAN = L.latLngBounds([-34.23, 18.29], [-33.96, 18.555]);

/*
 * A pin stands on its tip, so its head is above the position. The frame is
 * fitted with this much room round the marks, in pixels, then moved north so
 * the room splits 50 over the top pin, enough for its head, and 22 under the
 * bottom one, enough to keep it clear of the attribution line.
 */
const PIN_ROOM = L.point(56, 72);
const HEAD_LIFT = 14;

type Mark = {
   key: string;
   kind: 'spot' | 'other' | 'waypoint' | 'ramp' | 'marina' | 'tackle';
   lat: number;
   lng: number;
   count?: number;
   /* Yours, so the privacy control moves it. */
   mine?: boolean;
};

/*
 * Real places on the stretch from Muizenberg to Fish Hoek, so the harbour is
 * on the harbour and the slipway is on the water. They used to be placed by
 * eye on a wider frame, and a marina and a slipway ended up on the mountain.
 * The slipway is the one OpenStreetMap records at the mouth of Zandvlei; the
 * tackle shop stands in for any shop on Fish Hoek's main road; the private
 * mark is a boat mark out in the bay, which is what a private mark usually is.
 */
const MARKS: Mark[] = [
   {
      key: 'st-james',
      kind: 'spot',
      lat: -34.1187,
      lng: 18.4596,
      count: 12,
      mine: true,
   },
   {
      key: 'jagers-walk',
      kind: 'spot',
      lat: -34.1412,
      lng: 18.4372,
      count: 4,
      mine: true,
   },
   { key: 'surfers-corner', kind: 'other', lat: -34.1082, lng: 18.4712 },
   { key: 'fish-hoek-beach', kind: 'other', lat: -34.1328, lng: 18.4388 },
   {
      key: 'bay-mark',
      kind: 'waypoint',
      lat: -34.1335,
      lng: 18.4665,
      mine: true,
   },
   { key: 'zandvlei', kind: 'ramp', lat: -34.0935, lng: 18.4741 },
   { key: 'kalk-bay', kind: 'marina', lat: -34.1282, lng: 18.4497 },
   { key: 'main-road', kind: 'tackle', lat: -34.133, lng: 18.4252 },
];

/*
 * The closest whole zoom that shows every mark, or the closest the clean box
 * allows if that is closer, centred on the marks and then held inside the box.
 * Run again whenever the frame changes shape, since a phone and a desktop
 * want different zooms.
 */
function frame(map: L.Map) {
   const marks = L.latLngBounds(MARKS.map((m) => [m.lat, m.lng]));
   const zoom = Math.max(
      map.getBoundsZoom(marks, false, PIN_ROOM),
      map.getBoundsZoom(CLEAN, true)
   );
   map.setView(marks.getCenter(), zoom, { animate: false });
   map.panBy([0, -HEAD_LIFT], { animate: false });
   map.panInsideBounds(CLEAN, { animate: false });
}

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
         centre: CLEAN.getCenter(),
         zoom: 12,
         interactive: false,
         base: 'satellite',
         seamarks: false,
      });
      map.current = created;
      frame(created);

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

      /* Leaflet measures once; a new shape needs a new measure and a new frame. */
      const observer = new ResizeObserver(() =>
         window.requestAnimationFrame(() => {
            if (!created.getPane('mapPane')) return;
            created.invalidateSize();
            frame(created);
         })
      );
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
         aria-label="A map of the coast from Muizenberg to Fish Hoek with spots, a private mark, a slipway, a harbour and a tackle shop"
         data-base="satellite"
         className={cn(
            'map-surface w-full',
            'aspect-[5/6] sm:aspect-[3/2] lg:aspect-[21/9]',
            className
         )}
      />
   );
}
