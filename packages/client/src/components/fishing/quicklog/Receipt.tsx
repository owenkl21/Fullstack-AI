import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatClock, formatCoords } from '@/components/fishing/record/format';
import type { Fix, FixStatus } from './useFix';

/*
 * The receipt: the clock stamped the moment the log was opened, the dashed teal
 * line drawing while the fix tightens, and the position once it is sharp enough to
 * mean anything.
 */
export function Receipt({
   stampedAt,
   status,
   fix,
   isSharp,
}: {
   stampedAt: Date;
   status: FixStatus;
   fix: Fix | null;
   isSharp: boolean;
}) {
   const [drawing, setDrawing] = useState(false);

   useEffect(() => {
      const timer = window.setTimeout(() => setDrawing(true), 300);
      return () => window.clearTimeout(timer);
   }, []);

   const position = (() => {
      if (isSharp && fix) {
         return formatCoords(fix.latitude, fix.longitude);
      }
      if (status === 'denied') {
         return 'No position recorded';
      }
      if (status === 'unsupported') {
         return 'This browser does not give a position';
      }
      if (status === 'waiting') {
         return 'Waiting for a fix';
      }
      return 'Getting a fix';
   })();

   return (
      <div
         aria-live="polite"
         className="flex flex-col gap-1.5 rule-dashed-left bg-bg-2 p-3.5 [border-left-width:3px]"
      >
         <span className="g num text-[40px] leading-none">
            {formatClock(stampedAt)}
         </span>
         <span className={cn('fixline', drawing && 'go')} aria-hidden="true" />
         <span className="num flex items-baseline justify-between gap-3 text-[15px]">
            <span className={cn(isSharp ? 'text-ink' : 'text-ink-3')}>
               {position}
            </span>
            {fix ? (
               <span
                  className={cn(
                     'min-w-14 text-right font-medium',
                     isSharp ? 'text-ink' : 'text-teal-text'
                  )}
               >
                  ±{Math.round(fix.accuracy)} m
               </span>
            ) : null}
         </span>
         <span className="text-[14px] text-ink-3">
            Stamped the moment you tapped Log.
         </span>
      </div>
   );
}
