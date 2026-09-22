import {
   useCallback,
   useEffect,
   useId,
   useLayoutEffect,
   useRef,
   useState,
   type KeyboardEvent as ReactKeyboardEvent,
   type PointerEvent as ReactPointerEvent,
} from 'react';
import * as RadixSlider from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
} from '@/components/ui/dialog';
import {
   DEFAULT_FRAMING,
   ZOOM_MAX,
   ZOOM_MIN,
   applyFraming,
   framingPayload,
   panFraming,
   resolveFraming,
   zoomFraming,
   type Framing,
   type ResolvedFraming,
} from '@/lib/framing';

/*
 * Frame it.
 *
 * The feed crops every photograph to four by three, a row crops it to a
 * square and the season strip to a tall tile. A fish held up to a phone is
 * taller than all of them, and a centre crop kept the fish and lost the face.
 * This is where the angler puts that right: the photograph sits in the feed's
 * own frame, they drag it into place and push in, and the square and the tall
 * tile beside it follow as they go, so all three are seen to stay good.
 *
 * Nothing here touches the file. What comes out is three numbers (lib/framing.ts)
 * that are saved beside the image and applied with CSS wherever it is drawn.
 * The photograph still goes up exactly as the camera wrote it, because the log
 * reads the time and the place out of it.
 *
 * It has to feel like moving a print under a window, so the photograph does
 * not wait for React: the pointer writes the next figures into a ref, one
 * animation frame paints them straight onto the three <img> elements, and
 * only then is the state told, for the slider and the readout.
 */

export type FramingResult = ReturnType<typeof framingPayload>;

/* The three shapes a catch photograph is cropped to, as the product draws them. */
const SIDE_FRAMES = [
   { label: 'Row', ratio: '1 / 1' },
   { label: 'Season tile', ratio: '3 / 4' },
] as const;

const EASE_BACK =
   'object-position 260ms var(--ease), transform 260ms var(--ease), transform-origin 260ms var(--ease)';

const prefersStill = () =>
   typeof window !== 'undefined' &&
   window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const sameFraming = (a: ResolvedFraming, b: ResolvedFraming) =>
   a.x === b.x && a.y === b.y && a.zoom === b.zoom;

/* Written straight onto the three pictures, as the framing itself is. */
const easeNodes = (nodes: (HTMLImageElement | null)[], transition: string) => {
   for (const node of nodes) {
      if (node) node.style.transition = transition;
   }
};

export function FrameTool({
   open,
   onOpenChange,
   src,
   framing,
   onDone,
}: {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   /* The picture as the browser can draw it right now: the object URL of a
      file still on its way up, or the address of one already saved. */
   src: string | null;
   framing?: Framing | null;
   onDone: (next: FramingResult) => void;
}) {
   const stageRef = useRef<HTMLDivElement>(null);
   /* The control that opened the tool, to be given focus back when it shuts. */
   const openerRef = useRef<HTMLElement | null>(null);
   /*
    * The photograph it was opened on, kept while the dialog fades out. The
    * caller lets go of its own at the moment it closes, and a dialog that
    * emptied as it left would fold up on the way.
    *
    * Taken when it opens, and again if the picture itself is swapped while it
    * is open, but not on every render: the framing the caller holds is only
    * a starting point, and the tool owns it from there. Each opening is
    * counted, so the tool inside starts fresh every time.
    */
   const [held, setHeld] = useState<{
      src: string;
      framing?: Framing | null;
      opening: number;
      live: boolean;
   } | null>(null);
   if (open && src && (!held?.live || held.src !== src)) {
      setHeld({
         src,
         framing,
         opening: held?.live ? held.opening : (held?.opening ?? 0) + 1,
         live: true,
      });
   } else if (!open && held?.live) {
      setHeld({ ...held, live: false });
   }

   return (
      <Dialog open={open} onOpenChange={onOpenChange}>
         <DialogContent
            /* A sheet on a phone as every dialog here is, but one that rises
               higher: the frame is held to a share of the screen, and the
               sheet is given enough of it that Done is not under the fold.
               On a desktop it is wide enough for the frame and the two small
               ones beside it. `on-black` remaps the ink tokens for the black
               ground. */
            className="on-black max-h-[94dvh] sm:max-h-[min(94dvh,860px)] md:w-[772px] md:max-w-[calc(100%-32px)]"
            /* The keys move the photograph, so the photograph takes focus.
               What had it before is noted on the way in: every caller opens
               this from its own button rather than a Radix trigger, and
               without one Radix hands focus back to nothing, so a keyboard
               was left at the top of the page after Done or Escape. */
            onOpenAutoFocus={(event) => {
               event.preventDefault();
               const before = document.activeElement;
               openerRef.current =
                  before instanceof HTMLElement && before !== document.body
                     ? before
                     : null;
               stageRef.current?.focus({ preventScroll: true });
            }}
            onCloseAutoFocus={(event) => {
               /* React's development double mount calls this with the tool
                  still open; only a real close hands focus back. */
               if (open) return;
               const opener = openerRef.current;
               openerRef.current = null;
               /* The tile it was opened from can be gone by now (a photo
                  that finished going up is redrawn as another tile). */
               if (opener?.isConnected) {
                  event.preventDefault();
                  opener.focus({ preventScroll: true });
               }
            }}
         >
            <DialogHeader>
               <DialogTitle>Frame it</DialogTitle>
               {/* Said aloud always, but on a short phone the three lines it
                   takes are what kept Done under the fold, and the hint
                   beside the small frames already says what to do. */}
               <DialogDescription className="max-md:[@media(max-height:760px)]:sr-only">
                  Drag the photo into place and push in until it sits right.
                  Only the framing is saved, never a cropped photo.
               </DialogDescription>
            </DialogHeader>
            {held ? (
               <Framer
                  key={held.opening}
                  src={held.src}
                  initial={held.framing}
                  stageRef={stageRef}
                  onCancel={() => onOpenChange(false)}
                  onDone={(next) => {
                     onDone(next);
                     onOpenChange(false);
                  }}
               />
            ) : null}
         </DialogContent>
      </Dialog>
   );
}

