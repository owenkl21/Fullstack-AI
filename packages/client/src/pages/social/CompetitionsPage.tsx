import { useLoadOnScroll } from '@/lib/load-on-scroll';
import { NoData } from '@/components/states/NoData';
import { PageHead } from '@/components/brand/PageHead';
import { PlusIcon, TrophyIcon, UsersIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
   answerInvite,
   areaSentence,
   dateRange,
   enterCompetition,
   fetchCompetitions,
   leadingFigure,
   ruleSentence,
   scopeLabel,
   statusLabel,
   timeLeft,
   type Competition,
   type CompetitionTab,
} from '@/components/social/competitions-api';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { Button } from '@/components/ui/button';
import { ChoiceGroup } from '@/components/ui/field';
import { InlineError } from '@/components/states/InlineError';
import { useDocumentTitle } from '@/lib/title';
import { readUnitSystem, type UnitSystem } from '@/lib/units';
import { cn } from '@/lib/utils';

/*
 * Competitions, the ones anglers run themselves.
 *
 * Separate from Boards, which answers "who is catching what" across everybody
 * all the time. A competition has a start, an end and a rule somebody chose,
 * and those are different questions that deserve different pages. This is
 * the list; each one has a page of its own.
 */

const LOAD_FAILED = 'Could not read the competitions.';

export function CompetitionsPage() {
   useDocumentTitle('Competitions');
   return (
      <RequireSignIn what="competitions">
         <CompetitionsScreen />
      </RequireSignIn>
   );
}

