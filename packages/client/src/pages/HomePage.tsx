import { LandingPage } from '@/components/landing/LandingPage';
import { FeedPage } from '@/pages/fishing/FeedPage';
import { SignedIn, SignedOut } from '@/components/shell/Signed';

/** Signed out: the landing page. Signed in: the feed, never the marketing page. */
export function HomePage() {
   return (
      <>
         <SignedOut>
            <LandingPage />
         </SignedOut>
         <SignedIn>
            <FeedPage />
         </SignedIn>
      </>
   );
}
