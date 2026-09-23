import { XMarkIcon } from '@heroicons/react/24/outline';

/*
 * A toast confirms an outcome and nothing else. Black in both themes with a 3px
 * teal left rule, the way every always-dark block in this product is marked.
 * Outcomes are announced politely; failures interrupt.
 */

export type ToastVariant = 'success' | 'error';

export type ToastAction = {
   label: string;
   onClick: () => void;
};

export type ToastMessage = {
   id: string;
   title: string;
   description?: string;
   variant?: ToastVariant;
   /** The one reversal a toast may offer, for example Undo after a delete. */
   action?: ToastAction;
};

type ToastProps = {
   toast: ToastMessage;
   onDismiss: (id: string) => void;
};

export function Toast({ toast, onDismiss }: ToastProps) {
   const isFailure = toast.variant === 'error';

   return (
      <div
         role={isFailure ? 'alert' : 'status'}
         className="flex items-center gap-3 border-l-[3px] border-teal bg-black-block py-2 pr-2 pl-4 text-paper"
      >
         <div className="min-w-0 flex-1 py-1">
            <p className="text-[15px] leading-snug">{toast.title}</p>
            {toast.description ? (
               <p className="mt-1 text-sm leading-snug text-paper-2">
                  {toast.description}
               </p>
            ) : null}
         </div>

         {toast.action ? (
            <button
               type="button"
               className="g-tracked h-11 shrink-0 px-3 text-[18px] text-teal transition-colors duration-150 [transition-timing-function:var(--ease)] hover:brightness-110"
               onClick={() => {
                  toast.action?.onClick();
                  onDismiss(toast.id);
               }}
            >
               {toast.action.label}
            </button>
         ) : null}

         <button
            type="button"
            className="flex size-11 shrink-0 items-center justify-center text-paper-2 transition-colors duration-150 [transition-timing-function:var(--ease)] hover:text-paper"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss this message"
         >
            <XMarkIcon className="size-5" strokeWidth={1.5} />
         </button>
      </div>
   );
}
