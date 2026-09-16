import { LandingPage } from '@/components/landing/LandingPage';
import { HomeNowPage } from '@/pages/fishing/HomeNowPage';
import { SignedIn, SignedOut } from '@/components/shell/Signed';

/** Signed out: the landing page. Signed in: the log, never the marketing page. */
export function HomePage() {
   return (
      <>
         <SignedOut>
            <LandingPage />
         </SignedOut>
         <SignedIn>
            <HomeNowPage />
         </SignedIn>
      </>
   );
}
