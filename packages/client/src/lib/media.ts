import { useEffect, useState } from 'react';

/* True while the viewport matches. The phone layouts key off this. */
export function useMediaQuery(query: string) {
   const [matches, setMatches] = useState(() =>
      typeof window === 'undefined' ? false : window.matchMedia(query).matches
   );
   useEffect(() => {
      const mq = window.matchMedia(query);
      const onChange = () => setMatches(mq.matches);
      onChange();
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
   }, [query]);
   return matches;
}

/* Under the md breakpoint: one column, thumbs, sheets instead of popovers. */
export const usePhone = () => useMediaQuery('(max-width: 767px)');
