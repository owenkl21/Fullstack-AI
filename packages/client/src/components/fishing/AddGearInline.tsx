import { PlusIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { useState } from 'react';
import type { GearOption } from '@/pages/fishing/LogCatchPage';
import { Button } from '@/components/ui/button';

/*
 * Registering a rod without abandoning the catch you were logging.
 *
 * Gear could only be added on its own page, so a lure that was not on the list
 * meant leaving a half-filled form and losing it. The fish is the thing being
 * recorded; the tackle is a detail that should never cost you the record.
 *
 * Deliberately only the three fields the gear list needs. A photograph and the
 * rest can be added later on the gear page, and asking for them here would
 * rebuild that page inside this one.
 */

const TYPES = [
   'ROD',
   'REEL',
   'BAIT',
   'LURE',
   'LINE',
   'HOOK',
   'WEIGHTS',
] as const;

type GearType = (typeof TYPES)[number];

const label = (type: GearType) => type.charAt(0) + type.slice(1).toLowerCase();

export function AddGearInline({
   onAdded,
}: {
   /** Hands back the saved piece so the form can tick it straight away. */
   onAdded: (gear: GearOption) => void;
}) {
   const [open, setOpen] = useState(false);
   const [name, setName] = useState('');
   const [brand, setBrand] = useState('');
   const [type, setType] = useState<GearType>('ROD');
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const reset = () => {
      setName('');
      setBrand('');
      setType('ROD');
      setError(null);
   };

   const save = async () => {
      const trimmedName = name.trim();
      const trimmedBrand = brand.trim();

      if (!trimmedName || !trimmedBrand) {
         setError('A name and a make, so you can tell two reels apart.');
         return;
      }

      setBusy(true);
      setError(null);

      try {
         const { data } = await axios.post<{ gear: GearOption }>('/api/gear', {
            name: trimmedName,
            brand: trimmedBrand,
            type,
         });

         if (data?.gear) {
            onAdded(data.gear);
         }

         reset();
         setOpen(false);
      } catch {
         setError('That did not save. Try again.');
      } finally {
         setBusy(false);
      }
   };

   if (!open) {
      return (
         <button
            type="button"
            onClick={() => setOpen(true)}
            className="g-tracked inline-flex min-h-11 items-center gap-2 self-start border border-line px-4 text-[15px] transition-colors duration-150 [transition-timing-function:var(--ease)] hover:bg-bg-2"
         >
            <PlusIcon aria-hidden="true" className="size-[18px]" />
            Add a piece of gear
         </button>
      );
   }

   return (
      <div className="border border-line bg-bg-2 p-4">
         <h3 className="g text-[22px]">New gear</h3>

         <div className="mt-3 flex flex-col gap-3">
            <div>
               <label htmlFor="new-gear-name" className="lab">
                  What it is
               </label>
               <input
                  id="new-gear-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Sensor Surf 14ft"
                  className="input-line mt-1 text-[16px]"
               />
            </div>

            <div>
               <label htmlFor="new-gear-brand" className="lab">
                  Make
               </label>
               <input
                  id="new-gear-brand"
                  value={brand}
                  onChange={(event) => setBrand(event.target.value)}
                  placeholder="Daiwa"
                  className="input-line mt-1 text-[16px]"
               />
            </div>

            <div>
               <span className="lab">Kind</span>
               <div
                  className="mt-1 flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-label="Kind of gear"
               >
                  {TYPES.map((option) => (
                     <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={type === option}
                        onClick={() => setType(option)}
                        className={
                           'g-tracked inline-flex h-11 items-center border px-3.5 text-[16px] transition-colors duration-150 ' +
                           (type === option
                              ? 'border-ink bg-ink text-background'
                              : 'border-line text-ink-2 hover:border-ink hover:text-ink')
                        }
                     >
                        {label(option)}
                     </button>
                  ))}
               </div>
            </div>

            {error ? (
               <p role="alert" className="text-[14px] text-destructive">
                  {error}
               </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
               {/*
                * A button rather than a submit: this sits inside the catch form,
                * and a submit here would try to save the catch.
                */}
               <Button
                  type="button"
                  onClick={() => void save()}
                  disabled={busy}
               >
                  {busy ? 'Saving' : 'Save the gear'}
               </Button>
               <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                     reset();
                     setOpen(false);
                  }}
                  disabled={busy}
               >
                  Cancel
               </Button>
            </div>
         </div>
      </div>
   );
}
