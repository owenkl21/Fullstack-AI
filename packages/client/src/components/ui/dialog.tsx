import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

/*
 * One dialog shape for the whole product: a sheet that rises from the bottom of a
 * phone, full width with a 3px teal top rule, and the same black block centred at
 * 480px from 640px up. Square corners, no shadow, focus trapped by Radix, and the
 * content scrolls inside the sheet rather than pushing past the viewport.
 */

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
   React.ElementRef<typeof DialogPrimitive.Overlay>,
   React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
   <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
         'fixed inset-0 z-50 bg-black-block/65 duration-300 [animation-timing-function:var(--ease)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
         className
      )}
      {...props}
   />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
   React.ElementRef<typeof DialogPrimitive.Content>,
   React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
   <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
         ref={ref}
         /* The black block's token remap in index.css keys on this, so text-ink,
          * outline buttons, fields and text-destructive all read on the black. */
         data-slot="dialog-content"
         className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[86dvh] w-full flex-col overflow-y-auto border-t-[3px] border-teal bg-black-block px-5 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))] text-paper',
            'duration-300 [animation-timing-function:var(--ease)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-8 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-8',
            'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(86dvh,720px)] sm:w-[480px] sm:max-w-[calc(100%-32px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:px-7 sm:pb-7',
            className
         )}
         {...props}
      >
         {children}
         <DialogPrimitive.Close
            className="absolute top-2 right-2 flex size-11 items-center justify-center text-paper-2 transition-colors duration-150 [transition-timing-function:var(--ease)] hover:text-paper"
            aria-label="Close"
         >
            <XMarkIcon className="size-6" strokeWidth={1.5} />
         </DialogPrimitive.Close>
      </DialogPrimitive.Content>
   </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
   className,
   ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
   <div
      className={cn('flex flex-col gap-2 pr-12 text-left', className)}
      {...props}
   />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
   className,
   ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
   <div
      className={cn(
         'mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end',
         className
      )}
      {...props}
   />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
   React.ElementRef<typeof DialogPrimitive.Title>,
   React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
   <DialogPrimitive.Title
      ref={ref}
      className={cn('g text-[30px] font-normal', className)}
      {...props}
   />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
   React.ElementRef<typeof DialogPrimitive.Description>,
   React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
   <DialogPrimitive.Description
      ref={ref}
      className={cn('text-[15px] leading-relaxed text-paper-2', className)}
      {...props}
   />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
   Dialog,
   DialogPortal,
   DialogOverlay,
   DialogClose,
   DialogTrigger,
   DialogContent,
   DialogHeader,
   DialogFooter,
   DialogTitle,
   DialogDescription,
};
