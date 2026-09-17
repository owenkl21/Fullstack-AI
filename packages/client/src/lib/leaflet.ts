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

/*
 * A pin vocabulary, because one shape for everything makes a map unreadable.
 *
 * A saved spot, a private waypoint and a slipway are three different things and
 * a reader should be able to tell them apart without opening any of them. Shape
 * carries the kind and colour reinforces it, rather than colour alone, so the
 * map still reads for anyone who cannot separate teal from grey.
 */
export type PinKind =
   | 'spot'
   | 'waypoint'
   | 'ramp'
   | 'marina'
   | 'tackle'
   | 'parking';

/* Drawn inside a 24 box, sitting above the pin's point. */
const GLYPHS: Record<PinKind, string> = {
   /* The house fish. */
   spot: '<path d="M4 12.5c2.6-3.6 6.2-5.2 10.4-4.2 2 .5 3.6 1.6 6.2 1.6-2 1.6-4.2 2-6.2 2-4.2 0-7.8-1-10.4.6Z"/>',
   /* A flag: something you marked for yourself. */
   waypoint: '<path d="M8 20V5"/><path d="M8 6h9l-2 3 2 3H8"/>',
   /* A slipway: a ramp running into water. */
   ramp: '<path d="M4 17h16"/><path d="M6 17 14 7h4"/><path d="M4 20.5h16"/>',
   /* An anchor. */
   marina:
      '<path d="M12 8v12"/><circle cx="12" cy="5.5" r="2"/><path d="M5 13a7 7 0 0 0 14 0"/>',
   /* A hook. */
   tackle:
      '<path d="M14 4v7a4 4 0 0 1-8 0V9"/><path d="M11.5 6.5 14 4l2.5 2.5"/>',
   parking: '<path d="M9 19V6h4a3.5 3.5 0 0 1 0 7H9"/>',
};

const TONE: Record<PinKind, string> = {
   spot: 'map-pin-spot',
   waypoint: 'map-pin-waypoint',
   ramp: 'map-pin-poi',
   marina: 'map-pin-poi',
   tackle: 'map-pin-poi',
   parking: 'map-pin-poi',
};

/**
 * A pin of a given kind, optionally carrying a count.
 *
 * The count sits on the pin rather than inside the popup, because "how many
 * fish have come out of here" is the question the map is being asked, and
 * making someone open every pin to answer it defeats the map.
 */
export const kindPin = (kind: PinKind, count?: number | null): L.DivIcon => {
   const badge =
      typeof count === 'number' && count > 0
         ? `<span class="map-pin-count">${count > 99 ? '99+' : count}</span>`
         : '';

   return L.divIcon({
      html:
         `<span class="map-pin-body">` +
         `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" width="34" height="42" aria-hidden="true">` +
         `<path class="map-pin-drop" d="M12 33S1.5 20.8 1.5 12.5a10.5 10.5 0 1 1 21 0C22.5 20.8 12 33 12 33Z"/>` +
         `<g class="map-pin-glyph" transform="translate(3.6 2.2) scale(0.7)" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[kind]}</g>` +
         `</svg>${badge}</span>`,
      className: `map-pin map-pin-kind ${TONE[kind]}`,
      iconSize: [34, 42],
      iconAnchor: [17, 41],
      popupAnchor: [0, -38],
   });
};

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
