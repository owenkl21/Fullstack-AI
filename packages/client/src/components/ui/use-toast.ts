import { useSyncExternalStore } from 'react';
import type { ToastMessage } from '@/components/ui/toast';

/*
 * One store for the whole app. Three messages at most, so a burst of failures
 * cannot bury the screen, and every message remembers the address it was raised
 * on, so a message about the page you have just left goes with it.
 */

const TOAST_TTL_MS = 4500;
const MAX_TOASTS = 3;

type StoredToast = ToastMessage & { route: string };
type ToastInput = Omit<ToastMessage, 'id'>;
type Listener = () => void;

let memoryState: StoredToast[] = [];
let sequence = 0;
const listeners = new Set<Listener>();
const timers = new Map<string, number>();

/* crypto.randomUUID exists only in a secure context, and the app is opened over
 * plain http on a phone on the same network, where it would throw. */
const nextId = () => {
   sequence += 1;

   if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
   ) {
      try {
         return crypto.randomUUID();
      } catch {
         return `toast-${Date.now()}-${sequence}`;
      }
   }

   return `toast-${Date.now()}-${sequence}`;
};

const currentRoute = () =>
   typeof window === 'undefined' ? '' : window.location.pathname;

const notify = () => {
   listeners.forEach((listener) => listener());
};

const forget = (id: string) => {
   const timer = timers.get(id);

   if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.delete(id);
   }

   memoryState = memoryState.filter((item) => item.id !== id);
};

export const toast = ({ title, description, variant, action }: ToastInput) => {
   const id = nextId();
   memoryState = [
      ...memoryState,
      { id, title, description, variant, action, route: currentRoute() },
   ];

   while (memoryState.length > MAX_TOASTS) {
      forget(memoryState[0].id);
   }

   timers.set(
      id,
      window.setTimeout(() => {
         forget(id);
         notify();
      }, TOAST_TTL_MS)
   );

   notify();

   return id;
};

export const dismissToast = (id: string) => {
   forget(id);
   notify();
};

/** Drops everything raised somewhere other than the address given. */
export const dismissOtherRoutes = (route: string) => {
   const stale = memoryState.filter((item) => item.route !== route);

   if (stale.length === 0) {
      return;
   }

   stale.forEach((item) => forget(item.id));
   notify();
};

const subscribe = (listener: Listener) => {
   listeners.add(listener);

   return () => {
      listeners.delete(listener);
   };
};

const getSnapshot = (): ToastMessage[] => memoryState;

export function useToast() {
   const toasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

   return { toasts, toast, dismissToast };
}
