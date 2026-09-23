import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { PageHead } from '@/components/brand/PageHead';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { InlineError } from '@/components/states/InlineError';
import { NoData } from '@/components/states/NoData';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { Button } from '@/components/ui/button';
import { Fold } from '@/components/ui/fold';
import { Picker } from '@/components/ui/picker';
import { Sheet } from '@/components/ui/sheet';
import { FramedPhoto } from '@/components/FramedPhoto';
import { toast } from '@/components/ui/use-toast';
import {
   answerInvite,
   clockParts,
   enterCompetition,
   fetchCompetition,
   fetchMyFollowers,
   flagEntry,
   inviteToCompetition,
   leaveCompetition,
   listWords,
   reviewEntry,
   ruleSentence,
   scopeLabel,
   statusLabel,
   teamRefusal,
   whenSentence,
   whereSentence,
   withdrawEntry,
   type CompetitionDetail,
   type CompetitionEntry,
   type Follower,
} from '@/components/social/competitions-api';
import { EntryRow } from '@/components/social/EntryRow';
import {
   TeamBoard,
   TeamPicker,
   TeamRoster,
} from '@/components/social/CompetitionTeams';
import { RulesTable } from '@/components/social/RulesTable';
import { StandingsRows } from '@/components/social/StandingsRows';
import { WinnerCard } from '@/components/social/WinnerCard';
import { formatDayMonth } from '@/components/fishing/record/format';
import { useDocumentTitle } from '@/lib/title';
import { unitFor, useUnits, type Units } from '@/lib/units';
import { UnitToggle } from '@/components/social/UnitToggle';

/*
 * One competition: its rules, who is where, and every entry with what was
 * checked about it.
 *
 * The plate carries what a competition is and what you can do about it: the
 * status line, the name, the clock and the two actions. Under the wave the
 * rules are a table, the standings are rows, and the entries are a list that
 * opens one at a time. On a desktop the rules and standings stand on the
 * left with the entries beside them, so an organiser reviews without losing
 * sight of the board.
 *
 * Once it has ended the clock and the actions leave the plate, the winner
 * takes the one black card and the entries fold away under the standings.
 */

const COLUMN = 'w-[min(960px,100%-32px)]';
const POLL_MS = 3000;
const POLL_FOR_MS = 60000;

export function CompetitionPage() {
   return (
      <RequireSignIn what="competitions">
         <CompetitionScreen />
      </RequireSignIn>
   );
}

