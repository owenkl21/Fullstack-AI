import { cn } from '@/lib/utils';

type FishingBobberLoaderProps = {
   label?: string;
   className?: string;
   compact?: boolean;
};

export function FishingBobberLoader({
   label = 'Loading...',
   className,
   compact = false,
}: FishingBobberLoaderProps) {
   return (
      <div
         className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/20 p-4 text-muted-foreground',
            compact &&
               'inline-flex flex-row gap-2 border-none bg-transparent p-0',
            className
         )}
         role="status"
         aria-live="polite"
      >
         <div className="relative h-12 w-12">
            <div className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 rounded-full border border-red-200 bg-red-500 shadow-sm" />
            <div className="absolute left-1/2 top-4 h-3 w-0.5 -translate-x-1/2 rounded-full bg-slate-500" />
            <div className="absolute left-1/2 top-6 h-6 w-6 -translate-x-1/2 rounded-full border border-white/60 bg-white bobber-float" />
            <div className="absolute left-1/2 top-9 h-2 w-8 -translate-x-1/2 rounded-full bg-sky-400/50 blur-[1px] bobber-ripple" />
         </div>
         <p className="text-sm">{label}</p>
      </div>
   );
}
