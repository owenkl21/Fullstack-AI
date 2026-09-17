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
 * Bases to choose between.
 *
 * The standard OpenStreetMap raster is a road map. It is busy with things a
 * shore angler does not care about and quiet about the only thing they do,
 * which is what the water and the rock actually look like. That is why the map
 * read as cheap, and it is a tile problem rather than a library one: Mapbox
 * would cost real money per map load and fix none of it that this does not.
 *
 * Satellite is the default here on purpose. From the air you can see the
 * gullies, the reef and the ledges, which is how anyone picks a mark.
 *
 * All three are keyless and free to use with attribution, which is a licence
 * condition rather than a courtesy, so it is always on.
 */
export type BaseLayer = 'satellite' | 'plain' | 'streets';

const BASES: Record<
   BaseLayer,
   { url: string; attribution: string; maxZoom: number; label: string }
> = {
   satellite: {
      label: 'Satellite',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution:
         'Imagery &copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics',
      maxZoom: 19,
   },
   plain: {
      label: 'Plain',
      /* CARTO Positron: no road clutter, so the pins are the loudest thing. */
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution:
         '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
   },
   streets: {
      label: 'Streets',
      url: OSM_TILES,
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
   },
};

export const BASE_LAYERS = (Object.keys(BASES) as BaseLayer[]).map((value) => ({
   value,
   label: BASES[value].label,
}));

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
   /* Somebody else's public spot: the same shape, a quieter colour. */
   | 'other'
   | 'waypoint'
   | 'ramp'
   | 'marina'
   | 'tackle'
   | 'parking';

/* Drawn inside a 24 box, sitting above the pin's point. */
const GLYPHS: Record<PinKind, string> = {
   /* The house fish. */
   spot: '<path d="M4 12.5c2.6-3.6 6.2-5.2 10.4-4.2 2 .5 3.6 1.6 6.2 1.6-2 1.6-4.2 2-6.2 2-4.2 0-7.8-1-10.4.6Z"/>',
   other: '<path d="M4 12.5c2.6-3.6 6.2-5.2 10.4-4.2 2 .5 3.6 1.6 6.2 1.6-2 1.6-4.2 2-6.2 2-4.2 0-7.8-1-10.4.6Z"/>',
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
   other: 'map-pin-other',
   waypoint: 'map-pin-waypoint',
   ramp: 'map-pin-poi',
   marina: 'map-pin-poi',
   tackle: 'map-pin-poi',
   parking: 'map-pin-poi',
};

/**
 * A pin, of a shape that says what it is.
 *
 * Six kinds and, before this, one silhouette with different ring colours,
 * which nobody could tell apart at a glance. Shape is the thing the eye reads
 * first, so each kind has its own:
 *
 *   spot      a round disc, teal, the count inside      "fish come out of here"
 *   other     a round disc, dark, the count inside      "somebody else's spot"
 *   waypoint  a pennant on a pole                       "a note to myself"
 *   ramp      a square, blue, a slipway drawn in it     "put a boat in"
 *   marina    a square, navy, an anchor                 "a harbour"
 *   tackle    a square, amber, a hook                   "buy bait"
 *   parking   a square, grey, a P
 *
 * All of them carry a light ring on a dark or saturated body, because the base
 * is a photograph and a photograph can be any colour underneath.
 */
export const kindPin = (kind: PinKind, count?: number | null): L.DivIcon => {
   const n = typeof count === 'number' && count > 0 ? count : null;
   const glyph = `<svg viewBox="0 0 24 24" class="map-pin-g" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[kind]}</svg>`;

   if (kind === 'waypoint') {
      /* A pennant: a pole with a flag. The point of the pole is the position. */
      return L.divIcon({
         html:
            `<span class="map-pin-pole"></span>` +
            `<span class="map-pin-flag">${glyph}</span>`,
         className: `map-pin map-pin-kind map-pin-waypoint`,
         iconSize: [34, 44],
         iconAnchor: [4, 43],
         popupAnchor: [10, -40],
      });
   }

   if (kind === 'spot' || kind === 'other') {
      const face = n
         ? `<span class="map-pin-n">${n > 99 ? '99+' : n}</span>`
         : glyph;
      return L.divIcon({
         html:
            `<span class="map-pin-disc">${face}</span>` +
            `<span class="map-pin-stem"></span>`,
         className: `map-pin map-pin-kind ${TONE[kind]}`,
         iconSize: [40, 50],
         iconAnchor: [20, 49],
         popupAnchor: [0, -46],
      });
   }

   /* Points of interest: a square plate, coloured by what it is. */
   return L.divIcon({
      html: `<span class="map-pin-plate">${glyph}</span><span class="map-pin-stem"></span>`,
      className: `map-pin map-pin-kind map-pin-poi map-pin-${kind}`,
      iconSize: [32, 42],
      iconAnchor: [16, 41],
      popupAnchor: [0, -38],
   });
};

export type CreateMapOptions = {
   centre: MapPosition;
   zoom: number;
   /** Which base to draw. Satellite unless a reader has said otherwise. */
   base?: BaseLayer;
   /** Scroll wheel zoom. Right where the map is the page, wrong inside one. */
   wheelZoom?: boolean;
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
   options: CreateMapOptions
): L.Map => {
   const { centre, zoom, interactive = true, wheelZoom = false } = options;

   const map = L.map(container, {
      center: [centre.lat, centre.lng],
      zoom,
      scrollWheelZoom: interactive && wheelZoom,
      /*
       * Whole zoom levels, on purpose. Fractional zoom was tried and it draws a
       * grid: a raster tile scaled to a non-integer size shows its edges, and
       * on satellite imagery that is a lattice ruled across the sea. Each step
       * is animated, the wheel needs more travel per level so a notch is not
       * a flick, and that is what makes zooming feel smooth rather than
       * fractional levels.
       */
      zoomSnap: 1,
      zoomDelta: 1,
      zoomAnimation: true,
      wheelPxPerZoomLevel: 120,
      wheelDebounceTime: 40,
      zoomControl: interactive,
      dragging: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      attributionControl: true,
   });

   const base = BASES[options.base ?? 'satellite'];
   const baseLayer = L.tileLayer(base.url, {
      attribution: base.attribution,
      maxZoom: base.maxZoom,
   }).addTo(map);

   /* Kept on the map object so the caller can change base without rebuilding
    * everything that has been added to it. */
   (map as L.Map & { __base?: L.TileLayer }).__base = baseLayer;

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

/** Swap the base without disturbing the pins already on the map. */
export const setBaseLayer = (map: L.Map, base: BaseLayer) => {
   const holder = map as L.Map & { __base?: L.TileLayer };
   holder.__base?.remove();
   const next = BASES[base];
   holder.__base = L.tileLayer(next.url, {
      attribution: next.attribution,
      maxZoom: next.maxZoom,
   }).addTo(map);
   /* Under everything else, so pins and the seamark overlay stay on top. */
   holder.__base.bringToBack();
};

/** Leaflet measures its container once; anything that resizes it must say so. */
export const refreshSize = (map: L.Map) => {
   window.requestAnimationFrame(() => map.invalidateSize());
};

export { L };
