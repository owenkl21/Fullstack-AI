import { Link } from 'react-router-dom';
import {
   leadingFigure,
   type Competition,
   type CompetitionEntry,
   type CompetitionStanding,
} from '@/components/social/competitions-api';
import { formatStamp } from '@/components/fishing/record/format';
import { type UnitChoice } from '@/lib/units';

/*
 * The standings, as rows rather than a table.
 *
 * Place, angler, figure. The sub-line under a name says what that best catch
 * was: the species while a competition runs, the species and when it was
 * landed where there is room for it. A finished competition drops the
 * sub-line entirely, because by then the figure is the whole story.
 *
 * The catch time is not on a standing, so it is matched back out of the
 * entries: the angler's best counted one. A server that paired them would
 * save the walk.
 */
export function StandingsRows({
   competition: c,
   standings,
   entries,
   units,
   final = false,
}: {
   competition: Competition;
   standings: CompetitionStanding[];
   entries: CompetitionEntry[];
   units: UnitChoice;
   /* Final standings print the name alone, with no catch under it. */
   final?: boolean;
}) {
   const bestOf = (anglerId: string) =>
      entries
         .filter((e) => e.anglerId === anglerId && e.state === 'COUNTED')
         .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0] ?? null;

   return (
      <div className="flex flex-col">
         {standings.map((s) => {
            const best = bestOf(s.anglerId);
            const species = s.bestSpeciesName ?? best?.speciesName ?? null;
            const when = best ? formatStamp(best.caughtAt) : null;
            return (
               <div
                  key={s.anglerId}
                  className="flex h-14 items-center gap-3.5 border-b border-line lg:h-[60px] lg:gap-4"
               >
                  {/* Equal scores simply share the number; the frames print
                      it plain, and the sentence that used to explain that is
                      one of the things the design took out. */}
                  <span className="g num w-6 shrink-0 text-[28px] leading-none lg:w-7 lg:text-[30px]">
                     {s.place}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
                     <Link
                        to={`/anglers/${s.anglerId}`}
                        className="truncate text-[15px] font-semibold hover:text-teal-text lg:text-[16px]"
                     >
                        {s.displayName}
                     </Link>
                     {!final && species ? (
                        <span className="truncate text-[14px] text-ink-2">
                           {species}
                           {when ? (
                              <span className="hidden lg:inline">
                                 {' · '}
                                 <span className="num">{when}</span>
                              </span>
                           ) : null}
                        </span>
                     ) : null}
                  </span>
                  <span className="g num shrink-0 text-[24px] leading-none tracking-[0.03em] lg:text-[26px]">
                     {leadingFigure(c, s.score, units) ?? '0'}
                  </span>
               </div>
            );
         })}
      </div>
   );
}
