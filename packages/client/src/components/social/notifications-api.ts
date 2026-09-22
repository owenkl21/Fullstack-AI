import axios from 'axios';
import { useEffect, useState, useSyncExternalStore } from 'react';

export type NotificationKind =
   | 'FOLLOW'
   | 'COMMENT'
   | 'LIKE'
   | 'INVITE'
   | 'INVITE_ANSWER'
   | 'COMMENT_REPLY'
   | 'COMMENT_LIKE'
   /* The Fisherfeed team pinned a badge on one of your fish. */
   | 'BADGE';

export type Notification = {
   id: string;
   kind: NotificationKind;
   postId: string | null;
   /* The comment a reply or a comment like is about, when there is one. */
   commentId?: string | null;
   competitionId: string | null;
   /* The fish a badge line is about, so a tap opens the record. */
   catchId?: string | null;
   body: string | null;
   readAt: string | null;
   createdAt: string;
   actor: {
      id: string;
      displayName: string;
      username: string;
      avatarUrl: string | null;
      /* 256px, which is what a forty pixel face should be reading. */
      avatarThumbUrl?: string | null;
   } | null;
};

export async function fetchNotifications(page = 1, signal?: AbortSignal) {
   const { data } = await axios.get<{
      notifications: Notification[];
      total: number;
      unread: number;
      page: number;
      size: number;
   }>('/api/notifications', { params: { page }, signal });
   return data;
}

/* How many are unread, and which one is newest. The id is what lets an open
 * app notice an arrival without reading the whole list every time it asks. */
export async function fetchPulse(signal?: AbortSignal) {
   const { data, headers } = await axios.get<{
      unread: number;
      newestId?: string | null;
   }>('/api/notifications/unread', { signal });
   /* The server's own clock, to the second, for telling what is new. A phone
    * that runs five minutes fast would otherwise call everything old. */
   const stamped = Date.parse(String(headers?.date ?? ''));
   return {
      unread: data.unread ?? 0,
      newestId: data.newestId ?? null,
      serverNow: Number.isFinite(stamped) ? stamped : Date.now(),
   };
}

export async function clearNotifications() {
   const { data } = await axios.delete<{ cleared: number }>(
      '/api/notifications'
   );
   settleUnread(0);
   return data.cleared ?? 0;
}

export async function markNotificationsRead(ids?: string[]) {
   const { data } = await axios.post<{ read: number }>(
      '/api/notifications/read',
      ids ? { ids } : {}
   );
   return data.read ?? 0;
}

/*
 * The unread count, shared by the bell and the page. Asked for on load, when
 * the tab comes back, every forty five seconds while it is open, and at once
 * when the service worker says a push has just landed. A page that marks
 * things read tells the bell through `settle`.
 */
let count: number | null = null;
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((fn) => fn());

export function settleUnread(next: number) {
   count = next;
   announce();
}

/*
 * What arrived while the app was open, for the popups.
 *
 * The rule that matters is the one nobody should ever notice: nothing pops for
 * what was already waiting when the app opened. So the first answer from the
 * server is only remembered, never shown, and if anything is waiting the
 * first page of the inbox is read once, quietly, so every row on it is known.
 * After that, a newest id the app has not seen means something arrived: the
 * first page is read again and the unread rows that are new to this tab are
 * handed over.
 *
 * Never more than three at a time. A fourth pushes the oldest out: a burst of
 * likes should not build a wall over the feed.
 */
const MAX_POPUPS = 3;
/* A second guard behind the list of known rows: a row is only news if it was
 * written after the app opened, by the server's clock. The slack covers a row
 * stamped a moment before it was committed, and a proxy that stamps the date. */
const CLOCK_SLACK_MS = 60_000;

let popups: Notification[] = [];
const popupListeners = new Set<() => void>();
const announcePopups = () => popupListeners.forEach((fn) => fn());

const seen = new Set<string>();
let booted = false;
let bootedAt = 0;
let lastNewestId: string | null = null;

export function dismissPopup(id: string) {
   if (!popups.some((one) => one.id === id)) return;
   popups = popups.filter((one) => one.id !== id);
   announcePopups();
}

export function dismissAllPopups() {
   if (popups.length === 0) return;
   popups = [];
   announcePopups();
}

const subscribePopups = (fn: () => void) => {
   popupListeners.add(fn);
   return () => {
      popupListeners.delete(fn);
   };
};
const readPopups = () => popups;

export function usePopups() {
   return useSyncExternalStore(subscribePopups, readPopups, readPopups);
}

async function collectArrivals(quietly = false) {
   const { notifications } = await fetchNotifications(1);
   if (quietly) {
      notifications.forEach((row) => seen.add(row.id));
      return;
   }
   const fresh = notifications.filter(
      (row) =>
         !row.readAt &&
         !seen.has(row.id) &&
         new Date(row.createdAt).getTime() >= bootedAt - CLOCK_SLACK_MS
   );
   notifications.forEach((row) => seen.add(row.id));
   if (fresh.length === 0) return;
   /* Oldest first, so the newest ends up at the front of the stack. */
   const next = [...popups];
   fresh.reverse().forEach((row) => next.push(row));
   popups = next.slice(-MAX_POPUPS);
   announcePopups();
}

async function takePulse() {
   const pulse = await fetchPulse();
   settleUnread(pulse.unread);

   if (!booted) {
      booted = true;
      bootedAt = pulse.serverNow;
      lastNewestId = pulse.newestId;
      /* Whatever is waiting is known about, and stays quiet. */
      if (pulse.newestId) {
         seen.add(pulse.newestId);
         await collectArrivals(true).catch(() => undefined);
      }
      return;
   }

   if (pulse.unread === 0) {
      /* Read somewhere else: on the inbox page, or on another device. A popup
       * about something already read is only in the way. */
      lastNewestId = null;
      dismissAllPopups();
      return;
   }

   if (pulse.newestId && pulse.newestId !== lastNewestId) {
      const known = seen.has(pulse.newestId);
      lastNewestId = pulse.newestId;
      if (!known) await collectArrivals();
   }
}

/* Signing out, or signing in as somebody else in the same tab: the next
 * answer is a first answer again. */
export function resetNotifications() {
   count = null;
   booted = false;
   lastNewestId = null;
   seen.clear();
   dismissAllPopups();
   announce();
}

/* One asker at a time, so a push, a focus and the timer landing together are
 * one request and cannot race each other into popping the same row twice. */
let asking: Promise<void> | null = null;
export function askNow() {
   asking ??= takePulse()
      .catch(() => undefined)
      .finally(() => {
         asking = null;
      });
   return asking;
}

export function useUnreadCount(enabled = true) {
   const [, bump] = useState(0);

   useEffect(() => {
      const fn = () => bump((n) => n + 1);
      listeners.add(fn);
      return () => {
         listeners.delete(fn);
      };
   }, []);

   useEffect(() => {
      if (!enabled) return;
      void askNow();
      const timer = window.setInterval(() => void askNow(), 45000);
      const onWake = () => {
         if (document.visibilityState === 'visible') void askNow();
      };
      document.addEventListener('visibilitychange', onWake);
      window.addEventListener('focus', onWake);
      return () => {
         window.clearInterval(timer);
         document.removeEventListener('visibilitychange', onWake);
         window.removeEventListener('focus', onWake);
      };
   }, [enabled]);

   return count ?? 0;
}
