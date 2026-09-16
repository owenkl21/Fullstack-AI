import { Show } from '@clerk/react';
import { LandingPage } from '@/components/landing/LandingPage';
import { HomeNowPage } from '@/pages/fishing/HomeNowPage';

/** Signed out: the landing page. Signed in: the log, never the marketing page. */
export function HomePage() {
   return (
      <>
         <Show when="signed-out">
            <LandingPage />
         </Show>
         <Show when="signed-in">
            <HomeNowPage />
         </Show>
      </>
   );
}
