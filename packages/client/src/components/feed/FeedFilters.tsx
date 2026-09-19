import { cn } from '@/lib/utils';
import { StopSlider } from '@/components/ui/slider';
import { plural } from '@/components/feed/format';
import type { ScopeFilter } from '@/components/feed/types';

export type LocationState =
   | 'idle'
   | 'asking'
   | 'ready'
   | 'denied'
   | 'unsupported';

/*
 * One question now, not two. The Show group that chose between catches and
 * spots went with the spot posts themselves, which leaves the switch the whole
 * feed actually turns on: everywhere, or around here.
 */
const SCOPE_OPTIONS: ReadonlyArray<{ value: ScopeFilter; label: string }> = [
   { value: 'everywhere', label: 'Global' },
   { value: 'near-me', label: 'Local' },
];

export const MIN_RADIUS_KM = 5;
export const MAX_RADIUS_KM = 250;

/* The distances anyone actually means, rather than every value in between. */
const RADIUS_STEPS = [5, 10, 25, 50, 100, 250] as const;

/*
 * Global or Local, and it lives on the black plate beside the title.
 *
 * It used to be the first thing under the wave, on paper, which put a control
 * between the reader and the first catch and left the plate carrying a title
 * and nothing else. The plate does not remap the ink tokens, so the two cells
 * are drawn in paper and black outright rather than in `text-ink`.
 */
export function FeedScopeSegment({
   scope,
   onScopeChange,
   className,
}: {
   scope: ScopeFilter;
   onScopeChange: (next: ScopeFilter) => void;
   className?: string;
}) {
   return (
      <div
         role="radiogroup"
         aria-label="Scope"
         className={cn('grid w-[240px] grid-cols-2 lg:w-[280px]', className)}
      >
         {SCOPE_OPTIONS.map((option) => {
            const on = scope === option.value;
            return (
               <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onScopeChange(option.value)}
                  className={cn(
                     'g-tracked h-11 text-[16px] tracking-[0.07em] transition-colors duration-150 [transition-timing-function:var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
                     on
                        ? 'bg-paper text-black-block'
                        : 'border border-paper/40 text-paper hover:bg-paper/10'
                  )}
               >
                  {option.label}
               </button>
            );
         })}
      </div>
   );
}

/*
 * How far Local reaches, and what to do when the browser will not say where
 * you are. It stays under the wave on paper: it is the only part of the feed's
 * controls that has anything to set, and it only exists while Local is on.
 */
export function FeedRadius({
   radiusKm,
   onRadiusChange,
   onRadiusCommit,
   matchCount,
   locationState,
   onRetryLocation,
   onScopeChange,
}: {
   radiusKm: number;
   onRadiusChange: (next: number) => void;
   onRadiusCommit: (next: number) => void;
   matchCount: number | null;
   locationState: LocationState;
   onRetryLocation: () => void;
   onScopeChange: (next: ScopeFilter) => void;
}) {
   if (locationState === 'ready') {
      return (
         <div className="flex flex-col gap-2">
            {/*
             * A slider, drawn as the product's own fishing line, snapping
             * between the distances anyone actually means. The request goes
             * out when the drag ends, not on every step through.
             */}
            <StopSlider
               label="Within"
               stops={RADIUS_STEPS}
               value={
                  RADIUS_STEPS.includes(
                     radiusKm as (typeof RADIUS_STEPS)[number]
                  )
                     ? radiusKm
                     : 25
               }
               format={(km) => `${km} km`}
               onCommit={(km) => {
                  onRadiusChange(km);
                  onRadiusCommit(km);
               }}
               className="max-w-[420px]"
            />
            {/* Not an explanation of the slider: the count it produced, which
                is the only way to know whether widening it would help. */}
            <p className="text-[15px] text-ink-2" aria-live="polite">
               {matchCount === null
                  ? `Counting what is within ${radiusKm} km.`
                  : matchCount > 0
                    ? `${plural(matchCount, 'post', 'posts')} within ${radiusKm} km so far.`
                    : `Nothing within ${radiusKm} km yet.`}
            </p>
         </div>
      );
   }

   if (locationState === 'asking') {
      return <p className="text-[15px] text-ink-2">Finding where you are.</p>;
   }

   if (locationState === 'unsupported') {
      return (
         <p className="text-[15px] text-ink-2">
            This browser cannot share a position. Global shows the whole feed.
         </p>
      );
   }

   return (
      <div className="flex flex-col gap-3">
         <p className="text-[15px] text-ink-2">
            We could not get your position. Allow location for this site, then
            try again.
         </p>
         <div className="flex flex-wrap gap-6">
            <button
               type="button"
               onClick={onRetryLocation}
               className="g-tracked inline-flex h-12 items-center text-[19px] text-teal-text transition-[opacity] duration-150 [transition-timing-function:var(--ease)] hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            >
               Try again
            </button>
            <button
               type="button"
               onClick={() => onScopeChange('everywhere')}
               className="g-tracked inline-flex h-12 items-center text-[19px] text-ink-2 transition-[color] duration-150 [transition-timing-function:var(--ease)] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            >
               Show global
            </button>
         </div>
      </div>
   );
}
