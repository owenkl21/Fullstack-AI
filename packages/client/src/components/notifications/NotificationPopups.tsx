import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { isTaskRoute } from '@/components/shell/routes';
import {
   askNow,
   dismissPopup,
   markNotificationsRead,
   usePopups,
   type Notification,
} from '@/components/social/notifications-api';
import { useSession } from '@/lib/auth-client';
import { syncPush } from '@/lib/push';
import { NotificationFace } from './NotificationFace';
import { describe, sentenceOf } from './notification-text';

/*
 * News that arrives while the app is open, shown where it cannot be missed and
 * cannot get in the way: the top right corner on a desktop, just above the
 * bottom bar on a phone, where a thumb already is.
 *
 * A popup is a shortcut and never the record. It leaves by itself after a few
 * seconds, and leaving does not mark anything read: the bell still carries the
 * count and the inbox still has the line. Tapping it is the one thing that
 * reads it, because that is somebody acting on it.
 *
 * It lives inside the toast region (see toaster.tsx), so on a phone the two
 * stack in one column and can never cover each other.
 */

/* Long enough to read a name and a sentence twice. */
const LIFE_MS = 7000;
/* After a pause there is always at least this long left, so moving the pointer
 * off a popup does not make it vanish from under it. */
const GRACE_MS = 1500;

function Popup({ notification }: { notification: Notification }) {
   const line = describe(notification);
   /* Two holds and not one: a pointer drifting off must not let the clock run
    * while the keyboard is still inside, nor the other way round. */
   const [hovered, setHovered] = useState(false);
   const [focused, setFocused] = useState(false);
   const held = hovered || focused;
   const left = useRef(LIFE_MS);

   /* The clock stops while it is under a pointer or holds the focus. Reading
    * is not a race, and a keyboard user has to be able to reach the link. */
   useEffect(() => {
      if (held) return;
      const startedAt = Date.now();
      const timer = window.setTimeout(
         () => dismissPopup(notification.id),
         left.current
      );
      return () => {
         window.clearTimeout(timer);
         left.current = Math.max(
            GRACE_MS,
            left.current - (Date.now() - startedAt)
         );
      };
   }, [held, notification.id]);

   const open = () => {
      dismissPopup(notification.id);
      void markNotificationsRead([notification.id])
         .then(() => askNow())
         .catch(() => undefined);
   };

   const words = (
      <>
         <NotificationFace notification={notification} ground="black" />
         <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-[15px] leading-snug text-paper-2">
               <span className="font-semibold text-paper">{line.who}</span>{' '}
               {line.did}
            </span>
            {line.quote ? (
               <span className="mt-0.5 block truncate text-[14px] leading-snug text-paper-2">
                  {line.quote}
               </span>
            ) : null}
         </span>
      </>
   );

   const body =
      'flex min-h-[68px] min-w-0 flex-1 items-center gap-3.5 rounded-l-[16px] py-3 pr-1 pl-4 outline-offset-[-3px]';

   return (
      <div
         data-held={held ? '' : undefined}
         onPointerEnter={() => setHovered(true)}
         onPointerLeave={() => setHovered(false)}
         onFocus={() => setFocused(true)}
         onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
               setFocused(false);
            }
         }}
         /* Escape sends it away from the keyboard, as it does a dialog. */
         onKeyDown={(event) => {
            if (event.key === 'Escape') dismissPopup(notification.id);
         }}
         className="note-pop pointer-events-auto relative flex items-center overflow-hidden rounded-[16px] border border-paper/15 bg-black-block text-paper shadow-[0_14px_36px_rgba(11,9,9,0.32)]"
      >
         {line.to ? (
            <Link
               to={line.to}
               onClick={open}
               aria-label={sentenceOf(line)}
               className={body}
            >
               {words}
            </Link>
         ) : (
            <div className={body}>{words}</div>
         )}
         <button
            type="button"
            onClick={() => dismissPopup(notification.id)}
            aria-label="Dismiss"
            className="mr-1.5 grid size-11 shrink-0 place-items-center rounded-full text-paper-2 transition-colors duration-150 [transition-timing-function:var(--ease)] hover:bg-paper/10 hover:text-paper"
         >
            <XMarkIcon
               aria-hidden="true"
               className="size-5"
               strokeWidth={1.5}
            />
         </button>
         {/* How long it has left, as a teal line running out along the foot.
             It stops when the clock does. Held in from the rounded corners,
             which would otherwise clip its two ends into slivers. */}
         <span
            aria-hidden="true"
            className="note-pop-life absolute inset-x-4 bottom-0 h-[2px] origin-left rounded-full bg-teal"
            style={{ animationDuration: `${LIFE_MS}ms` }}
         />
      </div>
   );
}

export function NotificationPopups() {
   const popups = usePopups();
   const navigate = useNavigate();
   const { pathname } = useLocation();
   const { data } = useSession();
   const signedIn = Boolean(data?.user);
   /* A catch half logged is not the moment. On a task screen (shell/routes)
    * a popup sat over the form just above Next on a phone, and over the
    * form's own close on a desktop, where one stray tap left the log. What
    * arrives waits here, clock not started, and shows when the task is done;
    * the bell counts it meanwhile. */
   const holding = isTaskRoute(pathname);

   /* A browser that already holds a push address hands it to whoever has just
    * signed in. Never prompts; see lib/push.ts. */
   useEffect(() => {
      if (signedIn) void syncPush();
   }, [signedIn]);

   /*
    * The service worker talks to the open app in two words. "pushed": a
    * notification has just landed on the device, so ask the server now and do
    * not wait out the timer. "open": one was tapped, so go where it points,
    * through the router, without loading the app a second time.
    */
   useEffect(() => {
      if (!('serviceWorker' in navigator)) return;
      const onMessage = (event: MessageEvent) => {
         const message = event.data as { type?: string; url?: string } | null;
         if (!message || typeof message.type !== 'string') return;
         if (message.type === 'fisherfeed:pushed' && signedIn) {
            void askNow();
         }
         if (
            message.type === 'fisherfeed:open' &&
            typeof message.url === 'string' &&
            /* A path on this site and nothing else. */
            message.url.startsWith('/') &&
            !message.url.startsWith('//')
         ) {
            navigate(message.url);
         }
      };
      navigator.serviceWorker.addEventListener('message', onMessage);
      return () =>
         navigator.serviceWorker.removeEventListener('message', onMessage);
   }, [navigate, signedIn]);

   /* Always in the page, even with nothing in it: a live region that arrives
    * together with its first line is one most screen readers never read out. */
   return (
      <div
         role="region"
         aria-label="New notifications"
         aria-live="polite"
         className="pointer-events-none flex flex-col gap-2 not-empty:mb-2 md:fixed md:top-[76px] md:right-6 md:w-[380px] md:flex-col-reverse md:not-empty:mb-0"
      >
         {/* Newest nearest the edge it came from: the bottom on a phone, where
             the column grows upward from the bar, and the top on a desktop,
             which is why the column runs backwards there. */}
         {holding
            ? null
            : popups.map((notification) => (
                 <Popup key={notification.id} notification={notification} />
              ))}
      </div>
   );
}
