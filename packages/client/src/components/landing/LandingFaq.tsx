import { HelpCircle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const faqs = [
   {
      question: 'Can we swap in real illustrations later?',
      answer:
         'Yes. We added dedicated placeholder blocks with clear sizing intent so design assets can drop in with minimal refactoring.',
   },
   {
      question: 'Does this visual design support both dark and light mode?',
      answer:
         'It does. The page now uses semantic tokens, soft gradients, and contrast-safe cards that adapt to the selected mode.',
   },
   {
      question: 'Is the layout still easy to scale?',
      answer:
         'Absolutely. Sections are modular and can be extended with testimonials, pricing, docs links, or release notes.',
   },
];

export function LandingFaq() {
   return (
      <section
         id="faq"
         className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8"
      >
         <div className="mb-8 text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
               <HelpCircle className="size-3.5" />
               FAQ
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
               Frequently asked questions
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
               Built to feel like a polished SaaS landing page while staying
               consistent with your existing component stack.
            </p>
         </div>

         <div className="grid gap-4">
            {faqs.map((faq) => (
               <Card key={faq.question} className="border-primary/15">
                  <CardHeader>
                     <CardTitle className="text-lg">{faq.question}</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <p className="text-sm leading-6 text-muted-foreground">
                        {faq.answer}
                     </p>
                  </CardContent>
               </Card>
            ))}
         </div>
      </section>
   );
}
