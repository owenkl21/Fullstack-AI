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

export function FeedFilters({
   scope,
   onScopeChange,
   radiusKm,
   onRadiusChange,
   onRadiusCommit,
   matchCount,
   locationState,
   onRetryLocation,
}: {
   scope: ScopeFilter;
   onScopeChange: (next: ScopeFilter) => void;
   radiusKm: number;
   onRadiusChange: (next: number) => void;
   onRadiusCommit: (next: number) => void;
   matchCount: number | null;
   locationState: LocationState;
   onRetryLocation: () => void;
}) {
   return (
      <section aria-label="Filters" className="flex flex-col gap-6">
         {/*
          * Global or local, as one two-way switch and nothing beside it. It
          * used to share the row with a Show group, and on a phone the two
          * together took most of the room above the first post.
          */}
         <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div
               role="radiogroup"
               aria-label="Scope"
               className="grid w-full max-w-[320px] grid-cols-2 border border-ink"
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
                           'g-tracked h-11 text-[17px] transition-colors duration-150 [transition-timing-function:var(--ease)]',
                           on
                              ? 'bg-ink text-background'
                              : 'text-ink-2 hover:text-ink'
                        )}
                     >
                        {option.label}
                     </button>
                  );
               })}
            </div>
         </div>

         {scope === 'near-me' ? (
            <div className="rule-dashed pt-4">
               {locationState === 'ready' ? (
                  <div className="flex flex-col gap-2">
                     {/*
                      * A slider, drawn as the product's own fishing line,
                      * snapping between the distances anyone actually means.
                      * The request goes out when the drag ends, not on every
                      * step through.
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
                     <p className="text-[15px] text-ink-2" aria-live="polite">
                        {matchCount === null
                           ? `Counting what is within ${radiusKm} km.`
                           : matchCount > 0
                             ? `${plural(matchCount, 'post', 'posts')} within ${radiusKm} km so far.`
                             : `Nothing within ${radiusKm} km yet.`}
                     </p>
                  </div>
               ) : locationState === 'asking' ? (
                  <p className="text-[15px] text-ink-2">
                     Finding where you are.
                  </p>
               ) : locationState === 'unsupported' ? (
                  <p className="text-[15px] text-ink-2">
                     This browser cannot share a position. Everywhere shows the
                     whole feed.
                  </p>
               ) : (
                  <div className="flex flex-col gap-3">
                     <p className="text-[15px] text-ink-2">
                        We could not get your position. Allow location for this
                        site, then try again.
                     </p>
                     <div className="flex flex-wrap gap-4">
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
                           Show everywhere
                        </button>
                     </div>
                  </div>
               )}
            </div>
         ) : null}
      </section>
   );
}
