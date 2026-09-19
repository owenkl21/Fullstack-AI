import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
   CheckIcon,
   FlagIcon,
   MinusIcon,
   UsersIcon,
} from '@heroicons/react/24/outline';
import { PageHead } from '@/components/brand/PageHead';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { InlineError } from '@/components/states/InlineError';
import { NoData } from '@/components/states/NoData';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { Button } from '@/components/ui/button';
import { Picker } from '@/components/ui/picker';
import { TextField } from '@/components/ui/field';
import { toast } from '@/components/ui/use-toast';
import {
   answerInvite,
   areaSentence,
   checksSentence,
   dateRange,
   enterCompetition,
   entryStateLabel,
   fetchCompetition,
   fetchMyFollowers,
   flagEntry,
   inviteToCompetition,
   leadingFigure,
   leaveCompetition,
   reviewEntry,
   ruleSentence,
   timeLeft,
   withdrawEntry,
   type CheckCode,
   type Competition,
   type CompetitionDetail,
   type CompetitionEntry,
   type CompetitionStanding,
   type Follower,
} from '@/components/social/competitions-api';
import { ScopeChip, StatusChip } from '@/pages/social/CompetitionsPage';
import { formatStamp } from '@/components/fishing/record/format';
import { useDocumentTitle } from '@/lib/title';
import { formatMeasure, readUnitSystem, type UnitSystem } from '@/lib/units';
import { cn } from '@/lib/utils';

/*
 * One competition: its rules, who is where, and every entry with what was
 * checked about it.
 *
 * The standings are provisional while it runs and settle when it ends. An
 * entry is a catch frozen at the moment it was entered, so the board does
 * not move when a catch is edited later. Each entry shows its checks, one
 * line each, and the organiser accepts or excludes from here.
 */

const CHECK_LABELS: Record<CheckCode, string> = {
   fish: 'Fish in the photo',
   species: 'Species',
   figure: 'Figure',
   window: 'Time',
   area: 'Area',
   duplicate: 'Not entered twice',
};

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
   const [units] = useState<UnitSystem>(() => readUnitSystem());
   const [busy, setBusy] = useState<string | null>(null);
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
      } catch {
         toast({
            title: 'That did not go through.',
            description: 'Try again in a moment.',
            variant: 'error',
         });
      } finally {
         setBusy(null);
      }
   };

   if (status === 'gone') return <NotFoundPage />;

   const c = detail?.competition ?? null;
   const you = detail?.you ?? null;

   const timing = !c
      ? ''
      : c.status === 'running'
        ? timeLeft(c.endsAt, now)
        : c.status === 'upcoming'
          ? `Starts ${dateRange(c.startsAt, c.startsAt)}`
          : 'Results';

   return (
      <section className="relative mx-auto w-[min(1040px,100%-32px)] pb-10 md:pb-14">
         <PageHead
            column="w-[min(1040px,100%-32px)]"
            kicker={
               c
                  ? `${ruleSentence(c.rule, c.measure)} · ${areaSentence(c)}`
                  : 'Competition'
            }
            title={c?.name ?? 'Competition'}
            lede={
               c ? (
                  <span className="flex flex-wrap items-center gap-2">
                     <StatusChip status={c.status} />
                     <ScopeChip scope={c.scope} className="text-paper" />
                     <span className="num">
                        {dateRange(c.startsAt, c.endsAt)}
                     </span>
                  </span>
               ) : null
            }
            aside={
               c ? (
                  <span className="g-tracked text-[22px]">{timing}</span>
               ) : null
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
         ) : (
            <>
               <Rules competition={c} />

               <Actions
                  competition={c}
                  you={you}
                  busy={busy}
                  onEnter={() =>
                     void act('enter', () => enterCompetition(c.id))
                  }
                  onLeave={() =>
                     void act('leave', () => leaveCompetition(c.id))
                  }
                  onAnswer={(accept) =>
                     void act('invite', async () => {
                        if (!you.invite) return;
                        await answerInvite(you.invite.id, accept);
                        if (!accept) navigate('/competitions');
                     })
                  }
               />

               <Standings
                  competition={c}
                  standings={detail.standings}
                  units={units}
               />

               <Entries
                  competition={c}
                  entries={detail.entries}
                  units={units}
                  busy={busy}
                  onReview={(entry, action, note) =>
                     void act(`review:${entry.id}`, () =>
                        reviewEntry(c.id, entry.id, action, note)
                     )
                  }
                  onFlag={(entry, reason) =>
                     void act(`flag:${entry.id}`, () =>
                        flagEntry(c.id, entry.id, reason)
                     )
                  }
                  onWithdraw={(entry) =>
                     void act(`withdraw:${entry.id}`, () =>
                        withdrawEntry(c.id, entry.id)
                     )
                  }
               />

               <p className="mt-10 text-[14px] text-ink-3">
                  Your exact fishing spot is never shown on these boards.
               </p>
            </>
         )}
      </section>
   );
}