function CompetitionScreen() {
   const { competitionId = '' } = useParams();
   const navigate = useNavigate();
   const [detail, setDetail] = useState<CompetitionDetail | null>(null);
   const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'gone'>(
      'loading'
   );
   const [attempt, setAttempt] = useState(0);
   /* The reader's cm or in, kg or lb: the toggle on the standings sets it,
      and everything on the page, the entry form too, follows it. */
   const units = useUnits();
   const [busy, setBusy] = useState<string | null>(null);
   const [inviting, setInviting] = useState(false);
   const [picking, setPicking] = useState(false);
   /* Which board the standings show when there are teams: the sides, or
      the anglers. */
   const [board, setBoard] = useState<'anglers' | 'teams'>('teams');
   useDocumentTitle(detail?.competition.name ?? 'Competition');

   const load = useCallback(
      async (signal?: AbortSignal) => {
         try {
            const next = await fetchCompetition(competitionId, signal);
            setDetail(next);
            setStatus('ready');
         } catch (error: unknown) {
            if ((error as { code?: string })?.code === 'ERR_CANCELED') return;
            const code = (error as { response?: { status?: number } })?.response
               ?.status;
            setStatus(code === 404 || code === 403 ? 'gone' : 'error');
         }
      },
      [competitionId]
   );

   useEffect(() => {
      const controller = new AbortController();
      void load(controller.signal);
      return () => controller.abort();
   }, [load, attempt]);

   /* While any entry is still being checked, ask again every few seconds. */
   const pending = detail?.entries.some((e) => e.state === 'PENDING') ?? false;
   useEffect(() => {
      if (!pending) return;
      const started = Date.now();
      const timer = window.setInterval(() => {
         if (Date.now() - started > POLL_FOR_MS) {
            window.clearInterval(timer);
            return;
         }
         void load();
      }, POLL_MS);
      return () => window.clearInterval(timer);
   }, [pending, load]);

   /* The clock, for the time left, once a minute. */
   const [now, setNow] = useState(() => Date.now());
   useEffect(() => {
      const timer = window.setInterval(() => setNow(Date.now()), 60000);
      return () => window.clearInterval(timer);
   }, []);

   const act = async (key: string, run: () => Promise<unknown>) => {
      setBusy(key);
      try {
         await run();
         await load();
      } catch (error) {
         /* The server's own words when it has some: with teams a refusal
            says why (full, settled at the start), which "try again" would
            not. */
         toast({
            title: 'That did not go through.',
            description: teamRefusal(error),
            variant: 'error',
         });
         /* Whatever was refused (a side filled, the start came), the page
            says how things stand now. */
         void load();
      } finally {
         setBusy(null);
      }
   };

   if (status === 'gone') return <NotFoundPage />;

   const c = detail?.competition ?? null;
   const you = detail?.you ?? null;
   const finished = c?.status === 'finished';
   const clock = c && !finished ? clockParts(c, now) : null;
   const teams = detail?.teams ?? null;
   const yourTeamId = c?.yourTeamId ?? null;
   const yourTeam = teams?.teams.find((t) => t.id === yourTeamId) ?? null;
   /* In it but on no side: an invitation accepted, or the organiser, who
      starts a competition without picking one. */
   const needsTeam = Boolean(teams && you?.entered && !yourTeamId);

   const answer = (accept: boolean) =>
      void act('invite', async () => {
         if (!you?.invite) return;
         await answerInvite(you.invite.id, accept);
         if (!accept) navigate('/competitions');
      });

   /*
    * The plate's two actions. The teal one is the way in: submit a catch
    * once you are in it, accept an invitation, or enter an open one. The
    * outlined one beside it is whatever else is yours to do here.
    */
   const actions =
      !c || !you || finished ? null : (
         <div className="on-black flex gap-2.5">
            {you.invite ? (
               <>
                  <Button
                     type="button"
                     className="text-[18px]"
                     disabled={busy !== null}
                     onClick={() => answer(true)}
                  >
                     Accept invite
                  </Button>
                  <Button
                     type="button"
                     variant="outline"
                     className="border-paper/50 px-[18px] text-[18px] text-paper"
                     disabled={busy !== null}
                     onClick={() => answer(false)}
                  >
                     Decline
                  </Button>
               </>
            ) : needsTeam ? (
               <Button
                  type="button"
                  className="text-[18px]"
                  disabled={busy !== null}
                  onClick={() => setPicking(true)}
               >
                  Pick a team
               </Button>
            ) : you.entered && c.status === 'running' ? (
               <Button asChild className="text-[18px]">
                  <Link to={`/log?competition=${c.id}`}>Submit a catch</Link>
               </Button>
            ) : you.entered && teams && c.status === 'upcoming' ? (
               <Button
                  type="button"
                  className="text-[18px]"
                  disabled={busy !== null}
                  onClick={() => setPicking(true)}
               >
                  Change team
               </Button>
            ) : !you.entered && c.scope === 'PUBLIC' ? (
               <Button
                  type="button"
                  className="text-[18px]"
                  disabled={busy !== null}
                  onClick={() =>
                     teams
                        ? setPicking(true)
                        : void act('enter', () => enterCompetition(c.id))
                  }
               >
                  {teams ? 'Pick a team' : 'Enter'}
               </Button>
            ) : null}

            {you.organise && c.scope === 'PRIVATE' ? (
               <Button
                  type="button"
                  variant="outline"
                  className="border-paper/50 px-[18px] text-[18px] text-paper"
                  onClick={() => setInviting(true)}
               >
                  Invite
               </Button>
            ) : you.entered && !you.organise && !you.invite ? (
               <Button
                  type="button"
                  variant="outline"
                  className="border-paper/50 px-[18px] text-[18px] text-paper"
                  disabled={busy !== null}
                  onClick={() =>
                     void act('leave', () => leaveCompetition(c.id))
                  }
               >
                  Leave
               </Button>
            ) : null}
         </div>
      );

   return (
      <section className={`relative mx-auto ${COLUMN} pb-10 md:pb-14`}>
         <PageHead
            column={COLUMN}
            back={
               <Link
                  to="/competitions"
                  className="inline-flex items-center gap-2.5"
               >
                  <ArrowLeftIcon
                     aria-hidden="true"
                     strokeWidth={1.5}
                     className="size-[18px]"
                  />
                  Competitions
               </Link>
            }
            kicker={
               c
                  ? `${statusLabel(c.status)} · ${scopeLabel(c.scope)}${finished ? ` · ${formatDayMonth(c.endsAt)}` : ''}`
                  : undefined
            }
            kickerTone={finished ? 'quiet' : 'teal'}
            title={c?.name ?? 'Competition'}
            lede={c?.blurb ?? undefined}
            aside={
               clock || actions ? (
                  <div className="mt-4 flex flex-col gap-4 md:mt-0 md:items-end">
                     {clock ? (
                        <p className="flex items-baseline gap-2">
                           <span className="g num text-[40px] leading-[0.95] text-paper md:text-[48px]">
                              {clock[0]}
                           </span>
                           <span className="lab text-paper-2">{clock[1]}</span>
                        </p>
                     ) : null}
                     {actions}
                  </div>
               ) : undefined
            }
         />

         {status === 'loading' && !detail ? (
            <p className="text-ink-2" role="status">
               Reading the competition.
            </p>
         ) : status === 'error' || !detail || !c || !you ? (
            <InlineError
               message="Could not read the competition."
               onRetry={() => {
                  setStatus('loading');
                  setAttempt((n) => n + 1);
               }}
            />
         ) : finished ? (
            <Results
               detail={detail}
               units={units}
               board={board}
               onBoard={setBoard}
            />
         ) : (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-16">
               <div className="flex flex-col gap-8 lg:gap-9">
                  <RulesTable
                     rows={[
                        {
                           label: 'Rule',
                           value:
                              c.rule === 'SPECIES_VARIETY' ? (
                                 ruleSentence(c.rule, c.measure)
                              ) : (
                                 <>
                                    {ruleSentence(c.rule, c.measure)}
                                    <span className="block text-[14px] text-ink-3">
                                       {rankedWords(c.measure, units)}
                                    </span>
                                 </>
                              ),
                        },
                        {
                           /* Every name, however many: this is where an
                              angler checks their fish is on the list. */
                           label: 'Species',
                           value: c.species.length
                              ? listWords(
                                   c.species.map((s) => s.commonName),
                                   'and'
                                )
                              : 'Any species',
                        },
                        { label: 'Where', value: whereSentence(c) },
                        {
                           label: 'When',
                           value: (
                              <span className="num">
                                 {whenSentence(c.startsAt, c.endsAt)}
                              </span>
                           ),
                        },
                        { label: 'Entry', value: entrySentence(detail) },
                        {
                           label: 'Anglers',
                           value: `${c.entrantCount} entered${you.organise ? ' · you organise' : ''}`,
                        },
                        ...(teams
                           ? [
                                {
                                   label: 'Teams',
                                   value: teamsSentence(
                                      teams.teams.length,
                                      c.maxPerTeam ?? null,
                                      yourTeam?.name ?? null,
                                      you.entered
                                   ),
                                },
                             ]
                           : []),
                     ]}
                  />

                  <section aria-labelledby="standings-heading">
                     <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <h2
                           id="standings-heading"
                           className="g text-[26px] lg:text-[28px]"
                        >
                           Provisional standings
                        </h2>
                        {c.rule !== 'SPECIES_VARIETY' ? (
                           <UnitToggle measure={c.measure} />
                        ) : null}
                     </div>
                     {detail.teamStandings ? (
                        <BoardSwitch value={board} onChange={setBoard} />
                     ) : null}
                     <div className="mt-3">
                        {detail.teamStandings && board === 'teams' ? (
                           <TeamBoard
                              competition={c}
                              standings={detail.teamStandings}
                              units={units}
                              yourTeamId={yourTeamId}
                           />
                        ) : detail.standings.length ? (
                           <StandingsRows
                              competition={c}
                              standings={detail.standings}
                              entries={detail.entries}
                              units={units}
                           />
                        ) : (
                           <p className="text-[15px] text-ink-2">
                              No counted entry yet.
                           </p>
                        )}
                     </div>
                  </section>

                  {teams ? (
                     <TeamRoster
                        competition={c}
                        teams={teams.teams}
                        unassigned={teams.unassigned}
                        organise={you.organise}
                        onChanged={() => load()}
                     />
                  ) : null}

                  <p className="hidden text-[14px] text-ink-3 lg:block">
                     Your exact fishing spot is never shown on these boards.
                  </p>
               </div>

               <Entries
                  detail={detail}
                  units={units}
                  busy={busy}
                  act={act}
                  competitionId={c.id}
               />

               <p className="text-[14px] text-ink-3 lg:hidden">
                  Your exact fishing spot is never shown on these boards.
               </p>
            </div>
         )}

         {c ? (
            <InviteSheet
               open={inviting}
               onOpenChange={setInviting}
               competitionId={c.id}
            />
         ) : null}
         {c && teams ? (
            <TeamPicker
               open={picking}
               onOpenChange={setPicking}
               competition={c}
               teams={teams.teams}
               current={yourTeamId}
               onPick={async (teamId) => {
                  /* Refused, the sheet stays open on the fresh counts so
                     another side can be picked. */
                  setBusy('team');
                  try {
                     await enterCompetition(c.id, teamId);
                     await load();
                  } catch (error) {
                     toast({
                        title: 'That did not go through.',
                        description: teamRefusal(error),
                        variant: 'error',
                     });
                     await load();
                     throw error;
                  } finally {
                     setBusy(null);
                  }
               }}
            />
         ) : null}
      </section>
   );
}

