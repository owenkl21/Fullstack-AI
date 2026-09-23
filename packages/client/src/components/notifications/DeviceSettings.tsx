import { useCallback, useEffect, useId, useState } from 'react';
import axios from 'axios';
import {
   ArrowUpOnSquareIcon,
   CheckIcon,
   EllipsisVerticalIcon,
   PlusIcon,
   XMarkIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/use-toast';
import {
   isAppleTouch,
   isStandalone,
   promptInstall,
   useInstallState,
} from '@/lib/install';
import {
   PUSH_FAILED,
   PushError,
   readPushState,
   sendTestPush,
   turnPushOff,
   turnPushOn,
   type PushState,
} from '@/lib/push';
import { cn } from '@/lib/utils';

/*
 * The two things that are about the device in your hand and not about your
 * account: whether it may ring, and whether Fisherfeed has an icon on it.
 *
 * They sit together because on an iPhone one depends on the other. Apple only
 * lets a site send notifications once it is on the home screen, so the switch
 * says so and the button that fixes it is the next thing down.
 *
 * Every state the switch can be in is said in a sentence under it. A switch
 * that is greyed out and silent is how people end up believing notifications
 * are broken, when they are blocked two menus deep in the browser.
 */

/* What stands under the switch, by state. */
const PUSH_WORDS: Record<PushState, string> = {
   checking: 'Checking this browser.',
   on: 'On. A follow, a reply, a like or an invitation reaches this device, even with Fisherfeed closed.',
   off: 'Off. Turn it on to hear about follows, replies, likes and invitations, even with Fisherfeed closed.',
   blocked:
      'Blocked in this browser. Allow notifications for this site in the browser settings, then come back and turn it on.',
   'needs-install':
      'On an iPhone or iPad this only works from the home screen. Add Fisherfeed to your home screen, open it from there, and turn this on.',
   unsupported: 'This browser cannot show notifications from a website.',
};

/*
 * A switch: a pill and a grip, teal when on. Round is what the house allows
 * for a control that is not a button, alongside avatars and icon controls, and
 * a square switch reads as a checkbox. The whole 44px row of it is the target,
 * not the 28px track.
 */
function Switch({
   id,
   checked,
   disabled,
   busy,
   onChange,
   describedBy,
}: {
   id: string;
   checked: boolean;
   disabled?: boolean;
   busy?: boolean;
   onChange: (next: boolean) => void;
   describedBy?: string;
}) {
   return (
      <button
         type="button"
         role="switch"
         aria-checked={checked}
         aria-labelledby={id}
         aria-describedby={describedBy}
         aria-busy={busy || undefined}
         disabled={disabled || busy}
         onClick={() => onChange(!checked)}
         className="group grid h-11 w-[60px] shrink-0 place-items-center disabled:cursor-not-allowed disabled:opacity-45"
      >
         <span
            className={cn(
               'relative block h-7 w-[52px] rounded-full border transition-colors duration-200 [transition-timing-function:var(--ease)]',
               checked
                  ? 'border-teal bg-teal'
                  : 'border-line-2 bg-bg-2 group-hover:border-ink-3'
            )}
         >
            <span
               className={cn(
                  'absolute top-[3px] left-[3px] size-5 rounded-full transition-transform duration-200 [transition-timing-function:var(--ease)] motion-reduce:transition-none',
                  checked ? 'translate-x-6 bg-teal-ink' : 'bg-ink-2',
                  busy && 'animate-pulse motion-reduce:animate-none'
               )}
            />
         </span>
      </button>
   );
}

function Row({
   titleId,
   title,
   words,
   wordsId,
   control,
   children,
}: {
   titleId: string;
   title: string;
   words: string;
   wordsId: string;
   control: React.ReactNode;
   children?: React.ReactNode;
}) {
   return (
      <div className="py-5 first:pt-0 last:pb-0">
         <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
               <h3
                  id={titleId}
                  className="g-tracked pt-[13px] text-[19px] text-ink"
               >
                  {title}
               </h3>
               <p
                  id={wordsId}
                  className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-ink-2"
               >
                  {words}
               </p>
            </div>
            <div className="shrink-0">{control}</div>
         </div>
         {children}
      </div>
   );
}

export function DeviceSettings({ className }: { className?: string }) {
   const ids = useId();
   /* The three states a person can do something about. */
   const [push, setPush] = useState<PushState>('checking');
   const [busy, setBusy] = useState(false);
   const [problem, setProblem] = useState<string | null>(null);
   const [testing, setTesting] = useState(false);
   const [stepsOpen, setStepsOpen] = useState(false);
   const install = useInstallState();

   const refresh = useCallback(async () => {
      setPush(await readPushState());
   }, []);

   useEffect(() => {
      void refresh();
      /* Permission can be changed in the browser's own settings while this
       * page is open, and the page only finds out by asking again. */
      const onWake = () => {
         if (document.visibilityState === 'visible') void refresh();
      };
      document.addEventListener('visibilitychange', onWake);
      return () => document.removeEventListener('visibilitychange', onWake);
   }, [refresh, install]);

   /* Called straight from the tap, with nothing awaited before it, because the
    * browser only shows its permission prompt for a real gesture. */
   const flip = async (next: boolean) => {
      setProblem(null);
      setBusy(true);
      try {
         if (next) {
            await turnPushOn();
            setPush('on');
            /* Proof, on the device itself, that it works. */
            await sendTestPush().catch(() => undefined);
         } else {
            await turnPushOff();
            setPush('off');
         }
      } catch (error) {
         const reason = error instanceof PushError ? error.reason : 'failed';
         setProblem(PUSH_FAILED[reason]);
         await refresh();
      } finally {
         setBusy(false);
      }
   };

   const test = async () => {
      setTesting(true);
      try {
         const result = await sendTestPush();
         toast({
            title:
               result.sent > 0
                  ? 'Sent. It should arrive in a moment.'
                  : 'Nothing to send to. Turn it off and on again.',
            variant: result.sent > 0 ? 'success' : 'error',
         });
      } catch (error) {
         /* Only the server's "too soon" means one was just sent. Anything
          * else, a dropped connection included, sent nothing. */
         const tooSoon =
            axios.isAxiosError(error) && error.response?.status === 429;
         toast({
            title: tooSoon
               ? 'One was just sent. Give it a few seconds.'
               : 'Could not send one. Check your connection and try again.',
            variant: 'error',
         });
      } finally {
         setTesting(false);
      }
   };

   const add = async () => {
      if (install === 'ready') {
         const outcome = await promptInstall();
         if (outcome === 'accepted') {
            toast({ title: 'Added to your home screen.', variant: 'success' });
         }
         return;
      }
      setStepsOpen(true);
   };

   const canSwitch = push === 'on' || push === 'off';
   const olderApple =
      push === 'unsupported' && isAppleTouch() && isStandalone();

   const installWords =
      install === 'installed'
         ? isStandalone()
            ? 'Fisherfeed is on your home screen, and this is it.'
            : 'Added. Open Fisherfeed from its own icon from now on.'
         : isAppleTouch()
           ? 'Opens full screen from its own icon, like any other app. On an iPhone or iPad it is also what lets notifications through.'
           : 'Opens full screen from its own icon, like any other app.';

   return (
      <div className={cn('divide-y divide-line', className)}>
         <Row
            titleId={`${ids}-push`}
            title="Notifications on this device"
            wordsId={`${ids}-push-words`}
            words={
               olderApple
                  ? 'This needs iOS 16.4 or newer. Update the phone and the switch comes alive.'
                  : PUSH_WORDS[push]
            }
            control={
               <Switch
                  id={`${ids}-push`}
                  describedBy={`${ids}-push-words`}
                  checked={push === 'on'}
                  disabled={!canSwitch}
                  busy={busy}
                  onChange={flip}
               />
            }
         >
            {problem ? (
               <p role="alert" className="mt-3 text-[15px] text-destructive">
                  {problem}
               </p>
            ) : null}
            {push === 'on' ? (
               <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  disabled={testing}
                  onClick={test}
               >
                  {testing ? 'Sending' : 'Send a test'}
               </Button>
            ) : null}
         </Row>

         <Row
            titleId={`${ids}-install`}
            title="Add to home screen"
            wordsId={`${ids}-install-words`}
            words={installWords}
            control={
               install === 'installed' ? (
                  <span className="grid h-11 place-items-center">
                     <span className="lab inline-flex items-center gap-1.5 text-teal-text">
                        <CheckIcon
                           aria-hidden="true"
                           className="size-4"
                           strokeWidth={2}
                        />
                        Added
                     </span>
                  </span>
               ) : null
            }
         >
            {install === 'installed' ? null : (
               <Button
                  type="button"
                  className="mt-4"
                  aria-describedby={`${ids}-install-words`}
                  onClick={add}
               >
                  {install === 'manual'
                     ? 'How to add it'
                     : 'Add to home screen'}
               </Button>
            )}
         </Row>

         <InstallSteps
            open={stepsOpen}
            onOpenChange={setStepsOpen}
            apple={install === 'ios'}
         />
      </div>
   );
}

/*
 * The way in where the browser will not do it for us. Three steps, each with
 * the mark to look for, because "tap Share" means nothing to somebody who has
 * never known that the square with the arrow is called Share.
 */
export function InstallSteps({
   open,
   onOpenChange,
   apple,
}: {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   apple: boolean;
}) {
   const steps = apple
      ? [
           {
              icon: ArrowUpOnSquareIcon,
              title: 'Tap Share',
              words: 'The square with an arrow out of the top. In Safari it is at the bottom of the screen.',
           },
           {
              icon: PlusIcon,
              title: 'Choose Add to Home Screen',
              words: 'Scroll down the list that opens. It is below the row of apps.',
           },
           {
              icon: CheckIcon,
              title: 'Tap Add',
              words: 'Then open Fisherfeed from its new icon and turn on notifications from there.',
           },
        ]
      : [
           {
              icon: EllipsisVerticalIcon,
              title: 'Open the browser menu',
              words: 'The three dots beside the address bar. On a computer, look for an install mark in the address bar itself.',
           },
           {
              icon: PlusIcon,
              title: 'Choose Install or Add to Home screen',
              words: 'The wording changes from browser to browser. Firefox on a computer does not have it.',
           },
           {
              icon: CheckIcon,
              title: 'Confirm',
              words: 'Fisherfeed gets its own icon and opens without the browser around it.',
           },
        ];

   return (
      <Sheet open={open} onOpenChange={onOpenChange} title="Add to home screen">
         <div className="mx-auto w-full max-w-[560px] overflow-y-auto px-4 pt-5 pb-6">
            <div className="flex items-start justify-between gap-4">
               <div>
                  <p className="lab">Three steps</p>
                  <p className="g mt-2 text-[34px] text-ink">
                     Add to home screen
                  </p>
               </div>
               <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close"
                  className="grid size-11 shrink-0 place-items-center rounded-full border border-line-2 text-ink transition-colors hover:border-ink"
               >
                  <XMarkIcon
                     aria-hidden="true"
                     className="size-5"
                     strokeWidth={1.5}
                  />
               </button>
            </div>

            <ol className="mt-6 flex flex-col gap-5">
               {steps.map((step, index) => (
                  <li
                     key={step.title}
                     className="fact grid grid-cols-[44px_minmax(0,1fr)] items-start gap-4"
                     style={{ '--i': index } as React.CSSProperties}
                  >
                     <span
                        aria-hidden="true"
                        className="relative grid size-11 place-items-center rounded-full bg-bg-2 text-ink"
                     >
                        <step.icon className="size-5" strokeWidth={1.6} />
                        <span className="num absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-teal text-[12px] leading-none font-semibold text-teal-ink">
                           {index + 1}
                        </span>
                     </span>
                     <span className="min-w-0">
                        <span className="g-tracked block pt-1 text-[19px] text-ink">
                           {step.title}
                        </span>
                        <span className="mt-1.5 block text-[15px] leading-relaxed text-ink-2">
                           {step.words}
                        </span>
                     </span>
                  </li>
               ))}
            </ol>
         </div>
      </Sheet>
   );
}
