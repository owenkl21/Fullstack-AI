import { createElement, type ComponentType, type SVGProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
   ArrowDownRightIcon,
   BuildingStorefrontIcon,
   FlagIcon,
   LifebuoyIcon,
   TruckIcon,
} from '@heroicons/react/24/outline';
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
 * All four are keyless and free to use with attribution, which is a licence
 * condition rather than a courtesy, so it is always on.
 */
export type BaseLayer = 'satellite' | 'terrain' | 'plain' | 'streets';

const BASES: Record<
   BaseLayer,
   {
      url: string;
      attribution: string;
      maxZoom: number;
      /*
       * The last zoom the server has pictures for. Past it Leaflet stretches
       * that tile rather than asking for one that comes back grey.
       */
      maxNativeZoom: number;
      label: string;
   }
> = {
   satellite: {
      label: 'Satellite',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution:
         'Imagery &copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics',
      /*
       * Esri photographs the Cape Peninsula to z19 and nearly everywhere else
       * in the country to z18: Struisbaai, Langebaan, the Vaal, Gariep and
       * Theewaterskloof all came back as the grey "not yet available" tile at
       * z19. Stretching z18 one step is better than a blank last step.
       */
      maxZoom: 19,
      maxNativeZoom: 18,
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
      maxNativeZoom: 17,
   },
   plain: {
      label: 'Plain',
      /*
       * Esri's light grey canvas: no road clutter, so the pins are the loudest
       * thing. This was CARTO Positron until CARTO began burning "API KEY
       * REQUIRED" across every keyless tile (seen live, 19 Sep 2026). The grey
       * canvas is keyless under the same terms as the satellite above and is
       * drawn to z16, which is as close as a plain base needs to go.
       */
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      attribution:
         '&copy; <a href="https://www.esri.com">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      maxNativeZoom: 16,
   },
   streets: {
      label: 'Streets',
      url: OSM_TILES,
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
      maxNativeZoom: 19,
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

/*
 * The mark in the head of a pin. Heroicons for the places and the mark, the
 * brand's own fish for a spot; rendered once to markup because Leaflet's
 * icon is an HTML string rather than a React tree.
 */
const glyphMarkup = (
   Icon: ComponentType<SVGProps<SVGSVGElement>>,
   ink: string,
   size: number,
   x: number,
   y: number,
   strokeWidth: number
) =>
   renderToStaticMarkup(
      createElement(Icon, {
         x,
         y,
         width: size,
         height: size,
         stroke: ink,
         strokeWidth,
         'aria-hidden': true,
      })
   );

const GLYPH_ICON: Record<
   Exclude<PinKind, 'spot' | 'other'>,
   ComponentType<SVGProps<SVGSVGElement>>
> = {
   waypoint: FlagIcon,
   ramp: ArrowDownRightIcon,
   marina: LifebuoyIcon,
   tackle: BuildingStorefrontIcon,
   parking: TruckIcon,
};

/*
 * The mark a spot wears: the product's own logo, not a drawing of it.
 *
 * It is Owen's artwork, the same file the header carries, and it arrives as a
 * raster with the drawing in its alpha. A pin head is teal or near black by
 * turns, so the mark cannot be painted in its own colours: the filter floods
 * the head's ink and keeps it only where the artwork has alpha, which is the
 * drawing itself in whatever colour the pin needs.
 *
 * The filter is named after the colour it floods rather than being made
 * unique per pin. Leaflet writes every icon into the document as its own
 * markup, so ids repeat; naming them by ink means the copies that collide are
 * identical, and two pins of different kinds never share one.
 */
const MARK_URL = '/brand/fisherfeed-mark.png';

const fishMarkup = (ink: string, size: number, x: number, y: number) => {
   const id = `mark-${ink.replace(/[^a-z0-9]/gi, '')}`;
   return (
      `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">` +
      `<defs><filter id="${id}" x="0" y="0" width="100%" height="100%">` +
      `<feFlood flood-color="${ink}" result="ink"/>` +
      `<feComposite in="ink" in2="SourceGraphic" operator="in"/>` +
      `</filter></defs>` +
      `<image href="${MARK_URL}" x="0" y="0" width="24" height="24" preserveAspectRatio="xMidYMid meet" filter="url(#${id})"/>` +
      `</svg>`
   );
};

/* The mark a kind carries: the house fish for a spot, a Heroicon for a place. */
const markMarkup = (
   kind: PinKind,
   ink: string,
   size: number,
   x: number,
   y: number,
   strokeWidth: number
) =>
   kind === 'spot' || kind === 'other'
      ? fishMarkup(ink, size, x, y)
      : glyphMarkup(GLYPH_ICON[kind], ink, size, x, y, strokeWidth);

/*
 * The body colour of each kind. Saturated or dark, always inside a paper
 * stroke, because the base is a photograph and can be any colour underneath.
 *
 * `mark` is the mark's own colour, which is not always the ink. The mark is
 * the product's logo, a drawing of fine lines, and on a teal head those lines
 * read in paper and close into a blot in the dark ink the count needs. So the
 * count keeps the ink it needs to be legible and the drawing gets the colour
 * it needs to be seen.
 */
const BODY: Record<PinKind, { fill: string; ink: string; mark?: string }> = {
   spot: { fill: 'var(--teal)', ink: '#06232a', mark: '#f4f1ec' },
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
export const kindPin = (
   kind: PinKind,
   count?: number | null,
   /* An extra class for a pin with a job, such as the one you can drag. */
   extra?: string
): L.DivIcon => {
   const n = typeof count === 'number' && count > 0 ? count : null;
   const body = BODY[kind];
   const small = kind === 'waypoint';
   const w = small ? 28 : 36;
   const h = small ? 36 : 46;
   const cx = small ? 14 : 18;
   const cy = small ? 14 : 18;
   /*
    * The logo is a drawing rather than a glyph, so it needs more of the head
    * than a Heroicon does: at eighteen pixels its lines run together, at
    * twenty four it is a bass leaving the water.
    */
   const isMark = kind === 'spot' || kind === 'other';
   const glyphSize = small ? 14 : isMark ? 24 : 18;
   const markInk = body.mark ?? body.ink;

   /*
    * One thing in the head, never two.
    *
    * The mark and the number were set side by side, each shrunk to make room
    * for the other, and a sixteen pixel head is not big enough to hold a
    * drawing and a figure without both of them losing. A spot that has fish on
    * it shows the count, because that is the thing that differs from the spot
    * next to it; a spot with none shows the mark, because then the only
    * question is what kind of thing this is.
    */
   const label = n ? (n > 99 ? '99+' : String(n)) : '';
   const face = n
      ? `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="var(--font-display), 'League Gothic', sans-serif" font-size="${n > 99 ? 15 : 20}" letter-spacing="0.02em" fill="${body.ink}">${label}</text>`
      : markMarkup(
           kind,
           markInk,
           glyphSize,
           cx - glyphSize / 2,
           cy - glyphSize / 2,
           2.2
        );

   const html =
      `<svg class="map-pin-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">` +
      `<defs>${SHADOW}</defs>` +
      `<path d="${small ? SMALL_DROP : TEARDROP}" fill="${body.fill}" stroke="#f4f1ec" stroke-width="2.5" stroke-linejoin="round" filter="url(#pin-shadow)"/>` +
      face +
      `</svg>`;

   return L.divIcon({
      html,
      className: `map-pin map-pin-kind map-pin-${kind}${extra ? ` ${extra}` : ''}`,
      iconSize: [w, h],
      /* The tip, not the middle, sits on the coordinate. */
      iconAnchor: [w / 2, h - 1],
      popupAnchor: [0, -(h - 6)],
   });
};

/**
 * The pin a person puts where the fish came out.
 *
 * Deliberately the same teardrop a saved spot wears, because the pin you drag
 * on the form is the pin you will find on the map afterwards; a picker with a
 * shape of its own would teach the map's vocabulary twice. Only the class
 * differs, so a test can take hold of it.
 */
export const DROP_PIN_CLASS = 'map-pin-drop';

export const dropPin = (): L.DivIcon => {
   const icon = kindPin('spot', null, DROP_PIN_CLASS);
   /*
    * The same drawing in a wider box. A pin is 36 across, and 36 is a small
    * thing to find with a thumb on a moving boat; a control here is 44. The
    * extra eight are transparent and split either side, so the tip still
    * stands on the coordinate.
    */
   icon.options.html = `<span style="display:flex;justify-content:center;width:44px">${String(icon.options.html)}</span>`;
   icon.options.iconSize = [44, 46];
   icon.options.iconAnchor = [22, 45];
   return icon;
};

/*
 * The pin a search puts down, carrying the name that was asked for.
 *
 * The same teardrop the mark flow drops, because a pin is a pin, with a paper
 * plate above it holding the place's name: a result you can see from across
 * the screen rather than a map that quietly moved. The plate is drawn in the
 * product's own tokens rather than fixed colours, so night flips it with
 * everything else.
 */
export const FOUND_PIN_CLASS = 'map-pin-found';

const escapeHtml = (text: string) =>
   text.replace(
      /[&<>"']/g,
      (character) =>
         ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
         })[character] ?? character
   );

export const foundPin = (name: string): L.DivIcon => {
   const icon = dropPin();
   const label = name.length > 24 ? `${name.slice(0, 23).trimEnd()}…` : name;
   const plate =
      `<span style="position:absolute;bottom:48px;left:50%;transform:translateX(-50%);` +
      `white-space:nowrap;background:var(--bg);color:var(--ink);border:1px solid var(--line);` +
      `padding:2px 7px;font-family:var(--font-display),sans-serif;font-size:15px;` +
      `letter-spacing:0.06em;text-transform:uppercase;line-height:1.3">${escapeHtml(label)}</span>`;
   icon.options.html = `<span style="position:relative;display:block;width:44px">${plate}${String(icon.options.html)}</span>`;
   icon.options.className = `${icon.options.className ?? ''} ${FOUND_PIN_CLASS}`;
   return icon;
};

/**
 * A control drawn over the map, kept out of the map's hands.
 *
 * Leaflet listens on its own container, so a control that stands inside it
 * would pan, zoom or drop a mark on the water underneath as well as doing its
 * own job. Saying this about the element stops that.
 *
 * It does nothing for a control that is a sibling of the container rather than
 * a child of it, which is how every control in this product is drawn, and that
 * is deliberate rather than lazy: Leaflet never sees those events, so there is
 * nothing to stop, and stopping them does real harm. React listens at the root
 * of the document, so a mousedown halted on the way up never reaches the
 * button's own handler and the control goes quietly dead. That is exactly what
 * happened to the map's search field when this was applied to everything.
 */
export const stopMapEvents = (element: HTMLElement | null) => {
   if (!element || element.dataset.mapGuard === 'on') return;
   if (!element.closest('.leaflet-container')) return;
   element.dataset.mapGuard = 'on';
   L.DomEvent.disableClickPropagation(element);
   L.DomEvent.disableScrollPropagation(element);
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
   /**
    * The OpenSeaMap beacons and buoys. On by default; off for a picture of
    * the map, where a lit sector flare means nothing to someone who cannot
    * tap it.
    */
   seamarks?: boolean;
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
   const {
      centre,
      zoom,
      interactive = true,
      wheelZoom = false,
      seamarks = true,
   } = options;

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
      maxNativeZoom: base.maxNativeZoom,
   }).addTo(map);

   /* Kept on the map object so the caller can change base without rebuilding
    * everything that has been added to it. */
   (map as L.Map & { __base?: L.TileLayer }).__base = baseLayer;

   if (seamarks) {
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
   }

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
      maxNativeZoom: next.maxNativeZoom,
   }).addTo(map);
   /* Under everything else, so pins and the seamark overlay stay on top. */
   holder.__base.bringToBack();
};

/** Leaflet measures its container once; anything that resizes it must say so. */
export const refreshSize = (map: L.Map) => {
   window.requestAnimationFrame(() => {
      /*
       * A frame is long enough for the map to have gone. Leaving the log, or
       * any route change that unmounts a map, calls `map.remove()`, which
       * drops the panes; the frame queued a moment earlier then arrives at a
       * map with nothing to measure and Leaflet throws on the missing pane.
       * Asking for the pane is the cheapest way to hear that it is over.
       */
      if (!map.getPane('mapPane')) return;
      map.invalidateSize();
   });
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
