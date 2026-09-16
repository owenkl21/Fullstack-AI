import type { ReactNode } from 'react';
import { useSession } from '@/lib/auth-client';

/*
 * What <Show when="signed-in"> used to do, in our own terms, so the eleven call
 * sites stay one line each.
 *
 * While the session is still being fetched neither branch renders. Showing the
 * signed-out state first and swapping it a moment later is worse than showing
 * nothing: it flashes "Sign in" at someone who is already signed in.
 */

export function SignedIn({ children }: { children: ReactNode }) {
   const { data, isPending } = useSession();

   if (isPending || !data) {
      return null;
   }

   return <>{children}</>;
}

export function SignedOut({ children }: { children: ReactNode }) {
   const { data, isPending } = useSession();

   if (isPending || data) {
      return null;
   }

   return <>{children}</>;
}