function Rules({ competition: c }: { competition: Competition }) {
   const rows: [string, string][] = [
      [
         'Rule',
         `${ruleSentence(c.rule, c.measure)}${c.species ? `, ${c.species.commonName} only` : ''}`,
      ],
      ['Where', areaSentence(c)],
      ['When', dateRange(c.startsAt, c.endsAt)],
      ['Entries', checksSentence(c.checks)],
      ['Organiser', c.createdBy.displayName],
   ];
   return (
      <section aria-labelledby="rules-heading">
         <h2 id="rules-heading" className="lab">
            The rules and area
         </h2>
         {c.blurb ? (
            <p className="mt-2 max-w-[60ch] text-[16px]">{c.blurb}</p>
         ) : null}
         <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[15px]">
            {rows.map(([k, v]) => (
               <div key={k} className="contents">
                  <dt className="lab pt-0.5 text-ink-3">{k}</dt>
                  <dd className="min-w-0">{v}</dd>
               </div>
            ))}
         </dl>
      </section>
   );
}

function Actions({
   competition: c,
   you,
   busy,
   onEnter,
   onLeave,
   onAnswer,
}: {
   competition: Competition;
   you: CompetitionDetail['you'];
   busy: string | null;
   onEnter: () => void;
   onLeave: () => void;
   onAnswer: (accept: boolean) => void;
}) {
   const [inviting, setInviting] = useState(false);
   const [followers, setFollowers] = useState<Follower[] | null>(null);
   const [picked, setPicked] = useState<string[]>([]);
   const [sent, setSent] = useState<number | null>(null);
   useEffect(() => {
      if (!inviting || followers) return;
      const controller = new AbortController();
      fetchMyFollowers(controller.signal)
         .then(setFollowers)
         .catch(() => setFollowers([]));
      return () => controller.abort();
   }, [inviting, followers]);

   const finished = c.status === 'finished';
   const running = c.status === 'running';

   return (
      <section className="mt-8 flex flex-col gap-3">
         <div className="flex flex-wrap items-center gap-3">
            {you.invite ? (
               <>
                  <Button
                     type="button"
                     disabled={busy !== null}
                     onClick={() => onAnswer(true)}
                  >
                     Accept invitation
                  </Button>
                  <Button
                     type="button"
                     variant="ghost"
                     disabled={busy !== null}
                     onClick={() => onAnswer(false)}
                  >
                     Decline
                  </Button>
               </>
            ) : null}

            {you.entered && running ? (
               <Link
                  to={`/log?competition=${c.id}`}
                  className="g-tracked inline-flex h-11 items-center bg-teal px-5 text-[19px] text-teal-ink hover:brightness-105"
               >
                  Submit a catch
               </Link>
            ) : null}

            {!you.entered &&
            !you.invite &&
            !finished &&
            c.scope === 'PUBLIC' ? (
               <Button type="button" disabled={busy !== null} onClick={onEnter}>
                  Enter competition
               </Button>
            ) : null}

            {!you.entered && !you.invite && c.scope === 'PRIVATE' ? (
               <span className="text-[14px] text-ink-3">By invitation.</span>
            ) : null}

            {you.organise && c.scope === 'PRIVATE' && !finished ? (
               <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInviting((open) => !open)}
               >
                  {inviting ? 'Done inviting' : 'Invite'}
               </Button>
            ) : null}

            {you.entered && !you.organise && !finished ? (
               <Button
                  type="button"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={onLeave}
               >
                  Leave
               </Button>
            ) : null}

            <span className="ml-auto flex items-center gap-1.5 text-[14px] text-ink-3">
               <UsersIcon aria-hidden="true" className="size-4" />
               <span className="num">
                  {c.entrantCount === 1
                     ? '1 angler'
                     : `${c.entrantCount} anglers`}
               </span>
               {you.organise ? (
                  <span className="lab text-teal-text">You organise</span>
               ) : null}
            </span>
         </div>

         {inviting ? (
            <div className="flex flex-wrap items-end gap-3 border-l-[3px] border-teal bg-bg-2 px-4 py-3">
               <Picker
                  multiple
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
                  className="min-w-[240px]"
               />
               <Button
                  type="button"
                  size="sm"
                  disabled={!picked.length}
                  onClick={() =>
                     void inviteToCompetition(c.id, picked).then((r) => {
                        setSent(r.sent);
                        setPicked([]);
                     })
                  }
               >
                  Send
               </Button>
               {sent !== null ? (
                  <span className="text-[14px] text-ink-2">
                     {sent === 1
                        ? '1 invitation sent.'
                        : `${sent} invitations sent.`}
                  </span>
               ) : null}
            </div>
         ) : null}
      </section>
   );
}

