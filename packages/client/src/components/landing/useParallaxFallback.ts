import { useEffect, type RefObject } from 'react';

/*
 * Photo bands drift slower than the page. Where the browser has scroll-driven
 * animations the `.parallax-hero` and `.parallax-band` classes do the whole job and
 * this hook does nothing. Where it does not, every registered band shares one
 * frame-throttled scroll listener for the page, and reduced motion skips it.
 */
type Band = { el: HTMLElement; factor: number };

const bands = new Set<Band>();
let listening = false;
let ticking = false;

function frame() {
   ticking = false;
   bands.forEach(({ el, factor }) => {
      const parent = el.parentElement;
      if (!parent) return;
      const r = parent.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const shift = (r.top - window.innerHeight / 2) * -factor;
      el.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
   });
}

function onScroll() {
   if (ticking) return;
   ticking = true;
   requestAnimationFrame(frame);
}

export function useParallaxFallback(
   ref: RefObject<HTMLElement | null>,
   factor: number
) {
   useEffect(() => {
      const el = ref.current;
      if (!el) return;
      if (CSS.supports('animation-timeline: view()')) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const band: Band = { el, factor };
      bands.add(band);
      if (!listening) {
         listening = true;
         window.addEventListener('scroll', onScroll, { passive: true });
         window.addEventListener('resize', onScroll);
      }
      onScroll();
      return () => {
         bands.delete(band);
         if (bands.size === 0 && listening) {
            listening = false;
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
         }
      };
   }, [ref, factor]);
}