/*
 * The competition's own unit beside the reader's. Every figure is held and
 * ranked in centimetres or kilograms whatever the reader picks, and saying
 * so under the rule is what lets a board shown in inches be trusted.
 */
function rankedWords(measure: 'LENGTH' | 'WEIGHT', units: Units) {
   const own = measure === 'LENGTH' ? 'centimetres' : 'kilograms';
   const shown = unitFor(measure, units);
   const shownWord =
      shown === 'in' ? 'inches' : shown === 'lb' ? 'pounds' : null;
   return shownWord
      ? `Ranked in ${own}, shown here in ${shownWord}.`
      : `Ranked in ${own}.`;
}

/* The teams row of the rules table: how many, how big, and yours. */
function teamsSentence(
   count: number,
   cap: number | null,
   yours: string | null,
   entered: boolean
) {
   const size = cap ? `${count} teams of up to ${cap}.` : `${count} teams.`;
   if (yours) return `${size} You fish for ${yours}.`;
   return entered ? `${size} Pick yours.` : size;
}

/*
 * The sides or the anglers. Two words in the manner of the unit toggle, so a
 * reader sees at once which board they are reading.
 */
function BoardSwitch({
   value,
   onChange,
}: {
   value: 'anglers' | 'teams';
   onChange: (value: 'anglers' | 'teams') => void;
}) {
   return (
      <div role="group" aria-label="Board" className="mt-2 flex gap-5">
         {(['teams', 'anglers'] as const).map((option) => (
            <button
               key={option}
               type="button"
               aria-pressed={value === option}
               onClick={() => onChange(option)}
               className={`g-tracked inline-flex min-h-11 items-center border-b-2 text-[16px] transition-colors ${
                  value === option
                     ? 'border-teal text-ink'
                     : 'border-transparent text-ink-3 hover:text-ink'
               }`}
            >
               {option === 'teams' ? 'Teams' : 'Anglers'}
            </button>
         ))}
      </div>
   );
}

