import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { NotificationPopups } from '@/components/notifications/NotificationPopups';
import { Toast } from '@/components/ui/toast';
import {
   dismissOtherRoutes,
   dismissToast,
   useToast,
} from '@/components/ui/use-toast';

/*
 * The one region for anything that arrives over the page. It sits above the
 * phone bar and in the bottom right on a desktop. A message about the page you
 * have just left has nothing to say on the next one, so every message that was
 * raised somewhere else is dropped when the address changes.
 *
 * News from other people (see NotificationPopups) is drawn in here too. On a
 * phone it shares this column, above the toasts, so the two stack and never
 * cover each other. On a desktop it takes itself to the top right corner, and
 * the toasts keep the bottom right to themselves. The region is always in the
 * page and lets every tap through; only what is in it can be touched.
 */
export function Toaster() {
   const { toasts } = useToast();
   const { pathname } = useLocation();

   useEffect(() => {
      dismissOtherRoutes(pathname);
   }, [pathname]);

   return (
      <div className="pointer-events-none fixed right-4 bottom-[calc(64px+16px+env(safe-area-inset-bottom))] left-4 z-50 flex flex-col md:bottom-6 md:left-auto md:w-[380px]">
         <NotificationPopups />
         <div className="flex flex-col gap-2">
            {toasts.map((item) => (
               <div
                  key={item.id}
                  className="pointer-events-auto animate-in duration-300 [animation-timing-function:var(--ease)] fade-in-0 slide-in-from-bottom-4"
               >
                  <Toast toast={item} onDismiss={dismissToast} />
               </div>
            ))}
         </div>
      </div>
   );
}
