import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Toast } from '@/components/ui/toast';
import {
   dismissOtherRoutes,
   dismissToast,
   useToast,
} from '@/components/ui/use-toast';

/*
 * The one toast region. It sits above the phone bar and in the bottom right on a
 * desktop. A message about the page you have just left has nothing to say on the
 * next one, so every message that was raised somewhere else is dropped when the
 * address changes.
 */
export function Toaster() {
   const { toasts } = useToast();
   const { pathname } = useLocation();

   useEffect(() => {
      dismissOtherRoutes(pathname);
   }, [pathname]);

   if (toasts.length === 0) {
      return null;
   }

   return (
      <div className="pointer-events-none fixed right-4 bottom-[calc(64px+16px+env(safe-area-inset-bottom))] left-4 z-50 flex flex-col gap-2 md:bottom-6 md:left-auto md:w-[380px]">
         {toasts.map((item) => (
            <div
               key={item.id}
               className="pointer-events-auto animate-in duration-300 [animation-timing-function:var(--ease)] fade-in-0 slide-in-from-bottom-4"
            >
               <Toast toast={item} onDismiss={dismissToast} />
            </div>
         ))}
      </div>
   );
}
