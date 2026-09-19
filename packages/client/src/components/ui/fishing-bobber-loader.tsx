import { cn } from '@/lib/utils';

/*
 * The bobber is gone. This keeps the old import working as a static, content-shaped
 * skeleton until each page gets its own. No spinner, no shimmer, no float.
 */
export function FishingBobberLoader({
   label = 'Loading',
   className,
   rows = 3,
   compact = false,
}: {
   label?: string;
   className?: string;
   rows?: number;
   compact?: boolean;
}) {
   return (
      <div
         role="status"
         aria-label={label}
         className={cn('flex flex-col', className)}
      >
         {Array.from({ length: compact ? 1 : rows }).map((_, i) => (
            <div
               key={i}
               className="flex items-center gap-3 border-t border-line px-4 py-3"
            >
               <div className="size-[52px] shrink-0 bg-bg-2" />
               <div className="flex flex-1 flex-col gap-2">
                  <div className="h-5 w-2/5 bg-bg-2" />
                  <div className="h-4 w-4/5 bg-bg-2" />
               </div>
            </div>
         ))}
         <span className="sr-only">{label}</span>
      </div>
   );
}
