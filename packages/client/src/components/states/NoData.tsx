import type { ComponentType, ReactNode, SVGProps } from 'react';
import { FishMark } from '@/components/brand/FishMark';
import { cn } from '@/lib/utils';

/*
 * A list with nothing in it says so, with a mark, rather than leaving a
 * gap that reads as something failing to load. The fish is the default
 * mark; a list of other things brings its own.
 */
export function NoData({
   icon: Icon,
   title = 'Nothing here yet',
   children,
   className,
   compact = false,
}: {
   icon?: ComponentType<SVGProps<SVGSVGElement>>;
   title?: string;
   children?: ReactNode;
   className?: string;
   compact?: boolean;
}) {
   return (
      <div
         role="status"
         className={cn(
            'flex flex-col items-start gap-2 border border-dashed border-line',
            compact ? 'px-4 py-4' : 'px-5 py-6',
            className
         )}
      >
         {Icon ? (
            <Icon
               aria-hidden="true"
               className="size-7 text-ink-3"
               strokeWidth={1.5}
            />
         ) : (
            <FishMark className="h-7 w-11 text-ink-3" />
         )}
         <p className="g-tracked text-[19px] text-ink">{title}</p>
         {children ? (
            <p className="max-w-[52ch] text-[15px] text-ink-2">{children}</p>
         ) : null}
      </div>
   );
}
