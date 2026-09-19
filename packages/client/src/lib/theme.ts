import { useEffect, useState } from 'react';

export type Theme = 'day' | 'night';

const KEY = 'theme';

function systemTheme(): Theme {
   return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'night'
      : 'day';
}

export function getTheme(): Theme {
   const stamped = document.documentElement.dataset.theme;
   return stamped === 'night' || stamped === 'day' ? stamped : systemTheme();
}

export function setTheme(theme: Theme) {
   document.documentElement.dataset.theme = theme;
   try {
      localStorage.setItem(KEY, theme);
   } catch {
      /* storage may be unavailable; the stamp still applies for this load */
   }
   window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

export function toggleTheme(): Theme {
   const next: Theme = getTheme() === 'night' ? 'day' : 'night';
   setTheme(next);
   return next;
}

/** Follows the stamped theme, including the system switching while no choice is saved. */
export function useTheme(): Theme {
   const [theme, set] = useState<Theme>(() => getTheme());
   useEffect(() => {
      const onChange = () => set(getTheme());
      window.addEventListener('themechange', onChange);
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onSystem = () => {
         let saved: string | null = null;
         try {
            saved = localStorage.getItem(KEY);
         } catch {
            saved = null;
         }
         if (saved !== 'day' && saved !== 'night') {
            document.documentElement.dataset.theme = systemTheme();
            set(systemTheme());
         }
      };
      mq.addEventListener('change', onSystem);
      return () => {
         window.removeEventListener('themechange', onChange);
         mq.removeEventListener('change', onSystem);
      };
   }, []);
   return theme;
}
