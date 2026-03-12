import { LandingFaq } from '@/components/landing/LandingFaq';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingHero } from '@/components/landing/LandingHero';

export function LandingPage() {
   return (
      <div className="min-h-screen bg-background text-foreground [background-image:radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_36%)]">
         <LandingHeader />
         <main>
            <LandingHero />
            <LandingFeatures />
            <LandingFaq />
         </main>
         <LandingFooter />
      </div>
   );
}
