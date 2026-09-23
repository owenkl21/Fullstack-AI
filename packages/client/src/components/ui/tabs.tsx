import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

/*
 * One row of tabs, ruled rather than boxed.
 *
 * Radix owns the roving focus, the arrow keys and the aria wiring between a
 * tab and its panel. What is drawn is a rule under the row, a hairline
 * between each pair of tabs, and a teal bar under the one you are on.
 *
 * The row scrolls sideways instead of wrapping. Six tabs on a phone either
 * become two lines, which stops being a row, or they compress until the
 * words break; a scroller keeps the shape and lets the last tab be reached.
 */

/*
 * Tabs sit on the page ground in most places and on a black block in a
 * few. `paper` is that second case. It is a prop rather than a hard coded
 * colour so a caller can put the same row on either ground, and it is read
 * from the root by default so only the root has to say it.
 */
export type TabsTone = 'ink' | 'paper';

const ToneContext = React.createContext<TabsTone>('ink');

const listTone: Record<TabsTone, string> = {
   ink: 'border-b-line',
   paper: 'border-b-paper/20',
};

const triggerTone: Record<TabsTone, string> = {
   ink: 'text-ink-3 not-first:border-l-line hover:text-ink-2 data-[state=active]:border-b-teal data-[state=active]:text-ink',
   paper: 'text-paper-2 not-first:border-l-paper/20 hover:text-paper data-[state=active]:border-b-teal data-[state=active]:text-paper',
};

function Tabs({
   className,
   tone = 'ink',
   ...props
}: React.ComponentProps<typeof TabsPrimitive.Root> & { tone?: TabsTone }) {
   return (
      <ToneContext.Provider value={tone}>
         <TabsPrimitive.Root
            data-slot="tabs"
            data-tone={tone}
            className={cn('flex flex-col', className)}
            {...props}
         />
      </ToneContext.Provider>
   );
}

/*
 * The scrollbar is hidden on both engines rather than styled. This is a row
 * of controls a few pixels taller than its own text, and a bar under it
 * would take a quarter of that height and sit across the rule.
 */
function TabsList({
   className,
   tone,
   ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { tone?: TabsTone }) {
   const inherited = React.useContext(ToneContext);
   const shade = tone ?? inherited;

   return (
      <TabsPrimitive.List
         data-slot="tabs-list"
         data-tone={shade}
         className={cn(
            'flex w-full flex-nowrap items-stretch overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            listTone[shade],
            className
         )}
         {...props}
      />
   );
}

/*
 * 44px is the floor for anything a thumb has to hit, and the row is a row of
 * thumb targets. The type steps up on a coarse pointer as well: League
 * Gothic is a condensed face, so the size that reads on a desk is smaller
 * than it looks, and 16px is the line under which a phone decides a tap
 * means zoom in.
 *
 * The bottom border is on every tab, transparent until the tab is the one
 * you are on. Adding the border only when selected would move the label two
 * pixels as you went along the row.
 */
function TabsTrigger({
   className,
   tone,
   ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & { tone?: TabsTone }) {
   const inherited = React.useContext(ToneContext);
   const shade = tone ?? inherited;

   return (
      <TabsPrimitive.Trigger
         data-slot="tabs-trigger"
         data-tone={shade}
         className={cn(
            'g-tracked flex min-h-11 shrink-0 items-center justify-center gap-2 border-b-2 border-b-transparent px-4 whitespace-nowrap not-first:border-l',
            'text-[17px] transition-colors duration-150 outline-none [transition-timing-function:var(--ease)] [@media(pointer:coarse)]:text-[18px]',
            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal',
            triggerTone[shade],
            className
         )}
         {...props}
      />
   );
}

/*
 * The panel is left alone. Radix puts focus on it when the row is tabbed
 * past, so it takes the house focus ring and nothing else; what goes inside
 * belongs to whoever is using the tabs.
 */
function TabsContent({
   className,
   ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
   return (
      <TabsPrimitive.Content
         data-slot="tabs-content"
         className={cn(
            'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
            className
         )}
         {...props}
      />
   );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
