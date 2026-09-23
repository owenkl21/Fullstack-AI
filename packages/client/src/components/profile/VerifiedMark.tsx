import { cn } from '@/lib/utils';

/*
 * The verified mark, and the only one in the app.
 *
 * It was a teal square with a tick in it, which at the 14 pixels it lives at
 * read as a ticked checkbox sitting after somebody's name. A verified mark has
 * to be recognised before it is read, so this is the shape everybody already
 * knows: a scalloped seal with a tick cut out of it.
 *
 * The scallops are drawn rather than borrowed, twelve of them off a circle, so
 * the edge stays crisp at 12 pixels where a softer rosette turns to mush. Teal
 * seal, teal-ink tick, the pair a primary button already uses, so it sits right
 * on paper, on a black card and at night without being told which it is on.
 *
 * It comes from one boolean the server writes. A name and a handle cannot
 * produce it: the app refuses the brand words in a handle and in a display
 * name, and refuses a tick character in a name outright, so the only mark like
 * this beside a name is this one.
 */

/* Twelve scallops, built once: the seal is the same at every size. */
const SEAL = (() => {
   const points = 12;
   const outer = 8;
   const inner = 6.7;
   const middle = 8;
   const at = (index: number, radius: number) => {
      const angle = (index / points) * Math.PI * 2 - Math.PI / 2;
      return [
         middle + Math.cos(angle) * radius,
         middle + Math.sin(angle) * radius,
      ] as const;
   };

   let path = '';
   for (let index = 0; index < points; index++) {
      const [tipX, tipY] = at(index, outer);
      const [nextX, nextY] = at(index + 1, outer);
      const [dipX, dipY] = at(index + 0.5, inner);
      path += index === 0 ? `M${tipX.toFixed(2)} ${tipY.toFixed(2)}` : '';
      path += ` Q${dipX.toFixed(2)} ${dipY.toFixed(2)} ${nextX.toFixed(2)} ${nextY.toFixed(2)}`;
   }
   return `${path} Z`;
})();

export function VerifiedMark({
   className,
   label = 'Verified account',
}: {
   className?: string;
   /* Read out by a screen reader and shown on hover. */
   label?: string;
}) {
   return (
      <svg
         viewBox="0 0 16 16"
         role="img"
         aria-label={label}
         className={cn(
            'ml-1 inline-block size-[15px] shrink-0 align-[-0.16em]',
            className
         )}
      >
         <title>{label}</title>
         <path d={SEAL} fill="var(--teal)" />
         {/*
          * Rounded, unlike every other line in the app. The seal is a borrowed
          * shape and a square-capped tick inside it looked like a fault; this
          * is the one place the house hand gives way to being understood.
          */}
         <path
            d="M4.9 8.2 7 10.3 11.2 5.9"
            fill="none"
            stroke="var(--teal-ink)"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
         />
      </svg>
   );
}
