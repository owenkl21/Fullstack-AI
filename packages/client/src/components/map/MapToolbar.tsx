import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import * as Popover from '@radix-ui/react-popover';
import { usePhone } from '@/lib/media';
import { Sheet } from '@/components/ui/sheet';
import { useState } from 'react';
import { Picker } from '@/components/ui/picker';
import { BASE_LAYERS, type BaseLayer } from '@/lib/leaflet';
import { cn } from '@/lib/utils';

/*
 * The controls, on the map rather than under it.
 *
 * Three rows of chips under the map meant setting a filter and scrolling
 * back up to see what it did. Now everything sits over the map: on a desktop
 * in one row, on a phone in one bar under the thumb, and every panel rises
 * from the bottom of the screen as a sheet.
 *
 * The fish filter used to hold a cell of its own in the phone bar, where a
 * five column grid gave it seventy four pixels and a chosen species came out
 * as "FIS G. [1]" on two clipped lines. It lives in the layers sheet now,
 * which has the room, and the bar says how many are chosen.
 *
 * Every control carries its word. They used to carry a word and an icon of
 * the same thing, which says it twice and is the one thing the house rules
 * forbid outright; the icons are gone and the words do the work.
 *
 * Only what is about the whole map lives here: what is drawn, which fish, and
 * where you are standing. "Drop a mark" and "Log here" used to stand in this
 * row too, and both were about a point a toolbar cannot know. The first armed
 * a mode and the second logged the middle of the view, whatever had been
 * tapped. A tap on the map opens a menu for that exact point now, so they are
 * gone rather than mended: the header's Log a catch and the phone's Log key
 * already start a log from where the angler is standing.
 */
type Layers = { others: boolean; marks: boolean; places: boolean };

/*
 * The one gesture, in one place, for the legend and the layers panel on a
 * desktop and the layers sheet on a phone, in the verb of the hand holding
 * it. "Anywhere else" rather than "open water": most taps near a dam or a
 * river land on the bank.
 */
const gesture = (verb: 'Tap' | 'Click') =>
   `${verb} a pin for what is there. ${verb} anywhere else for what you can do there.`;

const control =
   'g-tracked inline-flex h-11 shrink-0 items-center whitespace-nowrap border border-line bg-background px-3.5 text-[15px] text-ink transition-[background-color,border-color,transform] duration-150 [transition-timing-function:var(--ease)] hover:border-ink active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal data-[state=open]:border-ink';