function CompetitionsScreen() {
   const navigate = useNavigate();
   const [tab, setTab] = useState<CompetitionTab>('all');
   const [items, setItems] = useState<Competition[]>([]);
   const [page, setPage] = useState(1);
   const [total, setTotal] = useState(0);
   const [size, setSize] = useState(20);
   const [inviteCount, setInviteCount] = useState<number | null>(null);
   const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
      'loading'
   );
   const [attempt, setAttempt] = useState(0);
   const [units] = useState<UnitSystem>(() => readUnitSystem());
   const moreSentinel = useLoadOnScroll(
      () => setPage((p) => p + 1),
      status === 'ready' && items.length < total && page * size < total
   );

   useEffect(() => {
      const controller = new AbortController();
      fetchCompetitions(controller.signal, page, tab)
         .then((result) => {
            /* Each page joins the one before it; the first replaces. */
            setItems((was) =>
               page === 1
                  ? result.items
                  : [
                       ...was,
                       ...result.items.filter(
                          (c) => !was.some((w) => w.id === c.id)
                       ),
                    ]
            );
            setTotal(result.total);
            setSize(result.size);
            setStatus('ready');
            if (tab === 'invites') setInviteCount(result.total);
         })
         .catch((error: unknown) => {
            if ((error as { code?: string })?.code === 'ERR_CANCELED') return;
            setStatus('error');
         });
      return () => controller.abort();
   }, [attempt, page, tab]);

   /* The count on the Invites tab, read once so the tab can say it. */
   useEffect(() => {
      const controller = new AbortController();
      fetchCompetitions(controller.signal, 1, 'invites')
         .then((result) => setInviteCount(result.total))
         .catch(() => undefined);
      return () => controller.abort();
   }, [attempt]);

   const switchTab = (next: CompetitionTab) => {
      if (next === tab) return;
      setTab(next);
      setPage(1);
      setItems([]);
      setStatus('loading');
   };

   const patch = (id: string, change: Partial<Competition>) =>
      setItems((current) =>
         current.map((row) => (row.id === id ? { ...row, ...change } : row))
      );

   const enter = async (competition: Competition) => {
      patch(competition.id, {
         youEntered: true,
         entrantCount: competition.entrantCount + 1,
      });
      try {
         await enterCompetition(competition.id);
      } catch {
         patch(competition.id, {
            youEntered: false,
            entrantCount: competition.entrantCount,
         });
      }
   };

   const answer = async (competition: Competition, accept: boolean) => {
      const invite = competition.invite;
      if (!invite) return;
      patch(competition.id, {
         invite: null,
         youEntered: accept ? true : competition.youEntered,
         entrantCount: competition.entrantCount + (accept ? 1 : 0),
      });
      try {
         await answerInvite(invite.id, accept);
         setInviteCount((n) => (n === null ? n : Math.max(0, n - 1)));
         if (accept) navigate(`/competitions/${competition.id}`);
         else if (tab === 'invites')
            setItems((current) =>
               current.filter((row) => row.id !== competition.id)
            );
      } catch {
         patch(competition.id, {
            invite,
            youEntered: competition.youEntered,
            entrantCount: competition.entrantCount,
         });
      }
   };

   const tabs = [
      { value: 'all' as const, label: 'All competitions' },
      { value: 'mine' as const, label: 'Mine' },
      {
         value: 'invites' as const,
         label: inviteCount ? `Invites ${inviteCount}` : 'Invites',
      },
   ];

   return (
      <section className="relative mx-auto w-[min(1320px,100%-32px)] pb-10 md:pb-14">
         <PageHead
            column="w-[min(1320px,100%-32px)]"
            kicker="Anglers running their own"
            title="Competitions"
            lede="Run a session with your fishing mates. Your own dates, your own water, your own rule, and every entry checked."
            aside={
               <Button
                  type="button"
                  onClick={() => navigate('/competitions/new')}
               >
                  <PlusIcon aria-hidden="true" className="mr-2 size-5" />
                  Start one
               </Button>
            }
         />

         <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="lab">On the board</h2>
            <ChoiceGroup
               label="Which competitions"
               hideLabel
               inline
               nowrap
               value={tab}
               onChange={switchTab}
               options={tabs}
            />
         </div>

         <div className="mt-6">
            {status === 'loading' && !items.length ? (
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
                  <NoData
                     icon={TrophyIcon}
                     title={
                        tab === 'invites'
                           ? 'No invitations'
                           : tab === 'mine'
                             ? 'None of yours yet'
                             : 'No competitions yet'
                     }
                  >
                     {tab === 'invites'
                        ? 'When somebody invites you, it lands here.'
                        : 'Start one and your mates can enter it.'}
                  </NoData>
               </div>
            ) : (
               <ul className="flex flex-col">
                  {items.map((competition) => (
                     <CompetitionCard
                        key={competition.id}
                        competition={competition}
                        units={units}
                        onEnter={() => void enter(competition)}
                        onAnswer={(accept) => void answer(competition, accept)}
                     />
                  ))}
               </ul>
            )}

            <div ref={moreSentinel} aria-hidden="true" className="h-px" />
            {items.length < total ? (
               <p className="lab num mt-4 text-ink-3">
                  {items.length} of {total}
               </p>
            ) : null}
         </div>

         <p className="mt-10 text-[14px] text-ink-3">
            Your exact fishing spot is never shown on these boards.
         </p>
      </section>
   );
}

export function StatusChip({
   status,
   className,
}: {
   status: Competition['status'];
   className?: string;
}) {
   return (
      <span
         className={cn(
            'lab px-2 py-1',
            status === 'running'
               ? 'bg-teal text-teal-ink'
               : status === 'upcoming'
                 ? 'border border-line text-ink-2'
                 : 'bg-ink text-background',
            className
         )}
      >
         {statusLabel(status)}
      </span>
   );
}

export function ScopeChip({
   scope,
   className,
}: {
   scope: Competition['scope'];
   className?: string;
}) {
   return (
      <span
         className={cn(
            'lab border border-line px-2 py-1 text-ink-2',
            className
         )}
      >
         {scopeLabel(scope)}
      </span>
   );
}