/* What happens to an entry here, in the words the rules table prints. */
function entrySentence(detail: CompetitionDetail) {
   const c = detail.competition;
   const photo =
      c.rule === 'SPECIES_VARIETY'
         ? 'A photo of the fish.'
         : c.measure === 'LENGTH'
           ? 'A photo of the fish, then one on the tape.'
           : 'A photo of the fish, then one on the scale.';
   const after =
      c.checks === 'REVIEW'
         ? detail.you.organise
            ? 'Six checks and the judge, then you review.'
            : 'Six checks and the judge, then the organiser reviews.'
         : 'Six checks and the judge, then it counts.';
   return `${photo} ${after}`;
}

function Entries({
   detail,
   units,
   busy,
   act,
   competitionId,
}: {
   detail: CompetitionDetail;
   units: Units;
   busy: string | null;
   act: (key: string, run: () => Promise<unknown>) => Promise<void>;
   competitionId: string;
}) {
   const c = detail.competition;
   const sorted = useMemo(
      () =>
         [...detail.entries].sort(
            (a, b) =>
               new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
         ),
      [detail.entries]
   );
   const held = sorted.filter((e) => e.state === 'HELD');

   /* The entry waiting on somebody is the one that is open to begin with. */
   const [open, setOpen] = useState<string | null>(() => held[0]?.id ?? null);

   const count = `${sorted.length}${held.length ? ` · ${held.length} held` : ''}`;

   return (
      <section aria-labelledby="entries-heading" className="min-w-0">
         <div className="flex items-baseline justify-between gap-4">
            <h2 id="entries-heading" className="g text-[26px] lg:text-[28px]">
               Entries
            </h2>
            {sorted.length ? <span className="lab num">{count}</span> : null}
         </div>
         {sorted.length === 0 ? (
            <div className="mt-3">
               <NoData compact title="No entries yet">
                  {c.status === 'running'
                     ? 'The first catch submitted lands here.'
                     : 'Nothing was entered.'}
               </NoData>
            </div>
         ) : (
            <ul className="mt-3 flex flex-col border-t border-line">
               {sorted.map((entry) => (
                  <EntryRow
                     key={entry.id}
                     competition={c}
                     entry={entry}
                     units={units}
                     open={open === entry.id}
                     onToggle={() =>
                        setOpen((was) => (was === entry.id ? null : entry.id))
                     }
                     busy={busy}
                     onReview={(e, action, note) =>
                        void act(`review:${e.id}`, () =>
                           reviewEntry(competitionId, e.id, action, note)
                        )
                     }
                     onFlag={(e, reason) =>
                        void act(`flag:${e.id}`, () =>
                           flagEntry(competitionId, e.id, reason)
                        )
                     }
                     onWithdraw={(e) =>
                        void act(`withdraw:${e.id}`, () =>
                           withdrawEntry(competitionId, e.id)
                        )
                     }
                  />
               ))}
            </ul>
         )}
      </section>
   );
}

