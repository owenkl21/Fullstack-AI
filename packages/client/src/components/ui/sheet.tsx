import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * A panel that rises from the bottom of a phone's screen.
 *
 * Built on Radix Dialog rather than Popover, because a popover is pinned to
 * the button that opened it and moved with it; a sheet belongs to the
 * screen. Dialog gives the overlay, the escape key, focus and a tap outside
 * to close; what is drawn is ours.
 */
export function Sheet({
   open,
   onOpenChange,
   title,
   children,
   className,
}: {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   /* Read by screen readers; the visible head is the caller's. */
   title: string;
   children: ReactNode;
   className?: string;
}) {
   return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
         <Dialog.Portal>
            <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[1000] bg-ink/45" />
            <Dialog.Content
               aria-describedby={undefined}
               onOpenAutoFocus={(event) => event.preventDefault()}
               className={cn(
                  'sheet fixed inset-x-0 bottom-0 z-[1001] flex max-h-[85vh] flex-col border-t-2 border-teal bg-background text-ink shadow-[0_-10px_30px_rgba(11,9,9,0.3)] outline-none',
                  className
               )}
            >
               <Dialog.Title className="sr-only">{title}</Dialog.Title>
               {children}
               <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
            </Dialog.Content>
         </Dialog.Portal>
      </Dialog.Root>
   );
}
