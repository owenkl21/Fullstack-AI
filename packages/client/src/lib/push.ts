import axios from 'axios';
import { isAppleTouch, isStandalone } from '@/lib/install';

/*
 * Notifications on this device: the browser's half of web push.
 *
 * One switch, and what it means is "this browser, on this device". Turning it
 * on registers the worker in public/sw.js, asks the browser for a push address
 * under the server's public key, and hands that address to the server. Turning
 * it off takes both away again. Nothing here is remembered in localStorage:
 * the browser already knows whether it holds a subscription, and asking it is
 * the only answer that cannot go stale.
 *
 * The permission prompt is only ever raised from turnPushOn, and turnPushOn is
 * only ever called from a tap. A prompt that arrives unasked is the one people
 * block, and a blocked site cannot ask twice.
 */

export type PushState =
   /** Still asking the browser. */
   | 'checking'
   /** No service worker, no push, or not a secure page. */
   | 'unsupported'
   /** iPhone or iPad in a browser tab: Apple only allows it once installed. */
   | 'needs-install'
   /** Refused in the browser. Only the browser's own settings can undo that. */
   | 'blocked'
   | 'off'
   | 'on';

export class PushError extends Error {
   reason: 'blocked' | 'dismissed' | 'unavailable' | 'failed';
   constructor(reason: PushError['reason']) {
      super(reason);
      this.reason = reason;
   }
}

/* What the switch says when turning it on did not work, by what went wrong. */
export const PUSH_FAILED: Record<PushError['reason'], string> = {
   blocked:
      'The browser said no. Allow notifications for this site in its settings to turn this on.',
   dismissed: 'The browser asked and got no answer, so it stays off.',
   unavailable: 'This browser cannot show notifications from a website.',
   failed: 'Could not turn it on. Check your connection and try again.',
};

const WORKER = '/sw.js';

const supported = () =>
   typeof window !== 'undefined' &&
   window.isSecureContext &&
   'serviceWorker' in navigator &&
   'PushManager' in window &&
   'Notification' in window;

/* The key arrives as base64url text and the browser wants the bytes. */
const bytesOf = (key: string) => {
   const padded = key.replace(/-/g, '+').replace(/_/g, '/');
   const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
   return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

const sameBytes = (held: ArrayBuffer | null, wanted: Uint8Array) => {
   if (!held) return false;
   const bytes = new Uint8Array(held);
   return (
      bytes.length === wanted.length &&
      bytes.every((byte, index) => byte === wanted[index])
   );
};

async function subscriptionOf() {
   const registration = await navigator.serviceWorker.getRegistration('/');
   return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function readPushState(): Promise<PushState> {
   /* Before anything else: in a Safari tab on an iPhone PushManager does not
    * exist at all, and "not supported" would be the wrong thing to say to
    * somebody who is one step away from it working. */
   if (isAppleTouch() && !isStandalone()) return 'needs-install';
   if (!supported()) return 'unsupported';
   if (Notification.permission === 'denied') return 'blocked';
   try {
      const held = await subscriptionOf();
      return held && Notification.permission === 'granted' ? 'on' : 'off';
   } catch {
      return 'off';
   }
}

async function fetchKey() {
   const { data } = await axios.get<{ publicKey: string }>('/api/push/key');
   return bytesOf(data.publicKey);
}

const save = (held: PushSubscription) =>
   axios.post('/api/push/subscriptions', held.toJSON());

/**
 * Call from a tap and nowhere else. Throws a PushError that says which of the
 * four ways it went wrong, so the switch can say so too.
 */
export async function turnPushOn(): Promise<void> {
   if (!supported()) throw new PushError('unavailable');

   /* First, before anything is awaited: Safari only honours the request while
    * the tap that caused it is still the thing being handled. */
   const answer =
      Notification.permission === 'granted'
         ? 'granted'
         : await Notification.requestPermission();
   if (answer === 'denied') throw new PushError('blocked');
   if (answer !== 'granted') throw new PushError('dismissed');

   let held: PushSubscription | null = null;
   try {
      await navigator.serviceWorker.register(WORKER, { scope: '/' });
      const registration = await navigator.serviceWorker.ready;
      const key = await fetchKey();
      held = await registration.pushManager.getSubscription();
      /* An address made under another key is one nothing signs for any more. */
      if (held && !sameBytes(held.options.applicationServerKey, key)) {
         await held.unsubscribe();
         held = null;
      }
      held ??= await registration.pushManager.subscribe({
         userVisibleOnly: true,
         applicationServerKey: key,
      });
      await save(held);
   } catch (error) {
      /* Half on is worse than off: a browser holding an address the server
       * never heard of shows the switch as on and never rings. */
      await held?.unsubscribe().catch(() => undefined);
      if (error instanceof PushError) throw error;
      throw new PushError('failed');
   }
}

export async function turnPushOff(): Promise<void> {
   if (!supported()) return;
   const held = await subscriptionOf().catch(() => null);
   if (!held) return;
   /* The server first, while there is still an address to name. If it cannot
    * be reached the browser's half still goes, and the server drops its row
    * the first time the push service answers that the address is gone. */
   await axios
      .delete('/api/push/subscriptions', { data: { endpoint: held.endpoint } })
      .catch(() => undefined);
   await held.unsubscribe().catch(() => undefined);
}

/** A line to this angler's own browsers, so the switch can be seen to work. */
export async function sendTestPush() {
   const { data } = await axios.post<{ sent: number; failed: number }>(
      '/api/push/test'
   );
   return data;
}

/*
 * Once per load, for somebody signed in whose browser already holds an
 * address. It never prompts. It re-registers the worker so a new sw.js is
 * picked up, and hands the address to the server again, which moves it to
 * whoever is signed in now: a phone that changed hands stops hearing about
 * the last person's likes. If the server's key has changed under it (a new
 * database), the old address is swapped for one made with the new key.
 */
let synced = false;
export async function syncPush(): Promise<void> {
   if (synced || !supported() || Notification.permission !== 'granted') return;
   synced = true;
   try {
      const held = await subscriptionOf();
      if (!held) return;
      const registration = await navigator.serviceWorker.register(WORKER, {
         scope: '/',
      });
      const key = await fetchKey();
      if (sameBytes(held.options.applicationServerKey, key)) {
         await save(held);
         return;
      }
      await held.unsubscribe();
      const fresh = await registration.pushManager.subscribe({
         userVisibleOnly: true,
         applicationServerKey: key,
      });
      await save(fresh);
   } catch {
      /* Tried again on the next load. */
      synced = false;
   }
}

/*
 * Signing out turns this device off first. Left on, the next person to sign in
 * here would be shown the last person's notifications on the lock screen until
 * they opened the app. Bounded, so a dead network cannot hold up a sign out.
 */
export async function forgetPushOnSignOut(): Promise<void> {
   synced = false;
   await Promise.race([
      turnPushOff(),
      new Promise<void>((resolve) => window.setTimeout(resolve, 2500)),
   ]).catch(() => undefined);
}

/** Opening the inbox clears what the phone is still showing about it. */
export async function clearShownNotifications(): Promise<void> {
   if (!supported()) return;
   try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const shown = (await registration?.getNotifications()) ?? [];
      shown.forEach((one) => one.close());
   } catch {
      /* Nothing to clear is not a fault. */
   }
}
