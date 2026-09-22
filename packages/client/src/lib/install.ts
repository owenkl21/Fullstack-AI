import { useSyncExternalStore } from 'react';

/*
 * Putting Fisherfeed on a home screen.
 *
 * Chromium (Android, and Chrome and Edge on a desktop) offers the install
 * itself through one event, beforeinstallprompt, fired once, early, and only
 * when the browser has decided the site can be installed. If nothing is
 * listening at that moment the offer is gone until the next load, so this
 * module is imported by main.tsx for its side effect, long before any settings
 * page exists to show a button.
 *
 * Safari on an iPhone or iPad has no such event and never will: there the
 * only way in is Share, then Add to Home Screen, so the button opens those
 * steps instead. It matters more there than anywhere, because iOS only lets an
 * installed site send notifications.
 */

type InstallChoice = { outcome: 'accepted' | 'dismissed' };

type BeforeInstallPromptEvent = Event & {
   prompt: () => Promise<void>;
   userChoice: Promise<InstallChoice>;
};

export type InstallState =
   /** Already running from the home screen. */
   | 'installed'
   /** The browser has offered; one tap shows its own dialog. */
   | 'ready'
   /** iPhone or iPad: Share, Add to Home Screen, Add. */
   | 'ios'
   /** Everything else: the browser's own menu, if it has the option at all. */
   | 'manual';

let offer: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((fn) => fn());

/* iPadOS says it is a Mac. A Mac with a touch screen is an iPad. */
export const isAppleTouch = () => {
   if (typeof navigator === 'undefined') return false;
   return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
   );
};

export const isStandalone = () => {
   if (typeof window === 'undefined') return false;
   const iosStandalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
   return (
      iosStandalone ||
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches
   );
};

if (typeof window !== 'undefined') {
   window.addEventListener('beforeinstallprompt', (event) => {
      /* Keeps Chrome's own bar off the bottom of the feed. The offer is made
       * from the settings, where somebody has gone looking for it. */
      event.preventDefault();
      offer = event as BeforeInstallPromptEvent;
      announce();
   });
   window.addEventListener('appinstalled', () => {
      offer = null;
      installedNow = true;
      announce();
   });
   /* Opened from the new icon while this tab was still around. */
   window
      .matchMedia('(display-mode: standalone)')
      .addEventListener?.('change', announce);
}

const read = (): InstallState => {
   if (installedNow || isStandalone()) return 'installed';
   if (offer) return 'ready';
   if (isAppleTouch()) return 'ios';
   return 'manual';
};

const subscribe = (fn: () => void) => {
   listeners.add(fn);
   return () => {
      listeners.delete(fn);
   };
};

export function useInstallState() {
   return useSyncExternalStore(subscribe, read, () => 'manual' as const);
}

/*
 * Shows the browser's own install dialog. Only from a tap: the browser refuses
 * it otherwise. An offer can be used once, so it is dropped either way, and
 * Chromium fires a fresh one later if the answer was no.
 */
export async function promptInstall(): Promise<
   InstallChoice['outcome'] | null
> {
   const held = offer;
   if (!held) return null;
   offer = null;
   try {
      await held.prompt();
      const choice = await held.userChoice;
      if (choice.outcome === 'accepted') installedNow = true;
      return choice.outcome;
   } catch {
      return null;
   } finally {
      announce();
   }
}
