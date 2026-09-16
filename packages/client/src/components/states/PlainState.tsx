import type { ReactNode } from 'react';

/*
 * Every state that is not a list looks the same: a dashed teal rule down the left,
 * one sentence, and the way out. Empty, no match and a failed load all share it, so
 * they read as the same product speaking rather than three different screens.
 */
export function PlainState({
   sentence,
   role,
   children,
}: {
   sentence: string;
   role?: 'alert' | 'status';
   children?: ReactNode;
}) {
   return (
      <div role={role} className="rule-dashed-left py-2 pl-4">
         <p className="max-w-[46ch] text-ink">{sentence}</p>
         {children ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
               {children}
            </div>
         ) : null}
      </div>
   );
}
