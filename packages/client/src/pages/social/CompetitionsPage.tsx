import { NoData } from '@/components/states/NoData';
import { PageHead } from '@/components/brand/PageHead';
import { ContourField } from '@/components/brand/ContourField';
import { PlusIcon, TrophyIcon, UsersIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useState } from 'react';
import { Picker } from '@/components/ui/picker';
import { NewCompetitionForm } from '@/components/social/NewCompetitionForm';
import {
   enterCompetition,
   fetchCompetitions,
   fetchStandings,
   leaveCompetition,
   ruleSentence,
   type Competition,
   type CompetitionStanding,
   answerInvite,
   fetchInvites,
   fetchMyFollowers,
   inviteToCompetition,
   timeLeft,
   type Invite,
   type Follower,
} from '@/components/social/competitions-api';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/states/InlineError';
import { useDocumentTitle } from '@/lib/title';
import { formatMeasure, readUnitSystem, type UnitSystem } from '@/lib/units';
import { cn } from '@/lib/utils';

/*
 * Competitions, the ones anglers run themselves.
 *
 * Separate from Boards, which answers "who is catching what" across everybody
 * all the time. A competition has a start, an end and a rule somebody chose,
 * and those are different questions that deserve different pages.
 */

const LOAD_FAILED = 'Could not read the competitions.';

const when = (iso: string) =>
   new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
   });

export function CompetitionsPage() {
   useDocumentTitle('Competitions');
   return (
      <RequireSignIn what="competitions">
         <CompetitionsScreen />
      </RequireSignIn>
   );
}

