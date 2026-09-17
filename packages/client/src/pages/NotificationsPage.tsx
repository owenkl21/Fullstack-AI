import { useLoadOnScroll } from '@/lib/load-on-scroll';
import { PageHead } from '@/components/brand/PageHead';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
   BellAlertIcon,
   ChatBubbleOvalLeftIcon,
   HeartIcon,
   TrophyIcon,
   UserPlusIcon,
} from '@heroicons/react/24/outline';
import { ContourField } from '@/components/brand/ContourField';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { InlineError } from '@/components/states/InlineError';
import { formatStamp, formatRelative } from '@/components/feed/format';
import {
   fetchNotifications,
   markNotificationsRead,
   settleUnread,
   type Notification,
} from '@/components/social/notifications-api';
import { useDocumentTitle } from '@/lib/title';
import { cn } from '@/lib/utils';

const LOAD_FAILED = 'Could not read your notifications.';

const initialOf = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

/* One line per kind, in words rather than codes. */
function describe(n: Notification): { text: string; to: string | null } {
   const who = n.actor?.displayName ?? 'Somebody';
   const profile = n.actor ? `/anglers/${n.actor.id}` : null;
   switch (n.kind) {
      case 'FOLLOW':
         return { text: `${who} started following you.`, to: profile };
      case 'COMMENT':
         return {
            text: n.body
               ? `${who} replied: ${n.body}`
               : `${who} replied to your post.`,
            to: '/',
         };
      case 'LIKE':
         return { text: `${who} liked your post.`, to: '/' };
      case 'INVITE':
         return {
            text: n.body
               ? `${who} invited you to ${n.body}.`
               : `${who} invited you to a competition.`,
            to: '/competitions',
         };
      case 'INVITE_ANSWER': {
         const [answer, name] = (n.body ?? '').split('|');
         return {
            text: `${who} ${answer === 'accepted' ? 'accepted' : 'declined'} your invitation${name ? ` to ${name}` : ''}.`,
            to: '/competitions',
         };
      }
      default:
         return { text: `${who} did something.`, to: null };
   }
}

const ICON = {
   FOLLOW: UserPlusIcon,
   COMMENT: ChatBubbleOvalLeftIcon,
   LIKE: HeartIcon,
   INVITE: TrophyIcon,
   INVITE_ANSWER: TrophyIcon,
};

export function NotificationsPage() {
   useDocumentTitle('Notifications');
   return (
      <RequireSignIn what="your notifications">
         <Inbox />
      </RequireSignIn>
   );
}

function Inbox() {
   const [rows, setRows] = useState<Notification[]>([]);
   const [total, setTotal] = useState(0);
   const [page, setPage] = useState(1);
   const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
      'loading'
   );
   const [attempt, setAttempt] = useState(0);
   const moreSentinel = useLoadOnScroll(
      () => setPage((p) => p + 1),
      status === 'ready' && rows.length < total
   );
   /* What was unread when the page opened stays marked so it can be seen. */
   const [fresh, setFresh] = useState<Set<string>>(() => new Set());

   useEffect(() => {
      const controller = new AbortController();
      const load = async () => {
         setStatus('loading');
         try {
            const data = await fetchNotifications(page, controller.signal);
            setFresh((was) => {
               const next = new Set(was);
               data.notifications
                  .filter((n) => !n.readAt)
                  .forEach((n) => next.add(n.id));
               return next;
            });
            setRows((was) =>
               page === 1 ? data.notifications : [...was, ...data.notifications]
            );
            setTotal(data.total);
            setStatus('ready');
            /* Reading the page is reading them. The bell goes quiet. */
            if (data.unread > 0) {
               await markNotificationsRead();
               settleUnread(0);
            }
         } catch {
            if (!controller.signal.aborted) setStatus('error');
         }
      };
      void load();
      return () => controller.abort();
   }, [page, attempt]);

   return (
      <section className="relative mx-auto w-[min(1120px,100%-32px)] pb-10 md:pb-14">
         <ContourField seed={29} />
         <PageHead
            column="w-[min(1120px,100%-32px)]"
            kicker="What happened"
            title="Notifications"
         />

         {status === 'error' && rows.length === 0 ? (
            <div className="mt-8">
               <InlineError
                  message={LOAD_FAILED}
                  onRetry={() => setAttempt((n) => n + 1)}
               />
            </div>
         ) : rows.length === 0 && status === 'ready' ? (
            <div className="mt-10 flex max-w-[52ch] flex-col items-start gap-3">
               <BellAlertIcon
                  aria-hidden="true"
                  className="size-8 text-ink-3"
                  strokeWidth={1.5}
               />
               <p className="text-[17px] text-ink-2">
                  Nothing yet. When somebody follows you, replies to a post of
                  yours, likes it, or invites you to a competition, it lands
                  here.
               </p>
            </div>
         ) : (
            <ul className="relative mt-8 flex flex-col">
               {rows.map((n, i) => {
                  const { text, to } = describe(n);
                  const Icon = ICON[n.kind] ?? BellAlertIcon;
                  const isFresh = fresh.has(n.id);
                  const inner = (
                     <>
                        <span
                           aria-hidden="true"
                           className={cn(
                              'g grid size-10 shrink-0 place-items-center rounded-full text-[18px]',
                              isFresh
                                 ? 'bg-teal text-teal-ink'
                                 : 'bg-bg-2 text-ink-2'
                           )}
                        >
                           {n.actor ? initialOf(n.actor.displayName) : '?'}
                        </span>
                        <span className="min-w-0 flex-1">
                           <span className="block text-[16px] leading-snug text-ink">
                              {text}
                           </span>
                           <span className="lab mt-1 block text-ink-3">
                              {formatRelative(n.createdAt) ??
                                 formatStamp(n.createdAt)}
                           </span>
                        </span>
                        <Icon
                           aria-hidden="true"
                           className={cn(
                              'size-5 shrink-0',
                              isFresh ? 'text-teal-text' : 'text-ink-3'
                           )}
                        />
                     </>
                  );
                  const row =
                     'fact flex items-center gap-4 border-t border-line py-3.5 first:border-t-0';
                  return (
                     <li
                        key={n.id}
                        className={cn(isFresh && 'bg-teal/5')}
                        style={
                           { '--i': Math.min(i, 10) } as React.CSSProperties
                        }
                     >
                        {to ? (
                           <Link to={to} className={cn(row, 'hover:bg-bg-2')}>
                              {inner}
                           </Link>
                        ) : (
                           <div className={row}>{inner}</div>
                        )}
                     </li>
                  );
               })}
            </ul>
         )}

         <div ref={moreSentinel} aria-hidden="true" className="h-px" />
         {rows.length < total && status === 'loading' ? (
            <p className="lab mt-6 text-ink-3">Reading older ones</p>
         ) : null}
      </section>
   );
}