type Point = { x: number; y: number };

function Framer({
   src,
   initial,
   stageRef,
   onDone,
   onCancel,
}: {
   src: string;
   initial?: Framing | null;
   stageRef: React.RefObject<HTMLDivElement | null>;
   onDone: (next: FramingResult) => void;
   onCancel: () => void;
}) {
   const hintId = useId();
   const zoomId = useId();

   /* What is drawn, and what the slider reads. The ref is the truth while a
      finger is down; the state follows it one frame behind. */
   const [view, setView] = useState<ResolvedFraming>(() =>
      resolveFraming(initial)
   );
   const current = useRef(view);
   const images = useRef<(HTMLImageElement | null)[]>([]);
   const frame = useRef(0);

   /* The photograph's own shape, known once it has loaded. Nothing moves
      before then, because how far it can move depends on it. */
   const [ratio, setRatio] = useState<number | null>(null);
   const [failed, setFailed] = useState(false);

   /* The thirds show while the photograph is being moved and fade after. */
   const [moving, setMoving] = useState(false);
   const restTimer = useRef(0);

   const paint = useCallback(() => {
      frame.current = 0;
      for (const node of images.current) {
         if (node) applyFraming(node, current.current);
      }
      setView(current.current);
   }, []);

   const commit = useCallback(
      (next: ResolvedFraming) => {
         if (sameFraming(next, current.current)) return;
         current.current = next;
         if (!frame.current) frame.current = requestAnimationFrame(paint);
      },
      [paint]
   );

   /*
    * The slider is painted at once rather than on the next frame. It is a
    * controlled input: a held arrow key steps from the value it was last
    * given, and a value one frame stale swallowed every other step.
    */
   const commitNow = useCallback(
      (next: ResolvedFraming) => {
         if (sameFraming(next, current.current)) return;
         current.current = next;
         if (frame.current) cancelAnimationFrame(frame.current);
         paint();
      },
      [paint]
   );

   /* The first paint, before the browser shows the dialog. */
   useLayoutEffect(() => {
      for (const node of images.current) {
         if (node) applyFraming(node, current.current);
      }
   }, []);

   /* A photograph already in the cache can be complete before its load
      event has anywhere to land, and the tool would wait on it for ever. */
   useEffect(() => {
      const node = images.current[0];
      if (node?.complete && node.naturalWidth > 0 && node.naturalHeight > 0) {
         setRatio(node.naturalWidth / node.naturalHeight);
      }
   }, []);

   useEffect(
      () => () => {
         if (frame.current) cancelAnimationFrame(frame.current);
         window.clearTimeout(restTimer.current);
      },
      []
   );

   const box = () => {
      const rect = stageRef.current?.getBoundingClientRect();
      return rect && rect.width > 0 && rect.height > 0 ? rect : null;
   };

   /* A move that is not under a finger (a key, the wheel) shows the thirds
      for a moment and lets them go. */
   const stir = useCallback(() => {
      setMoving(true);
      window.clearTimeout(restTimer.current);
      restTimer.current = window.setTimeout(() => setMoving(false), 520);
   }, []);

   /* Reset and the double tap travel rather than jump, unless the angler
      has asked for less motion. */
   const easeTo = (next: ResolvedFraming) => {
      if (!prefersStill()) {
         easeNodes(images.current, EASE_BACK);
         window.setTimeout(() => easeNodes(images.current, ''), 300);
      }
      commit(next);
   };

   /* ---- The pointer: one finger moves it, two push in -------------------- */

   const pointers = useRef(new Map<number, Point>());
   const lastTap = useRef<{ at: number; x: number; y: number } | null>(null);
   const press = useRef<{ at: number; x: number; y: number } | null>(null);

   const spread = () => {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return null;
      return {
         distance: Math.hypot(a.x - b.x, a.y - b.y),
         middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
   };

   const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
      if (ratio === null) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, {
         x: event.clientX,
         y: event.clientY,
      });
      press.current =
         pointers.current.size === 1
            ? { at: event.timeStamp, x: event.clientX, y: event.clientY }
            : null;
      window.clearTimeout(restTimer.current);
      setMoving(true);
   };

   const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
      const was = pointers.current.get(event.pointerId);
      const rect = box();
      if (!was || !rect || ratio === null) return;

      const before = spread();
      const now = { x: event.clientX, y: event.clientY };
      pointers.current.set(event.pointerId, now);

      /*
       * Each move is taken from the one before it, not from where the finger
       * first came down. Held against an edge and dragged on, the photograph
       * then answers the moment the finger turns back, rather than waiting
       * for it to travel all the way home.
       */
      if (pointers.current.size === 1) {
         commit(
            panFraming(
               current.current,
               rect,
               ratio,
               now.x - was.x,
               now.y - was.y
            )
         );
         return;
      }

      const after = spread();
      if (!before || !after || before.distance < 1) return;
      const pushed = zoomFraming(
         current.current,
         rect,
         ratio,
         current.current.zoom * (after.distance / before.distance),
         { x: after.middle.x - rect.left, y: after.middle.y - rect.top }
      );
      commit(
         panFraming(
            pushed,
            rect,
            ratio,
            after.middle.x - before.middle.x,
            after.middle.y - before.middle.y
         )
      );
   };

   const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.delete(event.pointerId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
         event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (pointers.current.size === 0) setMoving(false);

      /* A tap is a press that went nowhere; two of them close together put
         the photograph back, or push in where it was tapped if it is
         already back. */
      const began = press.current;
      press.current = null;
      if (
         event.type !== 'pointerup' ||
         !began ||
         event.timeStamp - began.at > 300 ||
         Math.hypot(event.clientX - began.x, event.clientY - began.y) > 8
      ) {
         return;
      }
      const before = lastTap.current;
      if (
         before &&
         event.timeStamp - before.at < 320 &&
         Math.hypot(event.clientX - before.x, event.clientY - before.y) < 28
      ) {
         lastTap.current = null;
         const rect = box();
         if (sameFraming(current.current, DEFAULT_FRAMING)) {
            if (rect && ratio !== null) {
               easeTo(
                  zoomFraming(current.current, rect, ratio, 2, {
                     x: event.clientX - rect.left,
                     y: event.clientY - rect.top,
                  })
               );
            }
         } else {
            easeTo(DEFAULT_FRAMING);
         }
         return;
      }
      lastTap.current = {
         at: event.timeStamp,
         x: event.clientX,
         y: event.clientY,
      };
   };

   /*
    * The wheel, and a pinch on a trackpad, which the browser also reports as
    * a wheel. Bound by hand because React listens for the wheel passively,
    * and a passive listener cannot stop the page scrolling under the dialog.
    * Bound once the photograph's shape is known, which is all it waits on.
    */
   useEffect(() => {
      const node = stageRef.current;
      if (!node || ratio === null) return;
      const onWheel = (event: WheelEvent) => {
         const rect = node.getBoundingClientRect();
         if (rect.width <= 0 || rect.height <= 0) return;
         event.preventDefault();
         const pixels =
            event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
         const factor = Math.exp(-pixels * (event.ctrlKey ? 0.012 : 0.0022));
         commit(
            zoomFraming(
               current.current,
               rect,
               ratio,
               current.current.zoom * factor,
               { x: event.clientX - rect.left, y: event.clientY - rect.top }
            )
         );
         stir();
      };
      node.addEventListener('wheel', onWheel, { passive: false });
      return () => node.removeEventListener('wheel', onWheel);
   }, [stageRef, ratio, commit, stir]);

   /* ---- The keys --------------------------------------------------------- */

   const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const rect = box();
      if (!rect || ratio === null) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      /* An arrow moves the photograph the way it points, a twenty-fifth of
         the frame at a time, or a sixth with shift held. */
      const step = rect.width * (event.shiftKey ? 0.16 : 0.04);
      const moves: Record<string, [number, number]> = {
         ArrowLeft: [-step, 0],
         ArrowRight: [step, 0],
         ArrowUp: [0, -step],
         ArrowDown: [0, step],
      };
      const move = moves[event.key];

      if (move) {
         commit(panFraming(current.current, rect, ratio, move[0], move[1]));
      } else if (event.key === '+' || event.key === '=') {
         commit(
            zoomFraming(
               current.current,
               rect,
               ratio,
               current.current.zoom + 0.1
            )
         );
      } else if (event.key === '-' || event.key === '_') {
         commit(
            zoomFraming(
               current.current,
               rect,
               ratio,
               current.current.zoom - 0.1
            )
         );
      } else if (event.key === '0') {
         easeTo(DEFAULT_FRAMING);
      } else {
         return;
      }
      event.preventDefault();
      stir();
   };

   const atRest = sameFraming(view, DEFAULT_FRAMING);
   const zoomText = `${view.zoom.toFixed(1)} times`;

   const picture = (index: number, alt: string) => (
      <img
         ref={(node) => {
            images.current[index] = node;
         }}
         src={src}
         alt={alt}
         draggable={false}
         onLoad={
            index === 0
               ? (event) => {
                    const { naturalWidth, naturalHeight } = event.currentTarget;
                    if (naturalWidth > 0 && naturalHeight > 0) {
                       setRatio(naturalWidth / naturalHeight);
                    }
                 }
               : undefined
         }
         onError={index === 0 ? () => setFailed(true) : undefined}
         className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
      />
   );

   return (
      <div className="mt-5 flex flex-col gap-5 max-md:[@media(max-height:760px)]:mt-3 max-md:[@media(max-height:760px)]:gap-3">
         <div className="flex flex-col gap-5 max-md:[@media(max-height:760px)]:gap-3 md:flex-row md:items-start md:gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
               <span className="lab text-paper-2">Feed card</span>
               {/* Held to a share of the screen's height, so the slider and
                   Done are on screen without scrolling. The frame takes no
                   scroll of its own, and on a desk the wheel over it zooms,
                   so a dialog that had to scroll was one that fought back.
                   On a desk the share is what the dialog has left once its
                   words and controls are counted (about 330px), with a floor
                   for a window too short to hold it all anyway. */}
               <div className="mx-auto w-full max-w-[calc(36dvh*4/3)] md:max-w-[min(100%,calc(50dvh*4/3),max(calc((94dvh-330px)*4/3),240px))]">
                  <div
                     ref={stageRef}
                     tabIndex={0}
                     role="group"
                     aria-roledescription="photo framing"
                     aria-label="The photograph in the feed's frame"
                     aria-describedby={hintId}
                     data-frame-stage=""
                     onPointerDown={onPointerDown}
                     onPointerMove={onPointerMove}
                     onPointerUp={onPointerUp}
                     onPointerCancel={onPointerUp}
                     onKeyDown={onKeyDown}
                     className={cn(
                        'relative aspect-[4/3] w-full touch-none overflow-hidden bg-black-block-2 outline-offset-2 select-none',
                        ratio === null
                           ? 'cursor-progress'
                           : 'cursor-grab active:cursor-grabbing'
                     )}
                  >
                     {picture(0, 'The photograph being framed')}
                     {/* The thirds: two rules each way, only while it moves. */}
                     <span
                        aria-hidden="true"
                        className={cn(
                           'pointer-events-none absolute inset-0 transition-opacity duration-200 [transition-timing-function:var(--ease)] motion-reduce:transition-none',
                           moving ? 'opacity-100' : 'opacity-0'
                        )}
                     >
                        {['33.333%', '66.666%'].map((at) => (
                           <span key={at}>
                              <span
                                 style={{ left: at }}
                                 className="absolute inset-y-0 w-px bg-paper/55 shadow-[0_0_0_0.5px_rgba(11,9,9,0.35)]"
                              />
                              <span
                                 style={{ top: at }}
                                 className="absolute inset-x-0 h-px bg-paper/55 shadow-[0_0_0_0.5px_rgba(11,9,9,0.35)]"
                              />
                           </span>
                        ))}
                     </span>
                     {failed ? (
                        <p
                           role="alert"
                           className="absolute inset-0 grid place-items-center px-6 text-center text-[15px] text-paper-2"
                        >
                           The photo could not be shown here. Close this and try
                           again in a moment.
                        </p>
                     ) : null}
                  </div>
               </div>
            </div>

            {/* The same three numbers in the other two shapes, live. On a
                desk the column is sized off the same share of the screen as
                the frame, so it is never the taller of the two. */}
            <div className="flex shrink-0 items-start gap-4 [--side:min(132px,max(calc(40dvh-162px),64px))] md:w-[var(--side)] md:flex-col md:gap-5">
               {SIDE_FRAMES.map((side, index) => (
                  <div key={side.label} className="flex flex-col gap-2">
                     <span className="lab text-paper-2">{side.label}</span>
                     <span
                        style={{ aspectRatio: side.ratio }}
                        className="relative block w-[76px] overflow-hidden bg-black-block-2 max-md:[@media(max-height:760px)]:w-[60px] md:w-[var(--side)]"
                     >
                        {picture(index + 1, '')}
                     </span>
                  </div>
               ))}
               {/* What a finger can do, in the room the two small frames
                   leave beside them on a phone. The keys are no use there,
                   so they are said by the buttons, and only on a desk. */}
               <p className="hidden min-w-0 flex-1 self-center text-[13px] leading-snug text-balance text-paper-2 pointer-coarse:block md:flex-none md:self-auto">
                  Pinch to push in. Double tap to put it back.
               </p>
            </div>
         </div>

         <div className="flex items-center gap-4">
            <span id={zoomId} className="lab shrink-0 text-paper-2">
               Zoom
            </span>
            <RadixSlider.Root
               className="fader relative flex h-11 min-w-0 flex-1 touch-none items-center select-none"
               min={ZOOM_MIN}
               max={ZOOM_MAX}
               step={0.02}
               value={[view.zoom]}
               disabled={ratio === null}
               aria-labelledby={zoomId}
               onValueChange={([next]) => {
                  const rect = box();
                  if (!rect || ratio === null || typeof next !== 'number') {
                     return;
                  }
                  commitNow(zoomFraming(current.current, rect, ratio, next));
                  stir();
               }}
            >
               <RadixSlider.Track className="fader-track relative h-2 w-full grow bg-line-2">
                  <RadixSlider.Range className="absolute h-full bg-teal" />
               </RadixSlider.Track>
               <RadixSlider.Thumb
                  aria-valuetext={zoomText}
                  /* A 20px grip inside a 44px reach, as the distance fader. */
                  className="fader-grip relative block h-8 w-5 cursor-grab bg-ink outline-none before:absolute before:-inset-x-3 before:-inset-y-1.5 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal active:cursor-grabbing"
               >
                  <span
                     aria-hidden="true"
                     className="absolute top-1/2 left-1/2 block h-3.5 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-background"
                  />
               </RadixSlider.Thumb>
            </RadixSlider.Root>
            {/* For the eye only. The slider already says its value aloud,
                and an output is a live region that read out every step. */}
            <span
               aria-hidden="true"
               className="g num w-[52px] shrink-0 text-right text-[26px] leading-none text-paper"
            >
               {view.zoom.toFixed(1)}x
            </span>
         </div>

         <div className="flex items-center gap-3">
            <Button
               type="button"
               variant="ghost"
               className="-ml-3 px-3"
               disabled={atRest}
               onClick={() => {
                  easeTo(DEFAULT_FRAMING);
                  stageRef.current?.focus({ preventScroll: true });
               }}
            >
               Reset
            </Button>
            {/* What the keys do. Read aloud with the frame everywhere, shown
                only on a desk with a mouse, in the room between Reset and
                Cancel, where it adds nothing to the dialog's height. */}
            <p
               id={hintId}
               className="sr-only min-w-0 flex-1 text-[13px] leading-snug text-paper-2 md:pointer-fine:not-sr-only"
            >
               Arrow keys move it. Plus and minus push in and pull out. Zero
               puts it back.
            </p>
            <Button
               type="button"
               variant="outline"
               className="ml-auto"
               onClick={onCancel}
            >
               Cancel
            </Button>
            <Button
               type="button"
               onClick={() => onDone(framingPayload(current.current))}
            >
               Done
            </Button>
         </div>
      </div>
   );
}
