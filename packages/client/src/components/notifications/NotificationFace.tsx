import { createElement } from 'react';
import { Img } from '@/components/Img';
import { initialOf } from '@/components/profile/types';
import type { Notification } from '@/components/social/notifications-api';
import { cn } from '@/lib/utils';
import { markOf } from './notification-text';

/*
 * Who it was, with what they did pinned to the corner of their picture.
 *
 * The mark used to stand alone at the far end of the row, hard against the
 * edge, a long way from the person it belonged to. On the face it reads as one
 * thing: this person, this kind of news. It is teal in both themes, the one
 * accent the product has, and ringed in whatever ground it sits on so it cuts
 * cleanly out of the photograph.
 */
export function NotificationFace({
   notification,
   ground = 'page',
   className,
}: {
   notification: Notification;
   /* What the ring has to match: the page, or an always-black block. */
   ground?: 'page' | 'black';
   className?: string;
}) {
   const actor = notification.actor;
   const onBlack = ground === 'black';

   return (
      <span
         aria-hidden="true"
         className={cn('relative block size-11 shrink-0', className)}
      >
         {actor?.avatarUrl || actor?.avatarThumbUrl ? (
            <Img
               src={actor.avatarUrl}
               thumbSrc={actor.avatarThumbUrl}
               alt=""
               ratio="1 / 1"
               sizes="44px"
               className={cn(
                  'size-11 rounded-full',
                  onBlack ? 'bg-paper/20' : 'bg-bg-2'
               )}
            />
         ) : (
            /* The page's own ground inside a hairline, so the circle holds
             * its shape on every row: a grey disc vanished into the grey of a
             * read row and into the tint of an unread one. */
            <span
               className={cn(
                  'g grid size-11 place-items-center rounded-full text-[18px] leading-none',
                  onBlack
                     ? 'bg-paper/15 text-paper'
                     : 'border border-line-2 bg-bg text-ink-2'
               )}
            >
               {actor ? initialOf(actor.displayName) : '?'}
            </span>
         )}
         <span
            className={cn(
               'absolute -right-1 -bottom-1 grid size-[22px] place-items-center rounded-full bg-teal text-teal-ink ring-2',
               onBlack
                  ? 'ring-black-block'
                  : 'ring-[var(--note-ground,var(--bg))]'
            )}
         >
            {/* A lookup and not a component made here: the same five icons,
                picked by kind. */}
            {createElement(markOf(notification.kind), { className: 'size-3' })}
         </span>
      </span>
   );
}
