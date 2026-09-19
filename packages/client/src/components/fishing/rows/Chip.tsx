import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * A filter chip: square, League Gothic, its count beside the word, and its state in
 * aria-pressed so it is announced. Pressed fills with ink, never with teal, because
 * teal belongs to the one action on the screen.
 */
export function Chip({
   pressed,
   onClick,
   count,
   children,
}: {
   pressed: boolean;
   onClick: () => void;
   count?: number;
   children: ReactNode;
}) {
   return (
      <button
         type="button"
         aria-pressed={pressed}
         onClick={onClick}
         className={cn(
            'g-tracked inline-flex h-11 items-center gap-2 border border-ink px-4 text-[19px] transition-[background-color,color,transform] duration-150 [transition-timing-function:var(--ease)] active:scale-[0.97]',
            pressed ? 'bg-ink text-background' : 'text-ink hover:bg-bg-2'
         )}
      >
         {children}
         {typeof count === 'number' ? (
            <span className="num text-[17px] opacity-70">({count})</span>
         ) : null}
      </button>
   );
}
