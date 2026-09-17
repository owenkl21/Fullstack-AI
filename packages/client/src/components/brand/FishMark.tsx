import { cn } from '@/lib/utils';

/*
 * The house fish, lifted out of the wordmark so everything that needs a mark
 * uses the same one.
 *
 * It exists mostly to stand in for a photograph that was never taken. An empty
 * grey square reads as an image that failed to load; a drawn fish reads as a
 * catch nobody photographed, which is what it actually is.
 */
export function FishMark({ className }: { className?: string }) {
   return (
      <svg
         viewBox="0 0 68 44"
         fill="none"
         stroke="currentColor"
         strokeWidth="2.2"
         strokeLinecap="round"
         strokeLinejoin="round"
         aria-hidden="true"
         className={cn('h-[22px] w-[34px]', className)}
      >
         <path d="M2 30c10-14 24-20 40-16 8 2 14 6 24 6-8 6-16 8-24 8-16 0-30-4-40 2Z" />
         <path d="M44 14c-4-6-10-8-16-8 4 4 8 6 14 6M22 24c4 4 8 4 12 2" />
      </svg>
   );
}

/**
 * The square that sits where a photograph would have been.
 *
 * Deliberately dark with a teal foot, the same treatment the season strip uses,
 * so a log with no photographs still looks composed rather than broken.
 */
export function NoPhoto({ className }: { className?: string }) {
   return (
      <span
         aria-hidden="true"
         className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden bg-ink/85',
            className
         )}
      >
         <FishMark className="h-[14px] w-[22px] text-paper/35" />
         <span className="absolute inset-x-0 bottom-0 h-1 bg-teal" />
      </span>
   );
}
