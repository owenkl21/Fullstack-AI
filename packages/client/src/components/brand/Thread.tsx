import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';

/*
 * The dashed teal fishing line that draws itself as the reader scrolls. Driven by a
 * CSS scroll-driven animation where the browser has it (the `.thread` class), with a
 * single frame-throttled fallback otherwise. Place it absolutely inside a section
 * that is `position: relative`; it stretches to the section's full height.
 */
export function Thread({ className }: { className?: string }) {
   const id = useId().replace(/:/g, '');
   const ref = useRef<HTMLDivElement>(null);

   useEffect(() => {
      const el = ref.current;
      if (!el) return;
      if (CSS.supports('animation-timeline: view()')) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
         el.style.setProperty('--draw', '0');
         return;
      }
      const section = el.parentElement ?? el;
      let ticking = false;
      const frame = () => {
         ticking = false;
         const r = section.getBoundingClientRect();
         const p = Math.min(
            1,
            Math.max(0, (window.innerHeight * 0.8 - r.top) / r.height)
         );
         el.style.setProperty('--draw', (1 - p).toFixed(3));
      };
      const onScroll = () => {
         if (!ticking) {
            ticking = true;
            requestAnimationFrame(frame);
         }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      frame();
      return () => {
         window.removeEventListener('scroll', onScroll);
         window.removeEventListener('resize', onScroll);
      };
   }, []);

   const d = 'M30 0 C 30 200, 12 300, 30 500 S 48 800, 30 1000';
   return (
      <div
         ref={ref}
         aria-hidden="true"
         className={cn(
            'thread pointer-events-none absolute top-0 bottom-0 z-[1] w-[60px]',
            className
         )}
      >
         <svg
            viewBox="0 0 60 1000"
            preserveAspectRatio="none"
            className="h-full w-full"
         >
            <defs>
               <mask id={`tm-${id}`}>
                  <path
                     className="thread-mask"
                     d={d}
                     fill="none"
                     stroke="#fff"
                     strokeWidth="6"
                     pathLength={1}
                     strokeDasharray="1"
                  />
               </mask>
            </defs>
            <path
               d={d}
               fill="none"
               stroke="#34ADBD"
               strokeWidth="3"
               strokeDasharray="12 10.5"
               mask={`url(#tm-${id})`}
            />
         </svg>
      </div>
   );
}
