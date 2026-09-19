import { useEffect, useState, type ReactNode } from 'react';
import { prefersReducedMotion } from '@/components/fishing/record/motion';

/*
 * Holds the first paint until the page is actually ready to be looked at.
 *
 * Without this the landing page assembles in front of you: the fonts swap, the
 * hero photograph fades in late and the headline jumps as League Gothic
 * replaces the fallback. Waiting a moment and arriving composed reads as
 * deliberate; arriving in pieces reads as broken.
 *
 * It waits for the fonts and the largest image, with a ceiling so a slow or
 * failed asset can never hold the page hostage, and a floor so the fish that
 * fills the wait is seen leaving the water rather than flashing past.
 */

const CEILING_MS = 2500;
const FLOOR_MS = 1600;

export function BootGate({ children }: { children: ReactNode }) {
   const [ready, setReady] = useState(false);

   useEffect(() => {
      const startedAt = Date.now();
      let done = false;
      let release: number | null = null;

      const finish = () => {
         if (done) {
            return;
         }
         done = true;
         /* Whatever finished the wait, the fish gets its moment first. */
         const owed = Math.max(0, FLOOR_MS - (Date.now() - startedAt));
         release = window.setTimeout(() => setReady(true), owed);
      };

      /* Never wait longer than this, whatever is still outstanding. */
      const ceiling = window.setTimeout(finish, CEILING_MS);

      const waits: Promise<unknown>[] = [];

      if (document.fonts?.ready) {
         waits.push(document.fonts.ready);
      }

      /*
       * Only images already in the document at this point, and only the ones
       * still loading. Anything added later is somebody else's problem.
       */
      const pending = [...document.images]
         .filter((img) => !img.complete)
         .slice(0, 6)
         .map(
            (img) =>
               new Promise<void>((resolve) => {
                  img.addEventListener('load', () => resolve(), { once: true });
                  img.addEventListener('error', () => resolve(), {
                     once: true,
                  });
               })
         );

      waits.push(...pending);

      Promise.all(waits).then(finish).catch(finish);

      return () => {
         window.clearTimeout(ceiling);
         if (release !== null) window.clearTimeout(release);
         done = true;
      };
   }, []);

   return (
      <>
         {/*
          * The page is mounted the whole time, just held back visually, so
          * images and fonts actually get a chance to load and nothing has to
          * mount twice.
          */}
         <div
            aria-hidden={!ready}
            className={
               ready
                  ? 'opacity-100 transition-opacity duration-500 [transition-timing-function:var(--ease)]'
                  : 'pointer-events-none opacity-0'
            }
         >
            {children}
         </div>

         {ready ? null : (
            <div
               role="status"
               aria-label="Loading Fishtagram"
               className="fixed inset-0 z-[9999] grid place-items-center bg-background"
            >
               <LeapingFish />
            </div>
         )}
      </>
   );
}

/*
 * Owen's bass leaving the water: a short monochrome clip on a white ground,
 * with the watermark scrubbed, the ground pushed to pure white and the frame
 * shrunk to 640 by ffmpeg.
 *
 * Three things keep it from reading as a square dropped on the page. The
 * clip's water runs to its own edges, so the frame is feathered on all four
 * sides and the ripples die away instead of being cut. The drawing is inked
 * in the accent rather than black: the frame is a teal ground the clip is
 * screened over, so white stays paper and every grey becomes a teal. And the
 * whole thing is multiplied onto the page, so its white is the page's white.
 * At night the clip is inverted and multiplied over the same teal, then
 * screened onto the dark, which draws the fish in light teal on the page's
 * own black. Anyone who asked for stillness gets the first frame.
 */
function LeapingFish() {
   const still = prefersReducedMotion();
   const clip =
      'block size-full mix-blend-screen dark:invert dark:mix-blend-multiply';
   return (
      <div
         className="size-[300px] bg-teal-text mix-blend-multiply md:size-[440px] dark:mix-blend-screen"
         style={{
            maskImage:
               'linear-gradient(to right, transparent, #000 14%, #000 86%, transparent), linear-gradient(to bottom, transparent, #000 10%, #000 84%, transparent)',
            maskComposite: 'intersect',
            WebkitMaskImage:
               'linear-gradient(to right, transparent, #000 14%, #000 86%, transparent), linear-gradient(to bottom, transparent, #000 10%, #000 84%, transparent)',
            WebkitMaskComposite: 'source-in',
         }}
      >
         {still ? (
            <img
               src="/brand/loader.jpg"
               alt=""
               width={640}
               height={640}
               className={clip}
            />
         ) : (
            <video
               className={clip}
               autoPlay
               muted
               playsInline
               loop
               poster="/brand/loader.jpg"
               aria-hidden="true"
            >
               <source src="/brand/loader.mp4" type="video/mp4" />
            </video>
         )}
      </div>
   );
}
