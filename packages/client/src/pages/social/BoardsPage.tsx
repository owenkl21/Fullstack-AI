import { NoData } from '@/components/states/NoData';
import { PageHead } from '@/components/brand/PageHead';
import { useEffect, useRef, useState } from 'react';
import { useRevealIn } from '@/components/brand/Reveal';
import { InlineError } from '@/components/states/InlineError';
import { ListSkeleton } from '@/components/states/ListSkeleton';
import {
   StandingsTable,
   type RankBy,
} from '@/components/social/StandingsTable';
import { Picker } from '@/components/ui/picker';
import { ChoiceGroup } from '@/components/ui/field';
import {
   fetchRivals,
   fetchSpeciesBoards,
   type RivalStanding,
   type SpeciesBoard,
} from '@/components/social/api';
import { useIsSignedIn } from '@/lib/auth-client';
import { useDocumentTitle } from '@/lib/title';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

const LOAD_FAILED = 'Could not load the boards.';

/*
 * Two views of the same fish. Species is the default because "who has the best
 * kob" is the question a shore angler actually asks; a combined table never
 * really compared a galjoen specialist with a kob specialist.
 */
export function BoardsPage() {
   useDocumentTitle('Boards');
   /*
    * One arrival for the page, staggered down the column. The plugin guidance
    * is right that a fade-up on every section is the generic tell; this is a
    * single orchestrated moment on load and nothing moves after it.
    */
   const root = useRef<HTMLElement>(null);
   useRevealIn(root);
   const { isSignedIn } = useIsSignedIn();
   const [youId, setYouId] = useState<string | null>(null);
   useEffect(() => {
      if (!isSignedIn) return;
      fetch('/api/users/me', { credentials: 'include' })
         .then((r) => (r.ok ? r.json() : null))
         .then((d) => setYouId(d?.profile?.id ?? d?.id ?? null))
         .catch(() => undefined);
   }, [isSignedIn]);
   const [view, setView] = useState<'species' | 'rivals'>('species');
   const [chosenSpecies, setChosenSpecies] = useState<string[]>([]);
   const [rankBy, setRankBy] = useState<RankBy>('points');
   const [boards, setBoards] = useState<SpeciesBoard[] | null>(null);
   const [rivals, setRivals] = useState<RivalStanding[] | null>(null);
   const [mutualCount, setMutualCount] = useState(0);
   const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
      'loading'
   );
   const [attempt, setAttempt] = useState(0);

   useEffect(() => {
      const controller = new AbortController();

      const load = async () => {
         /*
          * Inside the async body, not the effect body: setting state straight
          * from an effect cascades a render.
          */
         setStatus('loading');

         try {
            const list = await fetchSpeciesBoards(controller.signal);
            setBoards(list);

            if (isSignedIn) {
               const board = await fetchRivals(controller.signal);
               setRivals(board.standings);
               setMutualCount(board.mutualCount);
            }

            setStatus('ready');
         } catch {
            if (!controller.signal.aborted) {
               setStatus('error');
            }
         }
      };

      void load();
      return () => controller.abort();
   }, [isSignedIn, attempt]);

   return (
      <section
         ref={root}
         className="relative mx-auto w-full max-w-[1320px] px-4 pb-10 md:px-8"
      >
         <PageHead
            column="w-[min(1320px,100%-32px)]"
            kicker="Boards"
            title="Who is catching what"
            lede="Length becomes mass with published figures, and points are awarded per kilogram. The fish never has to be weighed, or kept."
         />

         {/*
          * The phone bar has four slots and they are all spoken for, so this is
          * the way through to competitions on a phone. It belongs here anyway:
          * anyone reading a board is already thinking about standings.
          */}
         <Link
            to="/competitions"
            className="g-tracked rv mt-4 inline-flex min-h-11 items-center gap-2 border border-line px-4 text-[15px] transition-colors duration-150 [transition-timing-function:var(--ease)] hover:bg-bg-2"
            style={{ '--i': 3 } as React.CSSProperties}
         >
            <TrophyIcon aria-hidden="true" className="size-[18px]" />
            Competitions anglers are running
         </Link>

         {/*
          * One filter bar, one row on a desktop and two on a phone: which
          * board, which fish, and what it is ordered by. The species used to
          * be every board stacked down the page; now it is a picker and only
          * the chosen boards are shown, always the top ten with paging.
          */}
         <div
            className="rv mt-7 flex flex-wrap items-end gap-x-6 gap-y-3"
            style={{ '--i': 3 } as React.CSSProperties}
         >
            <ChoiceGroup
               inline
               size="sm"
               label="Board"
               value={view}
               onChange={setView}
               options={[
                  { value: 'species', label: 'By species' },
                  { value: 'rivals', label: 'Your rivals' },
               ]}
            />
            {view === 'species' ? (
               <Picker
                  size="sm"
                  multiple
                  label="Fish"
                  allLabel="Pick a species"
                  value={chosenSpecies}
                  onChange={(next) => setChosenSpecies(next as string[])}
                  options={(boards ?? []).map((b) => ({
                     value: b.speciesId,
                     label: b.commonName,
                     hint:
                        b.anglers === 1 ? '1 angler' : `${b.anglers} anglers`,
                  }))}
                  className="min-w-[200px]"
               />
            ) : null}
            <ChoiceGroup
               inline
               size="sm"
               label="Order by"
               value={rankBy}
               onChange={setRankBy}
               options={[
                  { value: 'points', label: 'Points' },
                  { value: 'weight', label: 'Weight' },
                  { value: 'length', label: 'Longest' },
                  { value: 'bag', label: 'Bag' },
               ]}
            />
         </div>

         <div className="rv mt-8" style={{ '--i': 4 } as React.CSSProperties}>
            {status === 'loading' ? (
               <ListSkeleton
                  key={attempt}
                  label="Loading the boards"
                  errorMessage={LOAD_FAILED}
                  onRetry={() => setAttempt((a) => a + 1)}
               />
            ) : status === 'error' ? (
               <InlineError
                  message={LOAD_FAILED}
                  onRetry={() => setAttempt((a) => a + 1)}
               />
            ) : view === 'rivals' ? (
               <RivalsView
                  standings={rivals}
                  mutualCount={mutualCount}
                  isSignedIn={isSignedIn}
                  rankBy={rankBy}
               />
            ) : (
               <SpeciesView
                  boards={(boards ?? []).filter((b) =>
                     chosenSpecies.length === 0
                        ? false
                        : chosenSpecies.includes(b.speciesId)
                  )}
                  none={(boards ?? []).length === 0}
                  rankBy={rankBy}
                  youId={youId}
               />
            )}
         </div>
      </section>
   );
}

