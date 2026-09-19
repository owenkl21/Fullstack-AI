import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * The rules of a competition as a table: a tracked label in its own column
 * and the answer beside it, one hairline to a row.
 *
 * The same object appears twice. It is the last thing an organiser reads
 * before starting a competition, in three groups of two, and the first thing
 * anybody reads on the competition itself, as five rows. Writing it once is
 * what makes those two the same promise.
 */
export type Rule = { label: string; value: ReactNode };

export function RulesTable({
   rows,
   /* Pinned to the phone's measurements: the last look, inside a card. */
   compact = false,
   className,
}: {
   rows: Rule[];
   compact?: boolean;
   className?: string;
}) {
   return (
      <dl className={cn('flex flex-col', className)}>
         {rows.map((row) => (
            <div
               key={row.label}
               className={cn(
                  'grid grid-cols-[96px_1fr] items-baseline gap-3 border-b border-line',
                  compact
                     ? 'py-[9px]'
                     : 'py-2.5 lg:grid-cols-[110px_1fr] lg:gap-4 lg:py-3'
               )}
            >
               <dt className="lab leading-[1.4]">{row.label}</dt>
               <dd
                  className={cn(
                     'min-w-0 text-[15px] leading-[1.45]',
                     !compact && 'lg:text-[16px]'
                  )}
               >
                  {row.value}
               </dd>
            </div>
         ))}
      </dl>
   );
}
