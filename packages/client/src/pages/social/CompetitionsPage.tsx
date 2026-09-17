import { PlusIcon, TrophyIcon, UsersIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useState } from 'react';
import { NewCompetitionForm } from '@/components/social/NewCompetitionForm';
import {
   enterCompetition,
   fetchCompetitions,
   fetchStandings,
   leaveCompetition,
   ruleSentence,
   type Competition,
   type CompetitionStanding,
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
   const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
      'loading'
   );
   const [attempt, setAttempt] = useState(0);
   const [starting, setStarting] = useState(false);
   const [open, setOpen] = useState<string | null>(null);
   const [units] = useState<UnitSystem>(() => readUnitSystem());

   useEffect(() => {
      const controller = new AbortController();
      fetchCompetitions(controller.signal)
         .then((rows) => {
            setItems(rows);
            setStatus('ready');
         })
         .catch((error: unknown) => {
            if ((error as { code?: string })?.code === 'ERR_CANCELED') return;
            setStatus('error');
         });
      return () => controller.abort();
   }, [attempt]);

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
      <section className="mx-auto w-[min(900px,100%-32px)] py-10 md:py-14">
         <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h1 className="g text-[44px] md:text-[56px]">Competitions</h1>
            {!starting ? (
               <Button type="button" onClick={() => setStarting(true)}>
                  <PlusIcon aria-hidden="true" className="mr-2 size-5" />
                  Start one
               </Button>
            ) : null}
         </div>

         <p className="mt-3 max-w-[58ch] text-[17px] text-ink-2">
            Run your own, with your own dates, your own species and your own
            rule. Standings are counted from the catches themselves.
         </p>

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
                  <p className="max-w-[54ch] text-base text-ink-2">
                     None yet. Start one and anyone can enter it.
                  </p>
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

               <p className="lab num mt-2 text-ink-3">
                  {when(competition.startsAt)} to {when(competition.endsAt)}
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
                       : 'Finished'}
               </span>

               <span className="flex items-center gap-1.5 text-[14px] text-ink-3">
                  <UsersIcon aria-hidden="true" className="size-4" />
                  <span className="num">{competition.entrantCount}</span>
               </span>

               <Button
                  type="button"
                  size="sm"
                  variant={competition.youEntered ? 'outline' : 'default'}
                  onClick={onToggleEntry}
                  aria-pressed={competition.youEntered}
               >
                  {competition.youEntered ? 'Entered' : 'Enter'}
               </Button>
            </div>
         </div>

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
                     Nobody has entered yet.
                  </p>
               ) : (
                  <table className="w-full border-collapse text-left">
                     <thead>
                        <tr className="border-b border-line">
                           <th className="lab py-2 pr-3 font-normal">#</th>
                           <th className="lab py-2 pr-3 font-normal">Angler</th>
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
               )}
            </div>
         ) : null}
      </li>
   );
}
