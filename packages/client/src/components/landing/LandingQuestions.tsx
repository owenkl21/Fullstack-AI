import {
   Accordion,
   AccordionContent,
   AccordionItem,
   AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { ANCHOR, WRAP, stagger } from './layout';

/*
 * The four things people ask, answered short.
 *
 * Two of the app's best parts had no mention anywhere on this page: that the
 * namer learns from a correction, and that there are boards to enter. Neither
 * earns a band of its own, and the page was already too long, so they sit here
 * where someone looking for them will look.
 *
 * No wave and no ground of its own: it continues the record's band, so the
 * waterline above it still reads as one edge rather than two.
 */
const questions = [
   {
      q: 'Does it know South African fish?',
      a: 'It reads 866 species and answers in the names used here rather than the Latin: elf, garrick, galjoen, kob, steenbras. When it gets one wrong and you put the right name in, it keeps your correction and comes back closer on the next fish of that kind.',
   },
   {
      q: 'Can anyone else see my spots?',
      a: 'Only if you say so. A catch is private until you post it, and a spot can be exact for you, blurred to about a kilometre for everyone else, or kept off the map entirely. A mark you worked for stays yours.',
   },
   {
      q: 'How do competitions work?',
      a: 'Enter from the competition or straight from the log. Two photographs go up, one of the fish and one of it on the tape or the scale, and the figure is read off the second. Clean entries land on the board. Anything that does not add up is held for a person to look at rather than counted.',
   },
   {
      q: 'What does it cost?',
      a: 'Nothing. It is a log for one coast, built by someone who fishes it, and there is no plan to sell it or your catches.',
   },
];

export function LandingQuestions() {
   return (
      <section
         id="questions"
         className={cn('relative bg-bg-2 pb-16 md:pb-24', ANCHOR)}
      >
         <div className={cn(WRAP, 'relative')}>
            <div className="grid gap-7 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-16">
               <h2
                  className="g rv self-start text-[clamp(40px,5vw,64px)] md:sticky md:top-[84px]"
                  style={stagger(0)}
               >
                  Questions
               </h2>

               <Accordion
                  type="single"
                  collapsible
                  className="rv"
                  style={stagger(1)}
               >
                  {questions.map((item) => (
                     <AccordionItem key={item.q} value={item.q}>
                        <AccordionTrigger>{item.q}</AccordionTrigger>
                        <AccordionContent>{item.a}</AccordionContent>
                     </AccordionItem>
                  ))}
               </Accordion>
            </div>
         </div>
      </section>
   );
}
