import { useEffect, useState } from 'react';
import { BellAlertIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import {
   PUSH_FAILED,
   PushError,
   readPushState,
   sendTestPush,
   turnPushOn,
   type PushState,
} from '@/lib/push';
import { InstallSteps } from './DeviceSettings';

/*
 * One line at the top of the inbox for somebody whose device could ring and
 * does not: the inbox is where people go looking for this, and the switch
 * itself lives at the foot of the profile, a long way down.
 *
 * Only for the two states a tap here can change. Off turns on from this very
 * button, so the browser's prompt comes from a gesture. On an iPhone in
 * Safari it opens the three steps to the home screen, because that is the
 * only way in there. Blocked, unsupported and already on say nothing: the
 * profile has the whole story for those.
 *
 * Closing it is remembered on this device only, which is all it is about.
 */
const CLOSED = 'fisherfeed:inbox-nudge-closed';

const wasClosed = () => {
   try {
      return window.localStorage.getItem(CLOSED) === '1';
   } catch {
      return false;
   }
};

export function InboxNudge() {
   const [push, setPush] = useState<PushState>('checking');
   const [closed, setClosed] = useState(wasClosed);
   const [busy, setBusy] = useState(false);
   const [stepsOpen, setStepsOpen] = useState(false);

   useEffect(() => {
      let alive = true;
      void readPushState().then((state) => {
         if (alive) setPush(state);
      });
      return () => {
         alive = false;
      };
   }, []);

   if (closed || (push !== 'off' && push !== 'needs-install')) return null;

   const close = () => {
      setClosed(true);
      try {
         window.localStorage.setItem(CLOSED, '1');
      } catch {
         /* Private browsing: it comes back next visit, which is harmless. */
      }
   };

   /* Straight from the tap, with nothing awaited first: the browser only
    * shows its prompt for a real gesture. */
   const turnOn = async () => {
      setBusy(true);
      try {
         await turnPushOn();
         setPush('on');
         toast({
            title: 'Notifications are on for this device.',
            variant: 'success',
         });
         await sendTestPush().catch(() => undefined);
      } catch (error) {
         const reason = error instanceof PushError ? error.reason : 'failed';
         toast({ title: PUSH_FAILED[reason], variant: 'error' });
         setPush(await readPushState());
      } finally {
         setBusy(false);
      }
   };

   const apple = push === 'needs-install';

   return (
      <div className="fact relative mb-7 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[14px] border border-line py-3.5 pr-14 pl-4 md:flex-nowrap md:pr-3">
         <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-teal text-teal-text"
         >
            <BellAlertIcon className="size-5" strokeWidth={1.6} />
         </span>
         <p className="min-w-0 flex-1 basis-[200px] text-[15px] leading-snug text-ink-2">
            <span className="font-semibold text-ink">
               Hear about this with Fisherfeed closed.
            </span>{' '}
            {apple
               ? 'On an iPhone or iPad that starts with Fisherfeed on your home screen.'
               : 'A follow, a reply or a like arrives on this device like a message.'}
         </p>
         <Button
            type="button"
            size="sm"
            className="ml-[60px] md:ml-0"
            disabled={busy}
            onClick={apple ? () => setStepsOpen(true) : turnOn}
         >
            {apple ? 'Show me how' : busy ? 'Turning on' : 'Turn on'}
         </Button>
         <button
            type="button"
            onClick={close}
            aria-label="Not now"
            title="Not now"
            className="absolute top-1.5 right-1.5 grid size-11 place-items-center rounded-full text-ink-3 transition-colors duration-150 [transition-timing-function:var(--ease)] hover:bg-bg-2 hover:text-ink md:static md:shrink-0"
         >
            <XMarkIcon
               aria-hidden="true"
               className="size-5"
               strokeWidth={1.5}
            />
         </button>
         {apple ? (
            <InstallSteps open={stepsOpen} onOpenChange={setStepsOpen} apple />
         ) : null}
      </div>
   );
}