/* A finished competition: the winner, the final standings, the entries folded. */
function Results({
   detail,
   units,
   board,
   onBoard,
}: {
   detail: CompetitionDetail;
   units: Units;
   board: 'anglers' | 'teams';
   onBoard: (board: 'anglers' | 'teams') => void;
}) {
   const c = detail.competition;
   const winner =
      detail.standings.find((s) => s.place === 1 && s.score > 0) ?? null;
   const notCounted = detail.entries.filter(
      (e) => e.state === 'EXCLUDED'
   ).length;

   return (
      <div className="flex flex-col gap-8">
         {winner ? (
            <WinnerCard
               competition={c}
               winner={winner}
               entries={detail.entries}
               units={units}
            />
         ) : null}

         <section aria-labelledby="final-heading">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
               <h2 id="final-heading" className="g text-[26px] lg:text-[28px]">
                  Final standings
               </h2>
               {c.rule !== 'SPECIES_VARIETY' ? (
                  <UnitToggle measure={c.measure} />
               ) : null}
            </div>
            {detail.teamStandings ? (
               <BoardSwitch value={board} onChange={onBoard} />
            ) : null}
            <div className="mt-3">
               {detail.teamStandings && board === 'teams' ? (
                  <TeamBoard
                     competition={c}
                     standings={detail.teamStandings}
                     units={units}
                     yourTeamId={c.yourTeamId ?? null}
                  />
               ) : detail.standings.length ? (
                  <StandingsRows
                     competition={c}
                     standings={detail.standings}
                     entries={detail.entries}
                     units={units}
                     final
                  />
               ) : (
                  <p className="text-[15px] text-ink-2">
                     It closed with no counted entry.
                  </p>
               )}
            </div>
         </section>

         <div className="border-y border-line">
            <Fold
               title="Entries"
               className="[&>button]:min-h-[52px]"
               headingClassName="g text-[22px] md:text-[22px]"
               aside={
                  detail.entries.length
                     ? `${detail.entries.length}${notCounted ? ` · ${notCounted} not counted` : ''}`
                     : undefined
               }
            >
               <ul className="flex flex-col border-t border-line pb-2">
                  {detail.entries.map((entry) => (
                     <ClosedEntry key={entry.id} entry={entry} />
                  ))}
               </ul>
            </Fold>
         </div>

         <p className="text-[14px] text-ink-3">
            Your exact fishing spot is never shown on these boards.
         </p>
      </div>
   );
}

