import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { PlaceSearch } from '@/components/forecast/PlaceSearch';
import type { PlaceHit } from '@/components/forecast/forecast-api';
import {
   fetchSpecies,
   type Species,
} from '@/components/fishing/quicklog/species';
import {
   PROVINCES,
   createCompetition,
   fetchMyFollowers,
   type CompetitionArea,
   type CompetitionChecks,
   type CompetitionMeasure,
   type CompetitionRule,
   type Follower,
} from '@/components/social/competitions-api';
import { toast } from '@/components/ui/use-toast';
import {
   ChoiceGroup,
   FieldRow,
   FieldStack,
   SelectField,
   TextField,
} from '@/components/ui/field';
import { useDocumentTitle } from '@/lib/title';
import { cn } from '@/lib/utils';

/*
 * Starting a competition, one decision at a time.
 *
 * Five short steps rather than one long form: what it is, where and when,
 * who can enter and how entries are checked, who to invite, and one last
 * look before it goes up. "Keep it simple" skips to that last look with the
 * defaults, for the angler who only wants a name on a weekend.
 */

const RULES: { value: CompetitionRule; label: string; note: string }[] = [
   {
      value: 'BIGGEST_FISH',
      label: 'Biggest fish',
      note: 'Your single best fish decides your position.',
   },
   {
      value: 'SPECIES_POINTS',
      label: 'Total',
      note: 'Add up the best 3 fish per species, per day.',
   },
   {
      value: 'SPECIES_VARIETY',
      label: 'Most species',
      note: 'Each identified species counts once. No measurement required.',
   },
];

const CHECKS_SENTENCE =
   'Every entry is checked: the fish is named from the photo, the figure is read off the tape or scale, the time and the area are checked, and the same fish cannot be entered twice. Anything that does not add up waits for the organiser.';

