import { useLoadOnScroll } from '@/lib/load-on-scroll';
import { PageHead } from '@/components/brand/PageHead';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { InlineError } from '@/components/states/InlineError';
import { PlainState } from '@/components/states/PlainState';
import { Button } from '@/components/ui/button';
import { formatStamp, formatRelative } from '@/components/feed/format';
import { InboxNudge } from '@/components/notifications/InboxNudge';
import { NotificationFace } from '@/components/notifications/NotificationFace';
import { describe } from '@/components/notifications/notification-text';
import {
   fetchNotifications,
   markNotificationsRead,
   settleUnread,
   type Notification,
} from '@/components/social/notifications-api';
import { clearShownNotifications } from '@/lib/push';
import { useDocumentTitle } from '@/lib/title';
import { cn } from '@/lib/utils';

const LOAD_FAILED = 'Could not read your notifications.';

/*
 * The list falls into days, the way a phone's own notifications do: what
 * happened today reads first and on its own, and a week ago is one label and
 * not seven. Worked out on the reader's clock, which is whose today it is.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const dayOf = (iso: string) => {
   const at = new Date(iso);
   return new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
};
function whenGroup(iso: string, today: number) {
   const days = Math.round((today - dayOf(iso)) / DAY_MS);
   if (days <= 0) return 'Today';
   if (days === 1) return 'Yesterday';
   if (days < 7) return 'This week';
   return 'Earlier';
}
function byDay(rows: Notification[]) {
   const now = new Date();
   const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
   ).getTime();
   const groups: { label: string; rows: Notification[] }[] = [];
   for (const row of rows) {
      const label = whenGroup(row.createdAt, today);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.rows.push(row);
      else groups.push({ label, rows: [row] });
   }
   return groups;
}

export function NotificationsPage() {
   useDocumentTitle('Notifications');
   return (
      <RequireSignIn what="your notifications">
         <Inbox />
      </RequireSignIn>
   );
}

/*
 * What happened, newest first. Opening the page reads everything: the bell
 * goes quiet and the phone's own lines about it are cleared. What was unread
 * when the page opened stays marked for the visit, so the eye can find it.
 *
 * Each row is one person and one thing they did. The face carries the kind
 * (notifications/NotificationFace) and the sentence and time sit beside it,
 * all of it inset from the column's edge and on a soft rounded ground: this
 * used to be a hard-edged strip with the face against one side and a mark
 * against the other, which read as a table and not as news.
 */
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

   /* Whatever the phone is still showing about the inbox is answered by
    * being here, so it goes. */
   useEffect(() => {
      void clearShownNotifications();
   }, []);

   const newCount = fresh.size;
   const firstLoad = status === 'loading' && rows.length === 0;
   /* The nudge is there from the first paint and stays while older pages are
    * read: tied to "ready" it left and came back on every scroll to the foot,
    * and arrived after the rows, and both times the list jumped under the
    * reader's thumb. Only a page that failed to load at all goes without. */
   const shown = rows.length > 0 || status !== 'error';

   return (
      <section className="relative mx-auto w-[min(1120px,100%-32px)] pb-10 md:pb-14">
         <PageHead
            column="w-[min(1120px,100%-32px)]"
            kicker="What happened"
            title="Notifications"
            lede={
               rows.length > 0
                  ? newCount > 0
                     ? `${newCount} new since you last looked.`
                     : 'You are up to date.'
                  : /* Holds the line the count will take, so the rows do
                     * not land lower than their skeleton did. */
                    firstLoad
                    ? 'Reading what happened.'
                    : undefined
            }
         />

         {shown ? (
            <div className="mt-6 max-w-[820px] md:mt-8">
               <InboxNudge />
            </div>
         ) : null}

         {status === 'error' && rows.length === 0 ? (
            <div className="mt-8">
               <InlineError
                  message={LOAD_FAILED}
                  onRetry={() => setAttempt((n) => n + 1)}
               />
            </div>
         ) : firstLoad ? (
            <InboxSkeleton />
         ) : rows.length === 0 ? (
            <div className="mt-8">
               <PlainState
                  role="status"
                  sentence="Nothing yet. When somebody follows you, replies to a post of yours, likes it, or invites you to a competition, it lands here."
               >
                  <Button asChild variant="outline">
                     <Link to="/anglers">Find anglers to follow</Link>
                  </Button>
               </PlainState>
            </div>
         ) : (
            <div className="mt-6 flex max-w-[820px] flex-col gap-8 md:mt-8">
               {byDay(rows).map((group) => (
                  <section key={group.label}>
                     <h2 className="lab mb-3 pl-1">{group.label}</h2>
                     <ul className="flex flex-col gap-1.5">
                        {group.rows.map((n) => (
                           <NotificationRow
                              key={n.id}
                              notification={n}
                              fresh={fresh.has(n.id)}
                              index={rows.indexOf(n)}
                           />
                        ))}
                     </ul>
                  </section>
               ))}
            </div>
         )}

         <div ref={moreSentinel} aria-hidden="true" className="h-px" />
         {rows.length < total && status === 'loading' ? (
            <p className="lab mt-6 pl-4 text-ink-3">Reading older ones</p>
         ) : null}
      </section>
   );
}