function Standings({
   competition: c,
   standings,
   units,
}: {
   competition: Competition;
   standings: CompetitionStanding[];
   units: UnitSystem;
}) {
   const finished = c.status === 'finished';
   const figure = (s: CompetitionStanding) =>
      leadingFigure(c, s.score, units) ?? 'Nothing yet';
   const winners = finished
      ? standings.filter((s) => s.place === 1 && s.score > 0)
      : [];

   return (
      <section className="mt-10" aria-labelledby="standings-heading">
         <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="standings-heading" className="g text-[26px]">
               {finished ? 'Standings' : 'Provisional standings'}
            </h2>
            {!finished ? (
               <span className="text-[14px] text-ink-3">
                  Equal scores share a place.
               </span>
            ) : null}
         </div>

         {winners.length ? (
            <p className="mt-3 border-l-[3px] border-teal bg-bg-2 px-4 py-3 text-[16px]">
               <span className="lab mr-2 text-ink-3">
                  {winners.length > 1 ? 'Joint winners' : 'Winner'}
               </span>
               <span className="g text-[22px]">
                  {winners.map((w) => w.displayName).join(' and ')}
               </span>{' '}
               <span className="text-ink-2">with {figure(winners[0]!)}.</span>
            </p>
         ) : null}

         {standings.length === 0 ? (
            <p className="mt-3 text-[15px] text-ink-2">
               {finished
                  ? 'It closed with no counted entry.'
                  : 'No counted entry yet.'}
            </p>
         ) : (
            <table className="mt-3 w-full border-collapse text-left">
               <thead>
                  <tr className="border-b border-line">
                     <th className="lab py-2 pr-3 font-normal">#</th>
                     <th className="lab py-2 pr-3 font-normal">Angler</th>
                     <th className="lab hidden py-2 pr-3 font-normal sm:table-cell">
                        Best catch
                     </th>
                     <th className="lab py-2 text-right font-normal">
                        {c.rule === 'SPECIES_VARIETY'
                           ? 'Species'
                           : c.measure === 'LENGTH'
                             ? 'Length'
                             : 'Weight'}
                     </th>
                  </tr>
               </thead>
               <tbody>
                  {standings.map((s) => (
                     <tr key={s.anglerId} className="border-b border-line/60">
                        <td className="num py-3 pr-3 text-[15px] text-ink-2">
                           {s.joint ? `=${s.place}` : s.place}
                        </td>
                        <td className="py-3 pr-3 text-[17px]">
                           <Link
                              to={`/anglers/${s.anglerId}`}
                              className="hover:text-teal-text"
                           >
                              {s.displayName}
                           </Link>
                        </td>
                        <td className="hidden py-3 pr-3 text-[15px] text-ink-2 sm:table-cell">
                           {s.bestSpeciesName ?? ''}
                        </td>
                        <td className="num py-3 text-right text-[17px]">
                           {figure(s)}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         )}
      </section>
   );
}

function Entries({
   competition: c,
   entries,
   units,
   busy,
   onReview,
   onFlag,
   onWithdraw,
}: {
   competition: Competition;
   entries: CompetitionEntry[];
   units: UnitSystem;
   busy: string | null;
   onReview: (
      entry: CompetitionEntry,
      action: 'accept' | 'exclude',
      note: string
   ) => void;
   onFlag: (entry: CompetitionEntry, reason: string) => void;
   onWithdraw: (entry: CompetitionEntry) => void;
}) {
   const [open, setOpen] = useState<string | null>(null);
   const sorted = useMemo(
      () =>
         [...entries].sort(
            (a, b) =>
               new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
         ),
      [entries]
   );

   return (
      <section className="mt-10" aria-labelledby="entries-heading">
         <h2 id="entries-heading" className="g text-[26px]">
            Entries
         </h2>
         {sorted.length === 0 ? (
            <div className="mt-3">
               <NoData compact title="No entries yet">
                  {c.status === 'running'
                     ? 'The first catch submitted lands here.'
                     : 'Nothing was entered.'}
               </NoData>
            </div>
         ) : (
            <ul className="mt-3 flex flex-col">
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
                     onReview={onReview}
                     onFlag={onFlag}
                     onWithdraw={onWithdraw}
                  />
               ))}
            </ul>
         )}
      </section>
   );
}