function CompetitionCard({
   competition,
   units,
   onEnter,
   onAnswer,
}: {
   competition: Competition;
   units: UnitSystem;
   onEnter: () => void;
   onAnswer: (accept: boolean) => void;
}) {
   /* The clock, for the time left, once a minute. */
   const [now, setNow] = useState(() => Date.now());
   useEffect(() => {
      if (competition.status !== 'running') return;
      const timer = window.setInterval(() => setNow(Date.now()), 60000);
      return () => window.clearInterval(timer);
   }, [competition.status]);

   const to = `/competitions/${competition.id}`;
   const leading = competition.leading
      ? leadingFigure(competition, competition.leading.value, units)
      : null;
   const anglers =
      competition.entrantCount === 1
         ? '1 angler'
         : `${competition.entrantCount} anglers`;

   const action = competition.invite ? (
      <div className="flex flex-wrap items-center gap-2">
         <Button type="button" size="sm" onClick={() => onAnswer(true)}>
            Accept invite
         </Button>
         <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onAnswer(false)}
         >
            Decline invitation
         </Button>
      </div>
   ) : competition.status === 'finished' ? (
      <Link
         to={to}
         className="g-tracked inline-flex h-10 items-center border border-ink px-4 text-[17px] text-ink hover:bg-bg-2"
      >
         View results
      </Link>
   ) : competition.youEntered ? (
      <Link
         to={to}
         className="g-tracked inline-flex h-10 items-center border border-ink px-4 text-[17px] text-ink hover:bg-bg-2"
      >
         Entered · View
      </Link>
   ) : competition.scope === 'PUBLIC' ? (
      <Button type="button" size="sm" onClick={onEnter}>
         Enter
      </Button>
   ) : (
      <span className="text-[13px] text-ink-3">By invitation</span>
   );

   return (
      <li className="border-t border-line last:border-b">
         <div className="flex flex-col gap-3 py-5 md:flex-row md:items-start md:gap-6">
            <div className="min-w-0 flex-1">
               <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={competition.status} />
                  <ScopeChip scope={competition.scope} />
                  {competition.status === 'running' ? (
                     <span className="lab num text-teal-text">
                        {timeLeft(competition.endsAt, now)}
                     </span>
                  ) : null}
               </div>

               <Link
                  to={to}
                  className="g mt-2 block max-w-full truncate text-[28px] leading-none hover:text-teal-text"
               >
                  {competition.name}
               </Link>

               <p className="mt-1.5 text-[15px] text-ink-2">
                  {ruleSentence(competition.rule, competition.measure)}
                  {competition.species
                     ? `, ${competition.species.commonName} only`
                     : ''}
               </p>
               <p className="text-[15px] text-ink-2">
                  {areaSentence(competition)}
                  {' · '}
                  <span className="num">
                     {dateRange(competition.startsAt, competition.endsAt)}
                  </span>
               </p>

               {competition.leading && leading ? (
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[15px]">
                     <span className="lab text-ink-3">Leading catch</span>
                     <span className="g-tracked text-[19px]">
                        {competition.leading.displayName}
                     </span>
                     <span className="num text-[17px]">{leading}</span>
                     {competition.leading.speciesName ? (
                        <span className="text-ink-2">
                           {competition.leading.speciesName}
                        </span>
                     ) : null}
                  </p>
               ) : null}

               {competition.blurb ? (
                  <p className="mt-2 max-w-[60ch] text-[15px] text-ink-2">
                     {competition.blurb}
                  </p>
               ) : null}
            </div>

            <div className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-3 md:flex-col md:items-end">
               <span className="flex items-center gap-2 text-[14px] text-ink-3">
                  <UsersIcon aria-hidden="true" className="size-4" />
                  <span className="num">{anglers}</span>
                  {competition.youOrganise ? (
                     <span className="lab text-teal-text">You organise</span>
                  ) : null}
               </span>
               {action}
            </div>
         </div>
      </li>
   );
}
