import { useRef } from 'react';
import { useRevealIn } from '@/components/brand/Reveal';
import { useDocumentTitle } from '@/lib/title';
import { LandingBoards } from './LandingBoards';
import { LandingFooter } from './LandingFooter';
import { LandingForecast } from './LandingForecast';
import { LandingHero } from './LandingHero';
import { LandingInsights } from './LandingInsights';
import { LandingJoin } from './LandingJoin';
import { LandingMap } from './LandingMap';
import { LandingRecord } from './LandingRecord';

/*
 * The signed-out page. The black header and the phone bar come from the app
 * shell, so this renders the bands only.
 *
 * The order walks the app the way an angler meets it: the promise with the app
 * running beside it, the forecast you read before you drive, the map you stand
 * on, the fish you photograph, what the log counts back to you, the boards, and
 * then the signup.
 *
 * The grounds alternate black, white, black, off white, white, off white, teal.
 * A waterline only goes where a black plate meets paper, which is the hero into
 * the forecast and either side of the map. Two light grounds meeting need no
 * edge at all, and drawing one there would be decoration.
 */
export function LandingPage() {
   useDocumentTitle();
   const root = useRef<HTMLDivElement>(null);
   useRevealIn(root);

   return (
      <div ref={root} className="bg-background text-foreground">
         <LandingHero />
         <LandingForecast />
         <LandingMap />
         <LandingRecord />
         <LandingInsights />
         <LandingBoards />
         <LandingJoin />
         <LandingFooter />
      </div>
   );
}
