import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Sheet } from '@/components/ui/sheet';
import { Segment } from './Segment';
import { SAME_WATER_M, type SpotLike } from '@/lib/geo';

/*
 * Where the catch is filed.
 *
 * One row: the spot it will be filed under, or that there is none this close,
 * and one word that changes it. A spot already on the angler's list is chosen
 * from their own spots; a place that is not on it yet is named here and saved
 * with the catch, public or private as they say.
 */
export function SpotRow({
   spot,
   spots,
   onFileUnder,
   adding,
   spotName,
   onSpotName,
   spotPublic,
   onSpotPublic,
   onAdding,
   canAdd,
   className,
}: {
   /* The spot the catch is filed under, when there is one. */
   spot: SpotLike | null;
   /* Everything the angler has saved, for the picker. */
   spots: SpotLike[];
   onFileUnder: (spot: SpotLike | null) => void;
   /* Whether a new spot is being made with this catch, and its name. */
   adding: boolean;
   spotName: string;
   onSpotName: (name: string) => void;
   spotPublic: boolean;
   onSpotPublic: (isPublic: boolean) => void;
   onAdding: (adding: boolean) => void;
   /* False while there is no position to hang a new spot on. */
   canAdd: boolean;
   className?: string;
}) {
   const [picking, setPicking] = useState(false);
   const [naming, setNaming] = useState(false);

   const value = spot
      ? spot.name
      : adding && spotName.trim()
        ? spotName.trim()
        : `None within ${SAME_WATER_M} m`;

   return (
      <div
         className={cn(
            'flex h-[52px] items-center gap-3 border-y border-line',
            className
         )}
      >
         <span className="lab shrink-0">Spot</span>
         <span
            className={cn(
               'min-w-0 truncate',
               spot || (adding && spotName.trim())
                  ? 'text-[16px] text-ink'
                  : 'text-[15px] text-ink-2'
            )}
         >
            {value}
         </span>
         {spot ? (
            <button
               type="button"
               onClick={() => setPicking(true)}
               className="g-tracked ml-auto shrink-0 text-[15px] text-ink-2 hover:text-ink"
            >
               Not this spot
            </button>
         ) : (
            <button
               type="button"
               disabled={!canAdd}
               onClick={() => setNaming(true)}
               className="g-tracked ml-auto shrink-0 text-[15px] text-teal-text hover:opacity-80 disabled:opacity-50"
            >
               Add as a spot
            </button>
         )}

         {/* The saved spots, for a catch filed under the wrong one. */}
         <Sheet open={picking} onOpenChange={setPicking} title="Spot">
            <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
               <span className="lab">Spot</span>
               <button
                  type="button"
                  onClick={() => setPicking(false)}
                  className="g-tracked inline-flex h-10 items-center bg-ink px-3 text-[16px] text-background"
               >
                  Done
               </button>
            </div>
            <ul className="thread-scroll min-h-0 overflow-y-auto">
               {[null, ...spots].map((option) => {
                  const on = (option?.id ?? null) === (spot?.id ?? null);
                  return (
                     <li key={option?.id ?? 'none'}>
                        <button
                           type="button"
                           onClick={() => {
                              onFileUnder(option);
                              setPicking(false);
                           }}
                           className={cn(
                              'flex min-h-12 w-full items-center border-l-[3px] px-3 text-left transition-colors duration-100',
                              on
                                 ? 'border-teal bg-teal/10'
                                 : 'border-transparent hover:bg-bg-2'
                           )}
                        >
                           <span className="g-tracked truncate text-[16px]">
                              {option ? option.name : 'No spot'}
                           </span>
                        </button>
                     </li>
                  );
               })}
            </ul>
         </Sheet>

         {/* A place that is not on the list yet. */}
         <Sheet open={naming} onOpenChange={setNaming} title="Add as a spot">
            <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
               <span className="lab">Add as a spot</span>
               <button
                  type="button"
                  onClick={() => {
                     onAdding(Boolean(spotName.trim()));
                     setNaming(false);
                  }}
                  className="g-tracked inline-flex h-10 items-center bg-ink px-3 text-[16px] text-background"
               >
                  Done
               </button>
            </div>
            <div className="thread-scroll min-h-0 overflow-y-auto px-3 pt-4 pb-5">
               <label className="lab" htmlFor="new-spot-name">
                  Name
               </label>
               <input
                  id="new-spot-name"
                  type="text"
                  maxLength={120}
                  autoComplete="off"
                  value={spotName}
                  placeholder="Rooi-Els"
                  onChange={(event) => {
                     onSpotName(event.target.value);
                     onAdding(Boolean(event.target.value.trim()));
                  }}
                  className="mt-2 h-12 w-full border-0 border-b border-dashed border-line-2 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3 focus:border-ink"
               />
               <span className="lab mt-5 block">The spot is</span>
               <Segment
                  className="mt-2"
                  label="The spot is"
                  value={spotPublic ? 'PUBLIC' : 'PRIVATE'}
                  onChange={(next) => onSpotPublic(next === 'PUBLIC')}
                  options={[
                     { value: 'PRIVATE', label: 'Private' },
                     { value: 'PUBLIC', label: 'Public' },
                  ]}
               />
               {spots.length ? (
                  <>
                     <span className="lab mt-6 block">Your spots</span>
                     <ul className="mt-1">
                        {spots.map((option) => (
                           <li key={option.id}>
                              <button
                                 type="button"
                                 onClick={() => {
                                    onFileUnder(option);
                                    onAdding(false);
                                    setNaming(false);
                                 }}
                                 className="flex min-h-12 w-full items-center border-b border-line text-left"
                              >
                                 <span className="g-tracked truncate text-[16px]">
                                    {option.name}
                                 </span>
                              </button>
                           </li>
                        ))}
                     </ul>
                  </>
               ) : null}
            </div>
         </Sheet>
      </div>
   );
}
