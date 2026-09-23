import { Fold } from '@/components/ui/fold';
import {
   MapPinIcon,
   SparklesIcon,
   TrophyIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { CountIn } from '@/components/fishing/record/CountIn';
import { formatDay, plural } from '@/components/fishing/record/format';
import { Link } from 'react-router-dom';
import { fetchMyStats, type PersonalBest, type ProfileStats } from './api';
import { bestFigure } from '@/components/fishing/personal-best';
import { useUnits } from '@/lib/units';

/*
 * The numbers a profile can stand behind. Every one is counted, and anything
 * that cannot be known is a sentence rather than an invented zero: "no species
 * recorded" is not the same fact as "zero species".
 */
export function ProfileStatsPanel() {
   const [stats, setStats] = useState<ProfileStats | null>(null);
   const [bests, setBests] = useState<PersonalBest[]>([]);
   const [failed, setFailed] = useState(false);
   const units = useUnits();

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
      /*
       * The board points, which are kilograms scored against the published
       * figures for a species. The rank card above counts a different currency
       * and both were labelled Points, three lines apart.
       */
      { label: 'Board points', value: String(stats.points), counted: true },
   ];

   /* Midday, so the day cannot slip either way across the date line. */
   const dayName = (iso: string) => formatDay(`${iso}T12:00:00`) ?? iso;

   /*
    * Logs, not fish. The server counts these three by record, so a single log
    * of five elf counts once here; saying fish would be wrong the first time
    * Owen logs more than one at a go.
    */
   const highlights = [
      stats.favouriteSpecies && {
         key: 'species',
         Icon: SparklesIcon,
         value: stats.favouriteSpecies.name,
         tail: `is your most caught fish, in ${plural(stats.favouriteSpecies.count, 'log', 'logs')}.`,
      },
      stats.favouriteSpot && {
         key: 'spot',
         Icon: MapPinIcon,
         value: stats.favouriteSpot.name,
         tail: `is where you land most, ${plural(stats.favouriteSpot.count, 'log', 'logs')}.`,
      },
      stats.bestDay && {
         key: 'day',
         Icon: TrophyIcon,
         value: plural(stats.bestDay.count, 'log', 'logs'),
         tail: `was your best day, on ${dayName(stats.bestDay.date)}.`,
      },
   ].filter(Boolean) as {
      key: string;
      Icon: typeof SparklesIcon;
      value: string;
      tail: string;
   }[];

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
                     {/^\d+$/.test(f.value) ? (
                        <CountIn value={Number(f.value)} durationMs={800} />
                     ) : (
                        f.value
                     )}
                  </dd>
               </div>
            ))}
         </dl>

         {/*
          * The things worth saying out loud, in words rather than as figures in the
          * grid: a favourite is a sentence, not a measurement. Each one only
          * appears once it has happened more than once.
          */}
         {highlights.length ? (
            <ul className="mt-6 flex flex-col gap-2.5">
               {highlights.map((h) => (
                  <li key={h.key} className="flex items-center gap-2.5">
                     <h.Icon
                        aria-hidden="true"
                        className="size-[18px] shrink-0 text-ink-3"
                     />
                     <span className="text-[15px] text-ink-2">
                        <span className="text-ink">{h.value}</span> {h.tail}
                     </span>
                  </li>
               ))}
            </ul>
         ) : null}

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
            <Fold
               className="mt-10 border-t border-line pt-2"
               title="Personal bests"
               aside={`${bests.length} species`}
            >
               <ul className="mt-2 grid gap-0">
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
                        <span className="num text-[17px]">
                           {bestFigure(b, units)}
                        </span>
                     </li>
                  ))}
               </ul>
            </Fold>
         ) : null}
      </section>
   );
}
