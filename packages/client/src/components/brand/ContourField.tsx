import type { CSSProperties } from 'react';
import { Contours } from './Contours';

/*
 * A survey sheet behind a page.
 *
 * One patch of contours at the top read as a watermark and vanished on a
 * wide screen. This lays several across the whole height at different
 * sizes and weights, each drifting at its own pace, so the ground under a
 * page reads as one sheet rather than a corner of one. Absolute over the
 * page's own box; the page stays `relative`.
 */
export function ContourField({ seed = 1 }: { seed?: number }) {
   const patches: {
      className: string;
      weight: 'fine' | 'plain' | 'bold';
      drift: number;
      seed: number;
   }[] = [
      {
         className: 'left-[-12%] top-[-40px] h-[560px] w-[72%]',
         weight: 'plain',
         drift: 26,
         seed,
      },
      {
         className: 'right-[-10%] top-[22%] h-[460px] w-[52%]',
         weight: 'fine',
         drift: 34,
         seed: seed + 3,
      },
      {
         className: 'left-[6%] top-[52%] h-[420px] w-[46%]',
         weight: 'bold',
         drift: 40,
         seed: seed + 7,
      },
      {
         className: 'right-[2%] bottom-[-60px] h-[380px] w-[38%]',
         weight: 'plain',
         drift: 30,
         seed: seed + 11,
      },
   ];
   return (
      <div
         aria-hidden="true"
         className="pointer-events-none absolute inset-0 overflow-hidden"
      >
         {patches.map((patch) => (
            <Contours
               key={patch.seed}
               seed={patch.seed}
               className={`${patch.className} contour-${patch.weight}`}
               style={
                  {
                     animationDuration: `${patch.drift}s`,
                  } as CSSProperties
               }
            />
         ))}
      </div>
   );
}
