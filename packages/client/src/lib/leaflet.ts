import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
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
export type BaseLayer = 'satellite' | 'terrain' | 'plain' | 'streets';

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
   terrain: {
      label: 'Terrain',
      /*
       * OpenTopoMap: relief and contour lines. For a rock and surf angler the
       * question is often how steep the way down is, and a photograph of a
       * cliff from above does not say. Its own attribution is a condition.
       */
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution:
         '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
      maxZoom: 17,
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

/* Drawn inside a 24 box, in the head of the pin. Stroke only, round caps. */
const GLYPHS: Record<PinKind, string> = {
   /* The house fish. */
   spot: '<path d="M4 12.5c2.6-3.6 6.2-5.2 10.4-4.2 2 .5 3.6 1.6 6.2 1.6-2 1.6-4.2 2-6.2 2-4.2 0-7.8-1-10.4.6Z"/>',
   other: '<path d="M4 12.5c2.6-3.6 6.2-5.2 10.4-4.2 2 .5 3.6 1.6 6.2 1.6-2 1.6-4.2 2-6.2 2-4.2 0-7.8-1-10.4.6Z"/>',
   /* A flag: something you marked for yourself. */
   waypoint: '<path d="M7 20V4"/><path d="M7 5h10l-2.5 3.5L17 12H7"/>',
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

/*
 * The body colour of each kind. Saturated or dark, always inside a paper
 * stroke, because the base is a photograph and can be any colour underneath.
 */
const BODY: Record<PinKind, { fill: string; ink: string }> = {
   spot: { fill: 'var(--teal)', ink: '#06232a' },
   other: { fill: '#14110f', ink: '#f4f1ec' },
   waypoint: { fill: '#f4f1ec', ink: '#0b0909' },
   ramp: { fill: '#1f6fb2', ink: '#f4f1ec' },
   marina: { fill: '#1d3557', ink: '#f4f1ec' },
   tackle: { fill: '#c97b1c', ink: '#f4f1ec' },
   parking: { fill: '#4a4542', ink: '#f4f1ec' },
};

/*
 * One pin shape, the teardrop every map reader already knows, drawn as SVG
 * so the head, the point and the stroke are one piece rather than a disc
 * with a triangle glued under it. 36 wide, 46 tall; the tip is the position.
 *
 * The head is a circle of radius 16 at (18,18); the sides run down to the tip
 * at (18,45). Stroke is the paper ring the whole vocabulary shares.
 */
const TEARDROP =
   'M18 45C18 45 3.5 28.6 3.5 18a14.5 14.5 0 1 1 29 0C32.5 28.6 18 45 18 45Z';

/* A smaller drop for a private mark, so a note to yourself is quieter than a
 * spot fish come out of. 28 wide, 36 tall, head radius 11 at (14,14). */
const SMALL_DROP =
   'M14 35C14 35 3 22.4 3 14a11 11 0 1 1 22 0C25 22.4 14 35 14 35Z';

const SHADOW =
   '<filter id="pin-shadow" x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity="0.5"/></filter>';

/**
 * A pin that says what it is.
 *
 * Spots carry their catch count in the head; everything else carries a
 * glyph. Colour tells the kinds apart and the count tells the spots apart:
 * yours teal, theirs near black, a private mark paper, the places in their
 * own colours. The shape is the same for all so the map reads as one map.
 */
export const kindPin = (kind: PinKind, count?: number | null): L.DivIcon => {
   const n = typeof count === 'number' && count > 0 ? count : null;
   const body = BODY[kind];
   const small = kind === 'waypoint';
   const w = small ? 28 : 36;
   const h = small ? 36 : 46;
   const cx = small ? 14 : 18;
   const cy = small ? 14 : 18;
   const glyphSize = small ? 14 : 18;

   const face = n
      ? `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="var(--font-display), 'League Gothic', sans-serif" font-size="${n > 99 ? 13 : 17}" letter-spacing="0.02em" fill="${body.ink}">${n > 99 ? '99+' : n}</text>`
      : `<svg x="${cx - glyphSize / 2}" y="${cy - glyphSize / 2}" width="${glyphSize}" height="${glyphSize}" viewBox="0 0 24 24" fill="none" stroke="${body.ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[kind]}</svg>`;

   const html =
      `<svg class="map-pin-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">` +
      `<defs>${SHADOW}</defs>` +
      `<path d="${small ? SMALL_DROP : TEARDROP}" fill="${body.fill}" stroke="#f4f1ec" stroke-width="2.5" stroke-linejoin="round" filter="url(#pin-shadow)"/>` +
      face +
      `</svg>`;

   return L.divIcon({
      html,
      className: `map-pin map-pin-kind map-pin-${kind}`,
      iconSize: [w, h],
      /* The tip, not the middle, sits on the coordinate. */
      iconAnchor: [w / 2, h - 1],
      popupAnchor: [0, -(h - 6)],
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

/*
 * Several spots in one place, at a zoom where they would sit on top of each
 * other. A disc like a spot's, but doubled, so it reads as "several" and not
 * as one spot with a big count. Yours and other anglers' spots share the one
 * cluster, because two clusters that do not know about each other still land
 * on top of each other; the disc goes teal the moment one of yours is inside,
 * so "there is something of mine here" survives the zoom out. Tapping one
 * zooms in until they separate, which the plugin does on its own.
 */
export const clusterGroup = (): L.MarkerClusterGroup =>
   L.markerClusterGroup({
      maxClusterRadius: 44,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      removeOutsideVisibleBounds: true,
      /* From here in every spot stands on its own. */
      disableClusteringAtZoom: 14,
      iconCreateFunction: (cluster) => {
         const count = cluster.getChildCount();
         const text = count > 99 ? '99+' : String(count);
         const mine = cluster
            .getAllChildMarkers()
            .some((marker) =>
               String(
                  (marker.options.icon as L.DivIcon | undefined)?.options
                     .className ?? ''
               ).includes('map-pin-spot')
            );
         const fill = mine ? 'var(--teal)' : '#14110f';
         const ink = mine ? '#06232a' : '#f4f1ec';
         /*
          * A circle, not a drop: a cluster is not at a place, it stands for
          * several. The second, thinner ring outside says "more than one".
          */
         const html =
            `<svg class="map-pin-svg" width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">` +
            `<defs>${SHADOW}</defs>` +
            `<circle cx="24" cy="24" r="22" fill="none" stroke="#f4f1ec" stroke-opacity="0.75" stroke-width="1.5"/>` +
            `<circle cx="24" cy="24" r="17" fill="${fill}" stroke="#f4f1ec" stroke-width="2.5" filter="url(#pin-shadow)"/>` +
            `<text x="24" y="24" text-anchor="middle" dominant-baseline="central" font-family="var(--font-display), 'League Gothic', sans-serif" font-size="${count > 99 ? 13 : 18}" letter-spacing="0.02em" fill="${ink}">${text}</text>` +
            `</svg>`;
         return L.divIcon({
            html,
            className: `map-pin map-pin-kind map-pin-cluster map-pin-cluster-${mine ? 'spot' : 'other'}`,
            iconSize: [48, 48],
            iconAnchor: [24, 24],
         });
      },
   });