function StateChip({ state }: { state: CompetitionEntry['state'] }) {
   return (
      <span
         className={cn(
            'lab px-2 py-1',
            state === 'COUNTED'
               ? 'bg-teal text-teal-ink'
               : state === 'HELD'
                 ? 'border border-ink text-ink'
                 : state === 'EXCLUDED'
                   ? 'border border-line text-ink-3'
                   : 'text-ink-3'
         )}
      >
         {entryStateLabel(state)}
      </span>
   );
}

function EntryRow({
   competition: c,
   entry,
   units,
   open,
   onToggle,
   busy,
   onReview,
   onFlag,
   onWithdraw,
}: {
   competition: Competition;
   entry: CompetitionEntry;
   units: UnitSystem;
   open: boolean;
   onToggle: () => void;
   busy: string | null;
   onReview: (
      entry: CompetitionEntry,
      action: 'accept' | 'exclude',
      note: string
   ) => void;
   onFlag: (entry: CompetitionEntry, reason: string) => void;
   onWithdraw: (entry: CompetitionEntry) => void;
}) {
   const [note, setNote] = useState('');
   const [flagging, setFlagging] = useState(false);
   const [reason, setReason] = useState('');
   const working = busy !== null && busy.endsWith(entry.id);

   const figure =
      c.rule === 'SPECIES_VARIETY'
         ? null
         : formatMeasure(entry.value, c.measure, units);
   const typed =
      entry.readValue !== null &&
      entry.declaredValue !== null &&
      Math.abs(entry.readValue - entry.declaredValue) > 0.001
         ? formatMeasure(entry.declaredValue, c.measure, units)
         : null;

   return (
      <li className="border-t border-line last:border-b">
         <div className="flex gap-4 py-4">
            <button
               type="button"
               onClick={onToggle}
               aria-expanded={open}
               className="w-24 shrink-0 bg-black-block md:w-32"
               aria-label={open ? 'Close the entry' : 'Open the entry'}
            >
               {entry.heroUrl ? (
                  <img
                     src={entry.heroUrl}
                     alt=""
                     className="aspect-[4/3] w-full object-cover"
                  />
               ) : (
                  <span className="block aspect-[4/3] w-full" />
               )}
            </button>

            <div className="min-w-0 flex-1">
               <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link
                     to={`/anglers/${entry.anglerId}`}
                     className="g-tracked text-[19px] hover:text-teal-text"
                  >
                     {entry.displayName}
                  </Link>
                  <StateChip state={entry.state} />
               </div>
               <p className="mt-1 text-[15px]">
                  {entry.speciesName ?? 'Species not given'}
                  {figure ? (
                     <>
                        {' · '}
                        <span className="num">{figure}</span>
                        {typed ? (
                           <span className="text-ink-3"> (typed {typed})</span>
                        ) : null}
                     </>
                  ) : null}
               </p>
               <p className="num mt-0.5 text-[13px] text-ink-3">
                  {formatStamp(entry.caughtAt)}
                  {c.areaType !== 'ANYWHERE'
                     ? ' · Waterbody shown; exact spot hidden.'
                     : ''}
               </p>
               {entry.note ? (
                  <p className="mt-1 max-w-[60ch] text-[14px] text-ink-2">
                     {entry.note}
                  </p>
               ) : null}
               {entry.state === 'HELD' && entry.flaggedBy ? (
                  <p className="mt-1 text-[14px] text-ink-2">
                     Flagged by {entry.flaggedBy}
                     {entry.flagReason ? `: ${entry.flagReason}` : '.'}
                  </p>
               ) : null}
               {entry.reviewNote ? (
                  <p className="mt-1 text-[14px] text-ink-2">
                     Organiser: {entry.reviewNote}
                  </p>
               ) : null}
               <button
                  type="button"
                  onClick={onToggle}
                  aria-expanded={open}
                  className="g-tracked mt-2 inline-flex min-h-11 items-center text-[15px] text-teal-text hover:opacity-80"
               >
                  {open ? 'Close' : 'The checks'}
               </button>
            </div>
         </div>

         {open ? (
            <div className="grid gap-5 pb-5 md:grid-cols-[minmax(0,1fr)_240px]">
               <div>
                  {entry.state === 'PENDING' ? (
                     <p className="text-[15px] text-ink-2" role="status">
                        Checking. A few seconds.
                     </p>
                  ) : entry.report.length === 0 ? (
                     <p className="text-[15px] text-ink-2">
                        Nothing was checked.
                     </p>
                  ) : (
                     <ul className="flex flex-col gap-2">
                        {entry.report.map((check) => (
                           <li
                              key={check.code}
                              className="flex items-start gap-3 text-[15px]"
                           >
                              {check.status === 'pass' ? (
                                 <CheckIcon
                                    aria-label="Passed"
                                    className="mt-0.5 size-5 shrink-0 text-teal-text"
                                 />
                              ) : check.status === 'flag' ? (
                                 <FlagIcon
                                    aria-label="Flagged"
                                    className="mt-0.5 size-5 shrink-0 text-destructive"
                                 />
                              ) : (
                                 <MinusIcon
                                    aria-label="Not checked"
                                    className="mt-0.5 size-5 shrink-0 text-ink-3"
                                 />
                              )}
                              <span>
                                 <span className="g-tracked mr-2 text-[17px]">
                                    {CHECK_LABELS[check.code] ?? check.code}
                                 </span>
                                 <span className="text-ink-2">
                                    {check.status === 'skip'
                                       ? `Not checked. ${check.detail}`
                                       : check.detail}
                                 </span>
                              </span>
                           </li>
                        ))}
                     </ul>
                  )}

                  <div className="mt-4 flex flex-col gap-3">
                     {entry.canReview ? (
                        <div className="flex flex-wrap items-end gap-3">
                           <TextField
                              label="A note for the angler"
                              value={note}
                              maxLength={280}
                              onChange={(event) => setNote(event.target.value)}
                              className="min-w-[220px] flex-1"
                           />
                           {entry.state !== 'COUNTED' ? (
                              <Button
                                 type="button"
                                 size="sm"
                                 disabled={working}
                                 onClick={() => onReview(entry, 'accept', note)}
                              >
                                 Accept entry
                              </Button>
                           ) : null}
                           {entry.state !== 'EXCLUDED' ? (
                              <Button
                                 type="button"
                                 size="sm"
                                 variant="destructive"
                                 disabled={working}
                                 onClick={() =>
                                    onReview(entry, 'exclude', note)
                                 }
                              >
                                 Exclude
                              </Button>
                           ) : null}
                        </div>
                     ) : null}

                     {entry.canFlag && entry.state === 'COUNTED' ? (
                        !flagging ? (
                           <button
                              type="button"
                              onClick={() => setFlagging(true)}
                              className="g-tracked inline-flex min-h-11 items-center self-start text-[15px] text-ink-2 hover:text-ink"
                           >
                              Not right?
                           </button>
                        ) : (
                           <div className="flex flex-wrap items-end gap-3">
                              <TextField
                                 label="What is not right"
                                 value={reason}
                                 maxLength={280}
                                 onChange={(event) =>
                                    setReason(event.target.value)
                                 }
                                 className="min-w-[220px] flex-1"
                              />
                              <Button
                                 type="button"
                                 size="sm"
                                 variant="outline"
                                 disabled={working || reason.trim().length < 3}
                                 onClick={() => {
                                    onFlag(entry, reason);
                                    setFlagging(false);
                                 }}
                              >
                                 Hold it for the organiser
                              </Button>
                           </div>
                        )
                     ) : null}

                     {entry.yours && entry.state !== 'EXCLUDED' ? (
                        <button
                           type="button"
                           disabled={working}
                           onClick={() => onWithdraw(entry)}
                           className="g-tracked inline-flex min-h-11 items-center self-start text-[15px] text-ink-2 hover:text-ink"
                        >
                           Withdraw this entry
                        </button>
                     ) : null}
                  </div>
               </div>

               {entry.measureUrl ? (
                  <figure>
                     <img
                        src={entry.measureUrl}
                        alt={
                           c.measure === 'LENGTH'
                              ? 'The fish on the tape'
                              : 'The fish on the scale'
                        }
                        className="w-full bg-black-block object-cover"
                     />
                     <figcaption className="mt-1 text-[13px] text-ink-3">
                        {c.measure === 'LENGTH'
                           ? 'On the tape.'
                           : 'On the scale.'}
                        {entry.readConfidence !== null &&
                        entry.readValue !== null
                           ? ` Read ${formatMeasure(entry.readValue, c.measure, units)}, ${Math.round(entry.readConfidence * 100)}% sure.`
                           : ''}
                     </figcaption>
                  </figure>
               ) : null}
            </div>
         ) : null}
      </li>
   );
}