function NotificationRow({
   notification,
   fresh,
   index,
}: {
   notification: Notification;
   fresh: boolean;
   index: number;
}) {
   const line = describe(notification);
   const when =
      formatRelative(notification.createdAt) ??
      formatStamp(notification.createdAt);

   const inner = (
      <>
         <NotificationFace notification={notification} />
         <span className="min-w-0 flex-1">
            {fresh ? <span className="sr-only">New. </span> : null}
            {/* Unread speaks up: the whole sentence in ink. Once read, only
                the name keeps its weight and the rest steps back. */}
            <span
               className={cn(
                  'block text-[16px] leading-snug',
                  fresh ? 'text-ink' : 'text-ink-2'
               )}
            >
               <span className="font-semibold text-ink">{line.who}</span>{' '}
               {line.did}
            </span>
            {line.quote ? (
               <span className="mt-0.5 line-clamp-2 block text-[15px] leading-snug text-ink-2">
                  {line.quote}
               </span>
            ) : null}
            <span className="lab mt-1.5 block">{when}</span>
         </span>
         {/* The one mark of unread: a teal point at the far end, where a
             thumb scrolling the list sees a column of them. */}
         {fresh ? (
            <span
               aria-hidden="true"
               className="size-2.5 shrink-0 rounded-full bg-teal"
            />
         ) : null}
      </>
   );

   const row = cn(
      'note-row flex min-h-[76px] items-center gap-4 rounded-[14px] py-3.5 pr-5 pl-4',
      line.to && 'note-row-link'
   );

   return (
      <li
         className="fact"
         style={{ '--i': Math.min(index, 10) } as React.CSSProperties}
      >
         {line.to ? (
            <Link
               to={line.to}
               data-fresh={fresh ? '' : undefined}
               className={row}
            >
               {inner}
            </Link>
         ) : (
            <div data-fresh={fresh ? '' : undefined} className={row}>
               {inner}
            </div>
         )}
      </li>
   );
}

/* The shape of the first rows before they arrive, so the page does not jump
 * when they do. Still, like the profile's: nothing here needs to move. */
function InboxSkeleton() {
   return (
      <div
         role="status"
         aria-label="Loading your notifications"
         className="mt-6 max-w-[820px] md:mt-8"
      >
         {/* The room the first day's label takes, kept empty. */}
         <p aria-hidden="true" className="lab invisible mb-3 pl-1">
            Today
         </p>
         <ul className="flex flex-col gap-1.5">
            {[0, 1, 2, 3].map((i) => (
               <li
                  key={i}
                  className="flex min-h-[76px] items-center gap-4 rounded-[14px] bg-bg-2 py-3.5 pr-5 pl-4"
               >
                  <span className="size-11 shrink-0 rounded-full border border-line-2 bg-bg" />
                  <span className="flex flex-1 flex-col gap-2.5">
                     <span
                        className="block h-3.5 bg-line"
                        style={{ width: `${62 - i * 9}%` }}
                     />
                     <span className="block h-2.5 w-16 bg-line" />
                  </span>
               </li>
            ))}
         </ul>
      </div>
   );
}