function CompetitionsScreen() {
   const [items, setItems] = useState<Competition[]>([]);
   const [page, setPage] = useState(1);
   const [total, setTotal] = useState(0);
   const [size, setSize] = useState(20);
   const [invites, setInvites] = useState<Invite[]>([]);
   const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
      'loading'
   );
   const [attempt, setAttempt] = useState(0);
   const [starting, setStarting] = useState(false);
   const [open, setOpen] = useState<string | null>(null);
   const [units] = useState<UnitSystem>(() => readUnitSystem());

   useEffect(() => {
      const controller = new AbortController();
      fetchCompetitions(controller.signal, page)
         .then((result) => {
            setItems(result.items);
            setTotal(result.total);
            setSize(result.size);
            setStatus('ready');
         })
         .catch((error: unknown) => {
            if ((error as { code?: string })?.code === 'ERR_CANCELED') return;
            setStatus('error');
         });
      return () => controller.abort();
   }, [attempt, page]);

   useEffect(() => {
      const controller = new AbortController();
      fetchInvites(controller.signal)
         .then(setInvites)
         .catch(() => setInvites([]));
      return () => controller.abort();
   }, [attempt]);

   const answer = async (invite: Invite, accept: boolean) => {
      setInvites((current) => current.filter((i) => i.id !== invite.id));
      try {
         await answerInvite(invite.id, accept);
         if (accept) setAttempt((n) => n + 1);
      } catch {
         setInvites((current) => [invite, ...current]);
      }
   };

   const toggleEntry = useCallback(async (competition: Competition) => {
      const entering = !competition.youEntered;

      /* Move at once, and put it back if the server disagrees. */
      setItems((current) =>
         current.map((row) =>
            row.id === competition.id
               ? {
                    ...row,
                    youEntered: entering,
                    entrantCount: row.entrantCount + (entering ? 1 : -1),
                 }
               : row
         )
      );

      try {
         await (entering
            ? enterCompetition(competition.id)
            : leaveCompetition(competition.id));
      } catch {
         setItems((current) =>
            current.map((row) =>
               row.id === competition.id
                  ? {
                       ...row,
                       youEntered: !entering,
                       entrantCount: row.entrantCount + (entering ? -1 : 1),
                    }
                  : row
            )
         );
      }
   }, []);

   return (
      <section className="relative mx-auto w-[min(1320px,100%-32px)] pb-10 md:pb-14">
         <ContourField seed={17} />
         <PageHead
            column="w-[min(1320px,100%-32px)]"
            kicker="Anglers running their own"
            title="Competitions"
            lede="Run your own, with your own dates, your own species and your own rule. Standings are counted from the catches themselves."
            aside={
               !starting ? (
                  <Button type="button" onClick={() => setStarting(true)}>
                     <PlusIcon aria-hidden="true" className="mr-2 size-5" />
                     Start one
                  </Button>
               ) : null
            }
         />

         {starting ? (
            <div className="mt-8">
               <NewCompetitionForm
                  onCancel={() => setStarting(false)}
                  onCreated={(competition) => {
                     setItems((current) => [
                        { ...competition, youEntered: true, status: 'running' },
                        ...current,
                     ]);
                     setStarting(false);
                  }}
               />
            </div>
         ) : null}

         {invites.length ? (
            <section className="mt-8 border-l-[3px] border-teal bg-bg-2 px-4 py-4">
               <h2 className="lab">You are invited</h2>
               <ul className="mt-2 flex flex-col divide-y divide-line">
                  {invites.map((invite) => (
                     <li
                        key={invite.id}
                        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3"
                     >
                        <div className="min-w-0">
                           <p className="g text-[22px]">
                              {invite.competition.name}
                           </p>
                           <p className="text-[14px] text-ink-2">
                              From {invite.invitedBy.displayName}
                              {'. '}
                              {when(invite.competition.startsAt)} to{' '}
                              {when(invite.competition.endsAt)}. Answer by{' '}
                              {when(invite.expiresAt)}.
                           </p>
                        </div>
                        <div className="flex gap-2">
                           <Button
                              type="button"
                              size="sm"
                              onClick={() => void answer(invite, true)}
                           >
                              Accept
                           </Button>
                           <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void answer(invite, false)}
                           >
                              Decline
                           </Button>
                        </div>
                     </li>
                  ))}
               </ul>
            </section>
         ) : null}

         <div className="mt-10">
            {status === 'loading' ? (
               <p className="text-ink-2" role="status">
                  Reading the competitions.
               </p>
            ) : status === 'error' ? (
               <InlineError
                  message={LOAD_FAILED}
                  onRetry={() => {
                     setStatus('loading');
                     setAttempt((n) => n + 1);
                  }}
               />
            ) : items.length === 0 ? (
               <div className="flex items-start gap-3 border-l-[3px] border-teal bg-bg-2 px-4 py-4">
                  <TrophyIcon
                     aria-hidden="true"
                     className="mt-0.5 size-5 shrink-0 text-ink-3"
                  />
                  <NoData icon={TrophyIcon} title="No competitions yet">
                     Start one and anyone can enter it.
                  </NoData>
               </div>
            ) : (
               <ul className="flex flex-col">
                  {items.map((competition) => (
                     <CompetitionRow
                        key={competition.id}
                        competition={competition}
                        units={units}
                        expanded={open === competition.id}
                        onToggle={() =>
                           setOpen((current) =>
                              current === competition.id ? null : competition.id
                           )
                        }
                        onToggleEntry={() => void toggleEntry(competition)}
                     />
                  ))}
               </ul>
            )}

            {total > size ? (
               <div className="mt-4 flex items-center justify-between gap-4">
                  <button
                     type="button"
                     disabled={page <= 1}
                     onClick={() => setPage((p) => p - 1)}
                     className="g-tracked inline-flex h-10 items-center text-[15px] text-ink-2 disabled:opacity-40 hover:text-ink"
                  >
                     Newer
                  </button>
                  <span className="num text-[13px] text-ink-3">
                     {(page - 1) * size + 1} to {Math.min(total, page * size)}{' '}
                     of {total}
                  </span>
                  <button
                     type="button"
                     disabled={page * size >= total}
                     onClick={() => setPage((p) => p + 1)}
                     className="g-tracked inline-flex h-10 items-center text-[15px] text-ink-2 disabled:opacity-40 hover:text-ink"
                  >
                     Older
                  </button>
               </div>
            ) : null}
         </div>
      </section>
   );
}