/* Inside the fold on a finished competition there is nothing left to do
   about an entry, so the row does not open. */
function ClosedEntry({ entry }: { entry: CompetitionEntry }) {
   return (
      <li className="flex items-center gap-3 border-b border-line py-3.5 last:border-b-0">
         <span className="size-14 shrink-0 bg-black-block">
            {entry.heroUrl ? (
               <FramedPhoto
                  src={entry.heroUrl}
                  alt=""
                  framing={entry.heroFraming ?? null}
                  className="size-14"
               />
            ) : null}
         </span>
         <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
            <span className="truncate text-[15px] font-semibold">
               {entry.displayName}
            </span>
            <span className="truncate text-[14px] text-ink-2">
               {entry.speciesName ?? 'Species not given'}
            </span>
         </span>
         <span
            className={`lab shrink-0 text-right ${entry.state === 'COUNTED' ? 'text-ink' : 'text-ink-3'}`}
         >
            {entry.state === 'COUNTED' ? 'Counted' : 'Not counted'}
         </span>
      </li>
   );
}

/*
 * Inviting, in a sheet.
 *
 * The plate gives Invite one outlined button, so the follower list it used
 * to open inline now rises over the page and closes again.
 */
function InviteSheet({
   open,
   onOpenChange,
   competitionId,
}: {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   competitionId: string;
}) {
   const [followers, setFollowers] = useState<Follower[] | null>(null);
   const [picked, setPicked] = useState<string[]>([]);
   const [sent, setSent] = useState<number | null>(null);

   useEffect(() => {
      if (!open || followers) return;
      const controller = new AbortController();
      fetchMyFollowers(controller.signal)
         .then(setFollowers)
         .catch(() => setFollowers([]));
      return () => controller.abort();
   }, [open, followers]);

   return (
      <Sheet open={open} onOpenChange={onOpenChange} title="Invite followers">
         <div className="flex flex-col gap-4 p-4">
            <h2 className="g text-[26px]">Invite followers</h2>
            <Picker
               multiple
               variant="line"
               label="Followers"
               allLabel={
                  followers === null
                     ? 'Reading'
                     : followers.length
                       ? 'Pick who to invite'
                       : 'Nobody follows you yet'
               }
               value={picked}
               onChange={(next) => setPicked(next as string[])}
               options={(followers ?? []).map((f) => ({
                  value: f.id,
                  label: f.displayName,
                  hint: f.username ? `@${f.username}` : undefined,
               }))}
            />
            <div className="flex items-center gap-3">
               <Button
                  type="button"
                  disabled={!picked.length}
                  onClick={() =>
                     void inviteToCompetition(competitionId, picked).then(
                        (r) => {
                           setSent(r.sent);
                           setPicked([]);
                        }
                     )
                  }
               >
                  Send
               </Button>
               {sent !== null ? (
                  <span className="text-[14px] text-ink-2">
                     {sent === 1 ? '1 invitation sent.' : `${sent} sent.`}
                  </span>
               ) : null}
            </div>
         </div>
      </Sheet>
   );
}
