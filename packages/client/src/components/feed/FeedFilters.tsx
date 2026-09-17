import type { ChipOption } from '@/components/feed/ChipRadioGroup';
import { ChoiceGroup } from '@/components/ui/field';
import { Picker } from '@/components/ui/picker';
import { StopSlider } from '@/components/ui/slider';
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

/* The distances anyone actually means, rather than every value in between. */
const RADIUS_STEPS = [5, 10, 25, 50, 100, 250] as const;

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
   return (
      <section aria-label="Filters" className="flex flex-col gap-6">
         {/*
          * Label beside the chips, not above them. Two groups with a label over
          * each cost four rows at the top of a phone, which was most of the
          * room before the first post. Beside them it is two, and the labels
          * stay, so the two groups still read as two.
          */}
         {/*
          * On a phone, one row that scrolls sideways: the two groups side by
          * side with their labels, and the bar itself bleeds to the screen
          * edge so the last chip peeks in and says there is more. Two stacked
          * rows here cost the first post its place above the fold.
          */}
         {/*
          * On a phone, two pickers side by side: they fit one row without
          * scrolling and open a panel each. On a wider screen the chips are
          * back, because there is room and a chip is one tap fewer.
          */}
         <div className="grid grid-cols-2 gap-3 sm:hidden">
            <Picker
               size="sm"
               label="Scope"
               value={scope}
               options={SCOPE_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
               }))}
               onChange={(next) => onScopeChange(next as ScopeFilter)}
            />
            <Picker
               size="sm"
               label="Show"
               value={show}
               options={SHOW_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
               }))}
               onChange={(next) => onShowChange(next as ShowFilter)}
            />
         </div>
         <div className="hidden gap-10 sm:flex">
            <ChoiceGroup
               inline
               size="sm"
               label="Scope"
               value={scope}
               options={SCOPE_OPTIONS}
               onChange={onScopeChange}
            />
            <ChoiceGroup
               inline
               size="sm"
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
                        onChange={onRadiusChange}
                        onCommit={onRadiusCommit}
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
