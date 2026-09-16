import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapPosition } from './maps';

/*
 * Leaflet, used directly. Not react-leaflet: version 5 is Hippocratic-2.1,
 * which is not an OSI licence. Leaflet itself is BSD-2-Clause.
 *
 * Everything here is imported only by the map components, which are only
 * reached from lazy routes, so none of it lands in the entry chunk.
 */

/*
 * Keyless OpenStreetMap standard tiles. No account, no API key, no registered
 * domain. Attribution is a licence condition, not a courtesy, so it is always
 * on and never behind a toggle.
 */
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
   '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/*
 * Beacons, buoys and port detail, which is what a rock and surf angler reads.
 * Transparent overlay, free, ODbL.
 */
const SEAMARK_TILES = 'https://t2.openseamap.org/seamark/{z}/{x}/{y}.png';
const SEAMARK_ATTRIBUTION =
   '<a href="https://www.openseamap.org">OpenSeaMap</a>';

/*
 * The product's own pin: the Heroicons map-pin outline in --teal, as DOM we
 * control. Leaflet's shipped default icon is deliberately never touched, since
 * it resolves image URLs relative to the CSS and breaks under a bundler.
 */
const PIN_SVG = `<svg class="map-pin-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="32" height="32" aria-hidden="true"><path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/></svg>`;

export const pinIcon = (): L.DivIcon =>
   L.divIcon({
      html: PIN_SVG,
      className: 'map-pin',
      iconSize: [32, 32],
      // The point of the pin, not its middle, is what sits on the coordinate.
      iconAnchor: [16, 31],
      popupAnchor: [0, -28],
   });

export type CreateMapOptions = {
   centre: MapPosition;
   zoom: number;
   /** False for the read-only embeds, which should not be panned or zoomed. */
   interactive?: boolean;
};

/*
 * One map, made the same way everywhere.
 *
 * scrollWheelZoom is off deliberately. The brief asks for cooperative gestures
 * by name, which is a Google option; in Leaflet the equivalent behaviour is a
 * page that scrolls past the map unless you mean to zoom it. Two-finger drag on
 * touch is Leaflet's own default once dragging stays enabled.
 */
export const createMap = (
   container: HTMLElement,
   { centre, zoom, interactive = true }: CreateMapOptions
): L.Map => {
   const map = L.map(container, {
      center: [centre.lat, centre.lng],
      zoom,
      scrollWheelZoom: false,
      zoomControl: interactive,
      dragging: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      attributionControl: true,
   });

   L.tileLayer(OSM_TILES, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
   }).addTo(map);

   L.tileLayer(SEAMARK_TILES, {
      attribution: SEAMARK_ATTRIBUTION,
      /*
       * Seamarks only exist close in. Below this the server returns 404 for
       * every tile, which fills the console with errors and paints nothing.
       */
      minZoom: 9,
      maxZoom: 18,
      opacity: 0.9,
   }).addTo(map);

   return map;
};

/** Leaflet measures its container once; anything that resizes it must say so. */
export const refreshSize = (map: L.Map) => {
   window.requestAnimationFrame(() => map.invalidateSize());
};

export { L };
