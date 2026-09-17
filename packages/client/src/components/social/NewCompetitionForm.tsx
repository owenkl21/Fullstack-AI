import { useEffect, useState } from 'react';
import {
   fetchSpecies,
   type Species,
} from '@/components/fishing/quicklog/species';
import {
   createCompetition,
   type Competition,
   type CompetitionMeasure,
   type CompetitionRule,
} from '@/components/social/competitions-api';
import { Button } from '@/components/ui/button';

/*
 * Starting a competition.
 *
 * Four decisions and nothing else: what it is called, when it runs, what counts
 * as a fish, and how the winner is worked out. Everything a club actually
 * argues about before a competition is one of those four, and everything else
 * would be a setting nobody changes.
 *
 * Length is the default measure, deliberately. Far more catches carry a length
 * than a scale reading, and a weight competition quietly excludes every fish
 * whose species has no published conversion figures.
 */

const RULES: { value: CompetitionRule; label: string; note: string }[] = [
   {
      value: 'SPECIES_POINTS',
      label: 'Total',
      note: 'Every fish that counts is added up.',
   },
   {
      value: 'BIGGEST_FISH',
      label: 'Biggest fish',
      note: 'One fish decides it.',
   },
   {
      value: 'SPECIES_VARIETY',
      label: 'Most species',
      note: 'Variety rather than size.',
   },
];

/* Local date and time, in the shape a datetime-local input wants. */
const inputValue = (at: Date) => {
   const pad = (n: number) => String(n).padStart(2, '0');
   return (
      `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
      `T${pad(at.getHours())}:${pad(at.getMinutes())}`
   );
};

export function NewCompetitionForm({
   onCreated,
   onCancel,
}: {
   onCreated: (competition: Competition) => void;
   onCancel: () => void;
}) {
   const now = new Date();
   const inAWeek = new Date(now.getTime() + 7 * 86400000);

   const [name, setName] = useState('');
   const [blurb, setBlurb] = useState('');
   const [rule, setRule] = useState<CompetitionRule>('SPECIES_POINTS');
   const [measure, setMeasure] = useState<CompetitionMeasure>('LENGTH');
   const [speciesId, setSpeciesId] = useState('');
   const [startsAt, setStartsAt] = useState(inputValue(now));
   const [endsAt, setEndsAt] = useState(inputValue(inAWeek));
   const [species, setSpecies] = useState<Species[]>([]);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      const controller = new AbortController();
      fetchSpecies(controller.signal)
         .then(setSpecies)
         .catch(() => setSpecies([]));
      return () => controller.abort();
   }, []);

   const save = async () => {
      if (name.trim().length < 2) {
         setError('Give it a name people will recognise.');
         return;
      }
      if (new Date(endsAt) <= new Date(startsAt)) {
         setError('It has to end after it starts.');
         return;
      }

      setBusy(true);
      setError(null);

      try {
         const competition = await createCompetition({
            name: name.trim(),
            blurb: blurb.trim() || null,
            rule,
            measure,
            scope: 'PUBLIC',
            speciesId: speciesId || null,
            /* Sent as instants, so a competition means the same thing to
             * everyone reading it wherever they are. */
            startsAt: new Date(startsAt).toISOString(),
            endsAt: new Date(endsAt).toISOString(),
         });
         onCreated(competition);
      } catch {
         setError('That did not save. Try again.');
      } finally {
         setBusy(false);
      }
   };

   const chip = (on: boolean) =>
      'g-tracked inline-flex h-11 items-center border px-3.5 text-[16px] transition-colors duration-150 ' +
      (on
         ? 'border-ink bg-ink text-background'
         : 'border-line text-ink-2 hover:border-ink hover:text-ink');

   return (
      <div className="border border-line p-5">
         <h2 className="g text-[28px] md:text-[32px]">Start a competition</h2>

         <div className="mt-5 flex flex-col gap-5">
            <div>
               <label htmlFor="comp-name" className="lab">
                  What it is called
               </label>
               <input
                  id="comp-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Winter galjoen"
                  className="input-line mt-1 text-[16px]"
               />
            </div>

            <div>
               <label htmlFor="comp-blurb" className="lab">
                  A line about it
               </label>
               <input
                  id="comp-blurb"
                  value={blurb}
                  onChange={(event) => setBlurb(event.target.value)}
                  placeholder="Club members, west coast only."
                  className="input-line mt-1 text-[16px]"
               />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
               <div>
                  <label htmlFor="comp-start" className="lab">
                     Starts
                  </label>
                  <input
                     id="comp-start"
                     type="datetime-local"
                     value={startsAt}
                     onChange={(event) => setStartsAt(event.target.value)}
                     className="input-line mt-1 text-[16px]"
                  />
               </div>
               <div>
                  <label htmlFor="comp-end" className="lab">
                     Ends
                  </label>
                  <input
                     id="comp-end"
                     type="datetime-local"
                     value={endsAt}
                     onChange={(event) => setEndsAt(event.target.value)}
                     className="input-line mt-1 text-[16px]"
                  />
               </div>
            </div>

            <div>
               <span className="lab">Judged on</span>
               <div
                  className="mt-1 flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-label="Judged on"
               >
                  {(['LENGTH', 'WEIGHT'] as CompetitionMeasure[]).map((m) => (
                     <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={measure === m}
                        onClick={() => setMeasure(m)}
                        className={chip(measure === m)}
                     >
                        {m === 'LENGTH' ? 'Length' : 'Weight'}
                     </button>
                  ))}
               </div>
               <p className="mt-2 max-w-[54ch] text-[14px] text-ink-3">
                  {measure === 'LENGTH'
                     ? 'Anyone with a tape can enter, and the fish goes back.'
                     : 'A fish with no scale reading is converted from its length, and a species with no published figures cannot be counted.'}
               </p>
            </div>

            <div>
               <span className="lab">How it is won</span>
               <div
                  className="mt-1 flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-label="How it is won"
               >
                  {RULES.map((option) => (
                     <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={rule === option.value}
                        onClick={() => setRule(option.value)}
                        className={chip(rule === option.value)}
                     >
                        {option.label}
                     </button>
                  ))}
               </div>
               <p className="mt-2 text-[14px] text-ink-3">
                  {RULES.find((r) => r.value === rule)?.note}
               </p>
            </div>

            <div>
               <label htmlFor="comp-species" className="lab">
                  One species only
               </label>
               <select
                  id="comp-species"
                  value={speciesId}
                  onChange={(event) => setSpeciesId(event.target.value)}
                  className="input-line mt-1 text-[16px]"
               >
                  <option value="">Any fish</option>
                  {species.map((s) => (
                     <option key={s.id} value={s.id}>
                        {s.commonName}
                     </option>
                  ))}
               </select>
            </div>

            {error ? (
               <p role="alert" className="text-[14px] text-destructive">
                  {error}
               </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
               <Button
                  type="button"
                  onClick={() => void save()}
                  disabled={busy}
               >
                  {busy ? 'Starting' : 'Start it'}
               </Button>
               <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={busy}
               >
                  Cancel
               </Button>
            </div>
         </div>
      </div>
   );
}
