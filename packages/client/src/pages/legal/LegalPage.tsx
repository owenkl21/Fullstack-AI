import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/lib/title';
import {
   CONTACT_EMAIL,
   LEGAL_UPDATED,
   privacyPolicy,
   terms,
   type LegalDoc,
} from './legal-content';

/*
 * The two legal pages, one layout.
 *
 * Read like the rest of the product rather than like a contract pasted in:
 * the display face for the headings, a measure a person can follow, and a
 * list of sections at the top so someone looking for one answer does not
 * have to read all of it to find it. Open to anyone, signed in or not, since
 * people are asked to agree to these before they have an account.
 */
function LegalDocument({
   doc,
   other,
}: {
   doc: LegalDoc;
   other: { to: string; label: string };
}) {
   useDocumentTitle(doc.title);

   return (
      <article className="mx-auto w-[min(760px,100%-32px)] py-10 md:py-16">
         <span className="lab lab-rule text-ink-2">
            Updated {LEGAL_UPDATED}
         </span>
         <h1 className="g mt-3 text-[clamp(44px,7vw,72px)]">{doc.title}</h1>
         <p className="mt-4 max-w-[60ch] text-[18px] text-ink-2 text-pretty">
            {doc.lead}
         </p>

         <nav aria-label="Sections" className="mt-8 border-y border-line py-4">
            <span className="lab text-ink-3">In this document</span>
            <ol className="mt-2 grid gap-x-8 sm:grid-cols-2">
               {doc.sections.map((section, i) => (
                  <li key={section.id}>
                     <a
                        href={`#${section.id}`}
                        className="flex min-h-11 items-center gap-3 text-[16px] text-ink hover:text-teal-text"
                     >
                        <span className="num w-6 text-ink-3">
                           {String(i + 1).padStart(2, '0')}
                        </span>
                        {section.heading}
                     </a>
                  </li>
               ))}
            </ol>
         </nav>

         {doc.sections.map((section, i) => (
            <section
               key={section.id}
               id={section.id}
               className="mt-10 scroll-mt-[76px]"
            >
               <h2 className="g flex items-baseline gap-3 text-[32px] md:text-[38px]">
                  <span className="num text-[0.7em] text-teal-text">
                     {String(i + 1).padStart(2, '0')}
                  </span>
                  {section.heading}
               </h2>
               <div className="mt-3 flex flex-col gap-3 text-[17px] leading-[1.65] text-ink-2">
                  {section.blocks.map((block, k) =>
                     typeof block === 'string' ? (
                        <p key={k} className="max-w-[66ch] text-pretty">
                           {block}
                        </p>
                     ) : (
                        <ul
                           key={k}
                           className="flex max-w-[66ch] flex-col gap-2"
                        >
                           {block.list.map((item) => (
                              <li key={item} className="flex gap-3">
                                 <span
                                    aria-hidden="true"
                                    className="mt-[0.7em] h-px w-3 flex-none bg-teal"
                                 />
                                 <span className="text-pretty">{item}</span>
                              </li>
                           ))}
                        </ul>
                     )
                  )}
               </div>
            </section>
         ))}

         <footer className="mt-14 flex flex-col gap-2 border-t border-line pt-6 text-[15px] text-ink-2">
            <p>
               Questions go to{' '}
               <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-teal-text underline-offset-4 hover:underline"
               >
                  {CONTACT_EMAIL}
               </a>
               .
            </p>
            <p>
               Read the{' '}
               <Link
                  to={other.to}
                  className="text-teal-text underline-offset-4 hover:underline"
               >
                  {other.label}
               </Link>{' '}
               as well.
            </p>
         </footer>
      </article>
   );
}

export function PrivacyPage() {
   return (
      <LegalDocument
         doc={privacyPolicy}
         other={{ to: '/terms', label: 'Terms and Conditions' }}
      />
   );
}

export function TermsPage() {
   return (
      <LegalDocument
         doc={terms}
         other={{ to: '/privacy', label: 'Privacy Policy' }}
      />
   );
}
