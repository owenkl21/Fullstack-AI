import { useEffect, useState } from 'react';
import { InlineError } from './InlineError';

const SUB_WIDTHS = ['w-3/5', 'w-4/5', 'w-2/3', 'w-3/4', 'w-1/2'];
const TITLE_WIDTHS = ['w-2/5', 'w-1/3', 'w-1/2', 'w-2/5', 'w-1/4'];

/*
 * The list before it arrives, at the geometry of the real rows so nothing moves when
 * it does. Static: no spinner, no shimmer, nothing that loops. After five seconds it
 * stops pretending and hands over the error and a way to try again.
 */
export function ListSkeleton({
   label,
   errorMessage,
   onRetry,
   rows = 5,
}: {
   label: string;
   errorMessage: string;
   onRetry: () => void;
   rows?: number;
}) {
   const [timedOut, setTimedOut] = useState(false);

   useEffect(() => {
      const timer = window.setTimeout(() => setTimedOut(true), 5000);
      return () => window.clearTimeout(timer);
   }, []);

   if (timedOut) {
      return <InlineError message={errorMessage} onRetry={onRetry} />;
   }

   return (
      <div role="status" className="flex flex-col">
         {Array.from({ length: rows }).map((_, index) => (
            <div
               key={index}
               className="-mx-2 grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-line px-2 py-3"
            >
               <span className="size-[52px] shrink-0 bg-bg-2" />
               <span className="flex min-w-0 flex-col gap-2">
                  <span
                     className={`block h-[21px] bg-bg-2 ${TITLE_WIDTHS[index % TITLE_WIDTHS.length]}`}
                  />
                  <span
                     className={`block h-[14px] bg-bg-2 ${SUB_WIDTHS[index % SUB_WIDTHS.length]}`}
                  />
               </span>
               <span className="block h-[23px] w-16 bg-bg-2" />
            </div>
         ))}
         <span className="sr-only">{label}</span>
      </div>
   );
}