function RivalsView({
   standings,
   mutualCount,
   isSignedIn,
   rankBy,
}: {
   standings: RivalStanding[] | null;
   mutualCount: number;
   isSignedIn: boolean;
   rankBy: RankBy;
}) {
   if (!isSignedIn) {
      return (
         <p className="max-w-[52ch] text-[17px] text-ink-2">
            Sign in to see how you stand against the anglers you follow.
         </p>
      );
   }

   if (!standings?.length || mutualCount === 0) {
      return (
         <NoData icon={TrophyIcon} title="No rivals yet">
            Your board fills up when you and another angler follow each other.
            Following someone on its own does not put either of you on the
            other\u2019s board.
         </NoData>
      );
   }

   return (
      <>
         <p className="mb-4 text-[15px] text-ink-2">
            You and the {mutualCount} {mutualCount === 1 ? 'angler' : 'anglers'}{' '}
            you follow each other with.
         </p>
         <StandingsTable
            standings={standings}
            rankBy={rankBy}
            emptyLine="Nobody on this board has a qualifying catch yet."
         />
      </>
   );
}

function SpeciesView({
   boards,
   none,
   rankBy,
   youId,
}: {
   boards: SpeciesBoard[];
   none: boolean;
   rankBy: RankBy;
   youId: string | null;
}) {
   if (none) {
      return (
         <NoData icon={TrophyIcon} title="No data yet">
            No catch has a species on it yet, so there is nothing to rank.
         </NoData>
      );
   }
   if (!boards.length) {
      return (
         <NoData icon={TrophyIcon} title="Pick a species">
            Choose one or more species above to see who is catching them.
         </NoData>
      );
   }

   return (
      <div className="grid min-w-0 gap-12">
         {boards.map((board) => (
            <section key={board.speciesId} className="min-w-0">
               <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 className="g text-[30px]">{board.commonName}</h2>
                  {board.longestCm && board.longestByName ? (
                     <p className="text-[15px] text-ink-2">
                        Biggest:{' '}
                        <span className="num text-ink">
                           {board.longestCm} cm
                        </span>{' '}
                        by {board.longestByName}
                     </p>
                  ) : null}
               </div>

               <div className="mt-4 min-w-0">
                  <StandingsTable
                     standings={board.standings}
                     rankBy={rankBy}
                     youId={youId}
                     emptyLine={
                        board.unscoredReason ??
                        'Nobody has a qualifying catch of this yet.'
                     }
                  />
               </div>

               {board.loggedButUnscored && board.standings.length ? (
                  <p className="mt-2 text-[14px] text-ink-3">
                     {board.loggedButUnscored}{' '}
                     {board.loggedButUnscored === 1 ? 'catch' : 'catches'} of
                     this did not score. {board.unscoredReason}
                  </p>
               ) : null}
            </section>
         ))}
      </div>
   );
}