function CompetitionRow({
   competition,
   units,
   expanded,
   onToggle,
   onToggleEntry,
}: {
   competition: Competition;
   units: UnitSystem;
   expanded: boolean;
   onToggle: () => void;
   onToggleEntry: () => void;
}) {
   const [standings, setStandings] = useState<CompetitionStanding[] | null>(
      null
   );
   const [failed, setFailed] = useState(false);
   /* The clock, for the time left, once a minute. */
   const [now, setNow] = useState(() => Date.now());
   useEffect(() => {
      if (competition.status !== 'running') return;
      const timer = window.setInterval(() => setNow(Date.now()), 60000);
      return () => window.clearInterval(timer);
   }, [competition.status]);
   const [inviting, setInviting] = useState(false);
   const [followers, setFollowers] = useState<Follower[]>([]);
   const [picked, setPicked] = useState<string[]>([]);
   const [sent, setSent] = useState<number | null>(null);
   useEffect(() => {
      if (!inviting || followers.length) return;
      const controller = new AbortController();
      fetchMyFollowers(controller.signal)
         .then(setFollowers)
         .catch(() => setFollowers([]));
      return () => controller.abort();
   }, [inviting, followers.length]);

   useEffect(() => {
      if (!expanded || standings) return;

      const controller = new AbortController();
      fetchStandings(competition.id, controller.signal)
         .then((data) => setStandings(data.standings))
         .catch(() => setFailed(true));
      return () => controller.abort();
   }, [expanded, competition.id, standings]);

   /* What the leading figure means depends on how the competition is won. */
   const figureOf = (s: CompetitionStanding) =>
      competition.rule === 'BIGGEST_FISH'
         ? formatMeasure(s.best, competition.measure, units)
         : competition.rule === 'SPECIES_VARIETY'
           ? `${s.distinctSpecies} species`
           : formatMeasure(s.total, competition.measure, units);

   return (
      <li className="border-t border-line last:border-b">
         <div className="flex flex-wrap items-start gap-x-5 gap-y-3 py-4">
            <div className="min-w-0 flex-1">
               <button
                  type="button"
                  onClick={onToggle}
                  aria-expanded={expanded}
                  className="g block max-w-full truncate text-left text-[26px] hover:text-teal-text"
               >
                  {competition.name}
               </button>

               <p className="mt-1 text-[15px] text-ink-2">
                  {ruleSentence(competition.rule, competition.measure)}
                  {competition.species
                     ? `, ${competition.species.commonName} only`
                     : ''}
                  .
               </p>

               <p className="lab num mt-2 flex flex-wrap items-baseline gap-x-3 text-ink-3">
                  <span>
                     {when(competition.startsAt)} to {when(competition.endsAt)}
                  </span>
                  {competition.status === 'running' ? (
                     <span className="text-teal-text">
                        {timeLeft(competition.endsAt, now)}
                     </span>
                  ) : null}
                  {competition.scope === 'PRIVATE' ? (
                     <span className="border border-line px-1.5 py-0.5 text-ink-2">
                        Invitation only
                     </span>
                  ) : null}
               </p>

               {competition.blurb ? (
                  <p className="mt-2 max-w-[60ch] text-[15px] text-ink-2">
                     {competition.blurb}
                  </p>
               ) : null}
            </div>

            <div className="flex flex-col items-end gap-2">
               <span
                  className={cn(
                     'lab px-2 py-1',
                     competition.status === 'running'
                        ? 'bg-teal text-teal-ink'
                        : 'text-ink-3'
                  )}
               >
                  {competition.status === 'running'
                     ? 'Running'
                     : competition.status === 'upcoming'
                       ? 'Not started'
                       : 'Results'}
               </span>

               <span className="flex items-center gap-1.5 text-[14px] text-ink-3">
                  <UsersIcon aria-hidden="true" className="size-4" />
                  <span className="num">{competition.entrantCount}</span>
               </span>

               {competition.status === 'finished' ? null : competition.scope ===
                    'PRIVATE' && !competition.youEntered ? (
                  <span className="text-[13px] text-ink-3">By invitation</span>
               ) : (
                  <Button
                     type="button"
                     size="sm"
                     variant={competition.youEntered ? 'outline' : 'default'}
                     onClick={onToggleEntry}
                     aria-pressed={competition.youEntered}
                  >
                     {competition.youEntered ? 'Entered' : 'Enter'}
                  </Button>
               )}
               {competition.youOrganise &&
               competition.scope === 'PRIVATE' &&
               competition.status !== 'finished' ? (
                  <button
                     type="button"
                     onClick={() => setInviting((open) => !open)}
                     className="g-tracked text-[15px] text-teal-text"
                  >
                     {inviting ? 'Done' : 'Invite more'}
                  </button>
               ) : null}
            </div>
         </div>

         {inviting ? (
            <div className="flex flex-wrap items-end gap-3 pb-4">
               <Picker
                  multiple
                  label="Followers"
                  allLabel={
                     followers.length
                        ? 'Pick who to invite'
                        : 'Nobody follows you yet'
                  }
                  value={picked}
                  onChange={(next) => setPicked(next as string[])}
                  options={followers.map((f) => ({
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
                     void inviteToCompetition(competition.id, picked).then(
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
                     {sent === 1
                        ? '1 invitation sent.'
                        : `${sent} invitations sent.`}
                  </span>
               ) : null}
            </div>
         ) : null}

         {expanded ? (
            <div className="pb-5">
               {failed ? (
                  <p className="text-[15px] text-ink-2">
                     Could not read the standings.
                  </p>
               ) : !standings ? (
                  <p className="text-[15px] text-ink-2">Counting.</p>
               ) : standings.length === 0 ? (
                  <p className="text-[15px] text-ink-2">
                     {competition.status === 'finished'
                        ? 'It closed with no qualifying catch.'
                        : 'Nobody has entered yet.'}
                  </p>
               ) : (
                  <>
                     {competition.status === 'finished' && standings[0] ? (
                        <p className="mb-3 border-l-[3px] border-teal bg-bg-2 px-4 py-3 text-[16px]">
                           <span className="g text-[22px]">
                              {standings[0].displayName}
                           </span>{' '}
                           <span className="text-ink-2">
                              won it with{' '}
                              {figureOf(standings[0]) ?? 'the best entry'}.
                           </span>
                        </p>
                     ) : null}
                     <table className="w-full border-collapse text-left">
                        <thead>
                           <tr className="border-b border-line">
                              <th className="lab py-2 pr-3 font-normal">#</th>
                              <th className="lab py-2 pr-3 font-normal">
                                 Angler
                              </th>
                              <th className="lab py-2 text-right font-normal">
                                 {competition.rule === 'SPECIES_VARIETY'
                                    ? 'Species'
                                    : competition.measure === 'LENGTH'
                                      ? 'Length'
                                      : 'Weight'}
                              </th>
                           </tr>
                        </thead>
                        <tbody>
                           {standings.map((s, index) => (
                              <tr
                                 key={s.anglerId}
                                 className="border-b border-line/60"
                              >
                                 <td className="num py-3 pr-3 text-[15px] text-ink-2">
                                    {index + 1}
                                 </td>
                                 <td className="py-3 pr-3 text-[17px]">
                                    {s.displayName}
                                 </td>
                                 <td className="num py-3 text-right text-[17px]">
                                    {figureOf(s) ?? 'Nothing yet'}
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </>
               )}
            </div>
         ) : null}
      </li>
   );
}
