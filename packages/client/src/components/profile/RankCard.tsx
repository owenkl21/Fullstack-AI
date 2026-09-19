import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
   fetchMyProgress,
   fetchProgressOf,
   type Progress,
} from '@/components/social/progress-api';
import { cn } from '@/lib/utils';

/*
 * The rank, on the profile.
 *
 * One line and a bar: the level, the name it carries, how far to the next.
 * The whole reckoning is on the insights page; this is the part that belongs
 * next to a name.
 */
export function RankCard({
   userId,
   own = false,
   className,
}: {
   /* Another angler's id; left out, it is the signed-in angler's own. */
   userId?: string;
   own?: boolean;
   className?: string;
}) {
   const [progress, setProgress] = useState<Progress | null>(null);

   useEffect(() => {
      const controller = new AbortController();
      (userId
         ? fetchProgressOf(userId, controller.signal)
         : fetchMyProgress(controller.signal)
      )
         .then(setProgress)
         .catch(() => undefined);
      return () => controller.abort();
   }, [userId]);

   if (!progress) return null;

   const body = (
      <>
         <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="flex items-baseline gap-2">
               <span className="lab text-ink-3">Level</span>
               <span className="g num text-[28px] leading-none">
                  {progress.rank.index + 1}
               </span>
               <span className="g-tracked text-[19px]">
                  {progress.rank.name}
               </span>
            </span>
            <span className="num text-[14px] text-ink-2">
               {progress.points.toLocaleString()} points
               {progress.next
                  ? `, ${(progress.next.minPoints - progress.points).toLocaleString()} to ${progress.next.name}`
                  : ''}
            </span>
         </div>
         <div className="rank-bar mt-2" aria-hidden="true">
            <span
               style={{ width: `${Math.round(progress.progress * 100)}%` }}
            />
         </div>
         <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-ink-2">
            <span>
               {progress.badges.filter((b) => b.earned).length} of{' '}
               {progress.badges.length} badges
            </span>
            <span>{progress.figures.spots} spots</span>
            <span>{progress.figures.species} species</span>
            <span>{progress.figures.rangeKm} km range</span>
         </div>
      </>
   );

   return own ? (
      <Link
         to="/insights"
         aria-label={`Level ${progress.rank.index + 1}, ${progress.rank.name}. Open your insights.`}
         className={cn(
            'block border border-line p-4 transition-colors duration-150 hover:border-ink',
            className
         )}
      >
         {body}
         <span className="g-tracked mt-3 inline-block text-[16px] text-teal-text">
            How this is counted, and everything else in your log
         </span>
      </Link>
   ) : (
      <div className={cn('border border-line p-4', className)}>{body}</div>
   );
}
