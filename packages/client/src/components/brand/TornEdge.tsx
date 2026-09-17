import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/*
 * The waterline between a photograph and the section under it.
 *
 * Water, redrawn every frame by GSAP. Each line is a sum of three sine waves
 * at unrelated wavelengths whose phases advance at different rates, so the
 * crests drift in and out of alignment and the surface never repeats; a
 * second, much slower tween breathes the amplitude so the sea has a swell
 * under the chop rather than a fixed height.
 *
 * What is drawn depends on the mode. Painting the ground (`fill` is the next
 * section's colour) draws the region below each line. Cutting the plate
 * (`cut`) draws the plate above its own line and, under it, two translucent
 * wet strips between the plate's line and their own, a soft shadow the plate
 * throws on the water, and a thread of foam along the crest. Nothing in cut
 * mode is filled down to the bottom of the box, which is what used to end in
 * a ruled line across the section below.
 */

type Fill = 'bg' | 'bg-2' | 'black';

type Wave = { length: number; amp: number; speed: number; phase: number };

type Band = { waves: Wave[]; lift: number };

const WIDTH = 1600;
const HEIGHT = 120;
/* Points along the curve. Ninety is smooth at this width and cheap to rebuild. */
const STEPS = 90;

/* The y of each band at time t, with a breathing factor on the amplitude. */
function trace(band: Band, t: number, breath: number): number[] {
   const ys: number[] = [];
   for (let i = 0; i <= STEPS; i++) {
      const x = (i / STEPS) * WIDTH;
      let y = HEIGHT - band.lift;
      for (const wave of band.waves) {
         y -=
            Math.sin(
               (x / wave.length + t * wave.speed + wave.phase) * Math.PI * 2
            ) *
            wave.amp *
            breath;
      }
      ys.push(y);
   }
   return ys;
}

const xAt = (i: number) => ((i / STEPS) * WIDTH).toFixed(1);

/* The open line, left to right. */
const lineOf = (ys: number[]) =>
   ys.map((y, i) => `${i ? 'L' : 'M'}${xAt(i)} ${y.toFixed(1)}`).join('');

/*
 * Closed well past the box rather than on its edge. A path that ends exactly
 * on the box boundary is anti-aliased there and draws a one pixel seam
 * between the plate and the section it belongs to; the SVG lets its
 * contents overflow, so the closing edge can sit where nothing shows it.
 */
const PAST = 40;

/* Closed below the box: the next section's ground. */
const below = (ys: number[]) =>
   `${lineOf(ys)} L${WIDTH} ${HEIGHT + PAST} L0 ${HEIGHT + PAST} Z`;

/* Closed above the box: the plate being cut. */
const above = (ys: number[]) =>
   `${lineOf(ys)} L${WIDTH} ${-PAST} L0 ${-PAST} Z`;

/* The region between two lines: a wet strip under the plate. */
const between = (top: number[], bottom: number[]) =>
   `${lineOf(top)} ${bottom
      .map((y, i) => `L${xAt(bottom.length - 1 - i)} ${y.toFixed(1)}`)
      .reverse()
      .join('')} Z`;

