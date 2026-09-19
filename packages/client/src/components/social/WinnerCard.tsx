import {
   leadingFigure,
   type Competition,
   type CompetitionEntry,
   type CompetitionStanding,
} from '@/components/social/competitions-api';
import { type UnitSystem } from '@/lib/units';

/*
 * Who won, on the one black card the results page carries.
 *
 * The API has no winner object: a standing knows the score and nothing about
 * the fish behind it. So the photograph and, for a most-species competition,
 * the list of species are assembled here out of the winner's counted
 * entries. That is the client guessing at something the server should name,
 * and it shows: for a biggest-fish competition the card says the fish, for a
 * total it says the total, because there is no other honest reading.
 */
export function WinnerCard({
   competition: c,
   winner,
   entries,
   units,
}: {
   competition: Competition;
   winner: CompetitionStanding;
   entries: CompetitionEntry[];
   units: UnitSystem;
}) {
   const theirs = entries
      .filter((e) => e.anglerId === winner.anglerId && e.state === 'COUNTED')
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

   const photo = theirs.find((e) => e.heroUrl)?.heroUrl ?? null;
   const species = [
      ...new Set(
         theirs.map((e) => e.speciesName).filter((n): n is string => Boolean(n))
      ),
   ];
   const figure = leadingFigure(c, winner.score, units);
   const beside =
      c.rule === 'SPECIES_VARIETY'
         ? species.join(', ')
         : (winner.bestSpeciesName ?? species[0] ?? '');

   return (
      <article className="blk blk-flat flex flex-col">
         {photo ? (
            <img
               src={photo}
               alt=""
               className="block aspect-[16/9] w-full object-cover"
            />
         ) : null}
         <div className="flex flex-col gap-1 px-4 pt-4 pb-[18px]">
            <span className="lab text-teal">Winner</span>
            <span className="g text-[30px]">{winner.displayName}</span>
            <span className="g flex flex-wrap items-baseline gap-2 text-[24px] tracking-[0.03em]">
               {figure ?? '0'}
               {beside ? (
                  <span className="font-sans text-[14px] tracking-normal text-paper-2 normal-case">
                     {beside}
                  </span>
               ) : null}
            </span>
         </div>
      </article>
   );
}
