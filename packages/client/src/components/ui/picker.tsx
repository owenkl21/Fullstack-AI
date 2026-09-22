import * as Popover from '@radix-ui/react-popover';
import {
   CheckIcon,
   ChevronDownIcon,
   MagnifyingGlassIcon,
   XMarkIcon,
} from '@heroicons/react/24/outline';
import {
   useEffect,
   useId,
   useMemo,
   useRef,
   useState,
   type KeyboardEvent,
   type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/lib/media';
import { Sheet } from '@/components/ui/sheet';

/*
 * A filter you open, in the house style.
 *
 * A button that says what is chosen, and a panel of options under it. One
 * choice or several. Built on Radix Popover so it handles focus, the escape
 * key and a tap outside; everything visible is ours: radius 0, ink on paper,
 * League Gothic on the labels.
 *
 * On a phone the panel is a sheet that rises from the bottom of the screen
 * with a Done button, because a popover pinned to a thumb-sized trigger is
 * what made these feel loose. On a desktop it is a panel under the button.
 * The button itself says how many are chosen and which, the open one is
 * ruled in ink, and chosen rows are marked and tinted so a long list still
 * reads at a glance.
 *
 * The panel is one column, head then search then list, and only the list
 * scrolls. It used to be a list with a height of its own inside a panel with
 * no height at all, so on a short screen the popover ran off the bottom of
 * the window, followed its button when the page was scrolled, and the rows
 * past the edge could never be reached. Now the panel is never taller than
 * the room Radix says it has, the page behind it holds still while it is
 * open, and a screen too short for a popover (a phone on its side) gets the
 * sheet as well.
 */
export type PickerOption = {
   value: string;
   label: string;
   /* A small mark before the label: a pin, a swatch. */
   mark?: ReactNode;
   hint?: string;
};

/* Past this many rows a list is searched rather than read. */
const SEARCH_FROM = 8;

/* Case and accents do not make a different name. */
const fold = (text: string) =>
   text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/*
 * How much of the bottom of the screen the keyboard is covering.
 *
 * Neither iOS nor Android shrinks the page for the keyboard any more, they
 * slide it over the top, so a sheet fixed to the bottom keeps its last rows
 * under the keys. The visual viewport is the part still showing; what is left
 * of the window below it is the keyboard, and the list pads itself by that
 * much so its last row can be scrolled clear.
 */
function useKeyboardInset(active: boolean) {
   const [inset, setInset] = useState(0);
   useEffect(() => {
      const viewport = window.visualViewport;
      if (!active || !viewport) return;
      const read = () =>
         setInset(
            Math.max(
               0,
               Math.round(
                  window.innerHeight - viewport.height - viewport.offsetTop
               )
            )
         );
      read();
      viewport.addEventListener('resize', read);
      viewport.addEventListener('scroll', read);
      return () => {
         viewport.removeEventListener('resize', read);
         viewport.removeEventListener('scroll', read);
         setInset(0);
      };
   }, [active]);
   return inset;
}

export function Picker({
   label,
   options,
   value,
   onChange,
   multiple = false,
   allLabel = 'Any',
   size = 'md',
   variant = 'box',
   align = 'start',
   className,
   icon,
   searchable,
   searchPlaceholder,
   max,
}: {
   label: string;
   options: PickerOption[];
   /* One value, or a list of them for a multiple picker. */
   value: string | string[];
   onChange: (next: string | string[]) => void;
   multiple?: boolean;
   /* What the button says when a multiple picker has nothing chosen. */
   allLabel?: string;
   size?: 'sm' | 'md';
   /*
    * How the trigger is drawn. `box` is the filter button: a bordered box with
    * the value in League Gothic. `line` is the same control standing in a
    * form, where the fields around it are lines rather than boxes: a 60px row
    * on a dashed rule, the label over the value in Jost. The panel and the
    * sheet are the same either way.
    */
   variant?: 'box' | 'line';
   align?: 'start' | 'end';
   className?: string;
   icon?: ReactNode;
   /* A search field over the list. Left out, a long list gets one and a short
      one does not. */
   searchable?: boolean;
   searchPlaceholder?: string;
   /* The most a multiple picker will take. Past it the rest cannot be ticked. */
   max?: number;
}) {
   const [open, setOpenState] = useState(false);
   const [query, setQuery] = useState('');
   /* A phone, or a window too short to hang a panel in. */
   const sheet = useMediaQuery('(max-width: 767px), (max-height: 540px)');
   const panelRef = useRef<HTMLDivElement>(null);
   const searchRef = useRef<HTMLInputElement>(null);
   const listId = useId();
   const chosen = useMemo(
      () => (Array.isArray(value) ? value : [value]),
      [value]
   );
   const chosenOptions = options.filter((o) => chosen.includes(o.value));
   const chosenLabels = chosenOptions.map((o) => o.label);
   const searching = searchable ?? options.length > SEARCH_FROM;
   const full = multiple && max !== undefined && chosen.length >= max;
   const keyboard = useKeyboardInset(open && sheet && searching);

   /* Every opening starts from the whole list. */
   const setOpen = (next: boolean) => {
      if (!next) setQuery('');
      setOpenState(next);
   };

   const shown = useMemo(() => {
      const q = fold(query);
      if (!q) return options;
      return options.filter(
         (o) => fold(o.label).includes(q) || fold(o.hint ?? '').includes(q)
      );
   }, [options, query]);

   const summary = multiple
      ? chosenLabels.length === 0
         ? allLabel
         : chosenLabels.length <= 2
           ? chosenLabels.join(', ')
           : `${chosenLabels[0]}, ${chosenLabels[1]} and ${chosenLabels.length - 2} more`
      : (chosenLabels[0] ?? allLabel);

   const toggle = (option: string) => {
      if (!multiple) {
         onChange(option);
         setOpen(false);
         return;
      }
      const set = new Set(chosen);
      if (set.has(option)) set.delete(option);
      else if (!full) set.add(option);
      onChange([...set]);
   };

   /*
    * The arrow keys walk the rows, from the search field down into the list
    * and back, so a keyboard never has to tab through forty fish to reach the
    * forty first.
    */
   const onKeys = (event: KeyboardEvent<HTMLDivElement>) => {
      const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      const inSearch = event.target === searchRef.current;
      /* Home and End belong to the caret while a word is being typed. */
      if (inSearch && (event.key === 'Home' || event.key === 'End')) return;
      const rows = Array.from(
         panelRef.current?.querySelectorAll<HTMLButtonElement>(
            '[data-picker-option]:not(:disabled)'
         ) ?? []
      );
      if (!rows.length) return;
      event.preventDefault();
      const at = rows.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'ArrowUp' && at === 0 && searchRef.current) {
         searchRef.current.focus();
         return;
      }
      const next =
         event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? rows.length - 1
              : event.key === 'ArrowDown'
                ? Math.min(rows.length - 1, at + 1)
                : Math.max(0, at - 1);
      rows[next]?.focus();
   };

   const search = searching ? (
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line px-3 focus-within:border-ink">
         <MagnifyingGlassIcon
            aria-hidden="true"
            strokeWidth={1.5}
            className="size-5 shrink-0 text-ink-3"
         />
         <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
               /* Enter takes the first row left, which is what typing a
                  name and pressing Enter means. */
               if (event.key !== 'Enter') return;
               event.preventDefault();
               const first = shown.find(
                  (o) => !full || chosen.includes(o.value)
               );
               if (first) toggle(first.value);
            }}
            placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
            aria-label={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
            aria-controls={listId}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            className="picker-search h-full w-full min-w-0 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
         />
         {query ? (
            <button
               type="button"
               aria-label="Clear the search"
               onClick={() => {
                  setQuery('');
                  searchRef.current?.focus();
               }}
               className="-mr-2 grid size-11 shrink-0 place-items-center text-ink-3 hover:text-ink"
            >
               <XMarkIcon aria-hidden="true" className="size-5" />
            </button>
         ) : null}
      </div>
   ) : null;

   const list = (
      <ul
         id={listId}
         role={multiple ? 'group' : 'listbox'}
         aria-label={label}
         style={keyboard ? { paddingBottom: keyboard } : undefined}
         className="picker-list thread-scroll min-h-0 flex-1 overflow-y-auto"
      >
         {options.length === 0 ? (
            <li className="px-3 py-3 text-[15px] text-ink-3">
               Nothing to choose from yet.
            </li>
         ) : shown.length === 0 ? (
            <li className="px-3 py-3 text-[15px] text-ink-2" role="status">
               Nothing by that name.
            </li>
         ) : null}
         {shown.map((option) => {
            const on = chosen.includes(option.value);
            const shut = full && !on;
            return (
               <li key={option.value} role="presentation">
                  <button
                     type="button"
                     data-picker-option=""
                     role={multiple ? 'checkbox' : 'option'}
                     aria-checked={multiple ? on : undefined}
                     aria-selected={multiple ? undefined : on}
                     disabled={shut}
                     onClick={() => toggle(option.value)}
                     className={cn(
                        'flex w-full items-center gap-3 border-l-[3px] px-3 text-left transition-colors duration-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal disabled:opacity-45',
                        sheet ? 'min-h-12' : 'min-h-11',
                        on
                           ? 'border-teal bg-teal/10'
                           : 'border-transparent hover:bg-bg-2'
                     )}
                  >
                     <span
                        aria-hidden="true"
                        className={cn(
                           'grid size-5 shrink-0 place-items-center border transition-colors duration-100',
                           on
                              ? 'border-ink bg-ink text-background'
                              : 'border-line-2',
                           !multiple && 'rounded-full'
                        )}
                     >
                        {on ? (
                           <CheckIcon className="size-3.5" strokeWidth={3} />
                        ) : null}
                     </span>
                     {option.mark ? (
                        <span className="shrink-0">{option.mark}</span>
                     ) : null}
                     <span className="flex min-w-0 flex-col">
                        <span
                           className={cn(
                              'g-tracked truncate text-[16px]',
                              on && 'text-ink'
                           )}
                        >
                           {option.label}
                        </span>
                        {option.hint ? (
                           <span className="truncate text-[13px] text-ink-3">
                              {option.hint}
                           </span>
                        ) : null}
                     </span>
                  </button>
               </li>
            );
         })}
      </ul>
   );

   const head = (
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3 py-2">
         <span className="flex min-w-0 flex-col">
            <span className="lab text-ink-3">{label}</span>
            {/* The count only once anything is chosen: the trigger that opened
                this panel already says when nothing is. */}
            {multiple && chosen.length > 0 ? (
               <span className="num text-[13px] text-ink-2" aria-live="polite">
                  {max !== undefined
                     ? `${chosen.length} of ${max} chosen`
                     : `${chosen.length} chosen`}
               </span>
            ) : null}
         </span>
         <span className="flex items-center gap-4">
            {multiple && chosen.length > 0 ? (
               <button
                  type="button"
                  onClick={() => onChange([])}
                  className="g-tracked inline-flex h-11 items-center text-[15px] text-teal-text"
               >
                  Clear
               </button>
            ) : null}
            {/* A sheet always has a way out under the thumb. A panel closes on
                a click outside, so it only needs one when several can be
                ticked and nothing else says the ticking is over. */}
            {sheet || multiple ? (
               <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="g-tracked inline-flex h-10 items-center gap-1 bg-ink px-3 text-[16px] text-background"
               >
                  Done
               </button>
            ) : null}
         </span>
      </div>
   );

   const line = variant === 'line';

   const trigger = (
      <button
         type="button"
         aria-haspopup="listbox"
         aria-expanded={open}
         onClick={sheet ? () => setOpen(true) : undefined}
         className={cn(
            'inline-flex w-full items-center gap-2 text-left transition-colors duration-150 [transition-timing-function:var(--ease)]',
            line
               ? 'h-[60px] border-b border-dashed bg-transparent'
               : 'border bg-background hover:border-ink-3',
            !line && (size === 'sm' ? 'min-h-11 px-3' : 'min-h-12 px-3.5'),
            line
               ? open
                  ? 'border-ink'
                  : 'border-line-2'
               : open
                 ? 'border-ink shadow-[inset_0_-2px_0_var(--teal)]'
                 : chosen.length > 0 && (multiple || chosen[0])
                   ? 'border-ink'
                   : 'border-line',
            className
         )}
      >
         {icon ? <span className="shrink-0 text-ink-2">{icon}</span> : null}
         <span className="flex min-w-0 flex-1 flex-col leading-none">
            <span className="lab text-ink-3">{label}</span>
            <span
               className={cn(
                  'truncate',
                  line
                     ? 'mt-[5px] text-[16px] leading-none text-ink'
                     : 'g-tracked mt-0.5',
                  !line && (size === 'sm' ? 'text-[15px]' : 'text-[16px]'),
                  multiple && chosen.length === 0 && 'text-ink-2'
               )}
            >
               {summary}
            </span>
         </span>
         {/* The count is a filter-bar affordance: on a form line the value
             itself already lists what is chosen. */}
         {multiple && chosen.length > 0 && !line ? (
            <span className="num grid size-6 shrink-0 place-items-center bg-ink text-[12px] text-background">
               {chosen.length}
            </span>
         ) : null}
         <ChevronDownIcon
            aria-hidden="true"
            className={cn(
               'shrink-0 transition-transform duration-150',
               line ? 'size-[18px] text-ink-2' : 'size-4 text-ink-3',
               open && 'rotate-180 text-ink'
            )}
         />
      </button>
   );

   if (sheet) {
      return (
         <>
            {trigger}
            <Sheet
               open={open}
               onOpenChange={setOpen}
               title={label}
               /* A searched list keeps one height, so the sheet does not jump
                  about under the thumb as the rows are filtered away. */
               className={cn('picker-sheet', searching && 'picker-sheet-tall')}
            >
               <div
                  ref={panelRef}
                  onKeyDown={onKeys}
                  className="flex min-h-0 flex-1 flex-col"
               >
                  {head}
                  {search}
                  {list}
               </div>
            </Sheet>
         </>
      );
   }

   return (
      /* Modal, so the page behind holds still and the wheel belongs to the
         list. It is also what lets the list scroll when the picker stands
         inside a dialog, whose scroll lock otherwise swallows the wheel over
         anything portalled outside it. */
      <Popover.Root open={open} onOpenChange={setOpen} modal>
         <Popover.Trigger asChild>{trigger}</Popover.Trigger>
         <Popover.Portal>
            <Popover.Content
               ref={panelRef}
               align={align}
               sideOffset={6}
               /* Clear of the header at the top, which a panel that flips
                  upward would otherwise lie across. */
               collisionPadding={{ top: 68, right: 12, bottom: 12, left: 12 }}
               onKeyDown={onKeys}
               onOpenAutoFocus={(event) => {
                  /* Straight into the search field, so typing filters at
                     once; a short list takes focus the way Radix gives it. */
                  if (!searchRef.current) return;
                  event.preventDefault();
                  searchRef.current.focus();
               }}
               className={cn(
                  'picker-panel blk-plain z-[1000] flex w-[min(360px,calc(100vw-24px))] flex-col border border-line bg-background text-ink shadow-[0_10px_30px_rgba(11,9,9,0.18)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
                  searching && 'picker-panel-tall'
               )}
            >
               {head}
               {search}
               {list}
            </Popover.Content>
         </Popover.Portal>
      </Popover.Root>
   );
}

/* Small marks the pickers share: the cross that clears a chosen item. */
export function PickerClear({
   onClick,
   label,
}: {
   onClick: () => void;
   label: string;
}) {
   return (
      <button
         type="button"
         aria-label={label}
         onClick={onClick}
         className="grid size-6 place-items-center text-ink-3 hover:text-ink"
      >
         <XMarkIcon aria-hidden="true" className="size-4" />
      </button>
   );
}
