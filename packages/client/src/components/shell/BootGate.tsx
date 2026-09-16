import { useEffect, useState, type ReactNode } from 'react';

/*
 * Holds the first paint until the page is actually ready to be looked at.
 *
 * Without this the landing page assembles in front of you: the fonts swap, the
 * hero photograph fades in late and the headline jumps as League Gothic
 * replaces the fallback. Waiting a moment and arriving composed reads as
 * deliberate; arriving in pieces reads as broken.
 *
 * It waits for the fonts and the largest image, with a ceiling so a slow or
 * failed asset can never hold the page hostage.
 */

const CEILING_MS = 2500;

export function BootGate({ children }: { children: ReactNode }) {
   const [ready, setReady] = useState(false);

   useEffect(() => {
      let done = false;

      const finish = () => {
         if (done) {
            return;
         }

         done = true;
         setReady(true);
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
               aria-label="Loading"
               className="fixed inset-0 z-[9999] grid place-items-center bg-background"
            >
               {/*
                * The wordmark rather than a spinner, because the house rule is
                * no spinners, and because the first thing you should see is
                * whose app this is.
                */}
               <span className="g text-[32px] tracking-[0.06em] text-ink-3">
                  Name
               </span>
            </div>
         )}
      </>
   );
}
