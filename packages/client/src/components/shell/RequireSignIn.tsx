import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { SignedIn, SignedOut } from '@/components/shell/Signed';
import { Link } from 'react-router-dom';

/*
 * Gate for private pages. Signed out, the page keeps its chrome and shows one
 * sentence and the sign-in control instead of a blank page behind an error toast.
 */
export function RequireSignIn({
   children,
   what = 'this page',
}: {
   children: ReactNode;
   what?: string;
}) {
   return (
      <>
         <SignedIn>{children}</SignedIn>
         <SignedOut>
            <section className="mx-auto w-[min(720px,100%-32px)] py-16">
               <h1 className="g text-[44px]">Sign in</h1>
               <p className="mt-3 max-w-[48ch] text-ink-2">
                  Sign in to see {what}. Nothing you have entered is lost.
               </p>
               <Button className="mt-6" size="lg" asChild>
                  <Link to="/sign-in">Sign in</Link>
               </Button>
            </section>
         </SignedOut>
      </>
   );
}
