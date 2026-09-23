import { useCallback, useEffect, useState } from 'react';

/*
 * Where the angler is, asked for once.
 *
 * Every screen that wanted a position used to ask for its own, so walking from
 * the home page to the fast log to the feed put up the browser prompt three
 * times and threw the answer away in between. The position is now held in one
 * place, kept in localStorage, and shared: a page that opens with a recent fix
 * uses it immediately and says nothing.
 *
 * A fix is reused for five minutes. Older than that and it is still handed over
 * at once, so nothing waits, while a fresh reading is fetched behind it. The
 * browser's own permission, once granted, means no prompt for that refresh.
 */

export type Fix = {
   latitude: number;
   longitude: number;
   accuracy: number;
   at: number;
};

export type PositionState =
   | 'unknown'
   | 'asking'
   | 'ready'
   | 'denied'
   | 'unsupported';

const KEY = 'position-fix';
const FRESH_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 12000;

let current: Fix | null = null;
let state: PositionState = 'unknown';
let inFlight: Promise<Fix | null> | null = null;
const listeners = new Set<() => void>();

const announce = () => listeners.forEach((fn) => fn());

const supported = () =>
   typeof navigator !== 'undefined' && Boolean(navigator.geolocation);

const load = (): Fix | null => {
   if (current) {
      return current;
   }
   try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Fix;
      if (typeof parsed?.latitude !== 'number') return null;
      current = parsed;
      return current;
   } catch {
      return null;
   }
};

const save = (fix: Fix) => {
   current = fix;
   try {
      localStorage.setItem(KEY, JSON.stringify(fix));
   } catch {
      /* Storage refused. The fix still lives in memory for this session. */
   }
};

const isFresh = (fix: Fix | null) =>
   Boolean(fix && Date.now() - fix.at < FRESH_MS);

/*
 * Has the browser already been told yes? Where the Permissions API answers, a
 * granted permission means a refresh costs the reader nothing, so it can happen
 * without being asked for.
 */
async function alreadyGranted() {
   try {
      const status = await navigator.permissions?.query({
         name: 'geolocation' as PermissionName,
      });
      return status?.state === 'granted';
   } catch {
      return false;
   }
}

function read(): Promise<Fix | null> {
   if (inFlight) {
      return inFlight;
   }

   inFlight = new Promise<Fix | null>((resolve) => {
      state = 'asking';
      announce();

      navigator.geolocation.getCurrentPosition(
         (pos) => {
            const fix: Fix = {
               latitude: pos.coords.latitude,
               longitude: pos.coords.longitude,
               accuracy: pos.coords.accuracy,
               at: Date.now(),
            };
            save(fix);
            state = 'ready';
            announce();
            resolve(fix);
         },
         (error) => {
            state =
               error.code === error.PERMISSION_DENIED ? 'denied' : 'unknown';
            announce();
            resolve(null);
         },
         { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: FRESH_MS }
      );
   }).finally(() => {
      inFlight = null;
   });

   return inFlight;
}

/** Ask for a position. Safe to call from anywhere; only one request is ever live. */
export const requestPosition = () => {
   if (!supported()) {
      state = 'unsupported';
      announce();
      return Promise.resolve(null);
   }
   return read();
};

/**
 * The shared position.
 *
 * `auto` refreshes without a prompt where permission has already been granted,
 * which is what makes conditions feel live rather than something to be asked
 * for. It never puts the prompt up on its own.
 */
export function usePosition({ auto = true }: { auto?: boolean } = {}) {
   const [, bump] = useState(0);

   useEffect(() => {
      const fn = () => bump((n) => n + 1);
      listeners.add(fn);
      return () => {
         listeners.delete(fn);
      };
   }, []);

   const fix = load();

   useEffect(() => {
      if (!auto || !supported() || isFresh(fix)) {
         return;
      }

      let cancelled = false;
      void alreadyGranted().then((granted) => {
         if (!cancelled && granted) {
            void read();
         }
      });

      return () => {
         cancelled = true;
      };
      /* Only on mount and when the fix goes stale. */
   }, [auto, fix?.at]);

   const ask = useCallback(() => requestPosition(), []);

   return {
      fix,
      /* A stored fix is usable even before a refresh lands. */
      state: fix && state !== 'asking' ? ('ready' as PositionState) : state,
      isFresh: isFresh(fix),
      ask,
   };
}

/** Forget the stored position. For a sign out. */
export const clearPosition = () => {
   current = null;
   state = 'unknown';
   try {
      localStorage.removeItem(KEY);
   } catch {
      /* Nothing to clear. */
   }
   announce();
};
