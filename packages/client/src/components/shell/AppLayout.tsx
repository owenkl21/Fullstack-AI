import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { BottomBar } from './BottomBar';

/*
 * One layout for every route: the black header, the page, the phone bottom bar.
 * Scroll resets and focus moves to the page heading on navigation.
 */
export function AppLayout() {
   const { pathname } = useLocation();
   useEffect(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      const h1 = document.querySelector<HTMLElement>('main h1');
      if (h1) {
         h1.setAttribute('tabindex', '-1');
         h1.focus({ preventScroll: true });
      }
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
            className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0"
         >
            <Outlet />
         </main>
         <BottomBar />
      </div>
   );
}
