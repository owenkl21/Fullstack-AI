import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * The rail of cells under the photograph. Each cell has a dashed teal rule above
 * it and fades up in turn as the record builds. A cell with nothing in it says so
 * in words rather than printing a dash or an invented zero.
 */
export function RecordRail({ children }: { children: ReactNode }) {
   return (
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 px-4 pt-5 md:grid-cols-4 md:gap-x-8 md:px-8">
         {children}
      </div>
   );
}

export function RecordCell({
   label,
   value,
   missing,
   note,
   built,
   delayMs = 0,
   size = 'big',
   wide = false,
   children,
}: {
   label: string;
   value?: ReactNode;
   missing?: string;
   note?: ReactNode;
   built: boolean;
   delayMs?: number;
   size?: 'big' | 'small';
   wide?: boolean;
   children?: ReactNode;
}) {
   return (
      <div
         style={{ transitionDelay: `${delayMs}ms` }}
         className={cn(
            'flex flex-col rule-dashed pt-2 transition-[opacity,transform] duration-500 [transition-timing-function:var(--ease)]',
            wide && 'col-span-2 md:col-span-4',
            built ? 'translate-y-0 opacity-100' : 'translate-y-2.5 opacity-0'
         )}
      >
         <span className="lab">{label}</span>
         {value ? (
            <span
               className={cn(
                  'g num mt-1 leading-[1.05]',
                  size === 'big' ? 'text-[32px]' : 'text-[22px]'
               )}
            >
               {value}
            </span>
         ) : missing ? (
            <span className="mt-1 text-[15px] text-ink-2">{missing}</span>
         ) : null}
         {note ? (
            <span className="mt-1 text-[14px] text-ink-3">{note}</span>
         ) : null}
         {children}
      </div>
   );
}
