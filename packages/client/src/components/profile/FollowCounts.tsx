import { UserGroupIcon, UsersIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

/*
 * Followers and following, as two things you can press.
 *
 * They used to be a sentence with two links buried in it, so the numbers were
 * hard to find and the fact that they opened anything was hard to guess. The
 * figure leads, in the display face, because the figure is what anyone is
 * looking for.
 *
 * Renders as buttons when there is somewhere to go and as plain figures when
 * there is not, which is the case on another angler's profile where the lists
 * are not ours to show.
 */

type Props = {
   followers: number;
   following: number;
   onOpen?: (kind: 'followers' | 'following') => void;
   className?: string;
};

export function FollowCounts({
   followers,
   following,
   onOpen,
   className,
}: Props) {
   const entries = [
      {
         kind: 'followers' as const,
         Icon: UsersIcon,
         count: followers,
         label: followers === 1 ? 'Follower' : 'Followers',
      },
      {
         kind: 'following' as const,
         Icon: UserGroupIcon,
         count: following,
         label: 'Following',
      },
   ];

   return (
      <div className={cn('flex flex-wrap gap-3', className)}>
         {entries.map(({ kind, Icon, count, label }) => {
            const body = (
               <>
                  <Icon
                     aria-hidden="true"
                     className="size-[18px] shrink-0 text-ink-3"
                  />
                  <span className="g num text-[26px] leading-none">
                     {count}
                  </span>
                  <span className="lab text-ink-3">{label}</span>
               </>
            );

            const shape =
               'inline-flex min-h-11 items-center gap-2.5 border border-line px-3.5 py-2';

            return onOpen ? (
               <button
                  key={kind}
                  type="button"
                  onClick={() => onOpen(kind)}
                  className={cn(
                     shape,
                     'transition-colors duration-150 [transition-timing-function:var(--ease)] hover:border-ink hover:bg-bg-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal'
                  )}
               >
                  {body}
               </button>
            ) : (
               <span key={kind} className={shape}>
                  {body}
               </span>
            );
         })}
      </div>
   );
}
