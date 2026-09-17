import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyStats, type PersonalBest, type ProfileStats } from './api';

/*
 * The numbers a profile can stand behind. Every one is counted, and anything
 * that cannot be known is a sentence rather than an invented zero: "no species
 * recorded" is not the same fact as "zero species".
 */
export function ProfileStatsPanel() {
   const [stats, setStats] = useState<ProfileStats | null>(null);
   const [bests, setBests] = useState<PersonalBest[]>([]);
   const [failed, setFailed] = useState(false);

   useEffect(() => {
      const controller = new AbortController();

      fetchMyStats(controller.signal)
         .then((data) => {
            setStats(data.stats);
            setBests(data.personalBests);
         })
         .catch(() => {
            if (!controller.signal.aborted) {
               setFailed(true);
            }
         });

      return () => controller.abort();
   }, []);

   if (failed) {
      return (
         <p className="text-[15px] text-ink-2">
            Could not load your numbers just now.
         </p>
      );
   }

   if (!stats) {
      return null;
   }

   /*
    * The count and the longest fish are not here: the sentences directly above
    * already say both, and repeating them two lines later reads as padding.
    */
   const figures: { label: string; value: string; counted?: boolean }[] = [
      {
         label: 'Species',
         value:
            stats.distinctSpecies === null
               ? 'None recorded'
               : String(stats.distinctSpecies),
         counted: stats.distinctSpecies !== null,
      },
      {
         label: 'Days on the water',
         value: String(stats.daysOnTheWater),
         counted: true,
      },
      { label: 'Released', value: String(stats.releasedCount), counted: true },
      { label: 'Points', value: String(stats.points), counted: true },
   ];

   return (
      <section className="mt-10">
         <h2 className="lab lab-rule">Your log</h2>

         <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
            {figures.map((f) => (
               <div key={f.label}>
                  <dt className="lab text-ink-3">{f.label}</dt>
                  {/*
                   * A figure is set at 28px; a sentence standing in for one is
                   * not. "None recorded" at 28px wrapped to two lines in a
                   * phone's two column grid and made that cell twice the height
                   * of the numbers beside it.
                   */}
                  <dd
                     className={
                        f.counted
                           ? 'num mt-1 text-[28px] leading-none'
                           : 'mt-1 text-[17px] leading-snug text-ink-2'
                     }
                  >
                     {f.value}
                  </dd>
               </div>
            ))}
         </dl>

         {stats.unscored ? (
            <p className="mt-5 max-w-[56ch] text-[14px] text-ink-3">
               {stats.unscored}{' '}
               {stats.unscored === 1 ? 'catch does' : 'catches do'} not score
               yet. A catch needs a species, a length, and published figures for
               that species before it can be ranked.{' '}
               <Link to="/boards" className="tap-inline text-teal-text">
                  See the boards
               </Link>
            </p>
         ) : null}

         {bests.length ? (
            <>
               <h2 className="lab lab-rule mt-10">Personal bests</h2>
               <ul className="mt-4 grid gap-0">
                  {bests.map((b) => (
                     <li
                        key={b.speciesId}
                        className="flex items-baseline justify-between gap-4 border-b border-line/60 py-3"
                     >
                        <Link
                           to={`/catches/${b.catchId}`}
                           className="inline-flex min-h-11 items-center text-[17px] hover:text-teal-text"
                        >
                           {b.commonName}
                        </Link>
                        <span className="num text-[17px]">{b.lengthCm} cm</span>
                     </li>
                  ))}
               </ul>
            </>
         ) : null}
      </section>
   );
}
