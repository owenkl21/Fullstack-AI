import { useEffect, useRef } from 'react';

/*
 * The next page arrives when the reader nears the bottom of this one.
 *
 * An observer on a one pixel sentinel under the list, with a generous
 * margin, so the page after is already there by the time the last row
 * scrolls into view. A list that is shorter than the screen still reaches
 * for more, which a scroll listener would never notice.
 */
export function useLoadOnScroll(
   more: () => void,
   enabled: boolean
): React.RefObject<HTMLDivElement | null> {
   const sentinel = useRef<HTMLDivElement | null>(null);
   const latest = useRef(more);
   useEffect(() => {
      latest.current = more;
   }, [more]);

   useEffect(() => {
      const target = sentinel.current;
      if (!target || !enabled) return;
      const observer = new IntersectionObserver(
         (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
               latest.current();
            }
         },
         { rootMargin: '400px 0px' }
      );
      observer.observe(target);
      return () => observer.disconnect();
   }, [enabled]);

   return sentinel;
}
