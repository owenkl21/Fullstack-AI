import { useLoadOnScroll } from '@/lib/load-on-scroll';
import { NoData } from '@/components/states/NoData';
import { PageHead } from '@/components/brand/PageHead';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
   answerInvite,
   enterCompetition,
   fetchCompetitions,
   type Competition,
   type CompetitionTab,
} from '@/components/social/competitions-api';
import { CompetitionCard } from '@/components/social/CompetitionCard';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { Button } from '@/components/ui/button';
import { Segment } from '@/components/fishing/quicklog/Segment';
import { InlineError } from '@/components/states/InlineError';
import { useDocumentTitle } from '@/lib/title';
import { readUnitSystem, type UnitSystem } from '@/lib/units';

/*
 * Competitions, the ones anglers run themselves.
 *
 * Separate from Boards, which answers "who is catching what" across everybody
 * all the time. A competition has a start, an end and a rule somebody chose,
 * and those are different questions that deserve different pages. This is
 * the list; each one has a page of its own.
 *
 * Start one and the three tabs live on the plate, above the wave, so the
 * paper under it is nothing but competitions: one column of them on a phone,
 * two to a row on a desktop.
 */

const LOAD_FAILED = 'Could not read the competitions.';
const COLUMN = 'w-[min(960px,100%-32px)]';

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
         })
         .catch((error: unknown) => {
            if ((error as { code?: string })?.code === 'ERR_CANCELED') return;
            setStatus('error');
         });
      return () => controller.abort();
   }, [attempt, page, tab]);

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

   /*
    * Accepting is the card's one action; an invitation is declined from the
    * competition's own page, where there is room to read it first.
    */
   const accept = async (competition: Competition) => {
      const invite = competition.invite;
      if (!invite) return;
      patch(competition.id, {
         invite: null,
         youEntered: true,
         entrantCount: competition.entrantCount + 1,
      });
      try {
         await answerInvite(invite.id, true);
         navigate(`/competitions/${competition.id}`);
      } catch {
         patch(competition.id, {
            invite,
            youEntered: competition.youEntered,
            entrantCount: competition.entrantCount,
         });
      }
   };

   return (
      <section className={`relative mx-auto ${COLUMN} pb-10 md:pb-14`}>
         <PageHead
            column={COLUMN}
            kicker="Between mates"
            title="Competitions"
            lede="Your own dates, your own water, your own rule. Every entry checked."
            aside={
               <div className="flex flex-col items-start gap-[22px] md:items-end md:gap-4">
                  <Button
                     type="button"
                     className="text-[18px]"
                     onClick={() => navigate('/competitions/new')}
                  >
                     Start one
                  </Button>
                  {/*
                   * On the plate the tabs are paper on black: `.on-black`
                   * remaps the ink, ground and line tokens the Segment draws
                   * with, and the plate's own hairline is a shade stronger
                   * than the one on paper.
                   */}
                  <span className="on-black block w-[300px] max-w-full [--line:rgba(244,241,236,0.4)]">
                     <Segment
                        label="Which competitions"
                        value={tab}
                        onChange={switchTab}
                        options={[
                           { value: 'all', label: 'All' },
                           { value: 'mine', label: 'Mine' },
                           { value: 'invites', label: 'Invites' },
                        ]}
                        className="[&_button]:text-[16px]"
                     />
                  </span>
               </div>
            }
         />

         <div>
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
               <ul className="flex flex-col md:grid md:grid-cols-2 md:items-stretch md:gap-6">
                  {items.map((competition, i) => (
                     <CompetitionCard
                        key={competition.id}
                        competition={competition}
                        units={units}
                        first={i === 0}
                        onEnter={() => void enter(competition)}
                        onAccept={() => void accept(competition)}
                     />
                  ))}
               </ul>
            )}

            <div ref={moreSentinel} aria-hidden="true" className="h-px" />
            {items.length < total ? (
               <p className="lab num mt-4">
                  {items.length} of {total}
               </p>
            ) : null}
         </div>

         <p className="mt-3 text-[14px] text-ink-3 md:mt-7">
            Your exact fishing spot is never shown on these boards.
         </p>
      </section>
   );
}
