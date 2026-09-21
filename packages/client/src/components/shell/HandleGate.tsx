import type { ReactNode } from 'react';
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

   return needsHandle ? <HandleStep /> : <>{children}</>;
}