export function MapToolbar({
   base,
   onBase,
   species,
   onSpecies,
   speciesOptions,
   layers,
   onLayer,
   onLocate,
   locating = false,
   placement = 'overlay',
   anchor = 'top',
   className,
}: {
   base: BaseLayer;
   onBase: (next: BaseLayer) => void;
   species: string[];
   onSpecies: (next: string[]) => void;
   speciesOptions: { value: string; label: string }[];
   layers: Layers;
   onLayer: (key: keyof Layers) => void;
   /* Where the angler is standing. The bar always carries it; the overlay
      carries it on the map that is a whole screen and has no other copy. */
   onLocate?: () => void;
   locating?: boolean;
   /*
    * Where it sits. Over the map on a desktop; under the thumb on a phone,
    * as a bar, so the map itself is clear for fingers and nothing floats
    * where the fixed bar at the foot of the screen would cut it in half.
    */
   placement?: 'overlay' | 'bar';
   /* On a full screen map the row stands at the foot, like the phone's bar. */
   anchor?: 'top' | 'bottom';
   /** Where the bar is put, for the page that floats it on the map itself. */
   className?: string;
}) {
   const [layersOpen, setLayersOpen] = useState(false);
   const shown = Object.values(layers).filter(Boolean).length;
   const phone = usePhone();
   const bar = placement === 'bar';
   /*
    * 14px, not 11. Nothing in this product goes under fourteen except a
    * tracked field label, and these are controls a wet thumb has to read.
    */
   const barButton =
      'g-tracked flex min-h-12 items-center justify-center gap-1.5 bg-background px-1 text-center text-[14px] leading-tight text-ink transition-colors duration-100 hover:bg-bg-2';

   /* The fish filter, where there is room for it: inside the sheet. */
   const fish =
      phone && speciesOptions.length ? (
         <>
            <span className="lab mt-4 block text-ink-3">Fish</span>
            {/* No scroll of its own: the sheet already scrolls, and a list
                that scrolls inside a panel that scrolls is two thumbs. */}
            <ul className="mt-1.5 flex flex-col">
               <li>
                  <button
                     type="button"
                     role="radio"
                     aria-checked={species.length === 0}
                     onClick={() => onSpecies([])}
                     className="flex min-h-11 w-full items-center gap-3 text-left hover:bg-bg-2"
                  >
                     <span
                        aria-hidden="true"
                        className={cn(
                           'grid size-5 shrink-0 place-items-center border',
                           species.length === 0
                              ? 'border-ink bg-ink'
                              : 'border-line-2'
                        )}
                     >
                        {species.length === 0 ? (
                           <span className="size-2 bg-background" />
                        ) : null}
                     </span>
                     <span className="g-tracked text-[16px]">Any fish</span>
                  </button>
               </li>
               {speciesOptions.map((option) => {
                  const on = species.includes(option.value);
                  return (
                     <li key={option.value}>
                        <button
                           type="button"
                           role="checkbox"
                           aria-checked={on}
                           onClick={() =>
                              onSpecies(
                                 on
                                    ? species.filter((s) => s !== option.value)
                                    : [...species, option.value]
                              )
                           }
                           className="flex min-h-11 w-full items-center gap-3 text-left hover:bg-bg-2"
                        >
                           <span
                              aria-hidden="true"
                              className={cn(
                                 'grid size-5 shrink-0 place-items-center border',
                                 on ? 'border-ink bg-ink' : 'border-line-2'
                              )}
                           >
                              {on ? (
                                 <span className="size-2 bg-background" />
                              ) : null}
                           </span>
                           <span className="g-tracked text-[16px]">
                              {option.label}
                           </span>
                        </button>
                     </li>
                  );
               })}
            </ul>
         </>
      ) : null;

   /* Base, layers, fish and the legend: the one panel, sheet or popover. */
   const panel = (
      <div className="thread-scroll min-h-0 overflow-y-auto p-3">
         <span className="lab text-ink-3">Base</span>
         <div role="radiogroup" className="mt-1.5 grid grid-cols-2 gap-1.5">
            {BASE_LAYERS.map((option) => (
               <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={base === option.value}
                  onClick={() => onBase(option.value)}
                  className={cn(
                     'g-tracked h-10 border text-[15px] transition-colors duration-100',
                     base === option.value
                        ? 'border-ink bg-ink text-background'
                        : 'border-line text-ink-2 hover:border-ink hover:text-ink'
                  )}
               >
                  {option.label}
               </button>
            ))}
         </div>
         <span className="lab mt-4 block text-ink-3">Show</span>
         <ul className="mt-1.5 flex flex-col">
            {(
               [
                  ['others', 'Other anglers’ spots'],
                  ['marks', 'My private marks'],
                  ['places', 'Slipways, harbours and shops'],
               ] as [keyof Layers, string][]
            ).map(([key, text]) => (
               <li key={key}>
                  <button
                     type="button"
                     role="checkbox"
                     aria-checked={layers[key]}
                     onClick={() => onLayer(key)}
                     className="flex min-h-11 w-full items-center gap-3 text-left hover:bg-bg-2"
                  >
                     <span
                        aria-hidden="true"
                        className={cn(
                           'grid size-5 shrink-0 place-items-center border',
                           layers[key] ? 'border-ink bg-ink' : 'border-line-2'
                        )}
                     >
                        {layers[key] ? (
                           <span className="size-2 bg-background" />
                        ) : null}
                     </span>
                     <span className="g-tracked text-[16px]">{text}</span>
                  </button>
               </li>
            ))}
         </ul>
         {fish}
         {phone ? (
            <>
               <span className="lab mt-4 block text-ink-3">The pins</span>
               <ul className="mt-1.5 flex flex-col gap-1.5">
                  {LEGEND.map((row) => (
                     <li key={row.key} className="flex items-center gap-3">
                        <LegendMark fill={row.fill} shape={row.shape} />
                        <span className="text-[14px]">{row.label}</span>
                     </li>
                  ))}
               </ul>
               <p className="mt-3 text-[14px] text-ink-3">{gesture('Tap')}</p>
               <button
                  type="button"
                  onClick={() => setLayersOpen(false)}
                  className="g-tracked mt-4 flex h-11 w-full items-center justify-center bg-ink text-[16px] text-background"
               >
                  Done
               </button>
            </>
         ) : anchor === 'bottom' ? (
            /* The whole-screen map on a desktop has no legend of its own,
               so the one line about the gesture lives here, where a reader
               who has forgotten it goes looking. */
            <p className="mt-4 border-t border-line pt-3 text-[14px] text-ink-3">
               {gesture('Click')}
            </p>
         ) : null}
      </div>
   );

   /* What the Layers control says: the base on a desktop, the word on a
      phone, and the fish count when anything is filtered, so a bar cell
      never hides a filter that is on. */
   const layersLabel = bar ? (
      <>
         <span>Layers</span>
         {species.length ? (
            <span className="num grid size-5 shrink-0 place-items-center bg-ink text-[12px] text-background">
               {species.length}
            </span>
         ) : null}
      </>
   ) : (
      <span>
         {BASE_LAYERS.find((b) => b.value === base)?.label ?? 'Layers'}
         <span className="ml-1.5 text-ink-3">{shown} on</span>
      </span>
   );

   return (
      <div
         className={cn(
            bar
               ? /* As many cells as there are controls, so two do not sit in
                    half of a bar ruled for four. */
                 cn(
                    'grid gap-px border border-line bg-line',
                    onLocate ? 'grid-cols-2' : 'grid-cols-1'
                 )
               : /*
                  * One line, at its own width. An absolutely positioned flex
                  * row that is allowed to wrap takes the width of its widest
                  * item rather than the sum of them, so this row broke in two
                  * over the water on a 1440 screen for no reason a reader
                  * could see. There is always room for three controls.
                  */
                 anchor === 'bottom'
                 ? 'absolute bottom-8 left-3 z-[500] flex w-max flex-nowrap items-center gap-2'
                 : 'absolute top-3 left-3 z-[500] flex w-max flex-nowrap items-start gap-2 pr-16',
            className
         )}
      >
         {phone ? (
            <>
               <button
                  onClick={() => setLayersOpen(true)}
                  type="button"
                  className={bar ? barButton : control}
               >
                  {layersLabel}
               </button>
               <Sheet
                  open={layersOpen}
                  onOpenChange={setLayersOpen}
                  title="Map layers"
               >
                  {panel}
               </Sheet>
            </>
         ) : (
            <Popover.Root open={layersOpen} onOpenChange={setLayersOpen}>
               <Popover.Trigger asChild>
                  <button type="button" className={bar ? barButton : control}>
                     {layersLabel}
                  </button>
               </Popover.Trigger>
               <Popover.Portal>
                  <Popover.Content
                     align="start"
                     side={anchor === 'bottom' ? 'top' : 'bottom'}
                     sideOffset={6}
                     collisionPadding={12}
                     className="z-[1000] w-[min(300px,calc(100vw-24px))] border border-line-2 bg-background p-0 text-ink"
                  >
                     {panel}
                  </Popover.Content>
               </Popover.Portal>
            </Popover.Root>
         )}

         {!bar && speciesOptions.length ? (
            <Picker
               size="md"
               multiple
               label="Fish"
               allLabel="Any"
               value={species}
               onChange={(next) => onSpecies(next as string[])}
               options={speciesOptions}
               className="w-auto max-w-[200px] shrink-0"
            />
         ) : null}

         {onLocate ? (
            <button
               type="button"
               onClick={onLocate}
               className={cn(
                  bar ? barButton : control,
                  locating && 'text-teal-text'
               )}
            >
               <span>{locating ? 'Finding' : 'Locate'}</span>
            </button>
         ) : null}
      </div>
   );
}

