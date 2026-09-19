import { Contours } from '@/components/brand/Contours';
import { cn } from '@/lib/utils';
import { WRAP } from './layout';
import { FishMark } from '@/components/brand/FishMark';

const columns = [
   [
      { href: '#how', label: 'How it logs' },
      { href: '#keeps', label: 'What it keeps' },
   ],
   [
      { href: '#record', label: 'The record' },
      { href: '#join', label: 'Join' },
   ],
];

/* Black, with the contour art drawn faintly behind it and the columns cut off by the
 * dashed teal line. */
export function LandingFooter() {
   return (
      <footer className="relative overflow-hidden bg-black-block pt-14 pb-10 text-paper-2">
         <Contours
            seed={2}
            width={760}
            height={460}
            className="top-[-20%] right-[-6%] h-[140%] w-[64%] [&_path]:stroke-paper/15"
         />

         <div
            className={cn(
               WRAP,
               'relative grid items-start gap-10 md:grid-cols-[1fr_auto]'
            )}
         >
            <div>
               <FishMark className="h-[30px] w-[46px] text-paper" />
               <p className="mt-3 max-w-[36ch] text-[14px]">
                  A fishing log for the South African coast and its dams. Sample
                  data and Unsplash photographs on this page.
               </p>
            </div>

            <nav
               aria-label="This page"
               className="flex gap-12 md:border-l md:border-dashed md:border-teal md:pl-8"
            >
               {columns.map((column, i) => (
                  <div key={i} className="flex flex-col">
                     {column.map((link) => (
                        <a
                           key={link.href}
                           href={link.href}
                           className="g-tracked flex h-11 items-center text-[20px] text-paper transition-colors hover:text-teal"
                        >
                           {link.label}
                        </a>
                     ))}
                  </div>
               ))}
            </nav>
         </div>
      </footer>
   );
}
