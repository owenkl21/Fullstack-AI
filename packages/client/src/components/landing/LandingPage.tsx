import { useRef } from 'react';
import { useRevealIn } from '@/components/brand/Reveal';
import { useDocumentTitle } from '@/lib/title';
import { LandingFooter } from './LandingFooter';
import { LandingHero } from './LandingHero';
import { LandingHowItLogs } from './LandingHowItLogs';
import { LandingJoin } from './LandingJoin';
import { LandingKeeps } from './LandingKeeps';
import { LandingRecord } from './LandingRecord';

/*
 * The signed-out page. The black header and the phone bar come from the app shell, so
 * this renders the sections only: the hero, how a catch is logged with the app running
 * inside a phone, what the log keeps, one record in full, the signup and the footer.
 */
export function LandingPage() {
   useDocumentTitle();
   const root = useRef<HTMLDivElement>(null);
   useRevealIn(root);

   return (
      <div ref={root} className="bg-background text-foreground">
         <LandingHero />
         <LandingHowItLogs />
         <LandingKeeps />
         <LandingRecord />
         <LandingJoin />
         <LandingFooter />
      </div>
   );
}
