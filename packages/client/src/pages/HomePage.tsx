import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingPage } from '@/components/landing/LandingPage';

export function HomePage() {
   return (
      <div className="scroll-smooth">
         <LandingPage />
         <section className="mx-auto w-full max-w-6xl px-4 pb-16">
            <FishingActionBar />
         </section>
      </div>
   );
}
