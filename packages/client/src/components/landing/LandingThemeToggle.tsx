import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
   if (typeof window === 'undefined') {
      return 'light';
   }

   const savedTheme = window.localStorage.getItem('theme');
   if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
   }

   return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
}

export function LandingThemeToggle() {
   const [theme, setTheme] = useState<Theme>(getInitialTheme);

   useEffect(() => {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      window.localStorage.setItem('theme', theme);
   }, [theme]);

   const nextTheme = theme === 'dark' ? 'light' : 'dark';

   return (
      <Button
         type="button"
         variant="outline"
         size="icon"
         className="rounded-full border-primary/30 bg-background/80 shadow-sm backdrop-blur"
         aria-label={`Switch to ${nextTheme} mode`}
         onClick={() => setTheme(nextTheme)}
      >
         {theme === 'dark' ? (
            <Sun className="size-4 text-amber-300" />
         ) : (
            <Moon className="size-4 text-primary" />
         )}
      </Button>
   );
}
