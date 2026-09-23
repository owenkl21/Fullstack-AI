import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/*
 * The product's mark, wherever something small needs to say "this is a fish".
 *
 * It is Owen's own artwork rather than a drawing of it: the same file the
 * header carries, painted through its own alpha as a mask so it takes the
 * colour of whatever it sits on. That matters because this mark lands on a
 * black card, on a teal pin and on paper, and a raster in its own colours
 * would only be right on one of them.
 */
const MASK: CSSProperties = {
   maskImage: 'url(/brand/fisherfeed-mark.png)',
   WebkitMaskImage: 'url(/brand/fisherfeed-mark.png)',
   maskRepeat: 'no-repeat',
   WebkitMaskRepeat: 'no-repeat',
   maskPosition: 'center',
   WebkitMaskPosition: 'center',
   maskSize: 'contain',
   WebkitMaskSize: 'contain',
   backgroundColor: 'currentColor',
};

/*
 * Only a class and a style, so it can still stand where a Heroicon stands:
 * the map's popup and the toolbar hold their marks in one list, typed as SVG
 * components, and a component that asks for less than it is handed fits.
 */
export function FishMark({
   className,
   style,
}: {
   className?: string;
   style?: CSSProperties;
}) {
   return (
      <span
         aria-hidden="true"
         style={{ ...MASK, ...style }}
         className={cn('inline-block h-[22px] w-[34px]', className)}
      />
   );
}

/**
 * The square that sits where a photograph would have been.
 *
 * Deliberately dark with a teal foot, the same treatment the season strip uses,
 * so a log with no photographs still looks composed rather than broken.
 */
export function NoPhoto({ className }: { className?: string }) {
   return (
      <span
         aria-hidden="true"
         className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden bg-ink/85',
            className
         )}
      >
         <FishMark className="h-[18px] w-[22px] text-paper/40" />
         <span className="absolute inset-x-0 bottom-0 h-1 bg-teal" />
      </span>
   );
}
