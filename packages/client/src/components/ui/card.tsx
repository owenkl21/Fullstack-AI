import * as React from 'react';

import { cn } from '@/lib/utils';

/*
 * A card is a plain secondary surface, square, with no border and no shadow.
 * Depth in this product comes from the always-black block, the hairline and the
 * photograph, never from a raised rectangle. The six parts are kept so the pages
 * that already import them keep working.
 */

function Card({ className, ...props }: React.ComponentProps<'div'>) {
   return (
      <div
         data-slot="card"
         className={cn('flex flex-col gap-6 bg-bg-2 py-6 text-ink', className)}
         {...props}
      />
   );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
   return (
      <div
         data-slot="card-header"
         className={cn(
            'grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6',
            className
         )}
         {...props}
      />
   );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
   return (
      <div
         data-slot="card-title"
         className={cn('g text-[30px]', className)}
         {...props}
      />
   );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
   return (
      <div
         data-slot="card-description"
         className={cn('text-[15px] text-ink-2', className)}
         {...props}
      />
   );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
   return (
      <div
         data-slot="card-content"
         className={cn('px-6', className)}
         {...props}
      />
   );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
   return (
      <div
         data-slot="card-footer"
         className={cn('flex items-center px-6', className)}
         {...props}
      />
   );
}

export {
   Card,
   CardContent,
   CardDescription,
   CardFooter,
   CardHeader,
   CardTitle,
};