/*
 * What the pins mean, on demand. Drawn with the same SVG as the map so the
 * legend cannot drift from the pins.
 */
const LEGEND: {
   key: string;
   label: string;
   fill: string;
   shape: 'drop' | 'small' | 'ring';
   ink: string;
}[] = [
   {
      key: 'spot',
      label: 'Your spot, with its catch count',
      fill: '#34adbd',
      ink: '#06232a',
      shape: 'drop',
   },
   {
      key: 'other',
      label: 'Another angler’s public spot',
      fill: '#14110f',
      ink: '#f4f1ec',
      shape: 'drop',
   },
   {
      key: 'waypoint',
      label: 'Your private mark',
      fill: '#f4f1ec',
      ink: '#0b0909',
      shape: 'small',
   },
   {
      key: 'ramp',
      label: 'Slipway',
      fill: '#1f6fb2',
      ink: '#f4f1ec',
      shape: 'drop',
   },
   {
      key: 'marina',
      label: 'Harbour or marina',
      fill: '#1d3557',
      ink: '#f4f1ec',
      shape: 'drop',
   },
   {
      key: 'tackle',
      label: 'Tackle or bait shop',
      fill: '#c97b1c',
      ink: '#f4f1ec',
      shape: 'drop',
   },
   {
      key: 'cluster',
      label: 'Several spots, zoom in',
      fill: '#34adbd',
      ink: '#06232a',
      shape: 'ring',
   },
];

