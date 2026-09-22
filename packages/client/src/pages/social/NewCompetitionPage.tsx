import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { PlaceSearch } from '@/components/forecast/PlaceSearch';
import type { PlaceHit } from '@/components/forecast/forecast-api';
import {
   fetchSpecies,
   type Species,
} from '@/components/fishing/quicklog/species';
import { Segment } from '@/components/fishing/quicklog/Segment';
import {
   createCompetition,
   fetchMyFollowers,
   listWords,
   ruleSentence,
   speciesWords,
   whenSentence,
   type CompetitionArea,
   type CompetitionChecks,
   type CompetitionMeasure,
   type CompetitionRule,
   type Follower,
} from '@/components/social/competitions-api';
import { checkSentences } from '@/components/social/entry-checks';
import { formatDay } from '@/components/fishing/record/format';
import { ProvinceGrid } from '@/components/social/ProvinceGrid';
import { RulesTable } from '@/components/social/RulesTable';
import {
   SpeciesField,
   type SpeciesMode,
} from '@/components/social/SpeciesField';
import {
   ChoiceRow,
   LineField,
   LineRow,
   RadioDot,
   TickBox,
} from '@/components/social/StepLine';
import { DateTimeField } from '@/components/ui/date-time-field';
import { fromLocalValue, toLocalValue } from '@/lib/local-time';
import { MeasureBox } from '@/components/ui/measure-box';
import { Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/use-toast';
import { useDocumentTitle } from '@/lib/title';
import { cn } from '@/lib/utils';

/*
 * Starting a competition, one decision at a time.
 *
 * Five short steps rather than one long form: what it is, where and when,
 * who can enter and how entries are checked, who to invite, and one last
 * look before it goes up. Nothing on a step explains itself in a sentence
 * underneath; the labels on the controls say what they do, which is why
 * there are five short steps instead of one page with footnotes.
 *
 * On a phone the steps are a row of ticks under the title. On a desktop the
 * same five stand in a rail down the left, each showing what it was answered
 * with, and any step already passed can be gone back to.
 */

type StepKey = 'what' | 'where' | 'who' | 'invite' | 'look';

const STEPS: StepKey[] = ['what', 'where', 'who', 'invite', 'look'];

const STEP_TITLES: Record<StepKey, string> = {
   what: 'The competition',
   where: 'Rules and area',
   who: 'Who can enter',
   invite: 'Invite followers',
   look: 'One last look',
};

/*
 * Where the dates start: the coming Saturday at six in the morning to the
 * Sunday after it at three, which is the weekend most competitions are. Never
 * today, even on a Saturday: a competition that has already started before
 * anyone has been told about it is not the one being planned.
 */
const comingWeekend = () => {
   const start = new Date();
   start.setDate(start.getDate() + ((6 - start.getDay() + 7) % 7 || 7));
   start.setHours(6, 0, 0, 0);
   const end = new Date(start);
   end.setDate(end.getDate() + 1);
   end.setHours(15, 0, 0, 0);
   return {
      start: toLocalValue(start),
      end: toLocalValue(end),
      /* How long that is, for an end that follows a moved start. */
      length: end.getTime() - start.getTime(),
   };
};

/* "Fri 18 Sep", the way every other date in the app is written. */
const dayOf = (local: string) =>
   formatDay(fromLocalValue(local)) ?? 'Pick a day';

/* "1 day 9 h", for the line that says how long the dates make it. */
const runsFor = (from: Date, to: Date) => {
   const minutes = Math.round((to.getTime() - from.getTime()) / 60000);
   const days = Math.floor(minutes / 1440);
   const hours = Math.floor((minutes % 1440) / 60);
   const rest = minutes % 60;
   return [
      days ? `${days} ${days === 1 ? 'day' : 'days'}` : '',
      hours ? `${hours} h` : '',
      !days && rest ? `${rest} min` : '',
   ]
      .filter(Boolean)
      .join(' ');
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
   const [weekend] = useState(comingWeekend);

   const [name, setName] = useState('');
   const [blurb, setBlurb] = useState('');
   const [measure, setMeasure] = useState<CompetitionMeasure>('WEIGHT');
   const [rule, setRule] = useState<CompetitionRule>('BIGGEST_FISH');
   const [speciesMode, setSpeciesMode] = useState<SpeciesMode>('any');
   const [speciesIds, setSpeciesIds] = useState<string[]>([]);
   const [species, setSpecies] = useState<Species[] | null>(null);
   const [areaType, setAreaType] = useState<CompetitionArea>('ANYWHERE');
   const [place, setPlace] = useState<PlaceHit | null>(null);
   const [pickingSpot, setPickingSpot] = useState(false);
   const [radiusKm, setRadiusKm] = useState('25');
   const [province, setProvince] = useState('');
   /* Local wall clock, as typed. They become instants once, when it is sent. */
   const [startsAt, setStartsAt] = useState(weekend.start);
   const [endsAt, setEndsAt] = useState(weekend.end);
   const [scope, setScope] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
   const [checks, setChecks] = useState<CompetitionChecks>('CASUAL');
   const [followers, setFollowers] = useState<Follower[] | null>(null);
   const [search, setSearch] = useState('');
   const [invitees, setInvitees] = useState<string[]>([]);
   const [busy, setBusy] = useState(false);
   /*
    * A step's complaint is about what was on it when Continue was pressed.
    * Once any of that changes the complaint is stale, and a fixed field that
    * kept an old one under it would read as still broken. So a complaint is
    * kept with the answers it was about, and shown only while they stand.
    */
   const [complaint, setComplaint] = useState<{
      text: string;
      about: string;
   } | null>(null);
   const [entered, setEntered] = useState(false);
   const [step, setStep] = useState<StepKey>('what');

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

   const about = JSON.stringify([
      name,
      speciesMode,
      speciesIds,
      rule,
      areaType,
      place?.latitude,
      place?.longitude,
      province,
      startsAt,
      endsAt,
      radiusKm,
   ]);
   const error = complaint?.about === about ? complaint.text : null;
   const setError = (text: string | null) =>
      setComplaint(text ? { text, about } : null);

   useEffect(() => {
      if (scope !== 'PRIVATE' || followers) return;
      const controller = new AbortController();
      fetchMyFollowers(controller.signal)
         .then(setFollowers)
         .catch(() => setFollowers([]));
      return () => controller.abort();
   }, [scope, followers]);

   /* Inviting is skipped when anybody can enter; the step stays in the rail
      so the flow is the same five either way. */
   const live = (key: StepKey) => key !== 'invite' || scope === 'PRIVATE';
   const order = STEPS.filter(live);
   const index = Math.max(0, order.indexOf(step));

   /* The fish it is for, by name, in the list's order, which is how the
      competition will print them. Empty is any species, whichever way that
      was arrived at. */
   const chosenSpecies =
      speciesMode === 'chosen'
         ? (species ?? []).filter((s) => speciesIds.includes(s.id))
         : [];

   const from = fromLocalValue(startsAt);
   const to = fromLocalValue(endsAt);
   /* Said under the field the moment it is true, not only on Continue. */
   const endProblem =
      from && to && to <= from
         ? 'It has to end after it starts.'
         : to && to <= new Date()
           ? 'That is already past. Choose an end after now.'
           : null;

   /*
    * The end follows the start, the weekend's length later, until the
    * organiser sets the end by hand; after that the start is theirs to move
    * and an end it overtakes is said, not silently moved. Following is done
    * from the new start alone: a day typed segment by segment passes through
    * years like 0202 on the way, and a length measured against one of those
    * would fling the end into the far future.
    */
   const [endSetByHand, setEndSetByHand] = useState(false);
   const changeStart = (next: string) => {
      setStartsAt(next);
      const now = fromLocalValue(next);
      if (endSetByHand || !now) return;
      setEndsAt(toLocalValue(new Date(now.getTime() + weekend.length)));
   };
   const changeEnd = (next: string) => {
      setEndSetByHand(true);
      setEndsAt(next);
   };

   const problemWith = (key: StepKey): string | null => {
      if (key === 'what') {
         if (name.trim().length < 2)
            return 'Give your competition a name, at least 2 characters.';
         if (speciesMode === 'chosen' && chosenSpecies.length === 0)
            return 'Pick the species it is for, or make it any species.';
         if (rule === 'SPECIES_VARIETY' && chosenSpecies.length === 1)
            return 'Most species needs more than one fish to choose from.';
      }
      if (key === 'where') {
         if (areaType === 'WATERBODY' && !place)
            return 'Pick the spot it is on.';
         if (areaType === 'REGION' && !province) return 'Pick the region.';
         if (!from || !to)
            return 'Set the day and the time it starts and ends.';
         if (endProblem) return endProblem;
         if (
            areaType === 'WATERBODY' &&
            !(Number(radiusKm) > 0 && Number(radiusKm) <= 500)
         )
            return 'How far from the spot still counts, in kilometres, up to 500.';
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
      const following = order[index + 1];
      if (following) go(following);
   };

   const back = () => {
      const previous = order[index - 1];
      if (previous) go(previous);
   };

   const areaName =
      areaType === 'WATERBODY'
         ? (place?.name ?? null)
         : areaType === 'REGION'
           ? province
           : null;

   const create = async () => {
      for (const key of order) {
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
            areaName,
            areaLatitude: areaType === 'WATERBODY' ? place?.latitude : null,
            areaLongitude: areaType === 'WATERBODY' ? place?.longitude : null,
            areaRadiusKm: areaType === 'WATERBODY' ? Number(radiusKm) : null,
            inviteeIds: scope === 'PRIVATE' ? invitees : [],
            speciesIds: chosenSpecies.map((s) => s.id),
            /* Sent as instants, so a competition means the same thing to
             * everyone reading it wherever they are. The checks above have
             * already turned both away if either was not a date. */
            startsAt: (from as Date).toISOString(),
            endsAt: (to as Date).toISOString(),
         });
         toast({
            title: 'Competition started.',
            description:
               scope === 'PRIVATE' && invitees.length
                  ? invitees.length === 1
                     ? '1 invitation sent.'
                     : `${invitees.length} invitations sent.`
                  : undefined,
            variant: 'success',
         });
         navigate(`/competitions/${competition.id}`, { replace: true });
      } catch (failure) {
         /* A form the server turned away says why, on the step that holds
            the field, so it can be put right there. Anything else is a
            failure to save and worth another go. */
         const refused =
            axios.isAxiosError(failure) && failure.response?.status === 400
               ? (failure.response.data as { message?: string; field?: string })
               : null;
         if (refused?.message) {
            const field = refused.field ?? '';
            setStep(
               /^species/.test(field)
                  ? 'what'
                  : /^(startsAt|endsAt|area)/.test(field)
                    ? 'where'
                    : step
            );
            setError(refused.message);
         } else {
            setError('That did not save. Try again.');
         }
         setBusy(false);
      }
   };

   const close = () => navigate('/competitions');

   /* ---- the words a step is remembered by, on the rail and at the end --- */

   const whereSummary =
      areaType === 'ANYWHERE'
         ? 'Anywhere in South Africa'
         : areaType === 'WATERBODY'
           ? place
              ? `Within ${radiusKm || '25'} km of ${place.name}`
              : 'Around a spot'
           : province || 'A region';

   const entrySummary =
      scope === 'PRIVATE'
         ? `Invite only${invitees.length ? ` · ${invitees.length} invited` : ''}`
         : 'Open to all';

   const checksSummary =
      /* In the words the competition's own page prints once it is made. */
      checks === 'REVIEW'
         ? 'Six checks and the judge, then you review'
         : 'Six checks and the judge, then it counts';

   const answers: Record<StepKey, string> = {
      what: name.trim()
         ? `${name.trim()}, ${ruleSentence(rule, measure).toLowerCase()}, ${speciesWords(chosenSpecies) || 'any species'}`
         : '',
      where: `${whereSummary} · ${dayOf(startsAt)} to ${dayOf(endsAt)}`,
      who: `${entrySummary} · ${checksSummary.toLowerCase()}`,
      invite: invitees.length ? `${invitees.length} invited` : '',
      look: '',
   };

   /* ---- the five steps ------------------------------------------------- */

   const ruleOptions = [
      { value: 'BIGGEST_FISH' as const, label: 'Biggest fish' },
      {
         value: 'SPECIES_POINTS' as const,
         label: measure === 'LENGTH' ? 'Total length' : 'Total weight',
      },
      { value: 'SPECIES_VARIETY' as const, label: 'Most species' },
   ];

   const whatStep = (
      <>
         <div className="grid gap-6 md:grid-cols-2 md:gap-6">
            <LineField
               id="comp-name"
               label="What it is called"
               value={name}
               onChange={setName}
               placeholder="Vaal weekend"
               size={18}
               maxLength={120}
            />
            <LineField
               id="comp-blurb"
               label="A line about it"
               value={blurb}
               onChange={setBlurb}
               placeholder="A weekend on the river"
               maxLength={280}
            />
         </div>

         <div className="flex flex-col gap-2">
            <span className="lab">How it is won</span>
            <Segment
               label="How it is won"
               value={rule}
               onChange={setRule}
               options={ruleOptions}
               className="[&_button]:px-2 md:[&_button]:text-[16px]"
            />
         </div>

         {rule !== 'SPECIES_VARIETY' ? (
            <div className="grid items-end gap-6 md:grid-cols-2">
               <div className="flex flex-col gap-2">
                  <span className="lab">Judged on</span>
                  <Segment
                     label="Judged on"
                     value={measure}
                     onChange={setMeasure}
                     options={[
                        { value: 'WEIGHT', label: 'Weight, from a scale' },
                        { value: 'LENGTH', label: 'Length, from a tape' },
                     ]}
                     className="[&_button]:px-2 md:hidden"
                  />
                  {/* The desktop card is narrower per field, so the two
                      words that matter stand alone. */}
                  <Segment
                     label="Judged on"
                     value={measure}
                     onChange={setMeasure}
                     options={[
                        { value: 'WEIGHT', label: 'Weight, scale' },
                        { value: 'LENGTH', label: 'Length, tape' },
                     ]}
                     className="hidden md:flex"
                  />
               </div>
            </div>
         ) : null}

         <SpeciesField
            mode={speciesMode}
            onMode={setSpeciesMode}
            chosen={speciesIds}
            onChosen={setSpeciesIds}
            species={species}
         />
      </>
   );

   const whereStep = (
      <>
         <div className="flex flex-col gap-2">
            <span className="lab">Where</span>
            <div role="radiogroup" aria-label="Where" className="flex flex-col">
               {(
                  [
                     ['ANYWHERE', 'Anywhere in South Africa'],
                     ['REGION', 'A region'],
                     ['WATERBODY', 'Around a spot'],
                  ] as [CompetitionArea, string][]
               ).map(([value, label]) => (
                  <ChoiceRow key={value} onClick={() => setAreaType(value)}>
                     <RadioDot on={areaType === value} />
                     <span className="text-[16px]">{label}</span>
                  </ChoiceRow>
               ))}
            </div>
         </div>

         {areaType === 'WATERBODY' ? (
            <div className="grid grid-cols-[1fr_140px] items-end gap-4">
               <LineRow
                  label="Spot"
                  value={place?.name ?? 'Pick a spot'}
                  onClick={() => setPickingSpot(true)}
               />
               <MeasureBox
                  id="radius"
                  label="Within"
                  value={radiusKm}
                  onChange={setRadiusKm}
                  unit="km"
                  units={['km'] as const}
               />
            </div>
         ) : areaType === 'REGION' ? (
            <ProvinceGrid
               value={province}
               onChange={setProvince}
               invalid={Boolean(error) && !province}
            />
         ) : null}

         <div className="flex flex-col gap-3">
            {/* Side by side only from lg: between md and lg the step rail
                takes half the card, and a day and a time in a quarter of it
                were cut to "2026/" and "06". */}
            <div className="grid gap-6 lg:grid-cols-2">
               <DateTimeField
                  variant="line"
                  label="Starts"
                  value={startsAt}
                  onChange={changeStart}
               />
               <DateTimeField
                  variant="line"
                  label="Ends"
                  value={endsAt}
                  onChange={changeEnd}
                  min={startsAt || undefined}
                  error={endProblem}
               />
            </div>
            {/* The dates read back in words, because a native date input
                writes them in whatever order the phone is set to. */}
            {from && to && !endProblem ? (
               <p className="text-[14px] text-ink-2" aria-live="polite">
                  <span className="num">
                     {whenSentence(from.toISOString(), to.toISOString())}
                  </span>
                  {'. '}
                  Runs for <span className="num">{runsFor(from, to)}</span>, in
                  your own time.
               </p>
            ) : null}
         </div>
      </>
   );

   const whoStep = (
      <>
         <Segment
            label="Who can enter"
            value={scope}
            onChange={setScope}
            options={[
               { value: 'PUBLIC', label: 'Open to all' },
               { value: 'PRIVATE', label: 'Invite only' },
            ]}
            className="[&_button]:text-[16px]"
         />

         <div className="flex flex-col gap-2">
            <span className="lab">Every entry is checked for</span>
            <div className="flex flex-col">
               {checkSentences(measure, rule).map((sentence) => (
                  <ChoiceRow key={sentence}>
                     <TickBox on />
                     <span className="text-[16px]">{sentence}</span>
                  </ChoiceRow>
               ))}
            </div>
         </div>

         <div className="flex flex-col gap-2">
            <span className="lab">When an entry passes</span>
            <Segment
               label="When an entry passes"
               value={checks}
               onChange={setChecks}
               options={[
                  { value: 'CASUAL', label: 'It counts at once' },
                  { value: 'REVIEW', label: 'I review it first' },
               ]}
               className="[&_button]:text-[16px]"
            />
         </div>
      </>
   );

   const matches = (followers ?? []).filter((f) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
         f.displayName.toLowerCase().includes(q) ||
         (f.username ?? '').toLowerCase().includes(q)
      );
   });

   const inviteStep = (
      <>
         <div className="flex h-12 items-center gap-2.5 border-b border-dashed border-line-2 focus-within:border-ink">
            <MagnifyingGlassIcon
               aria-hidden="true"
               strokeWidth={1.5}
               className="size-5 shrink-0 text-ink-3"
            />
            <input
               type="search"
               value={search}
               onChange={(event) => setSearch(event.target.value)}
               placeholder="Search your followers"
               aria-label="Search your followers"
               className="h-full w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
            />
         </div>

         {followers === null ? (
            <p className="text-[15px] text-ink-2">Reading your followers.</p>
         ) : matches.length === 0 ? (
            <p className="text-[15px] text-ink-2">
               {followers.length
                  ? 'Nobody by that name.'
                  : 'Nobody follows you yet.'}
            </p>
         ) : (
            <div className="flex flex-col">
               {matches.map((f) => {
                  const on = invitees.includes(f.id);
                  return (
                     <ChoiceRow
                        key={f.id}
                        height={60}
                        onClick={() =>
                           setInvitees((was) =>
                              on
                                 ? was.filter((id) => id !== f.id)
                                 : [...was, f.id]
                           )
                        }
                     >
                        <span className="g grid size-9 shrink-0 place-items-center rounded-full bg-ink-2 text-[18px] text-paper">
                           {f.displayName.slice(0, 1)}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
                           <span className="truncate text-[15px] font-semibold">
                              {f.displayName}
                           </span>
                           {f.username ? (
                              <span className="truncate text-[13px] text-ink-3">
                                 @{f.username}
                              </span>
                           ) : null}
                        </span>
                        <TickBox on={on} />
                     </ChoiceRow>
                  );
               })}
            </div>
         )}
      </>
   );

   const lookStep = (
      <>
         <SummaryGroup
            title="The competition"
            onEdit={() => go('what')}
            rows={[
               { label: 'Name', value: name.trim() || 'Unnamed' },
               { label: 'Rule', value: ruleSentence(rule, measure) },
               {
                  label: 'Species',
                  value: chosenSpecies.length
                     ? listWords(
                          chosenSpecies.map((s) => s.commonName),
                          'and'
                       )
                     : 'Any species',
               },
            ]}
         />
         <SummaryGroup
            title="Rules and area"
            onEdit={() => go('where')}
            rows={[
               { label: 'Where', value: whereSummary },
               {
                  label: 'When',
                  value: (
                     <span className="num">
                        {from && to
                           ? whenSentence(from.toISOString(), to.toISOString())
                           : 'Not set yet'}
                     </span>
                  ),
               },
            ]}
         />
         <SummaryGroup
            title="Who can enter"
            onEdit={() => go('who')}
            rows={[
               { label: 'Entry', value: entrySummary },
               { label: 'Checks', value: checksSummary },
            ]}
         />
      </>
   );

   const body: Record<StepKey, React.ReactNode> = {
      what: whatStep,
      where: whereStep,
      who: whoStep,
      invite: inviteStep,
      look: lookStep,
   };

   const last = step === 'look';

   return (
      <>
         {/* The teal rule runs the width of the screen under the header,
             off the card and out of the page's column. */}
         <div
            aria-hidden="true"
            className="relative left-1/2 h-0.5 w-screen -translate-x-1/2 bg-teal"
         />

         <section
            className={cn(
               'mx-auto w-full bg-background transition-[transform,opacity] duration-[460ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)]',
               'md:my-8 md:max-w-[1160px] md:border md:border-line',
               entered ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
            )}
         >
            <header className="flex items-center gap-3.5 border-b border-line px-4 pt-4 pb-3.5 md:px-8 md:py-6">
               <div className="flex min-w-0 flex-1 flex-col gap-3 md:gap-0">
                  <h1 className="g text-[30px] md:text-[36px]">
                     Start a competition
                  </h1>
                  {/* The ticks are the phone's rail: one per step, teal for
                      where you are and ink for what is behind you. */}
                  <ol
                     aria-label="Steps"
                     className="flex items-center gap-1.5 md:hidden"
                  >
                     {STEPS.map((key) => {
                        const at = order.indexOf(key);
                        return (
                           <li
                              key={key}
                              aria-current={key === step ? 'step' : undefined}
                              className={cn(
                                 'h-0.5 w-10',
                                 key === step
                                    ? 'bg-teal'
                                    : at >= 0 && at < index
                                      ? 'bg-ink'
                                      : 'bg-line'
                              )}
                           />
                        );
                     })}
                  </ol>
               </div>
               <button
                  type="button"
                  onClick={close}
                  aria-label="Close and go back to the competitions"
                  className="grid size-10 shrink-0 place-items-center rounded-full border border-line hover:bg-bg-2 md:size-11"
               >
                  <XMarkIcon
                     aria-hidden="true"
                     strokeWidth={1.5}
                     className="size-5"
                  />
               </button>
            </header>

            <div className="md:grid md:grid-cols-[280px_1fr] md:items-start md:gap-16 md:px-8 md:pt-8 md:pb-10">
               <nav aria-label="Steps" className="hidden flex-col md:flex">
                  {STEPS.map((key, i) => {
                     const at = order.indexOf(key);
                     const done = at >= 0 && at < index;
                     const here = key === step;
                     return (
                        <button
                           key={key}
                           type="button"
                           aria-current={here ? 'step' : undefined}
                           disabled={!done && !here}
                           onClick={() => done && go(key)}
                           className={cn(
                              'flex gap-3.5 border-b border-line py-3.5 text-left',
                              here
                                 ? 'border-l-[3px] border-l-teal pl-3.5'
                                 : 'pl-[17px]',
                              here || done ? 'text-ink' : 'text-ink-3'
                           )}
                        >
                           <span className="g num text-[24px] leading-none">
                              {String(i + 1).padStart(2, '0')}
                           </span>
                           <span className="flex min-w-0 flex-col gap-[3px]">
                              <span className="g text-[20px] leading-none">
                                 {STEP_TITLES[key]}
                              </span>
                              {answers[key] && (done || here) ? (
                                 <span className="text-[14px] leading-[1.4] text-ink-2">
                                    {answers[key]}
                                 </span>
                              ) : null}
                           </span>
                        </button>
                     );
                  })}
               </nav>

               <div className="px-4 pt-5 pb-6 md:max-w-[640px] md:p-0">
                  <div className="flex items-baseline justify-between gap-4">
                     <h2 className="g text-[26px]">{STEP_TITLES[step]}</h2>
                     {/* The count sits on the heading rather than in a
                         sentence under the list. */}
                     {step === 'invite' && invitees.length ? (
                        <span className="lab num">
                           {invitees.length} invited
                        </span>
                     ) : null}
                  </div>
                  <div
                     className={cn(
                        'mt-6 flex flex-col md:mt-7 md:gap-7',
                        step === 'look'
                           ? 'gap-7'
                           : step === 'invite'
                             ? 'gap-5'
                             : 'gap-6'
                     )}
                  >
                     {body[step]}
                  </div>
                  {error ? (
                     <p
                        role="alert"
                        className="mt-4 text-[15px] text-destructive"
                     >
                        {error}
                     </p>
                  ) : null}
               </div>
            </div>

            <footer className="sticky bottom-0 z-10 flex gap-2.5 border-t border-line bg-background px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:static md:px-8 md:py-4">
               {index > 0 ? (
                  <button
                     type="button"
                     onClick={back}
                     disabled={busy}
                     className="g-tracked h-[52px] w-16 shrink-0 border border-ink text-[18px] md:w-[120px]"
                  >
                     Back
                  </button>
               ) : null}
               <button
                  type="button"
                  onClick={last ? () => void create() : next}
                  disabled={busy}
                  className={cn(
                     'g-tracked h-[52px] flex-1 text-[22px] disabled:opacity-60 md:ml-auto md:w-60 md:flex-none',
                     last
                        ? 'bg-teal text-teal-ink hover:brightness-95'
                        : 'bg-ink text-background'
                  )}
               >
                  {last
                     ? busy
                        ? 'Starting'
                        : 'Start the competition'
                     : 'Continue'}
               </button>
            </footer>
         </section>

         <Sheet
            open={pickingSpot}
            onOpenChange={setPickingSpot}
            title="Pick a spot"
         >
            <div className="flex flex-col gap-3 p-4">
               <h2 className="g text-[26px]">Pick a spot</h2>
               <PlaceSearch
                  showMine={false}
                  onPick={(hit) => {
                     setPlace(hit);
                     setPickingSpot(false);
                  }}
                  onUseMine={() => undefined}
               />
            </div>
         </Sheet>
      </>
   );
}

/* The heading on a step-5 group, with the way back to the step it came from. */
function SummaryGroup({
   title,
   onEdit,
   rows,
}: {
   title: string;
   onEdit: () => void;
   rows: { label: string; value: React.ReactNode }[];
}) {
   return (
      <div className="flex flex-col gap-1.5">
         <div className="flex items-center justify-between gap-4">
            <span className="lab">{title}</span>
            <button
               type="button"
               onClick={onEdit}
               className="g-tracked text-[15px] text-teal-text hover:opacity-80"
            >
               Edit
            </button>
         </div>
         <RulesTable rows={rows} compact />
      </div>
   );
}
