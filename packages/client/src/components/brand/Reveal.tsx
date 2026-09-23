import { useEffect, type RefObject } from 'react';

/*
 * Reveal on scroll: any element with class `rv` inside `root` gets `in` when it
 * enters the viewport (elements already in view reveal at once). Stagger siblings
 * with `style={{ '--i': n }}`.
 */
export function useRevealIn(root: RefObject<HTMLElement | null>) {
   useEffect(() => {
      const el = root.current;
      if (!el) return;
      const targets = Array.from(el.querySelectorAll<HTMLElement>('.rv'));
      if (!targets.length) return;
      const io = new IntersectionObserver(
         (entries) => {
            entries.forEach((e) => {
               if (e.isIntersecting) {
                  e.target.classList.add('in');
                  io.unobserve(e.target);
               }
            });
         },
         { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
      );
      targets.forEach((t) => io.observe(t));
      return () => io.disconnect();
   }, [root]);
}
