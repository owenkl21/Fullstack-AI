import type { CSSProperties } from 'react';

/*
 * How a photograph sits in a frame.
 *
 * A catch photo is drawn in many shapes: four by three on the feed, a square
 * in a row, a tall tile on the season strip. The angler frames it once and
 * every one of those follows. The framing is three numbers kept beside the
 * image and applied with CSS where the picture is drawn. The file is never
 * cropped, redrawn or re-encoded, because the log reads the time and the place
 * out of what the camera wrote in it, and a canvas keeps pixels and drops tags.
 *
 * The model is one sentence: the point of the photograph at (focusX, focusY)
 * sits at the same fractions of whatever frame it is drawn in, and the
 * photograph is scaled by `zoom` about that point. `object-position` already
 * means exactly that for a cover fit, and a scale whose origin is the same
 * point keeps it true when pushed in. With both figures between 0 and 1 and
 * the zoom at 1 or more, no edge of the photograph can come inside the frame
 * at any aspect ratio: the scale only ever grows the picture away from a point
 * that is inside the frame.
 *
 * Under 1 is pulled out: the photograph sits inside the frame with a border
 * where it no longer reaches, placed by the same two figures. That is how a
 * fish held up in a tall phone photo is shown whole in a wide frame. It is
 * measured against the feed's frame, from the cover (1) to the whole
 * photograph (containZoom), and every other frame goes the same share of
 * its own way there, so "the whole photograph" in the feed is the whole
 * photograph in a square row and a tall tile too.
 *
 * A cover fit cannot draw that: object-fit crops the picture to its box
 * before any scale is applied, so shrinking the box only shrinks the crop.
 * Pulled out, the picture is drawn with a contain fit instead and scaled up
 * from there, which needs the photograph's own shape. So it is drawn once the
 * picture has loaded (applyFraming, reached through framedOnLoad), and until
 * then it is drawn as a plain cover.
 */

export type Framing = {
   focusX?: number | null;
   focusY?: number | null;
   zoom?: number | null;
};

export type ResolvedFraming = { x: number; y: number; zoom: number };

/* The floor for any saved zoom. The tool stops sooner, at the zoom where the
   whole photograph just shows in the feed's frame (containZoom). */
export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 3;

/* The feed's frame, four by three, which the framing tool works in. */
export const FEED_RATIO = 4 / 3;

/**
 * The zoom at which the whole photograph just fits a frame of the given
 * shape: 1 when the two are the same shape, less the more they differ.
 */
export function containZoom(ratio: number, frameRatio = FEED_RATIO) {
   if (!(ratio > 0) || !(frameRatio > 0)) return 1;
   return Math.max(ZOOM_MIN, Math.min(frameRatio / ratio, ratio / frameRatio));
}

/*
 * Where an unframed photograph is held. Half way across, and a little over a
 * third of the way down: catch photos are mostly a person holding a fish, taken
 * upright on a phone, and the face is in the upper third. Dead centre in a
 * wide frame kept the fish and cut the angler off at the eyes.
 *
 * It only moves a photograph that is taller than its frame. One that is wider
 * has nothing to slide up or down, so it is drawn exactly as it always was.
 */
export const DEFAULT_FRAMING: ResolvedFraming = { x: 0.5, y: 0.35, zoom: 1 };

const pin = (value: number, min: number, max: number) =>
   Math.min(max, Math.max(min, value));

const figure = (value: number | null | undefined) =>
   typeof value === 'number' && Number.isFinite(value) ? value : null;

/*
 * Whether the angler ever framed this one.
 *
 * The old log wrote a focus of exactly 0.5, 0.5 on every photograph it sent,
 * touched or not, and had no zoom to send. So a dead centre with no zoom
 * beside it is not a choice anybody made, and it gets the default like a
 * photograph with nothing saved. The framing tool always sends a zoom, which
 * is how a centre that was chosen is told from one that was not.
 */
export function isFramed(framing?: Framing | null): boolean {
   if (!framing) return false;
   const x = figure(framing.focusX);
   const y = figure(framing.focusY);
   if (figure(framing.zoom) !== null) return true;
   if (x === null || y === null) return false;
   return !(x === 0.5 && y === 0.5);
}

/** The three figures to draw with: what was saved, pinned, or the default. */
export function resolveFraming(framing?: Framing | null): ResolvedFraming {
   if (!framing || !isFramed(framing)) return DEFAULT_FRAMING;
   const x = figure(framing.focusX);
   const y = figure(framing.focusY);
   return {
      x: pin(x ?? DEFAULT_FRAMING.x, 0, 1),
      y: pin(y ?? DEFAULT_FRAMING.y, 0, 1),
      zoom: pin(figure(framing.zoom) ?? 1, ZOOM_MIN, ZOOM_MAX),
   };
}

const percent = (fraction: number) => `${+(fraction * 100).toFixed(2)}%`;

/*
 * The style for an <img> that fills an overflow-hidden frame with
 * object-fit: cover. Every cover-fit catch photograph in the product is drawn
 * through this, so the tool's preview and the feed cannot drift apart.
 *
 * The scale is written as `transform` and not as the `scale` property on
 * purpose: several tiles already ease their own `scale` on hover, and the two
 * compose rather than fight.
 */
export function framingStyle(framing?: Framing | null): CSSProperties {
   const { x, y, zoom } = resolveFraming(framing);
   const at = `${percent(x)} ${percent(y)}`;
   return zoom > 1
      ? {
           objectPosition: at,
           transformOrigin: at,
           transform: `scale(${+zoom.toFixed(4)})`,
        }
      : { objectPosition: at };
}

/*
 * The same, written straight onto a picture: for the tool's drag loop, and
 * for a pulled out photograph once it has loaded. The picture is measured
 * where it stands, its own shape from its pixels and the frame's from its
 * box, so the one call is right in the feed, a row or a tile.
 */
