import { Link } from 'react-router-dom';
import type { CatchSummary } from '@/components/fishing/record/api';
import {
   formatStamp,
   lengthMetric,
   plural,
   weightMetric,
} from '@/components/fishing/record/format';

/*
 * The last few catches in the row anatomy the whole product uses: a 52px photo, the
 * fish in League Gothic, one sub-line of facts, the length on the right. Hairlines
 * between rows, no cards.
 */
export function RecentRows({
   catches,
   total,
}: {
   catches: CatchSummary[];
   total: number;
}) {
   return (
      <section aria-labelledby="recent-heading" className="pt-5">
         <div className="flex items-baseline justify-between gap-4 px-4 md:px-8">
            <h2 id="recent-heading" className="g text-[30px]">
               Recent
            </h2>
            <Link to="/catches/me" className="lab text-teal-text">
               All {plural(total, 'catch', 'catches')}
            </Link>
         </div>
         <ul className="mt-2">
            {catches.map((entry) => {
               const photo = entry.images[0]?.image.url;
               const facts = [
                  formatStamp(entry.caughtAt),
                  entry.site?.name,
                  weightMetric(entry.weight),
               ].filter(Boolean);
               const length = lengthMetric(entry.length);

               return (
                  <li key={entry.id} className="border-t border-line">
                     <Link
                        to={`/catches/${entry.id}`}
                        className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3.5 px-4 py-2.5 transition-colors duration-150 hover:bg-bg-2 md:px-8"
                     >
                        {photo ? (
                           <img
                              src={photo}
                              alt=""
                              loading="lazy"
                              className="size-[52px] bg-bg-2 object-cover"
                           />
                        ) : (
                           <span
                              className="size-[52px] bg-bg-2"
                              aria-hidden="true"
                           />
                        )}
                        <span className="flex min-w-0 flex-col">
                           <span className="g truncate text-[22px]">
                              {entry.title}
                           </span>
                           <span className="truncate text-[14px] text-ink-2">
                              {facts.join(' · ')}
                           </span>
                        </span>
                        {length ? (
                           <span className="g num text-[24px]">{length}</span>
                        ) : (
                           <span className="text-[14px] text-ink-3">
                              Not measured
                           </span>
                        )}
                     </Link>
                  </li>
               );
            })}
         </ul>
      </section>
   );
}
