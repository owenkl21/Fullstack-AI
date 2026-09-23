import {
   ArrowTrendingDownIcon,
   ArrowTrendingUpIcon,
   ArrowsRightLeftIcon,
   BoltIcon,
   CloudIcon,
   EyeIcon,
   SunIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/utils';

/*
 * Marks for the conditions.
 *
 * Heroicons covers the sky and the sun. It has nothing for a wave, a swell, a
 * barometer or a moon at a given phase, so those are drawn here: a fishing log
 * that cannot draw a wave is missing the obvious one.
 */

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

const stroke = {
   fill: 'none',
   stroke: 'currentColor',
   strokeWidth: 1.5,
   strokeLinecap: 'round' as const,
   strokeLinejoin: 'round' as const,
};

/**
 * The mark for the rating row.
 *
 * Three readings climbing, which is the shape the row itself draws. Every
 * other mark in the rail stands for a thing in the weather; this row is the
 * only one whose figure is a judgement rather than a measurement, so its mark
 * is the judgement and not a wave or a cloud borrowed to stand in for one.
 */
export function RatingIcon({ className, ...rest }: IconProps) {
   return (
      <svg
         viewBox="0 0 24 24"
         className={cn('size-5', className)}
         {...stroke}
         {...rest}
      >
         <path d="M4.5 20.5v-5" />
         <path d="M11 20.5v-9" />
         <path d="M17.5 20.5v-13" />
      </svg>
   );
}

/** A wave, for sea state. */
export function WaveIcon({ className, ...rest }: IconProps) {
   return (
      <svg
         viewBox="0 0 24 24"
         className={cn('size-5', className)}
         {...stroke}
         {...rest}
      >
         <path d="M2 16c2.2 0 2.2-2.4 4.4-2.4S8.6 16 10.8 16s2.2-2.4 4.4-2.4S17.4 16 19.6 16 22 13.6 22 13.6" />
         <path d="M2 20c2.2 0 2.2-2.4 4.4-2.4S8.6 20 10.8 20s2.2-2.4 4.4-2.4S17.4 20 19.6 20 22 17.6 22 17.6" />
         <path d="M6 10.5c1.6-4 5-6 9-5.5-2.6.7-4 2.2-4.6 4" />
      </svg>
   );
}

/** A long swell, drawn flatter and longer than the chop above it. */
export function SwellIcon({ className, ...rest }: IconProps) {
   return (
      <svg
         viewBox="0 0 24 24"
         className={cn('size-5', className)}
         {...stroke}
         {...rest}
      >
         <path d="M1.5 15c3.5 0 4.5-5 9-5s5.5 5 9 5 3-1.6 3-1.6" />
         <path d="M1.5 19.5c3.5 0 4.5-3 9-3s5.5 3 9 3" />
      </svg>
   );
}

/** A thermometer, for air or water. */
export function ThermometerIcon({ className, ...rest }: IconProps) {
   return (
      <svg
         viewBox="0 0 24 24"
         className={cn('size-5', className)}
         {...stroke}
         {...rest}
      >
         <path d="M12 14.8V5a2 2 0 1 1 4 0v9.8a4 4 0 1 1-4 0Z" />
         <circle cx="14" cy="18" r="1.4" fill="currentColor" stroke="none" />
      </svg>
   );
}

/** A barometer dial, for pressure. */
export function PressureIcon({ className, ...rest }: IconProps) {
   return (
      <svg
         viewBox="0 0 24 24"
         className={cn('size-5', className)}
         {...stroke}
         {...rest}
      >
         <circle cx="12" cy="12" r="9" />
         <path d="M12 12l4.2-3.2" />
         <path d="M12 3v1.6M21 12h-1.6M12 21v-1.6M3 12h1.6" />
      </svg>
   );
}

/** Wind, as moving air rather than a weather symbol. */
export function WindIcon({ className, ...rest }: IconProps) {
   return (
      <svg
         viewBox="0 0 24 24"
         className={cn('size-5', className)}
         {...stroke}
         {...rest}
      >
         <path d="M3 8h11a2.6 2.6 0 1 0-2.6-2.6" />
         <path d="M3 12h15a2.6 2.6 0 1 1-2.6 2.6" />
         <path d="M3 16h8a2.4 2.4 0 1 1-2.4 2.4" />
      </svg>
   );
}

/** A water droplet, for humidity. */
export function DropIcon({ className, ...rest }: IconProps) {
   return (
      <svg
         viewBox="0 0 24 24"
         className={cn('size-5', className)}
         {...stroke}
         {...rest}
      >
         <path d="M12 3.5c3.4 4 5.6 6.8 5.6 9.4a5.6 5.6 0 1 1-11.2 0C6.4 10.3 8.6 7.5 12 3.5Z" />
      </svg>
   );
}

/**
 * The moon at its actual phase.
 *
 * The lit part is drawn from the illuminated fraction rather than picked from a
 * set of eight pictures, so the shape on the screen is the shape in the sky, and
 * a waxing moon is lit on the opposite side to a waning one.
 */
export function MoonPhaseIcon({
   fraction,
   className,
}: {
   fraction: number;
   className?: string;
}) {
   const r = 9;
   /*
    * The terminator is an ellipse whose width follows the phase. At a quarter it
    * is a straight line, so the half disc is drawn on its own.
    */
   const k = Math.cos(2 * Math.PI * fraction);
   const waxing = fraction < 0.5;
   const rx = Math.abs(k) * r;
   const lit = fraction < 0.25 || fraction > 0.75 ? 'small' : 'large';

   return (
      <svg
         viewBox="0 0 24 24"
         className={cn('size-5', className)}
         aria-hidden="true"
      >
         <circle
            cx="12"
            cy="12"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
         />
         {Math.abs(k) < 0.02 ? (
            <path
               d={`M12 3 A ${r} ${r} 0 0 ${waxing ? 1 : 0} 12 21 Z`}
               fill="currentColor"
            />
         ) : (
            <path
               d={
                  `M12 3 ` +
                  `A ${r} ${r} 0 0 ${waxing ? 1 : 0} 12 21 ` +
                  `A ${rx} ${r} 0 0 ${(lit === 'small') === waxing ? 0 : 1} 12 3 Z`
               }
               fill="currentColor"
            />
         )}
      </svg>
   );
}

/**
 * The tide, as the shape it makes: water rising to a high and falling away
 * again over a mean line. Heroicons has no tide, and the rail in the hour grid
 * has forty four pixels to name a row with, so the row's own drawing shrunk to
 * an icon is the honest mark for it.
 */
export function TideIcon({ className, ...rest }: IconProps) {
   return (
      <svg
         viewBox="0 0 24 24"
         className={cn('size-5', className)}
         {...stroke}
         {...rest}
      >
         <path d="M2 16c3.2 0 3.6-8 7-8s3.8 8 7 8 3.4-4 3.4-4" />
         <path d="M2 19.5h20" strokeDasharray="3 2.5" />
      </svg>
   );
}

/**
 * UV: the sun's rays arriving at something they burn. The plain sun already
 * means a clear sky in this vocabulary, so the row that says how hard the
 * light is has to be a different mark or the rail says "sun" twice.
 */
export function UvIcon({ className, ...rest }: IconProps) {
   return (
      <svg
         viewBox="0 0 24 24"
         className={cn('size-5', className)}
         {...stroke}
         {...rest}
      >
         <path d="M8 4.5a4.5 4.5 0 0 1 8 0" />
         <path d="M12 2v-.5M5.6 5 4.8 4.2M18.4 5l.8-.8" />
         <path d="M7 9.5 5 13M12 9.5V13M17 9.5 19 13" />
         <path d="M3 17h18" />
         <path d="M3 20.5h18" />
      </svg>
   );
}

/** A cloud letting go, for the chance of rain. The plain drop means humidity. */
export function CloudRainIcon({ className, ...rest }: IconProps) {
   return (
      <svg
         viewBox="0 0 24 24"
         className={cn('size-5', className)}
         {...stroke}
         {...rest}
      >
         <path d="M7 14.5a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 8.2 3.5 3.5 0 0 1 17.5 15H7Z" />
         <path d="M9 17.5v2.5M12.5 17.5v3M16 17.5v2.5" />
      </svg>
   );
}

/** Sun over a horizon, for first and last light. Distinct from the sky mark. */
export function DaylightIcon({ className, ...rest }: IconProps) {
   return (
      <svg
         viewBox="0 0 24 24"
         className={cn('size-5', className)}
         {...stroke}
         {...rest}
      >
         <path d="M2.5 18.5h19" />
         <path d="M6.5 18.5a5.5 5.5 0 0 1 11 0" />
         <path d="M12 5.5V3M5 8 3.6 6.6M19 8l1.4-1.4" />
      </svg>
   );
}

/** The sky, picked from the words Open-Meteo gives for a WMO code. */
export function skyIcon(
   text: string | null | undefined
): ComponentType<IconProps> {
   const t = (text ?? '').toLowerCase();
   if (/thunder|storm/.test(t)) return BoltIcon;
   if (/rain|drizzle|shower|snow/.test(t)) return DropIcon;
   if (/fog|mist|haze/.test(t)) return EyeIcon;
   if (/cloud|overcast/.test(t)) return CloudIcon;
   return SunIcon;
}

/*
 * Which way the wind is going. Weather reports give the direction the wind
 * comes from; an arrow is read as where it goes, so the mark is turned half a
 * circle from the reported bearing. Straight up is north.
 */
export function WindArrowIcon({
   degrees,
   className,
   ...rest
}: IconProps & { degrees: number }) {
   return (
      <svg
         viewBox="0 0 24 24"
         className={cn('size-5', className)}
         style={{ transform: `rotate(${(degrees + 180) % 360}deg)` }}
         {...stroke}
         {...rest}
      >
         <path d="M12 20V4M6 10l6-6 6 6" />
      </svg>
   );
}

/** The sky icon for a reading, as an element rather than a component. */
export function SunIconFor({
   text,
   className,
}: {
   text: string | null | undefined;
   className?: string;
}) {
   const Sky = skyIcon(text);
   return <Sky aria-hidden="true" className={cn('size-5', className)} />;
}

/** Which way the barometer is going, once there is a previous reading to compare. */
export function trendIcon(delta: number | null): ComponentType<IconProps> {
   if (delta === null || Math.abs(delta) < 0.5) return ArrowsRightLeftIcon;
   return delta > 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
}
