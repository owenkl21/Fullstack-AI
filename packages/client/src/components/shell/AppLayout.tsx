import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { FishingBobberLoader } from '@/components/ui/fishing-bobber-loader';
import { RouteBoundary, clearChunkReloadMark } from '@/lib/lazy-route';
import { cn } from '@/lib/utils';
import { AppHeader } from './AppHeader';
import { isTaskRoute } from './routes';
import { BottomBar } from './BottomBar';

/*
 * One layout for every route: the black header, the page, the phone bottom bar.
 * Scroll resets and focus moves to the page heading on navigation.
 */
export function AppLayout() {
   const { pathname } = useLocation();
   useEffect(() => {
      /* We got here, so whatever chunk was stale has been replaced. */
      clearChunkReloadMark();
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

      /*
       * Routes are split, so on navigation <main> may still hold the Suspense
       * fallback rather than the page. Looking for the heading right now would
       * find nothing, or find the fallback's, and focus would never reach the
       * page. Take it as soon as it appears instead, and give up rather than
       * observe forever if a page has no h1.
       */
      const focusHeading = (h1: HTMLElement) => {
         h1.setAttribute('tabindex', '-1');
         /*
          * Focus moves for screen readers and keyboard users. It should not
          * paint a ring: this focus was not asked for, and the browser cannot
          * tell the difference, so say so. :focus-visible still rings a real
          * keyboard focus.
          */
         h1.style.outline = 'none';
         h1.focus({ preventScroll: true });
      };

      const existing = document.querySelector<HTMLElement>('main h1');
      if (existing) {
         focusHeading(existing);
         return;
      }

      const main = document.getElementById('main');
      if (!main) {
         return;
      }

      const observer = new MutationObserver(() => {
         const h1 = main.querySelector<HTMLElement>('h1');
         if (h1) {
            observer.disconnect();
            focusHeading(h1);
         }
      });
      observer.observe(main, { childList: true, subtree: true });

      const giveUp = window.setTimeout(() => observer.disconnect(), 5000);

      return () => {
         observer.disconnect();
         window.clearTimeout(giveUp);
      };
   }, [pathname]);
   return (
      <div className="flex min-h-dvh flex-col">
         <a
            href="#main"
            className="g-tracked sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-teal focus:px-4 focus:py-2 focus:text-teal-ink"
         >
            Skip to content
         </a>
         <AppHeader />
         <main
            id="main"
            className={cn(
               'flex-1 md:pb-0',
               isTaskRoute(pathname)
                  ? 'pb-0'
                  : 'pb-[calc(64px+env(safe-area-inset-bottom))]'
            )}
         >
            {/*
             * The boundary is keyed on the path so a route that failed does not
             * keep its error state over the next navigation.
             */}
            <RouteBoundary key={pathname}>
               <Suspense
                  fallback={
                     <div className="mx-auto w-full max-w-3xl px-4 py-10">
                        <FishingBobberLoader label="Loading the page" />
                     </div>
                  }
               >
                  <Outlet />
               </Suspense>
            </RouteBoundary>
         </main>
         <BottomBar />
      </div>
   );
}
