import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * A panel that belongs to the screen rather than to the button that opened it.
 *
 * Built on Radix Dialog rather than Popover, because a popover is pinned to
 * the button that opened it and moves with it; a sheet belongs to the
 * screen. Dialog gives the overlay, the escape key, the scroll lock, focus
 * and a tap outside to close; what is drawn is ours.
 *
 * `side` says which edge it comes from. `bottom` is the original and stays
 * the default, so every picker, layer list and competition sheet in the app
 * is untouched. `right` and `left` are full height panels: the account panel
 * is the first of them.
 */
export type SheetSide = 'bottom' | 'right' | 'left';

/*
 * The keyframes travel with the component. React hoists a <style href> into
 * the head once and dedupes it, so a side panel works wherever it is used
 * without a second file having to know about it. The motion is the house
 * motion: a 24px nudge and a fade over 260ms, the same as the bottom sheet,
 * on the same easing.
 */
const sideMotion = `
.sheet-right { animation: sheet-in-right 260ms var(--ease) both; }
.sheet-left { animation: sheet-in-left 260ms var(--ease) both; }
@keyframes sheet-in-right {
   from { translate: 24px 0; opacity: 0; }
   to { translate: 0 0; opacity: 1; }
}
@keyframes sheet-in-left {
   from { translate: -24px 0; opacity: 0; }
   to { translate: 0 0; opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
   .sheet-right, .sheet-left { animation: none; }
}
`;

/*
 * A side panel is most of a phone's screen and a column on a desktop, where a
 * full width one would be a wall. The left border is the teal rule the bottom
 * sheet carries on its top edge.
 */
const shell: Record<SheetSide, string> = {
   bottom:
      'sheet fixed inset-x-0 bottom-0 z-[1001] flex max-h-[85vh] flex-col border-t-2 border-teal bg-background text-ink shadow-[0_-10px_30px_rgba(11,9,9,0.3)] outline-none',
   right: 'sheet-right fixed inset-y-0 right-0 z-[1001] flex w-[min(86vw,340px)] flex-col border-l-2 border-teal bg-background text-ink shadow-[-10px_0_30px_rgba(11,9,9,0.3)] outline-none md:w-[380px]',
   left: 'sheet-left fixed inset-y-0 left-0 z-[1001] flex w-[min(86vw,340px)] flex-col border-r-2 border-teal bg-background text-ink shadow-[10px_0_30px_rgba(11,9,9,0.3)] outline-none md:w-[380px]',
};

export function Sheet({
   open,
   onOpenChange,
   title,
   children,
   className,
   side = 'bottom',
}: {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   /* Read by screen readers; the visible head is the caller's. */
   title: string;
   children: ReactNode;
   className?: string;
   side?: SheetSide;
}) {
   const bottom = side === 'bottom';
   return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
         <Dialog.Portal>
            <style href="sheet-side-motion" precedence="medium">
               {sideMotion}
            </style>
            <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[1000] bg-ink/45" />
            <Dialog.Content
               aria-describedby={undefined}
               /*
                * The bottom sheet leaves focus on the trigger on purpose: it
                * opens under a thumb, not a keyboard. A side panel is a
                * destination, so it takes focus, which is also what holds
                * focus inside it once it is open.
                */
               onOpenAutoFocus={
                  bottom ? (event) => event.preventDefault() : undefined
               }
               className={cn(shell[side], className)}
            >
               <Dialog.Title className="sr-only">{title}</Dialog.Title>
               {children}
               {/* The bottom sheet sits on the home bar; a side panel's own
                   footer takes the inset, because the panel is a black plate
                   edge to edge and a spacer here would show the page under it. */}
               {bottom ? (
                  <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
               ) : null}
            </Dialog.Content>
         </Dialog.Portal>
      </Dialog.Root>
   );
}