export function applyFraming(node: HTMLElement, framing: ResolvedFraming) {
   const at = `${percent(framing.x)} ${percent(framing.y)}`;
   node.style.objectPosition = at;
   node.style.transformOrigin = at;

   const image = node instanceof HTMLImageElement ? node : null;
   const ratio =
      image && image.naturalWidth > 0 && image.naturalHeight > 0
         ? image.naturalWidth / image.naturalHeight
         : null;
   const frameRatio =
      node.clientWidth > 0 && node.clientHeight > 0
         ? node.clientWidth / node.clientHeight
         : null;

   if (framing.zoom < 1 && ratio && frameRatio) {
      /* How far from the cover towards the whole photograph, in the feed. */
      const feedWhole = containZoom(ratio, FEED_RATIO);
      const share =
         feedWhole < 0.999
            ? pin((1 - framing.zoom) / (1 - feedWhole), 0, 1)
            : 0;
      /* The same share of the way in this frame. */
      const whole = containZoom(ratio, frameRatio);
      const zoom = 1 - share * (1 - whole);
      const scale = zoom / whole;
      node.style.objectFit = 'contain';
      node.style.transform =
         Math.abs(scale - 1) > 0.0005 ? `scale(${+scale.toFixed(4)})` : '';
      return;
   }

   node.style.objectFit = '';
   node.style.transform =
      framing.zoom > 1 ? `scale(${+framing.zoom.toFixed(4)})` : '';
}

/**
 * For a photograph drawn with framingStyle: a pulled out one is only right
 * once its shape is known, so its load finishes the drawing.
 */
export function framedOnLoad(framing?: Framing | null) {
   const resolved = resolveFraming(framing);
   if (resolved.zoom >= 1) return undefined;
   return (event: { currentTarget: HTMLElement }) =>
      applyFraming(event.currentTarget, resolved);
}

/*
 * The geometry the tool moves in. `frame` is the box on screen, `ratio` the
 * photograph's own width over height.
 */
type Box = { width: number; height: number };

/** The photograph's size at zoom 1, covering the frame. */
function coverSize(frame: Box, ratio: number): Box {
   const frameRatio = frame.width / Math.max(1, frame.height);
   return ratio > frameRatio
      ? { width: frame.height * ratio, height: frame.height }
      : { width: frame.width, height: frame.width / Math.max(0.0001, ratio) };
}

/*
 * Drag the photograph by a number of pixels. The focus is the point that stays
 * put, so moving the picture right means the held point moves left along it.
 * An axis with nothing spare (the photograph fits it exactly at this zoom)
 * does not move, and its figure is left alone. Pulled out, the spare is
 * negative, a border, and the same sum slides the photograph within it.
 */
export function panFraming(
   from: ResolvedFraming,
   frame: Box,
   ratio: number,
   dx: number,
   dy: number
): ResolvedFraming {
   const base = coverSize(frame, ratio);
   const spareX = base.width * from.zoom - frame.width;
   const spareY = base.height * from.zoom - frame.height;
   return {
      x: Math.abs(spareX) > 0.5 ? pin(from.x - dx / spareX, 0, 1) : from.x,
      y: Math.abs(spareY) > 0.5 ? pin(from.y - dy / spareY, 0, 1) : from.y,
      zoom: from.zoom,
   };
}

/*
 * Push in or pull out while holding one point of the frame still: the centre
 * for the slider and the keys, the pointer for the wheel, the middle of two
 * fingers for a pinch. Whatever was under that point is still under it after,
 * until an edge of the photograph would come inside, where it stops.
 */
export function zoomFraming(
   from: ResolvedFraming,
   frame: Box,
   ratio: number,
   nextZoom: number,
   anchor: { x: number; y: number } = {
      x: frame.width / 2,
      y: frame.height / 2,
   },
   /* How far out this photograph may go: until it shows whole. */
   floor: number = ZOOM_MIN
): ResolvedFraming {
   const zoom = pin(nextZoom, Math.max(ZOOM_MIN, floor), ZOOM_MAX);
   const base = coverSize(frame, ratio);

   const axis = (
      focus: number,
      frameSize: number,
      baseSize: number,
      at: number
   ) => {
      const sizeWas = baseSize * from.zoom;
      const sizeNow = baseSize * zoom;
      const startWas = focus * (frameSize - sizeWas);
      /* The fraction of the photograph that sits under the anchor now. */
      const under = (at - startWas) / sizeWas;
      const startNow = at - under * sizeNow;
      const spare = frameSize - sizeNow;
      return Math.abs(spare) > 0.5 ? pin(startNow / spare, 0, 1) : focus;
   };

   return {
      x: axis(from.x, frame.width, base.width, anchor.x),
      y: axis(from.y, frame.height, base.height, anchor.y),
      zoom,
   };
}

/*
 * What is sent with the catch. A photograph left at the default is sent as
 * nothing at all, so it keeps following the default if that is ever tuned;
 * a framed one is rounded to four places, which is a fortieth of a pixel on
 * the widest frame the product draws.
 */
export function framingPayload(framing: ResolvedFraming | null): {
   focusX: number | null;
   focusY: number | null;
   zoom: number | null;
} {
   if (
      !framing ||
      (framing.x === DEFAULT_FRAMING.x &&
         framing.y === DEFAULT_FRAMING.y &&
         framing.zoom === DEFAULT_FRAMING.zoom)
   ) {
      return { focusX: null, focusY: null, zoom: null };
   }
   const round = (value: number) => Math.round(value * 10000) / 10000;
   return {
      focusX: round(framing.x),
      focusY: round(framing.y),
      zoom: round(framing.zoom),
   };
}
