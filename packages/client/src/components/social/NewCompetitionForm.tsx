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
import {
   ChoiceGroup,
   FieldRow,
   FieldStack,
   SelectField,
   TextField,
} from '@/components/ui/field';

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

   return (
      <div className="border border-line p-5">
         <h2 className="g text-[28px] md:text-[32px]">Start a competition</h2>

         <FieldStack className="mt-5">
            <TextField
               label="What it is called"
               value={name}
               onChange={(event) => setName(event.target.value)}
               placeholder="Winter galjoen"
            />

            <TextField
               label="A line about it"
               value={blurb}
               onChange={(event) => setBlurb(event.target.value)}
               placeholder="Club members, west coast only."
            />

            <FieldRow>
               <TextField
                  label="Starts"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
               />
               <TextField
                  label="Ends"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
               />
            </FieldRow>

            <ChoiceGroup
               label="Judged on"
               value={measure}
               onChange={setMeasure}
               options={[
                  { value: 'LENGTH', label: 'Length' },
                  { value: 'WEIGHT', label: 'Weight' },
               ]}
               hint={
                  measure === 'LENGTH'
                     ? 'Anyone with a tape can enter, and the fish goes back.'
                     : 'A fish with no scale reading is converted from its length, and a species with no published figures cannot be counted.'
               }
            />

            <ChoiceGroup
               label="How it is won"
               value={rule}
               onChange={setRule}
               options={RULES.map((r) => ({ value: r.value, label: r.label }))}
               hint={RULES.find((r) => r.value === rule)?.note}
            />

            <SelectField
               label="One species only"
               value={speciesId}
               onChange={(event) => setSpeciesId(event.target.value)}
            >
               <option value="">Any fish</option>
               {species.map((s) => (
                  <option key={s.id} value={s.id}>
                     {s.commonName}
                  </option>
               ))}
            </SelectField>

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
         </FieldStack>
      </div>
   );
}
