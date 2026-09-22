import { type ReactNode, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';
import { lazyRoute } from '@/lib/lazy-route';

/* Split like a route: almost nobody ever sees it, and only once. */
const HandleStep = lazyRoute(() =>
   import('./HandleStep').then((m) => ({ default: m.HandleStep }))
);

/*
 * Pages a signed-in angler with no handle must still be able to reach. The
 * auth pages finish what they started, a confirmation link or a reset among
 * them, and Account is where they can change their address or sign out.
 */
const OPEN_PATHS = [
   '/sign-in',
   '/sign-up',
   '/verify-email',
   '/reset-password',
   '/forgot-password',
   '/account',
   /* What they agreed to at sign-up stays readable at any point. */
   '/privacy',
   '/terms',
];

const isOpen = (pathname: string) =>
   OPEN_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
   );

/*
 * Whoever is signed in and has no handle is asked for one before the page.
 *
 * In place of the page rather than a redirect to one, so the address they
 * opened is still the address once the handle is saved and there is no
 * "next" to carry or lose. The session already carries the handle, so the
 * decision costs no request. While the session is still being read the page
 * is shown as it would be anyway: holding every page for everyone to catch
 * the rare account without a handle would be the wrong way round.
 */
export function HandleGate({ children }: { children: ReactNode }) {
   const { pathname } = useLocation();
   const { data, isPending } = useSession();

   const needsHandle =
      !isPending &&
      Boolean(data?.user) &&
      !data?.user.username &&
      !isOpen(pathname);

   /*
    * Saving takes the step away with the focus still on its button, and the
    * address has not changed, so the layout's move to the heading never
    * runs. Without this the page arrives with focus on nothing, and a screen
    * reader is told nothing at all. The page is split like any other, so its
    * heading is waited for the way the layout waits for one.
    */
   const asked = useRef(false);
   useEffect(() => {
      if (needsHandle) {
         asked.current = true;
         return;
      }
      if (!asked.current) return;
      asked.current = false;

      const main = document.getElementById('main');
      if (!main) return;

      const take = () => {
         const h1 = main.querySelector<HTMLElement>('h1');
         if (!h1) return false;
         h1.setAttribute('tabindex', '-1');
         h1.style.outline = 'none';
         h1.focus({ preventScroll: true });
         return true;
      };

      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      if (take()) return;

      const observer = new MutationObserver(() => {
         if (take()) observer.disconnect();
      });
      observer.observe(main, { childList: true, subtree: true });
      const giveUp = window.setTimeout(() => observer.disconnect(), 5000);

      return () => {
         observer.disconnect();
         window.clearTimeout(giveUp);
      };
   }, [needsHandle]);

   return needsHandle ? <HandleStep /> : <>{children}</>;
}
