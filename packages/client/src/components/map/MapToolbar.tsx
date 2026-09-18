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
 * back up to see what it did. Now everything sits over the map's top left on
 * a desktop, and in one row under the map on a phone: the base and what
 * shows in one panel, the fish in another, a pin button that arms the next
 * tap to drop a mark, a way back to where you are standing, and a way to log
 * a catch at the centre.
 *
 * Every one of them carries its word. They used to carry a word and an icon
 * of the same thing, which says it twice and is the one thing the house rules
 * forbid outright; the icons are gone and the words do the work. The map's
 * own icon-only controls are the zoom, the legend and, on a desktop, locate,
 * each with a label a screen reader can read.
 */
type Layers = { others: boolean; marks: boolean; places: boolean };

const control =
   'g-tracked inline-flex h-11 items-center border border-line bg-background px-3.5 text-[15px] text-ink transition-[background-color,border-color,transform] duration-150 [transition-timing-function:var(--ease)] hover:border-ink active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal data-[state=open]:border-ink';

export function MapToolbar({
   base,
   onBase,
   species,
   onSpecies,
   speciesOptions,
   layers,
   onLayer,
   dropping,
   onDrop,
   onLogHere,
   onLocate,
   locating = false,
   placement = 'overlay',
}: {
   base: BaseLayer;
   onBase: (next: BaseLayer) => void;
   species: string[];
   onSpecies: (next: string[]) => void;
   speciesOptions: { value: string; label: string }[];
   layers: Layers;
   onLayer: (key: keyof Layers) => void;
   dropping: boolean;
   onDrop: () => void;
   onLogHere: () => void;
   /*
    * Where the angler is standing. Only the bar carries it: on a desktop the
    * map floats its own round locate control, which has nowhere to collide.
    */
   onLocate?: () => void;
   locating?: boolean;
   /*
    * Where it sits. Over the map on a desktop; under the map on a phone,
    * as a bar, so the map itself is clear for fingers, every panel rises from
    * the bottom of the screen, and nothing floats where the fixed bar at the
    * foot of the screen would cut it in half.
    */
   placement?: 'overlay' | 'bar';
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
      'g-tracked flex min-h-12 items-center justify-center bg-background px-1 text-center text-[14px] leading-tight text-ink transition-colors duration-100 hover:bg-bg-2';

   return (
      <div
         className={cn(
            bar
               ? 'grid grid-cols-5 gap-px border border-line bg-line'
               : 'absolute top-3 left-3 z-[500] flex flex-wrap items-start gap-2 pr-16'
         )}
      >
         {phone ? (
            <>
               <button
                  onClick={phone ? () => setLayersOpen(true) : undefined}
                  type="button"
                  className={bar ? barButton : control}
               >
                  {bar ? (
                     <span>Layers</span>
                  ) : (
                     <span>
                        {BASE_LAYERS.find((b) => b.value === base)?.label ??
                           'Layers'}
                        <span className="ml-1.5 text-ink-3">{shown} on</span>
                     </span>
                  )}
               </button>
               <Sheet
                  open={layersOpen}
                  onOpenChange={setLayersOpen}
                  title="Map layers"
               >
                  <div className="thread-scroll min-h-0 overflow-y-auto p-3">
                     <span className="lab text-ink-3">Base</span>
                     <div
                        role="radiogroup"
                        className="mt-1.5 grid grid-cols-2 gap-1.5"
                     >
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
                                       layers[key]
                                          ? 'border-ink bg-ink'
                                          : 'border-line-2'
                                    )}
                                 >
                                    {layers[key] ? (
                                       <span className="size-2 bg-background" />
                                    ) : null}
                                 </span>
                                 <span className="g-tracked text-[16px]">
                                    {text}
                                 </span>
                              </button>
                           </li>
                        ))}
                     </ul>
                     {phone ? (
                        <>
                           <span className="lab mt-4 block text-ink-3">
                              The pins
                           </span>
                           <ul className="mt-1.5 flex flex-col gap-1.5">
                              {LEGEND.map((row) => (
                                 <li
                                    key={row.key}
                                    className="flex items-center gap-3"
                                 >
                                    <LegendMark
                                       fill={row.fill}
                                       shape={row.shape}
                                    />
                                    <span className="text-[14px]">
                                       {row.label}
                                    </span>
                                 </li>
                              ))}
                           </ul>
                           <button
                              type="button"
                              onClick={() => setLayersOpen(false)}
                              className="g-tracked mt-4 flex h-11 w-full items-center justify-center bg-ink text-[16px] text-background"
                           >
                              Done
                           </button>
                        </>
                     ) : null}
                  </div>
               </Sheet>
            </>
         ) : (
            <Popover.Root open={layersOpen} onOpenChange={setLayersOpen}>
               <Popover.Trigger asChild>
                  <button type="button" className={bar ? barButton : control}>
                     {bar ? (
                        <span>Layers</span>
                     ) : (
                        <span>
                           {BASE_LAYERS.find((b) => b.value === base)?.label ??
                              'Layers'}
                           <span className="ml-1.5 text-ink-3">{shown} on</span>
                        </span>
                     )}
                  </button>
               </Popover.Trigger>
               <Popover.Portal>
                  <Popover.Content
                     align="start"
                     sideOffset={6}
                     collisionPadding={12}
                     className="z-[1000] w-[min(300px,calc(100vw-24px))] border border-line-2 bg-background p-3 text-ink"
                  >
                     <span className="lab text-ink-3">Base</span>
                     <div
                        role="radiogroup"
                        className="mt-1.5 grid grid-cols-2 gap-1.5"
                     >
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
                                       layers[key]
                                          ? 'border-ink bg-ink'
                                          : 'border-line-2'
                                    )}
                                 >
                                    {layers[key] ? (
                                       <span className="size-2 bg-background" />
                                    ) : null}
                                 </span>
                                 <span className="g-tracked text-[16px]">
                                    {text}
                                 </span>
                              </button>
                           </li>
                        ))}
                     </ul>
                     {phone ? (
                        <>
                           <span className="lab mt-4 block text-ink-3">
                              The pins
                           </span>
                           <ul className="mt-1.5 flex flex-col gap-1.5">
                              {LEGEND.map((row) => (
                                 <li
                                    key={row.key}
                                    className="flex items-center gap-3"
                                 >
                                    <LegendMark
                                       fill={row.fill}
                                       shape={row.shape}
                                    />
                                    <span className="text-[14px]">
                                       {row.label}
                                    </span>
                                 </li>
                              ))}
                           </ul>
                           <button
                              type="button"
                              onClick={() => setLayersOpen(false)}
                              className="g-tracked mt-4 flex h-11 w-full items-center justify-center bg-ink text-[16px] text-background"
                           >
                              Done
                           </button>
                        </>
                     ) : null}
                  </Popover.Content>
               </Popover.Portal>
            </Popover.Root>
         )}

         {speciesOptions.length ? (
            <Picker
               size={bar ? 'sm' : 'md'}
               multiple
               label="Fish"
               allLabel="Any"
               value={species}
               onChange={(next) => onSpecies(next as string[])}
               options={speciesOptions}
               className={bar ? 'min-h-12 border-0 px-1' : 'max-w-[200px]'}
            />
         ) : bar ? (
            /* The filter with nothing to filter yet. It keeps its cell so the
               row does not reshuffle the moment a species arrives. */
            <span className={cn(barButton, 'text-ink-3')}>Fish</span>
         ) : null}

         <button
            type="button"
            aria-pressed={dropping}
            onClick={onDrop}
            className={cn(
               bar ? barButton : control,
               dropping &&
                  (bar
                     ? 'bg-teal text-teal-ink'
                     : 'border-teal bg-teal text-teal-ink')
            )}
         >
            {bar ? (
               <span>{dropping ? 'Tap map' : 'Mark'}</span>
            ) : (
               <span>{dropping ? 'Tap the map' : 'Drop a mark'}</span>
            )}
         </button>

         {bar && onLocate ? (
            <button
               type="button"
               onClick={onLocate}
               className={cn(barButton, locating && 'text-teal')}
            >
               <span>{locating ? 'Finding' : 'Locate'}</span>
            </button>
         ) : null}

         <button
            type="button"
            onClick={onLogHere}
            className={bar ? barButton : control}
         >
            <span>Log here</span>
         </button>
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
               <p className="mt-3 text-[13px] text-ink-3">
                  Tap a pin for what is there. Press and hold anywhere to drop a
                  mark of your own.
               </p>
            </Popover.Content>
         </Popover.Portal>
      </Popover.Root>
   );
}
