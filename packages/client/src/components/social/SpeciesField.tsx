import { XMarkIcon } from '@heroicons/react/24/outline';
import { Segment } from '@/components/fishing/quicklog/Segment';
import { Picker } from '@/components/ui/picker';
import type { Species } from '@/components/fishing/quicklog/species';

/*
 * The fish a competition is for.
 *
 * Two answers, and the first is a real one: any species is chosen, not what
 * is left when nothing was picked, so an organiser who wants every fish says
 * so and one who wants three names them. The three are picked from a list
 * that is searched, because there are more fish than a phone shows at once,
 * and what has been picked stands under the field as chips that each come off
 * with one tap. The chips are the whole answer; the line above them only
 * opens the list.
 */

/* The server's own ceiling, so the form stops where the save would. */
export const MAX_COMPETITION_SPECIES = 12;

export type SpeciesMode = 'any' | 'chosen';

export function SpeciesField({
   mode,
   onMode,
   chosen,
   onChosen,
   species,
}: {
   mode: SpeciesMode;
   onMode: (next: SpeciesMode) => void;
   chosen: string[];
   onChosen: (next: string[]) => void;
   /* Every species there is; null while they are still being read. */
   species: Species[] | null;
}) {
   /* In the list's own order, which is the order the line above reads them
      in and the order the competition will print them, and only the ones
      that are still real. */
   const picked = (species ?? []).filter((s) => chosen.includes(s.id));

   return (
      <div className="flex flex-col gap-2">
         <span className="lab" id="comp-species-label">
            Species
         </span>
         <Segment
            label="Species"
            value={mode}
            onChange={onMode}
            options={[
               { value: 'any', label: 'Any species' },
               { value: 'chosen', label: 'Only some' },
            ]}
            className="[&_button]:px-2 md:[&_button]:text-[16px]"
         />

         {mode === 'chosen' ? (
            <div className="flex flex-col gap-3 motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in-0 motion-safe:slide-in-from-top-1">
               <Picker
                  multiple
                  searchable
                  variant="line"
                  label="Which fish"
                  searchPlaceholder="Search the species"
                  allLabel={
                     species === null
                        ? 'Reading the species'
                        : 'Pick one or more'
                  }
                  max={MAX_COMPETITION_SPECIES}
                  value={chosen}
                  onChange={(next) => onChosen(next as string[])}
                  options={(species ?? []).map((s) => ({
                     value: s.id,
                     label: s.commonName,
                     hint: s.scientificName || undefined,
                  }))}
               />

               {picked.length ? (
                  <ul
                     aria-label="Chosen species"
                     className="flex flex-wrap gap-2"
                  >
                     {picked.map((s) => (
                        <li
                           key={s.id}
                           className="motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in-0 motion-safe:zoom-in-95"
                        >
                           {/* The whole chip is the button, so the target is
                               the chip and not a 16px cross inside it. */}
                           <button
                              type="button"
                              onClick={() =>
                                 onChosen(chosen.filter((id) => id !== s.id))
                              }
                              aria-label={`Remove ${s.commonName}`}
                              className="group g-tracked inline-flex h-11 items-center gap-2 border border-ink bg-background pr-2 pl-3 text-[16px] transition-colors duration-150 [transition-timing-function:var(--ease)] hover:bg-ink hover:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                           >
                              {s.commonName}
                              <XMarkIcon
                                 aria-hidden="true"
                                 strokeWidth={2}
                                 className="size-4 text-ink-3 group-hover:text-background"
                              />
                           </button>
                        </li>
                     ))}
                  </ul>
               ) : null}
            </div>
         ) : null}
      </div>
   );
}
