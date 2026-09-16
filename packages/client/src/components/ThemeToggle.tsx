import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { toggleTheme, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/** Sun and moon only. No "light" or "dark" wording anywhere. */
export function ThemeToggle({ className }: { className?: string }) {
   const theme = useTheme();
   const night = theme === 'night';
   return (
      <button
         type="button"
         onClick={() => toggleTheme()}
         aria-label={night ? 'Switch to day' : 'Switch to night'}
         className={cn(
            'inline-flex size-10 items-center justify-center rounded-full border border-paper/25 text-paper transition-colors hover:bg-paper/10',
            className
         )}
      >
         {night ? (
            <MoonIcon className="size-5" strokeWidth={1.5} />
         ) : (
            <SunIcon className="size-5" strokeWidth={1.5} />
         )}
      </button>
   );
}
