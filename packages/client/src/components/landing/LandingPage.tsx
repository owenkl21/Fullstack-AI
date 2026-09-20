import { useRef } from 'react';
import { useRevealIn } from '@/components/brand/Reveal';
import { useDocumentTitle } from '@/lib/title';
import { LandingFooter } from './LandingFooter';
import { LandingHero } from './LandingHero';
import { LandingJoin } from './LandingJoin';
import { LandingKeeps } from './LandingKeeps';
import { LandingQuestions } from './LandingQuestions';
import { LandingRecord } from './LandingRecord';

/*
 * The signed-out page. The black header and the phone bar come from the app shell, so
 * this renders the sections only: the opening, which carries the promise and the
 * app running inside a phone, then what the log keeps, one record in full, the
 * four questions and the signup, then the footer.
 */
export function LandingPage() {
   useDocumentTitle();
   const root = useRef<HTMLDivElement>(null);
   useRevealIn(root);

   return (
      <div ref={root} className="bg-background text-foreground">
         <LandingHero />
         <LandingKeeps />
         <LandingRecord />
         <LandingQuestions />
         <LandingJoin />
         <LandingFooter />
      </div>
   );
}
