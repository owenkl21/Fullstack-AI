import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const faqs = [
   {
      question: 'When will the chatbot be available on the landing page?',
      answer:
         'For now, the landing experience is focused on product marketing and onboarding. Chat functionality will be introduced in a dedicated app flow soon.',
   },
   {
      question: 'Is this layout mobile friendly?',
      answer:
         'Yes. The page uses responsive spacing, typography, and stacked sections so it reads cleanly on phones, tablets, and desktop screens.',
   },
   {
      question: 'Can this structure scale as we add more pages?',
      answer:
         'Absolutely. The landing page is split into reusable sections and UI primitives, making it easy to add pricing, testimonials, or blog pages later.',
   },
];

export function LandingFaq() {
   return (
      <section
         id="faq"
         className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8"
      >
         <div className="mb-8 text-left">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
               Frequently asked questions
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
               Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque
               elementum feugiat sem, ac faucibus velit dapibus sed.
            </p>
         </div>

         <div className="grid gap-4">
            {faqs.map((faq) => (
               <Card key={faq.question}>
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