export function TornEdge({
   fill = 'bg',
   flip = false,
   seed = 1,
   cut = false,
   className,
}: {
   fill?: Fill;
   flip?: boolean;
   seed?: number;
   /*
    * Cut the plate rather than paint the ground. `fill` then names the plate,
    * not the ground, and the section under it shows through the troughs.
    */
   cut?: boolean;
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
       * components never line up the same way twice. The back line is slower
       * and taller, the front one quicker and shallower: the parallax that
       * gives the edge depth.
       */
      const bands: Band[] = [
         {
            lift: 26,
            waves: [
               { length: 760, amp: 19, speed: 0.036, phase: seed * 0.13 },
               { length: 430, amp: 10, speed: -0.058, phase: seed * 0.41 },
               { length: 237, amp: 5, speed: 0.088, phase: seed * 0.77 },
            ],
         },
         {
            lift: 13,
            waves: [
               { length: 610, amp: 16, speed: -0.048, phase: seed * 0.29 },
               { length: 347, amp: 9, speed: 0.076, phase: seed * 0.61 },
               { length: 193, amp: 4.5, speed: -0.115, phase: seed * 0.19 },
            ],
         },
         {
            lift: 0,
            waves: [
               { length: 520, amp: 15, speed: 0.063, phase: seed * 0.53 },
               { length: 281, amp: 8, speed: -0.097, phase: seed * 0.83 },
               { length: 157, amp: 3.5, speed: 0.138, phase: seed * 0.31 },
            ],
         },
      ];

      const id = `torn-${seed}-${cut ? 'cut' : 'ground'}`;
      const paper = 'rgba(244,241,236,';

      el.innerHTML = cut
         ? `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" aria-hidden="true" overflow="visible">` +
           `<defs>` +
           `<filter id="${id}-blur" x="-5%" y="-40%" width="110%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>` +
           `<filter id="${id}-soft" x="-5%" y="-40%" width="110%" height="200%"><feGaussianBlur stdDeviation="1.2"/></filter>` +
           `</defs>` +
           /* the shadow the plate throws on the water */
           `<path data-role="shadow" fill="rgba(0,0,0,0.42)" filter="url(#${id}-blur)"/>` +
           /* two wet strips, the far one fainter */
           `<path data-role="strip0" fill="${paper}0.22)"/>` +
           `<path data-role="strip1" fill="${paper}0.40)"/>` +
           /* the plate */
           `<path data-role="plate" fill="${ground}"/>` +
           /* foam along the crest */
           `<path data-role="foam" fill="none" stroke="${paper}0.55)" stroke-width="2" stroke-linecap="round" filter="url(#${id}-soft)"/>` +
           `</svg>`
         : `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" aria-hidden="true">` +
           `<path data-role="band0" fill="${paper}0.30)"/>` +
           `<path data-role="band1" fill="${paper}0.45)"/>` +
           `<path data-role="band2" fill="${ground}"/>` +
           `</svg>`;

      const path = (role: string) =>
         el.querySelector<SVGPathElement>(`path[data-role="${role}"]`);
      const set = (role: string, d: string) => path(role)?.setAttribute('d', d);

      const state = { t: 0, breath: 1 };

      const draw = () => {
         const ys = bands.map((band) => trace(band, state.t, state.breath));
         if (cut) {
            const plate = ys[2]!;
            /* The shadow sits a little below the plate's own line. */
            set('shadow', above(plate.map((y) => y + 9)));
            set('strip0', between(plate, ys[0]!));
            set('strip1', between(plate, ys[1]!));
            set('plate', above(plate));
            set('foam', lineOf(plate));
         } else {
            set('band0', below(ys[0]!));
            set('band1', below(ys[1]!));
            set('band2', below(ys[2]!));
         }
      };

      /* Somebody who asked for stillness gets one frame and no ticker. */
      const still = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (still.matches) {
         draw();
         return () => {
            el.innerHTML = '';
         };
      }

      /*
       * One tween running forever rather than a per frame clock, so GSAP owns
       * the timing: it pauses with the tab and picks up without a jump. The
       * second tween is the swell: the whole surface rises and settles over
       * about nine seconds.
       */
      const run = gsap.to(state, {
         t: 1000,
         duration: 1000,
         ease: 'none',
         repeat: -1,
         onUpdate: draw,
      });
      const swell = gsap.to(state, {
         breath: 1.3,
         duration: 3.8,
         ease: 'sine.inOut',
         yoyo: true,
         repeat: -1,
      });

      return () => {
         run.kill();
         swell.kill();
         el.innerHTML = '';
      };
   }, [fill, seed, theme, cut]);

   return (
      <div
         ref={host}
         aria-hidden="true"
         className={cn(
            'torn',
            flip && 'top-[-2px] bottom-auto -scale-y-100',
            /* Hung over the next section rather than sitting inside this one. */
            cut && 'torn-hang',
            className
         )}
      />
   );
}
