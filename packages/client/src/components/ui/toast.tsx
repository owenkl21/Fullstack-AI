import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'success' | 'error';

export type ToastMessage = {
   id: string;
   title: string;
   description?: string;
   variant?: ToastVariant;
};

type ToastProps = {
   toast: ToastMessage;
   onDismiss: (id: string) => void;
};

export function Toast({ toast, onDismiss }: ToastProps) {
   return (
      <div
         className={cn(
            'w-full rounded-lg border bg-card p-4 shadow-lg',
            toast.variant === 'error' && 'border-red-300',
            toast.variant === 'success' && 'border-emerald-300'
         )}
      >
         <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
               <p className="text-sm font-medium">{toast.title}</p>
               {toast.description ? (
                  <p className="text-xs text-muted-foreground">
                     {toast.description}
                  </p>
               ) : null}
            </div>
            <button
               type="button"
               className="text-muted-foreground transition-colors hover:text-foreground"
               onClick={() => onDismiss(toast.id)}
               aria-label="Dismiss notification"
            >
               <X className="size-4" />
            </button>
         </div>
      </div>
   );
}
