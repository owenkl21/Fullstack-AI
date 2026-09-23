import * as Popover from '@radix-ui/react-popover';
import { useMemo, useState } from 'react';
import {
   CheckIcon,
   ChevronDownIcon,
   MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { usePhone } from '@/lib/media';
import { Sheet } from '@/components/ui/sheet';
import { AddGearInline } from '@/components/fishing/AddGearInline';
import type { GearOption } from '@/pages/fishing/LogCatchPage';

/*
 * Gear, and bait or lure, on the log.
 *
 * The row is a line rather than a box, because everything around it is: the
 * label over what is chosen, on a dashed rule, with a chevron that says it
 * opens. What it opens is the long form's own list: a search, the kinds as
 * tabs once there is enough gear for them to help, the tackle under its kind,
 * and the way to register a rod without leaving the catch.
 */

/* The kinds, in the order tackle is picked up. */
const KINDS: { value: string; plural: string }[] = [
   { value: 'ROD', plural: 'Rods' },
   { value: 'REEL', plural: 'Reels' },
   { value: 'LINE', plural: 'Line' },
   { value: 'HOOK', plural: 'Hooks' },
   { value: 'WEIGHTS', plural: 'Weights' },
   { value: 'RIG', plural: 'Rigs' },
   { value: 'LURE', plural: 'Lures' },
   { value: 'BAIT', plural: 'Bait' },
];

export function GearPicker({
   label,
   gear,
   value,
   onChange,
   onAdded,
   emptyLabel = 'None chosen',
   className,
}: {
   label: string;
   /* The gear this picker may offer: the rods, or the bait and lures. */
   gear: GearOption[];
   value: string[];
   onChange: (next: string[]) => void;
   /* A piece registered from inside the sheet, for the form's own list. */
   onAdded: (entry: GearOption) => void;
   emptyLabel?: string;
   className?: string;
}) {
   const phone = usePhone();
   const [open, setOpen] = useState(false);
   const [query, setQuery] = useState('');
   const [kind, setKind] = useState<string>('ANY');

   const chosen = gear.filter((entry) => value.includes(entry.id));
   const summary = chosen.length
      ? chosen.map((entry) => entry.name).join(', ')
      : emptyLabel;

   const kinds = useMemo(
      () => KINDS.filter((k) => gear.some((entry) => entry.type === k.value)),
      [gear]
   );

   const matches = useMemo(() => {
      const q = query.trim().toLowerCase();
      return gear.filter(
         (entry) =>
            (kind === 'ANY' || entry.type === kind) &&
            (!q ||
               entry.name.toLowerCase().includes(q) ||
               (entry.brand ?? '').toLowerCase().includes(q))
      );
   }, [gear, query, kind]);

   const toggle = (id: string) =>
      onChange(
         value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
      );

   const trigger = (
      <button
         type="button"
         aria-haspopup="listbox"
         aria-expanded={open}
         onClick={phone ? () => setOpen(true) : undefined}
         className={cn(
            'flex h-[60px] w-full items-center justify-between gap-3 border-b border-dashed text-left transition-colors duration-150',
            open ? 'border-ink' : 'border-line-2',
            className
         )}
      >
         <span className="flex min-w-0 flex-col gap-[5px]">
            <span className="lab">{label}</span>
            <span
               className={cn(
                  'truncate text-[16px] leading-none',
                  chosen.length ? 'text-ink' : 'text-ink-2'
               )}
            >
               {summary}
            </span>
         </span>
         <ChevronDownIcon
            aria-hidden="true"
            strokeWidth={1.5}
            className={cn(
               'size-[18px] shrink-0 text-ink-2 transition-transform duration-150',
               open && 'rotate-180'
            )}
         />
      </button>
   );

   const body = (
      <>
         <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
            <span className="flex min-w-0 flex-col">
               <span className="lab">{label}</span>
               {chosen.length ? (
                  <span className="num text-[13px] text-ink-2">
                     {chosen.length} chosen
                  </span>
               ) : null}
            </span>
            <span className="flex items-center gap-4">
               {chosen.length ? (
                  <button
                     type="button"
                     onClick={() => onChange([])}
                     className="g-tracked text-[15px] text-teal-text"
                  >
                     Clear
                  </button>
               ) : null}
               <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="g-tracked inline-flex h-10 items-center bg-ink px-3 text-[16px] text-background"
               >
                  Done
               </button>
            </span>
         </div>
         <div className="thread-scroll min-h-0 overflow-y-auto">
            <div className="px-3 pt-3">
               <div className="relative">
                  <MagnifyingGlassIcon
                     aria-hidden="true"
                     className="pointer-events-none absolute top-1/2 left-0 size-[18px] -translate-y-1/2 text-ink-3"
                  />
                  <input
                     type="search"
                     value={query}
                     aria-label={`Search your ${label.toLowerCase()}`}
                     placeholder="Search your gear"
                     onChange={(event) => setQuery(event.target.value)}
                     className="h-12 w-full border-0 border-b border-dashed border-line-2 bg-transparent pl-7 text-[16px] text-ink outline-none placeholder:text-ink-3 focus:border-ink"
                  />
               </div>
            </div>
            {kinds.length > 1 ? (
               <div className="flex flex-wrap gap-2 px-3 pt-3">
                  {[{ value: 'ANY', plural: 'Any' }, ...kinds].map((k) => (
                     <button
                        key={k.value}
                        type="button"
                        aria-pressed={kind === k.value}
                        onClick={() => setKind(k.value)}
                        className={cn(
                           'g-tracked h-9 border px-3 text-[15px] transition-colors duration-150',
                           kind === k.value
                              ? 'border-ink bg-ink text-background'
                              : 'border-line text-ink-2 hover:border-ink-3'
                        )}
                     >
                        {k.plural}
                     </button>
                  ))}
               </div>
            ) : null}
            {gear.length === 0 ? (
               <p className="px-3 py-4 text-[15px] text-ink-2">
                  Nothing on your list yet.
               </p>
            ) : matches.length === 0 ? (
               <p className="px-3 py-4 text-[15px] text-ink-2">
                  Nothing goes by that name.
               </p>
            ) : (
               <ul className="pt-2">
                  {matches.map((entry) => {
                     const on = value.includes(entry.id);
                     return (
                        <li key={entry.id}>
                           <button
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              onClick={() => toggle(entry.id)}
                              className={cn(
                                 'flex min-h-12 w-full items-center gap-3 border-l-[3px] px-3 text-left transition-colors duration-100',
                                 on
                                    ? 'border-teal bg-teal/10'
                                    : 'border-transparent hover:bg-bg-2'
                              )}
                           >
                              <span
                                 aria-hidden="true"
                                 className={cn(
                                    'grid size-5 shrink-0 place-items-center border',
                                    on
                                       ? 'border-ink bg-ink text-background'
                                       : 'border-line-2'
                                 )}
                              >
                                 {on ? (
                                    <CheckIcon
                                       className="size-3.5"
                                       strokeWidth={3}
                                    />
                                 ) : null}
                              </span>
                              <span className="flex min-w-0 flex-col">
                                 <span className="g-tracked truncate text-[16px]">
                                    {entry.name}
                                 </span>
                                 {entry.brand ? (
                                    <span className="text-[13px] text-ink-3">
                                       {entry.brand}
                                    </span>
                                 ) : null}
                              </span>
                           </button>
                        </li>
                     );
                  })}
               </ul>
            )}
            <div className="px-3 py-4">
               <AddGearInline
                  onAdded={(entry) => {
                     onAdded(entry);
                     onChange([...value, entry.id]);
                  }}
               />
            </div>
         </div>
      </>
   );

   if (phone) {
      return (
         <>
            {trigger}
            <Sheet open={open} onOpenChange={setOpen} title={label}>
               {body}
            </Sheet>
         </>
      );
   }

   return (
      <Popover.Root open={open} onOpenChange={setOpen}>
         <Popover.Trigger asChild>{trigger}</Popover.Trigger>
         <Popover.Portal>
            <Popover.Content
               align="start"
               sideOffset={6}
               collisionPadding={12}
               className="blk-plain z-[1000] flex max-h-[min(70vh,560px)] w-[min(400px,calc(100vw-24px))] flex-col border border-line bg-background text-ink shadow-[0_10px_30px_rgba(11,9,9,0.18)]"
            >
               {body}
            </Popover.Content>
         </Popover.Portal>
      </Popover.Root>
   );
}
