import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/title';

export function NotFoundPage() {
   const { pathname } = useLocation();
   useDocumentTitle('Not here');
   const kind = pathname.startsWith('/catches')
      ? {
           what: 'That catch is not here.',
           to: '/catches/me',
           back: 'Go to my catches',
        }
      : pathname.startsWith('/sites')
        ? {
             what: 'That spot is not here.',
             to: '/sites/me',
             back: 'Go to my spots',
          }
        : pathname.startsWith('/gear')
          ? {
               what: 'That gear is not here.',
               to: '/gear/me',
               back: 'Go to my gear',
            }
          : {
               what: 'There is nothing at this address.',
               to: '/',
               back: 'Go home',
            };
   return (
      <section className="mx-auto w-[min(720px,100%-32px)] py-16">
         <h1 className="g text-[44px]">{kind.what}</h1>
         <p className="mt-3 text-ink-2">
            It may have been deleted, or the link was wrong.
         </p>
         <Button asChild variant="outline" className="mt-6">
            <Link to={kind.to}>{kind.back}</Link>
         </Button>
      </section>
   );
}
