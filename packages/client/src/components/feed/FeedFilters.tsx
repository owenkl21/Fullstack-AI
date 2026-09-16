import { useId } from 'react';

import { Slider } from '@/components/ui/slider';
import {
   ChipRadioGroup,
   type ChipOption,
} from '@/components/feed/ChipRadioGroup';
import { plural } from '@/components/feed/format';
import type { ScopeFilter, ShowFilter } from '@/components/feed/types';

export type LocationState =
   | 'idle'
   | 'asking'
   | 'ready'
   | 'denied'
   | 'unsupported';

const SCOPE_OPTIONS: ReadonlyArray<ChipOption<ScopeFilter>> = [
   { value: 'everywhere', label: 'Everywhere' },
   { value: 'near-me', label: 'Near me' },
];

const SHOW_OPTIONS: ReadonlyArray<ChipOption<ShowFilter>> = [
   { value: 'all', label: 'All' },
   { value: 'catches', label: 'Catches' },
   { value: 'spots', label: 'Spots' },
];

export const MIN_RADIUS_KM = 5;
export const MAX_RADIUS_KM = 250;

export function FeedFilters({
   scope,
   onScopeChange,
   show,
   onShowChange,
   radiusKm,
   onRadiusChange,
   onRadiusCommit,
   matchCount,
   locationState,
   onRetryLocation,
}: {
   scope: ScopeFilter;
   onScopeChange: (next: ScopeFilter) => void;
   show: ShowFilter;
   onShowChange: (next: ShowFilter) => void;
   radiusKm: number;
   onRadiusChange: (next: number) => void;
   onRadiusCommit: (next: number) => void;
   matchCount: number | null;
   locationState: LocationState;
   onRetryLocation: () => void;
}) {
   const radiusLabelId = useId();

   return (
      <section aria-label="Filters" className="flex flex-col gap-6">
         <div className="flex flex-col gap-6 sm:flex-row sm:gap-10">
            <ChipRadioGroup
               label="Scope"
               value={scope}
               options={SCOPE_OPTIONS}
               onChange={onScopeChange}
            />
            <ChipRadioGroup
               label="Show"
               value={show}
               options={SHOW_OPTIONS}
               onChange={onShowChange}
            />
         </div>

         {scope === 'near-me' ? (
            <div className="rule-dashed pt-4">
               {locationState === 'ready' ? (
                  <div className="flex flex-col gap-2">
                     <div className="flex items-baseline justify-between gap-4">
                        <span id={radiusLabelId} className="lab">
                           Search radius
                        </span>
                        <span className="num font-display text-[24px] tracking-[0.02em] text-ink">
                           {radiusKm} km
                        </span>
                     </div>
                     <Slider
                        aria-labelledby={radiusLabelId}
                        min={MIN_RADIUS_KM}
                        max={MAX_RADIUS_KM}
                        step={5}
                        value={[radiusKm]}
                        onValueChange={(value) =>
                           onRadiusChange(value[0] ?? MIN_RADIUS_KM)
                        }
                        onValueCommit={(value) =>
                           onRadiusCommit(value[0] ?? MIN_RADIUS_KM)
                        }
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
