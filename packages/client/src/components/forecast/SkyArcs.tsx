import { SunIcon } from '@heroicons/react/24/outline';
import type { CSSProperties, ReactNode } from 'react';
import { MoonPhaseIcon } from '@/components/fishing/home/ConditionIcons';
import type { ForecastDay } from './forecast-api';
import {
   BAND_W,
   arcPath,
   clockOfMinutes,
   labelLeft,
   minutesOfStamp,
   minutesX,
   quarterPath,
} from './band-geometry';

/*
 * The sun and the moon over the same horizon as the hours.
 *
 * A first and last light printed as two times tells you when; an arc over the
 * hour columns tells you where you are in the day, which is the thing an
 * angler is actually working out at four in the afternoon. The arc is a shape,
 * not an altitude: nothing here claims to know how high the sun stands, only
 * when it comes up, when it is highest, and when it goes.
 *
 * The moon is the harder one. It rises about fifty minutes later each day, so
 * it wanders through the calendar: the moon that sets at 01:15 rose the night
 * before, and the moon that rises at 10:48 sets tomorrow morning. Both are
 * drawn, the tail of one and the start of the other, and a date with no rise
 * or no set at all (which happens about once a lunation) simply runs off the
 * edge rather than inventing a time.
 */

const H = 72;
const HORIZON = 52;
const PEAK = 14;

const nightFill: CSSProperties = {
   fill: 'color-mix(in srgb, var(--ink) 8%, transparent)',
};

function Horizon() {
   return (
      <line
         x1="0"
         x2={BAND_W}
         y1={HORIZON}
         y2={HORIZON}
         className="stroke-teal"
         strokeWidth="1"
         strokeDasharray="12 10.5"
      />
   );
}

function Mark({
   x,
   top,
   children,
}: {
   x: number;
   top: number;
   children: ReactNode;
}) {
   return (
      <span
         aria-hidden="true"
         className="absolute -translate-x-1/2 whitespace-nowrap"
         style={{ left: `${labelLeft(x)}%`, top }}
      >
         {children}
      </span>
   );
}

export function SunBand({ day }: { day: ForecastDay }) {
   const rise = minutesOfStamp(day.sunrise);
   const set = minutesOfStamp(day.sunset);
   if (rise === null || set === null || set <= rise) return null;

   const xRise = minutesX(rise);
   const xSet = minutesX(set);
   const noon = (rise + set) / 2;
   const xNoon = minutesX(noon);

   return (
      <div
         role="img"
         aria-label={`Sun up ${clockOfMinutes(rise)}, highest ${clockOfMinutes(noon)}, down ${clockOfMinutes(set)}.`}
         className="relative h-18 w-full"
      >
         <svg
            aria-hidden="true"
            viewBox={`0 0 ${BAND_W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
         >
            {/* The hours with no sun in them, shaded under the horizon. */}
            <rect
               x="0"
               y={HORIZON}
               width={xRise}
               height={H - HORIZON}
               style={nightFill}
            />
            <rect
               x={xSet}
               y={HORIZON}
               width={BAND_W - xSet}
               height={H - HORIZON}
               style={nightFill}
            />
            <Horizon />
            <path
               d={arcPath(xRise, xSet, HORIZON, PEAK)}
               pathLength={1}
               fill="none"
               strokeWidth="1.5"
               className="draw-on stroke-ink"
            />
         </svg>
         <span
            aria-hidden="true"
            className="absolute -translate-x-1/2 -translate-y-1/2 text-ink"
            style={{ left: `${(xNoon / BAND_W) * 100}%`, top: PEAK }}
         >
            <SunIcon className="size-4" />
         </span>
         <Mark x={xNoon} top={PEAK + 12}>
            <span className="lab num text-ink">
               High noon {clockOfMinutes(noon)}
            </span>
         </Mark>
      </div>
   );
}

export function MoonBand({
   day,
   next,
}: {
   day: ForecastDay;
   next: ForecastDay | null;
}) {
   const rise = minutesOfStamp(day.moonrise);
   const set = minutesOfStamp(day.moonset);
   const nextSet = minutesOfStamp(next?.moonset);
   if (rise === null && set === null) return null;

   /* The moon that sets this morning came up yesterday: draw its tail. */
   const tail = set !== null && (rise === null || set < rise) ? set : null;
   /* And the one that comes up today usually sets tomorrow. */
   const closing =
      rise === null
         ? null
         : set !== null && set > rise
           ? set
           : nextSet !== null
             ? nextSet + 1440
             : null;
   const peak = rise !== null && closing !== null ? (rise + closing) / 2 : null;
   const peakOnScreen = peak !== null && peak <= 1440;

   /*
    * In clock order. A set earlier than the rise is last night's moon going
    * down, and reading "up 10:48, down 01:15" as one moon makes it a three
    * hour night.
    */
   const upDown = [
      rise === null ? null : { at: rise, word: `up ${clockOfMinutes(rise)}` },
      set === null ? null : { at: set, word: `down ${clockOfMinutes(set)}` },
   ]
      .filter((t): t is { at: number; word: string } => t !== null)
      .sort((a, b) => a.at - b.at);
   const times = upDown.map((t) => t.word);

   return (
      <div
         role="img"
         aria-label={`Moon ${times.join(', ')}.`}
         className="relative h-18 w-full"
      >
         <svg
            aria-hidden="true"
            viewBox={`0 0 ${BAND_W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
         >
            <Horizon />
            {tail === null ? null : (
               <path
                  d={quarterPath(0, PEAK, minutesX(tail), HORIZON)}
                  pathLength={1}
                  fill="none"
                  strokeWidth="1.5"
                  className="draw-on stroke-ink"
               />
            )}
            {rise === null ? null : (
               <path
                  d={
                     closing === null
                        ? quarterPath(minutesX(rise), HORIZON, BAND_W, PEAK)
                        : arcPath(
                             minutesX(rise),
                             minutesX(closing),
                             HORIZON,
                             PEAK
                          )
                  }
                  pathLength={1}
                  fill="none"
                  strokeWidth="1.5"
                  className="draw-on stroke-ink"
               />
            )}
         </svg>
         {peakOnScreen && peak !== null ? (
            <span
               aria-hidden="true"
               className="absolute -translate-x-1/2 -translate-y-1/2 text-ink"
               style={{
                  left: `${(minutesX(peak) / BAND_W) * 100}%`,
                  top: PEAK,
               }}
            >
               <MoonPhaseIcon fraction={day.moon.fraction} className="size-4" />
            </span>
         ) : null}
         {rise === null ? null : (
            <Mark x={minutesX(rise)} top={HORIZON + 4}>
               <span className="lab num text-ink">
                  Moonrise {clockOfMinutes(rise)}
               </span>
            </Mark>
         )}
         {set === null ? null : (
            <Mark x={minutesX(set)} top={HORIZON + 4}>
               <span className="lab num text-ink">
                  Moonset {clockOfMinutes(set)}
               </span>
            </Mark>
         )}
      </div>
   );
}
