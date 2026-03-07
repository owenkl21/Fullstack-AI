import { Show } from '@clerk/react';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingHero } from '@/components/landing/LandingHero';
import { ProfileSettingsPanel } from '@/components/profile/ProfileSettingsPanel';

export function LandingPage() {
   return (
      <div className="min-h-screen bg-background text-foreground">
         <LandingHeader />
         <main>
            <LandingHero />
            <Show when="signed-in">
               <ProfileSettingsPanel />
            </Show>
            <LandingFeatures />
            <LandingFaq />
         </main>
         <LandingFooter />
      </div>
   );
}
