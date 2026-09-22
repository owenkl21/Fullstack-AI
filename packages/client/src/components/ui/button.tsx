import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/*
 * Buttons carry their label in League Gothic, uppercase, square corners.
 * `default` is the one teal action on a screen. `outline` and `secondary` are the quiet ones.
 * `ghost` is a text control. `destructive` is text plus a red outline, never a red block.
 */
const buttonVariants = cva(
   "g-tracked inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border border-transparent text-[19px] transition-[background-color,color,filter,transform] duration-150 outline-hidden select-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5 [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-teal aria-invalid:border-destructive",
   {
      variants: {
         variant: {
            default: 'bg-teal text-teal-ink hover:brightness-105',
            secondary: 'bg-bg-2 text-ink border-line-2 hover:bg-accent',
            outline: 'border-ink text-ink hover:bg-bg-2',
            ghost: 'text-ink-2 hover:text-ink hover:bg-bg-2',
            destructive:
               'border-destructive text-destructive hover:bg-destructive/10',
            link: 'text-teal-text underline-offset-4 hover:underline',
            paper: 'bg-paper text-black-block hover:brightness-95',
         },
         size: {
            default: 'h-11 px-5',
            xs: 'h-8 px-3 text-[15px]',
            sm: 'h-10 px-4 text-[17px]',
            lg: 'h-12 px-6 text-[22px]',
            xl: 'h-14 px-7 text-[24px]',
            /*
             * An icon-only control is 44px, and there is no smaller size to
             * reach for. There used to be a 32 and a 40, both under the
             * minimum this product promises and neither of them used by
             * anything; leaving them in the variant list is how a 32px delete
             * ends up on a row six months from now.
             */
            icon: 'size-11 p-0',
            'icon-lg': 'size-12 p-0',
         },
      },
      defaultVariants: {
         variant: 'default',
         size: 'default',
      },
   }
);

function Button({
   className,
   variant = 'default',
   size = 'default',
   asChild = false,
   ...props
}: React.ComponentProps<'button'> &
   VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
   }) {
   const Comp = asChild ? Slot.Root : 'button';

   return (
      <Comp
         data-slot="button"
         data-variant={variant}
         data-size={size}
         className={cn(buttonVariants({ variant, size, className }))}
         {...props}
      />
   );
}

export { Button };