/* Local date and time, in the shape a datetime-local input wants. */
const inputValue = (at: Date) => {
   const pad = (n: number) => String(n).padStart(2, '0');
   return (
      `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
      `T${pad(at.getHours())}:${pad(at.getMinutes())}`
   );
};

const readable = (local: string) =>
   new Date(local).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
   });

type StepKey = 'what' | 'where' | 'who' | 'invite' | 'look';

const STEP_TITLES: Record<StepKey, string> = {
   what: 'Choose your competition',
   where: 'Rules and area',
   who: 'Who can enter',
   invite: 'Invite your followers',
   look: 'One last look',
};

export function NewCompetitionPage() {
   useDocumentTitle('Start a competition');
   return (
      <RequireSignIn what="competitions">
         <NewCompetition />
      </RequireSignIn>
   );
}

function NewCompetition() {
   const navigate = useNavigate();
   const now = useMemo(() => new Date(), []);
   const inAWeek = useMemo(() => new Date(now.getTime() + 7 * 86400000), [now]);

   const [name, setName] = useState('');
   const [blurb, setBlurb] = useState('');
   const [measure, setMeasure] = useState<CompetitionMeasure>('LENGTH');
   const [rule, setRule] = useState<CompetitionRule>('BIGGEST_FISH');
   const [speciesId, setSpeciesId] = useState('');
   const [species, setSpecies] = useState<Species[]>([]);
   const [areaType, setAreaType] = useState<CompetitionArea>('ANYWHERE');
   const [place, setPlace] = useState<PlaceHit | null>(null);
   const [radiusKm, setRadiusKm] = useState('25');
   const [province, setProvince] = useState('');
   const [startsAt, setStartsAt] = useState(inputValue(now));
   const [endsAt, setEndsAt] = useState(inputValue(inAWeek));
   const [scope, setScope] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
   const [checks, setChecks] = useState<CompetitionChecks>('CASUAL');
   const [followers, setFollowers] = useState<Follower[] | null>(null);
   const [invitees, setInvitees] = useState<string[]>([]);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [entered, setEntered] = useState(false);

   useEffect(() => {
      const frame = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(frame);
   }, []);

   useEffect(() => {
      const controller = new AbortController();
      fetchSpecies(controller.signal)
         .then(setSpecies)
         .catch(() => setSpecies([]));
      return () => controller.abort();
   }, []);

   useEffect(() => {
      if (scope !== 'PRIVATE' || followers) return;
      const controller = new AbortController();
      fetchMyFollowers(controller.signal)
         .then(setFollowers)
         .catch(() => setFollowers([]));
      return () => controller.abort();
   }, [scope, followers]);

   /* The steps that apply: the invitation step only when it is invite only. */
   const steps: StepKey[] = useMemo(
      () =>
         scope === 'PRIVATE'
            ? ['what', 'where', 'who', 'invite', 'look']
            : ['what', 'where', 'who', 'look'],
      [scope]
   );
   const [step, setStep] = useState<StepKey>('what');
   const index = Math.max(0, steps.indexOf(step));

   const chosenSpecies = species.find((s) => s.id === speciesId) ?? null;

   const problemWith = (key: StepKey): string | null => {
      if (key === 'what') {
         if (name.trim().length < 2)
            return 'Give your competition a name, at least 2 characters.';
      }
      if (key === 'where') {
         if (areaType === 'WATERBODY' && !place)
            return 'Pick the waterbody it is on.';
         if (areaType === 'REGION' && !province) return 'Pick the province.';
         const from = new Date(startsAt);
         const to = new Date(endsAt);
         if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()))
            return 'Set when it starts and when it ends.';
         if (to <= from) return 'Choose an end after the start.';
         if (to <= new Date()) return 'Choose an end after now.';
         if (
            areaType === 'WATERBODY' &&
            !(Number(radiusKm) > 0 && Number(radiusKm) <= 500)
         )
            return 'How far from the water still counts, in kilometres, up to 500.';
      }
      return null;
   };

   const go = (to: StepKey) => {
      setError(null);
      setStep(to);
      window.scrollTo({ top: 0, behavior: 'smooth' });
   };

   const next = () => {
      const problem = problemWith(step);
      if (problem) {
         setError(problem);
         return;
      }
      const following = steps[index + 1];
      if (following) go(following);
   };

   const back = () => {
      const previous = steps[index - 1];
      if (previous) go(previous);
   };

   const keepItSimple = () => {
      for (const key of ['what', 'where'] as const) {
         const problem = problemWith(key);
         if (problem) {
            setError(problem);
            setStep(key);
            return;
         }
      }
      go('look');
   };

   const create = async () => {
      for (const key of steps) {
         const problem = problemWith(key);
         if (problem) {
            setError(problem);
            setStep(key);
            return;
         }
      }
      setBusy(true);
      setError(null);
      try {
         const competition = await createCompetition({
            name: name.trim(),
            blurb: blurb.trim() || null,
            rule,
            measure,
            scope,
            checks,
            areaType,
            areaName:
               areaType === 'WATERBODY'
                  ? (place?.name ?? null)
                  : areaType === 'REGION'
                    ? province
                    : null,
            areaLatitude: areaType === 'WATERBODY' ? place?.latitude : null,
            areaLongitude: areaType === 'WATERBODY' ? place?.longitude : null,
            areaRadiusKm: areaType === 'WATERBODY' ? Number(radiusKm) : null,
            inviteeIds: scope === 'PRIVATE' ? invitees : [],
            speciesId: rule === 'SPECIES_VARIETY' ? null : speciesId || null,
            /* Sent as instants, so a competition means the same thing to
             * everyone reading it wherever they are. */
            startsAt: new Date(startsAt).toISOString(),
            endsAt: new Date(endsAt).toISOString(),
         });
         toast({
            title: 'Competition created.',
            description:
               scope === 'PRIVATE' && invitees.length
                  ? invitees.length === 1
                     ? '1 invitation sent.'
                     : `${invitees.length} invitations sent.`
                  : undefined,
            variant: 'success',
         });
         navigate(`/competitions/${competition.id}`, { replace: true });
      } catch {
         setError('That did not save. Try again.');
         setBusy(false);
      }
   };

   const close = () => navigate('/competitions');

   const heading = (n: number, title: string) => (
      <div className="mb-5 flex items-center gap-2.5">
         <span className="g-tracked text-[19px] text-teal-text">
            {String(n).padStart(2, '0')}
         </span>
         <h2 className="g text-[22px] leading-none">{title}</h2>
      </div>
   );

   const areaWords =
      areaType === 'ANYWHERE'
         ? 'Anywhere in South Africa'
         : areaType === 'WATERBODY'
           ? place
              ? `${place.name}${place.region ? `, ${place.region}` : ''}, within ${radiusKm || '25'} km`
              : 'A waterbody'
           : province || 'A province';

   const whatStep = (
      <FieldStack>
         <TextField
            label="What it is called"
            value={name}
            maxLength={120}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
            placeholder="Vaal weekend"
         />
         <TextField
            label="A line about it"
            value={blurb}
            maxLength={280}
            onChange={(event) => setBlurb(event.target.value)}
            placeholder="A weekend on the river. Good company, a few fish, and one personal best to beat."
         />
         <ChoiceGroup
            label="How it is won"
            value={rule}
            onChange={(next) => {
               setRule(next);
               if (next === 'SPECIES_VARIETY') setSpeciesId('');
            }}
            options={RULES.map((r) => ({ value: r.value, label: r.label }))}
            hint={RULES.find((r) => r.value === rule)?.note}
         />
         {rule !== 'SPECIES_VARIETY' ? (
            <ChoiceGroup
               label="Judged on"
               value={measure}
               onChange={setMeasure}
               options={[
                  { value: 'WEIGHT', label: 'Weight, from a scale' },
                  { value: 'LENGTH', label: 'Length, from a tape' },
               ]}
               hint={
                  measure === 'LENGTH'
                     ? 'Every entry carries a photo of the fish on the tape, and the figure is read off it.'
                     : 'Every entry carries a photo of the fish on the scale, and the figure is read off it.'
               }
            />
         ) : null}
         {rule !== 'SPECIES_VARIETY' ? (
            <SelectField
               label="Eligible species"
               value={speciesId}
               onChange={(event) => setSpeciesId(event.target.value)}
               hint={
                  speciesId
                     ? 'Only that fish counts.'
                     : 'Any fish counts. Pick one for a single-species competition.'
               }
            >
               <option value="">Any species</option>
               {species.map((s) => (
                  <option key={s.id} value={s.id}>
                     {s.commonName}
                  </option>
               ))}
            </SelectField>
         ) : (
            <p className="text-[14px] text-ink-3">
               A most-species competition takes any species.
            </p>
         )}
      </FieldStack>
   );

   const whereStep = (
      <FieldStack>
         <ChoiceGroup
            label="Where"
            value={areaType}
            onChange={setAreaType}
            options={[
               { value: 'ANYWHERE', label: 'Anywhere in South Africa' },
               { value: 'WATERBODY', label: 'One waterbody' },
               { value: 'REGION', label: 'A province' },
            ]}
            hint={
               areaType === 'ANYWHERE'
                  ? 'No check on where the fish came out.'
                  : 'A catch with a position is checked against it. The exact spot is never shown.'
            }
         />
         {areaType === 'WATERBODY' ? (
            <div className="flex flex-col gap-4">
               <div className="flex flex-col">
                  <span className="lab">Waterbody</span>
                  <PlaceSearch
                     showMine={false}
                     onPick={setPlace}
                     onUseMine={() => undefined}
                     className="mt-1.5"
                  />
                  {place ? (
                     <p className="mt-1.5 text-[14px] text-ink-2">
                        <span className="g-tracked text-[17px] text-ink">
                           {place.name}
                        </span>
                        {place.region ? `, ${place.region}` : ''}
                        {place.kind ? ` · ${place.kind}` : ''}
                     </p>
                  ) : (
                     <p className="mt-1.5 text-[14px] text-ink-3">
                        A dam, a river, a stretch of coast. Type its name.
                     </p>
                  )}
               </div>
               <TextField
                  label="How far from it still counts, km"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={500}
                  numeric
                  value={radiusKm}
                  onChange={(event) => setRadiusKm(event.target.value)}
                  hint="25 km covers a dam and its banks. A long river wants more."
                  className="max-w-[260px]"
               />
            </div>
         ) : areaType === 'REGION' ? (
            <SelectField
               label="Province"
               value={province}
               onChange={(event) => setProvince(event.target.value)}
            >
               <option value="">Pick one</option>
               {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                     {p}
                  </option>
               ))}
            </SelectField>
         ) : null}
         <FieldRow>
            <TextField
               label="Starts (SAST)"
               type="datetime-local"
               value={startsAt}
               onChange={(event) => setStartsAt(event.target.value)}
            />
            <TextField
               label="Ends (SAST)"
               type="datetime-local"
               value={endsAt}
               onChange={(event) => setEndsAt(event.target.value)}
               hint="After the start, and after now."
            />
         </FieldRow>
      </FieldStack>
   );

   const whoStep = (
      <FieldStack>
         <ChoiceGroup
            label="Who can enter"
            value={scope}
            onChange={setScope}
            options={[
               { value: 'PUBLIC', label: 'Anyone' },
               { value: 'PRIVATE', label: 'Invite followers' },
            ]}
            hint={
               scope === 'PRIVATE'
                  ? 'Invitation only. Only the people you invite see it, and they have a week to accept.'
                  : 'Any signed-in angler can enter.'
            }
         />
         <ChoiceGroup
            label="Entry checks"
            value={checks}
            onChange={setChecks}
            options={[
               { value: 'CASUAL', label: 'Casual' },
               { value: 'REVIEW', label: 'Organiser review' },
            ]}
            hint={
               checks === 'REVIEW'
                  ? 'New entries wait for you to accept them before they affect the standings.'
                  : 'Photo and the reading. Entries count as soon as the checks pass.'
            }
         />
         <p className="max-w-[64ch] text-[15px] text-ink-2">
            {CHECKS_SENTENCE}
         </p>
      </FieldStack>
   );

   const inviteStep = (
      <div>
         {followers === null ? (
            <p className="text-[15px] text-ink-2">Reading your followers.</p>
         ) : followers.length === 0 ? (
            <p className="text-[15px] text-ink-2">
               Nobody follows you yet. Only people who follow you can be
               invited; you can invite more once it is running.
            </p>
         ) : (
            <ul className="flex flex-col divide-y divide-line border-y border-line">
               {followers.map((f) => {
                  const on = invitees.includes(f.id);
                  return (
                     <li key={f.id}>
                        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 py-2">
                           <span className="min-w-0">
                              <span className="g-tracked block truncate text-[19px]">
                                 {f.displayName}
                              </span>
                              {f.username ? (
                                 <span className="block text-[13px] text-ink-3">
                                    @{f.username}
                                 </span>
                              ) : null}
                           </span>
                           <span className="flex items-center gap-2">
                              <span className="text-[13px] text-ink-3">
                                 {on ? 'Invited' : 'Invite'}
                              </span>
                              <input
                                 type="checkbox"
                                 className="size-4 accent-ink"
                                 checked={on}
                                 onChange={(event) =>
                                    setInvitees((was) =>
                                       event.target.checked
                                          ? [...was, f.id]
                                          : was.filter((id) => id !== f.id)
                                    )
                                 }
                              />
                           </span>
                        </label>
                     </li>
                  );
               })}
            </ul>
         )}
         <p className="mt-3 text-[14px] text-ink-3">
            {invitees.length === 0
               ? 'Nobody chosen yet. You can invite people after it starts too.'
               : invitees.length === 1
                 ? '1 invitation will go out.'
                 : `${invitees.length} invitations will go out.`}
         </p>
      </div>
   );

   const summary: [string, string][] = [
      ['Name', name.trim() || 'Unnamed'],
      ['How it is won', RULES.find((r) => r.value === rule)?.label ?? rule],
      [
         'Judged on',
         rule === 'SPECIES_VARIETY'
            ? 'Species, no measurement'
            : measure === 'LENGTH'
              ? 'Length, from a tape'
              : 'Weight, from a scale',
      ],
      [
         'Species',
         rule === 'SPECIES_VARIETY'
            ? 'Any'
            : (chosenSpecies?.commonName ?? 'Any species'),
      ],
      ['Where', areaWords],
      ['From', readable(startsAt)],
      ['To', readable(endsAt)],
      [
         'Who can enter',
         scope === 'PRIVATE' ? 'Invited followers' : 'Any signed-in angler',
      ],
      ['Entry checks', checks === 'REVIEW' ? 'Organiser review' : 'Casual'],
      ...(scope === 'PRIVATE'
         ? ([
              [
                 'Invitations',
                 invitees.length === 0 ? 'None yet' : String(invitees.length),
              ],
           ] as [string, string][])
         : []),
   ];

   const lookStep = (
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-[15px]">
         {summary.map(([k, v]) => (
            <div key={k} className="contents">
               <dt className="lab pt-0.5 text-ink-3">{k}</dt>
               <dd className="min-w-0 break-words">{v}</dd>
            </div>
         ))}
      </dl>
   );

   const body: Record<StepKey, React.ReactNode> = {
      what: whatStep,
      where: whereStep,
      who: whoStep,
      invite: inviteStep,
      look: lookStep,
   };

   return (
      <section
         className={cn(
            'mx-auto w-full max-w-[880px] border border-line border-t-[3px] border-t-teal bg-background transition-[transform,opacity] duration-[460ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)] md:my-8',
            entered ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
         )}
      >
         <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-5 md:items-center md:px-7">
            <div className="min-w-0">
               <h1 className="g text-[30px] leading-none md:text-[34px]">
                  Start a competition
               </h1>
               <p className="mt-1.5 max-w-[40ch] text-[14px] text-ink-2">
                  Step {index + 1} of {steps.length}. {STEP_TITLES[step]}.
               </p>
               <ol
                  aria-label="Steps"
                  className="mt-3 flex items-center gap-1.5"
               >
                  {steps.map((key, i) => (
                     <li
                        key={key}
                        aria-current={key === step ? 'step' : undefined}
                        className={cn(
                           'h-[3px] flex-1 transition-colors duration-200',
                           i <= index ? 'bg-teal' : 'bg-line'
                        )}
                     />
                  ))}
               </ol>
            </div>
            <button
               type="button"
               onClick={close}
               aria-label="Close and go back to the competitions"
               className="grid size-11 shrink-0 place-items-center rounded-full border border-line hover:bg-bg-2"
            >
               <XMarkIcon aria-hidden="true" className="size-5" />
            </button>
         </header>

         <div className="px-4 py-6 md:px-7">
            {heading(index + 1, STEP_TITLES[step])}
            {body[step]}
            {error ? (
               <p role="alert" className="mt-4 text-[15px] text-destructive">
                  {error}
               </p>
            ) : null}
         </div>

         <footer className="sticky bottom-0 z-10 border-t border-line bg-background px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:px-7 md:py-4">
            <div className="flex items-center gap-3">
               {index > 0 ? (
                  <button
                     type="button"
                     onClick={back}
                     disabled={busy}
                     className="g-tracked inline-flex min-h-[52px] items-center border border-line px-4 text-[17px]"
                  >
                     Back
                  </button>
               ) : (
                  <button
                     type="button"
                     onClick={keepItSimple}
                     className="g-tracked inline-flex min-h-[52px] items-center px-2 text-[17px] text-ink-2 hover:text-ink"
                  >
                     Keep it simple
                  </button>
               )}
               {step !== 'look' ? (
                  <button
                     type="button"
                     onClick={next}
                     className="g-tracked flex min-h-[52px] flex-1 items-center justify-center bg-ink px-6 text-[20px] text-background"
                  >
                     Continue
                  </button>
               ) : (
                  <button
                     type="button"
                     onClick={() => void create()}
                     disabled={busy}
                     className="g-tracked flex min-h-[52px] flex-1 items-center justify-center bg-teal px-7 text-[22px] text-teal-ink transition-[filter] duration-150 hover:brightness-95 disabled:opacity-60"
                  >
                     {busy ? 'Creating' : 'Create competition'}
                  </button>
               )}
            </div>
         </footer>
      </section>
   );
}
