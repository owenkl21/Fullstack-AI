import axios from 'axios';
import { useEffect, useState } from 'react';

export type NotificationKind =
   | 'FOLLOW'
   | 'COMMENT'
   | 'LIKE'
   | 'INVITE'
   | 'INVITE_ANSWER';

export type Notification = {
   id: string;
   kind: NotificationKind;
   postId: string | null;
   competitionId: string | null;
   body: string | null;
   readAt: string | null;
   createdAt: string;
   actor: {
      id: string;
      displayName: string;
      username: string;
      avatarUrl: string | null;
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

export async function fetchUnread(signal?: AbortSignal) {
   const { data } = await axios.get<{ unread: number }>(
      '/api/notifications/unread',
      { signal }
   );
   return data.unread ?? 0;
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
 * the tab comes back, and every forty five seconds while it is open; nothing
 * is pushed. A page that marks things read tells the bell through `settle`.
 */
let count: number | null = null;
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((fn) => fn());

export function settleUnread(next: number) {
   count = next;
   announce();
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
      let alive = true;
      const read = () =>
         fetchUnread()
            .then((n) => {
               if (alive) settleUnread(n);
            })
            .catch(() => undefined);
      read();
      const timer = window.setInterval(read, 45000);
      const onWake = () => {
         if (document.visibilityState === 'visible') read();
      };
      document.addEventListener('visibilitychange', onWake);
      window.addEventListener('focus', onWake);
      return () => {
         alive = false;
         window.clearInterval(timer);
         document.removeEventListener('visibilitychange', onWake);
         window.removeEventListener('focus', onWake);
      };
   }, [enabled]);

   return count ?? 0;
}