function LegendMark({
   fill,
   shape,
}: {
   fill: string;
   shape: 'drop' | 'small' | 'ring';
}) {
   if (shape === 'ring') {
      return (
         <svg width="28" height="28" viewBox="0 0 48 48" aria-hidden="true">
            <circle
               cx="24"
               cy="24"
               r="22"
               fill="none"
               stroke="#b7b2ab"
               strokeWidth="2"
            />
            <circle
               cx="24"
               cy="24"
               r="17"
               fill={fill}
               stroke="#f4f1ec"
               strokeWidth="3"
            />
         </svg>
      );
   }
   const d =
      shape === 'small'
         ? 'M14 35C14 35 3 22.4 3 14a11 11 0 1 1 22 0C25 22.4 14 35 14 35Z'
         : 'M18 45C18 45 3.5 28.6 3.5 18a14.5 14.5 0 1 1 29 0C32.5 28.6 18 45 18 45Z';
   const box = shape === 'small' ? '0 0 28 36' : '0 0 36 46';
   return (
      <svg width="24" height="28" viewBox={box} aria-hidden="true">
         <path
            d={d}
            fill={fill}
            stroke="#b7b2ab"
            strokeWidth="2.5"
            strokeLinejoin="round"
         />
      </svg>
   );
}

export function MapLegend() {
   return (
      <Popover.Root>
         <Popover.Trigger asChild>
            <button
               type="button"
               aria-label="What the pins mean"
               className="absolute right-3 bottom-[88px] z-[500] grid size-11 place-items-center border border-line bg-background text-ink transition-transform duration-150 active:scale-[0.96] data-[state=open]:border-ink"
            >
               <QuestionMarkCircleIcon aria-hidden="true" className="size-6" />
            </button>
         </Popover.Trigger>
         <Popover.Portal>
            <Popover.Content
               align="end"
               side="top"
               sideOffset={6}
               collisionPadding={12}
               className="z-[1000] w-[min(300px,calc(100vw-24px))] border border-line-2 bg-background p-3 text-ink"
            >
               <span className="lab text-ink-3">The pins</span>
               <ul className="mt-2 flex flex-col gap-1.5">
                  {LEGEND.map((row) => (
                     <li key={row.key} className="flex items-center gap-3">
                        <LegendMark fill={row.fill} shape={row.shape} />
                        <span className="text-[15px]">{row.label}</span>
                     </li>
                  ))}
               </ul>
               <p className="mt-3 text-[14px] text-ink-3">{gesture('Click')}</p>
            </Popover.Content>
         </Popover.Portal>
      </Popover.Root>
   );
}
