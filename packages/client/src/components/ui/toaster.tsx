import { Toast } from '@/components/ui/toast';
import { dismissToast, useToast } from '@/components/ui/use-toast';

export function Toaster() {
   const { toasts } = useToast();

   return (
      <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
         {toasts.map((item) => (
            <div key={item.id} className="pointer-events-auto">
               <Toast toast={item} onDismiss={dismissToast} />
            </div>
         ))}
      </div>
   );
}
