import type { ComponentType, SVGProps } from 'react';
import {
   BellAlertIcon,
   ChatBubbleOvalLeftIcon,
   HeartIcon,
   TrophyIcon,
   UserPlusIcon,
} from '@heroicons/react/24/solid';
import type { Notification } from '@/components/social/notifications-api';

/*
 * One notification, in words. The inbox and the popup both read from here, so
 * a follow is the same sentence wherever it shows up, and a new kind is added
 * in one place.
 *
 * It comes back in parts and not as one string, because the two places set it
 * differently: who did it is the heavy part of the line, what they did is the
 * light part, and what they wrote (a reply, the comment that was liked) sits
 * under both as a quote.
 */
export type NotificationLine = {
   who: string;
   /* Reads on after the name: "started following you". No full stop. */
   did: string;
   /* Their words, or the name of the competition. Null when there are none. */
   quote: string | null;
   /* Where a tap goes. Null is a line that leads nowhere. */
   to: string | null;
};

/*
 * The feed, opened at one post and, when the row names one, at one comment.
 * A row about a comment that was since removed is removed with it, so this
 * never points at nothing.
 */
export function threadLink(n: Pick<Notification, 'postId' | 'commentId'>) {
   if (!n.postId) return '/feed';
   const query = new URLSearchParams({ post: n.postId });
   if (n.commentId) query.set('comment', n.commentId);
   return `/feed?${query.toString()}`;
}

/* The competition itself when the row names one, else the list of them. */
const competitionLink = (n: Pick<Notification, 'competitionId'>) =>
   n.competitionId ? `/competitions/${n.competitionId}` : '/competitions';

export function describe(n: Notification): NotificationLine {
   const who = n.actor?.displayName ?? 'Somebody';
   const profile = n.actor ? `/anglers/${n.actor.id}` : null;
   const words = n.body?.trim() || null;

   switch (n.kind) {
      case 'FOLLOW':
         return { who, did: 'started following you', quote: null, to: profile };
      case 'COMMENT':
         return {
            who,
            did: 'replied to your post',
            quote: words,
            to: threadLink(n),
         };
      case 'COMMENT_REPLY':
         return {
            who,
            did: 'replied to your comment',
            quote: words,
            to: threadLink(n),
         };
      case 'LIKE':
         return { who, did: 'liked your post', quote: null, to: threadLink(n) };
      case 'COMMENT_LIKE':
         return {
            who,
            did: 'liked your comment',
            quote: words,
            to: threadLink(n),
         };
      case 'INVITE':
         return {
            who,
            did: 'invited you to a competition',
            quote: words,
            to: competitionLink(n),
         };
      case 'INVITE_ANSWER': {
         const [answer, name] = (n.body ?? '').split('|');
         return {
            who,
            did: `${answer === 'accepted' ? 'accepted' : 'declined'} your invitation`,
            quote: name?.trim() || null,
            to: competitionLink(n),
         };
      }
      default:
         /* A kind this build has never heard of still says something true. */
         return { who, did: 'did something new', quote: null, to: null };
   }
}

/** The whole line as one sentence, for a screen reader and a title. */
export const sentenceOf = (line: NotificationLine) =>
   `${line.who} ${line.did}.${line.quote ? ` ${line.quote}` : ''}`;

type Mark = ComponentType<SVGProps<SVGSVGElement>>;

const MARKS: Partial<Record<Notification['kind'], Mark>> = {
   FOLLOW: UserPlusIcon,
   COMMENT: ChatBubbleOvalLeftIcon,
   COMMENT_REPLY: ChatBubbleOvalLeftIcon,
   LIKE: HeartIcon,
   COMMENT_LIKE: HeartIcon,
   INVITE: TrophyIcon,
   INVITE_ANSWER: TrophyIcon,
};

export const markOf = (kind: Notification['kind']): Mark =>
   MARKS[kind] ?? BellAlertIcon;
