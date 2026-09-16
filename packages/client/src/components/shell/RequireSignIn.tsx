import type { ReactNode } from 'react';
import { Show, SignInButton } from '@clerk/react';
import { Button } from '@/components/ui/button';

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
         <Show when="signed-in">{children}</Show>
         <Show when="signed-out">
            <section className="mx-auto w-[min(720px,100%-32px)] py-16">
               <h1 className="g text-[44px]">Sign in</h1>
               <p className="mt-3 max-w-[48ch] text-ink-2">
                  Sign in to see {what}. Nothing you have entered is lost.
               </p>
               <SignInButton mode="modal">
                  <Button className="mt-6" size="lg">
                     Sign in
                  </Button>
               </SignInButton>
            </section>
         </Show>
      </>
   );
}
