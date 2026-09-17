import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/*
 * The waterline between a photograph and the section under it.
 *
 * Three bands of water, redrawn every frame.
 *
 * The first version slid a fixed shape sideways, and sliding a fixed shape is
 * exactly what water does not do: the silhouette never changed, so it read as a
 * printed wave on a conveyor belt. A wave is a travelling disturbance, so the
 * curve itself has to change shape as it goes.
 *
 * Each band is a sum of three sine waves at unrelated wavelengths, whose phases
 * advance at different rates. Because the rates do not divide into each other
 * the crests drift in and out of alignment and the surface never repeats, which
 * is what stops it looking mechanical. GSAP drives it from a single ticker, so
 * three bands on a page cost one callback a frame rather than three timers, and
 * it respects the browser being backgrounded.
 */

type Fill = 'bg' | 'bg-2' | 'black';

type Band = {
   /* Wavelength, amplitude and speed per component. */
   waves: { length: number; amp: number; speed: number; phase: number }[];
   lift: number;
   fill: string;
};

const WIDTH = 1600;
const HEIGHT = 90;
/* Points along the curve. Sixty is smooth at this width and cheap to rebuild. */
const STEPS = 60;

function build(band: Band, t: number) {
   const points: string[] = [];

   for (let i = 0; i <= STEPS; i++) {
      const x = (i / STEPS) * WIDTH;
      let y = HEIGHT - band.lift;

      for (const wave of band.waves) {
         y -=
            Math.sin(
               (x / wave.length + t * wave.speed + wave.phase) * Math.PI * 2
            ) * wave.amp;
      }

      points.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
   }

   /* Down the right, across the bottom, up the left: the band is a solid. */
   return `M${points.join(' L')} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`;
}

export function TornEdge({
   fill = 'bg',
   flip = false,
   seed = 1,
   className,
}: {
   fill?: Fill;
   flip?: boolean;
   seed?: number;
   className?: string;
}) {
   const host = useRef<HTMLDivElement>(null);
   const theme = useTheme();

   useEffect(() => {
      const el = host.current;
      if (!el) return;

      const cs = getComputedStyle(document.documentElement);
      const varName =
         fill === 'black' ? '--black' : fill === 'bg-2' ? '--bg-2' : '--bg';
      const ground = cs.getPropertyValue(varName).trim() || '#ffffff';

      /*
       * Wavelengths deliberately not multiples of each other, so the three
       * components never line up the same way twice. The back band is slower
       * and taller, the front one quicker and shallower, which is the parallax
       * that gives the edge depth.
       */
      const bands: Band[] = [
         {
            lift: 16,
            fill: 'rgba(244,241,236,0.30)',
            waves: [
               { length: 760, amp: 13, speed: 0.021, phase: seed * 0.13 },
               { length: 430, amp: 7, speed: -0.034, phase: seed * 0.41 },
               { length: 237, amp: 3.5, speed: 0.052, phase: seed * 0.77 },
            ],
         },
         {
            lift: 8,
            fill: 'rgba(244,241,236,0.45)',
            waves: [
               { length: 610, amp: 11, speed: -0.028, phase: seed * 0.29 },
               { length: 347, amp: 6, speed: 0.045, phase: seed * 0.61 },
               { length: 193, amp: 3, speed: -0.068, phase: seed * 0.19 },
            ],
         },
         {
            lift: 0,
            fill: ground,
            waves: [
               { length: 520, amp: 10, speed: 0.037, phase: seed * 0.53 },
               { length: 281, amp: 5.5, speed: -0.057, phase: seed * 0.83 },
               { length: 157, amp: 2.5, speed: 0.081, phase: seed * 0.31 },
            ],
         },
      ];

      el.innerHTML =
         `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" aria-hidden="true">` +
         bands.map((b) => `<path fill="${b.fill}"/>`).join('') +
         `</svg>`;

      const paths = Array.from(el.querySelectorAll('path'));

      /* Somebody who asked for stillness gets one frame and no ticker. */
      const still = window.matchMedia('(prefers-reduced-motion: reduce)');
      const draw = (t: number) =>
         paths.forEach((path, i) => {
            const band = bands[i];
            if (band) path.setAttribute('d', build(band, t));
         });

      if (still.matches) {
         draw(0);
         return () => {
            el.innerHTML = '';
         };
      }

      const state = { t: 0 };
      /*
       * One tween running forever rather than a per frame clock, so GSAP owns
       * the timing: it pauses with the tab and picks up without a jump.
       */
      const tween = gsap.to(state, {
         t: 1000,
         duration: 1000,
         ease: 'none',
         repeat: -1,
         onUpdate: () => draw(state.t),
      });

      return () => {
         tween.kill();
         el.innerHTML = '';
      };
   }, [fill, seed, theme]);

   return (
      <div
         ref={host}
         aria-hidden="true"
         className={cn(
            'torn',
            flip && 'top-[-2px] bottom-auto -scale-y-100',
            className
         )}
      />
   );
}
