import { useState } from 'react';
import { ChatBubbleOvalLeftIcon, HeartIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { feedHead, feedPost } from './data';
import { ScreenHead } from './ScreenHead';

/*
 * The feed, as one card.
 *
 * The card is the app's own: `blk blk-flat` with the teal corner on it, the
 * angler across the top, the photograph at four by three, the fish as the
 * heading with its figures straight under it, and one row of actions under a
 * dashed rule. Heart and Follow are live, because a picture of a card is the
 * thing this phone was being accused of being.
 */

/* The same word-as-a-button the feed uses: League Gothic, tracked, no box. */
const word =
   'g-tracked inline-flex items-center tracking-[0.07em] transition-[color,opacity] duration-150 [transition-timing-function:var(--ease)] motion-reduce:transition-none';

const action = `${word} h-11 gap-1.5`;

export function FeedScreen({ on }: { on: boolean }) {
   const [liked, setLiked] = useState(false);
   const [following, setFollowing] = useState(false);

   return (
      <>
         <ScreenHead
            on={on}
            seed={23}
            kicker={feedHead.kicker}
            title={feedHead.title}
         />

         <div className="px-[18px] py-4">
            <article className="blk blk-flat grid grid-cols-1">
               <header className="flex items-center gap-3 px-4 pt-4 pr-10 pb-3.5">
                  <span
                     aria-hidden="true"
                     className="g grid size-10 shrink-0 place-items-center bg-paper/30 text-[20px] text-paper"
                  >
                     {feedPost.initial}
                  </span>
                  <span className="min-w-0 leading-tight">
                     <span className="block text-[16px] font-semibold text-paper">
                        {feedPost.author}
                     </span>
                     <span className="block truncate text-[13px] text-paper-2">
                        @{feedPost.handle}
                     </span>
                  </span>
                  <button
                     type="button"
                     aria-pressed={following}
                     onClick={() => setFollowing((was) => !was)}
                     className={cn(
                        word,
                        'ml-auto h-11 shrink-0 text-[15px]',
                        following ? 'text-teal-text' : 'text-paper-2'
                     )}
                  >
                     {following ? 'Following' : 'Follow'}
                  </button>
               </header>

               <div className="relative aspect-[4/3] w-full overflow-hidden bg-black-block-2">
                  <img
                     src={feedPost.photo}
                     alt={feedPost.photoAlt}
                     loading="lazy"
                     className="absolute inset-0 h-full w-full object-cover"
                  />
                  <span className="num absolute top-3 right-3 bg-black-block/72 px-2 py-[5px] text-[12px] leading-none tracking-[0.14em] text-paper">
                     {feedPost.frame}
                  </span>
               </div>

               <div className="flex flex-col px-4 py-[18px]">
                  <div className="flex flex-col gap-2">
                     <h2 className="g text-[30px] text-paper">
                        {feedPost.species}
                     </h2>
                     <p className="flex items-baseline gap-2.5 leading-none">
                        <span className="num font-display text-[26px] leading-none tracking-[0.03em] text-paper">
                           {feedPost.measure}
                        </span>
                        <span className="text-[14px] text-paper-2">
                           {feedPost.source}
                        </span>
                     </p>
                     <p className="text-[14px] text-paper-2">
                        {feedPost.context}
                     </p>
                     <p className="text-[15px] leading-relaxed text-paper">
                        {feedPost.note}
                     </p>
                  </div>

                  <div className="mt-4 flex items-center gap-[22px] border-t border-dashed border-line-2 pt-3">
                     <button
                        type="button"
                        aria-pressed={liked}
                        aria-label={liked ? 'Liked' : 'Like'}
                        onClick={() => setLiked((was) => !was)}
                        className={cn(
                           action,
                           liked ? 'text-teal-text' : 'text-paper-2'
                        )}
                     >
                        <HeartIcon
                           aria-hidden="true"
                           className="size-[22px]"
                           strokeWidth={1.5}
                        />
                        <span className="num text-[19px] tracking-[0.04em]">
                           {feedPost.likes + (liked ? 1 : 0)}
                        </span>
                     </button>

                     <span className={cn(action, 'text-paper-2')}>
                        <ChatBubbleOvalLeftIcon
                           aria-hidden="true"
                           className="size-[22px]"
                           strokeWidth={1.5}
                        />
                        <span className="num text-[19px] tracking-[0.04em]">
                           {feedPost.comments}
                        </span>
                     </span>

                     <span
                        className={cn(
                           word,
                           'ml-auto h-11 text-[16px] text-paper'
                        )}
                     >
                        {feedPost.action}
                     </span>
                  </div>
               </div>
            </article>
         </div>
      </>
   );
}
