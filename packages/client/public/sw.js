/*
 * The Fisherfeed service worker. It does two things: it shows a notification
 * when the server pushes one, and it opens the right page when that
 * notification is tapped.
 *
 * It has no fetch handler and keeps no cache, on purpose. A worker that answers
 * requests can go on serving last week's bundle after a deploy, and nothing in
 * this product is worth that risk. Every request goes to the network exactly as
 * it would with no worker at all.
 *
 * Plain JavaScript in public/, not a module in src/: it has to be served from
 * the root at a name that never changes, or its scope is not the whole site and
 * a deploy would register a second worker beside the first.
 */

/* A new copy takes over at once. There is nothing cached to migrate, so there
 * is no reason for an old copy to hang on until every tab has closed. */
self.addEventListener('install', () => {
   self.skipWaiting();
});

self.addEventListener('activate', (event) => {
   event.waitUntil(self.clients.claim());
});

const INBOX = '/notifications';

/* Safari, and every browser on an iPhone or iPad, which are all Safari
 * underneath. Chromium and Firefox name themselves; WebKit alone does not. */
const agent = self.navigator.userAgent;
const webkitOnly =
   /iPhone|iPad|iPod/.test(agent) ||
   (/Safari\//.test(agent) &&
      !/Chrome\/|Chromium\/|Edg\/|Firefox\//.test(agent));

/* Only ever a path on this site. The payload comes from our own server, but a
 * worker that opens whatever address it is handed is one bug away from being
 * used to send somebody somewhere else. */
const sameSite = (value) => {
   try {
      const url = new URL(value || INBOX, self.location.origin);
      return url.origin === self.location.origin ? url : null;
   } catch {
      return null;
   }
};

self.addEventListener('push', (event) => {
   let line = {};
   try {
      line = event.data ? event.data.json() : {};
   } catch {
      /* Not JSON. It still has to show something: a push that shows nothing
       * costs the permission on Safari after a few of them. */
   }

   const title =
      typeof line.title === 'string' && line.title ? line.title : 'Fisherfeed';
   const url = sameSite(line.url);

   event.waitUntil(
      (async () => {
         /* An open tab asks the server on a timer. Tell it to ask now, so the
          * bell and the popup in the app do not trail the phone by a minute.
          * First, so it happens even if showing the line below fails. */
         const tabs = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
         });
         tabs.forEach((tab) => tab.postMessage({ type: 'fisherfeed:pushed' }));

         /* Somebody looking at Fisherfeed right now gets the popup inside it,
          * and a second copy from the system in the corner is only noise.
          * Chromium and Firefox allow a push to show nothing while a tab of
          * the site is in front. Safari does not, and takes the permission
          * away from a site whose pushes stay silent, so there it always
          * shows.
          *
          * The test line is the exception: it is sent from a tap on the
          * settings, so the tab is always in front, and it has no row in
          * the inbox for the app to pop. Kept quiet, "Send a test" showed
          * nothing at all on Chrome and Firefox. The tag is the one
          * services/push.service.ts gives it. */
         const isTest = line.tag === 'test';
         if (!webkitOnly && !isTest && tabs.some((tab) => tab.focused)) return;

         await self.registration.showNotification(title, {
            body: typeof line.body === 'string' ? line.body : '',
            icon: line.icon || '/icons/icon-192.png',
            badge: line.badge || '/icons/badge-96.png',
            /* The same tag replaces the line already showing, so ten likes on
             * one post are one line and not ten. */
            tag: typeof line.tag === 'string' ? line.tag : undefined,
            renotify: Boolean(line.tag && line.renotify),
            data: { url: url ? url.pathname + url.search + url.hash : INBOX },
         });
      })()
   );
});

self.addEventListener('notificationclick', (event) => {
   event.notification.close();
   const data = event.notification.data || {};
   const url = sameSite(data.url) || new URL(INBOX, self.location.origin);
   const path = url.pathname + url.search + url.hash;

   event.waitUntil(
      (async () => {
         const tabs = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
         });
         /* The tab being looked at first, then any tab at all. */
         const tab =
            tabs.find((one) => one.focused) ||
            tabs.find((one) => one.visibilityState === 'visible') ||
            tabs[0];

         if (tab) {
            /* The app moves itself there: client.navigate would reload the
             * whole page and sit through the boot screen again. */
            tab.postMessage({ type: 'fisherfeed:open', url: path });
            if ('focus' in tab) {
               await tab.focus().catch(() => undefined);
            }
            return;
         }
         await self.clients.openWindow(url.href);
      })()
   );
});

/*
 * A push service can replace a browser's address whenever it likes, and
 * Firefox does. The old one is dead from that moment, so the new one is sent
 * to the server straight away and not left until the app is next opened. The
 * session cookie rides along because this is the same origin.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
   event.waitUntil(
      (async () => {
         const old = event.oldSubscription;
         const key =
            old && old.options ? old.options.applicationServerKey : null;
         const next =
            event.newSubscription ||
            (key
               ? await self.registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: key,
                 })
               : null);
         if (!next) return;
         await fetch('/api/push/subscriptions', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(next.toJSON()),
         });
      })().catch(() => undefined)
   );
});
