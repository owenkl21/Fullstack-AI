import {
   MapPinIcon,
   PlusIcon,
   QuestionMarkCircleIcon,
   Squares2X2Icon,
} from '@heroicons/react/24/outline';
import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { FishMark } from '@/components/brand/FishMark';
import { Picker } from '@/components/ui/picker';
import { BASE_LAYERS, type BaseLayer } from '@/lib/leaflet';
import { cn } from '@/lib/utils';

/*
 * The controls, on the map rather than under it.
 *
 * Three rows of chips under the map meant setting a filter and scrolling
 * back up to see what it did. Now everything sits over the map's top left:
 * the base and what shows in one panel, the fish in another, a pin button
 * that arms the next tap to drop a mark, and a way to log a catch at the
 * centre. On a phone they are icons; on a desktop they carry their words.
 */
type Layers = { others: boolean; marks: boolean; places: boolean };

const control =
   'inline-flex h-11 items-center gap-2 border border-line bg-background px-3 text-ink shadow-[0_2px_8px_rgba(11,9,9,0.25)] transition-[background-color,border-color,transform] duration-150 [transition-timing-function:var(--ease)] hover:border-ink active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal data-[state=open]:border-ink';

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
}) {
   const [layersOpen, setLayersOpen] = useState(false);
   const shown = Object.values(layers).filter(Boolean).length;

   return (
      <div className="absolute top-3 left-3 z-[500] flex flex-wrap items-start gap-2 pr-16">
         <Popover.Root open={layersOpen} onOpenChange={setLayersOpen}>
            <Popover.Trigger asChild>
               <button
                  type="button"
                  className={control}
                  aria-label="Map layers"
               >
                  <Squares2X2Icon aria-hidden="true" className="size-5" />
                  <span className="g-tracked hidden text-[15px] sm:inline">
                     {BASE_LAYERS.find((b) => b.value === base)?.label ??
                        'Layers'}
                     <span className="ml-1.5 text-ink-3">{shown} on</span>
                  </span>
               </button>
            </Popover.Trigger>
            <Popover.Portal>
               <Popover.Content
                  align="start"
                  sideOffset={6}
                  collisionPadding={12}
                  className="z-[1000] w-[min(300px,calc(100vw-24px))] border border-line bg-background p-3 text-ink shadow-[0_10px_30px_rgba(11,9,9,0.18)]"
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
               </Popover.Content>
            </Popover.Portal>
         </Popover.Root>

         {speciesOptions.length ? (
            <Picker
               size="md"
               multiple
               label="Fish"
               allLabel="Any"
               value={species}
               onChange={(next) => onSpecies(next as string[])}
               options={speciesOptions}
               icon={<FishMark className="h-4 w-6" />}
               className="max-w-[200px] shadow-[0_2px_8px_rgba(11,9,9,0.25)]"
            />
         ) : null}

         <button
            type="button"
            aria-pressed={dropping}
            onClick={onDrop}
            className={cn(
               control,
               dropping && 'border-teal bg-teal text-teal-ink'
            )}
            title="Drop a private mark"
         >
            <MapPinIcon aria-hidden="true" className="size-5" />
            <span className="g-tracked hidden text-[15px] sm:inline">
               {dropping ? 'Tap the map' : 'Drop a mark'}
            </span>
         </button>

         <button
            type="button"
            onClick={onLogHere}
            className={control}
            title="Log a catch at the centre of the map"
         >
            <PlusIcon aria-hidden="true" className="size-5" />
            <span className="g-tracked hidden text-[15px] sm:inline">
               Log here
            </span>
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
               className="absolute right-3 bottom-[88px] z-[500] grid size-11 place-items-center border border-line bg-background text-ink shadow-[0_2px_8px_rgba(11,9,9,0.25)] transition-transform duration-150 active:scale-[0.96] data-[state=open]:border-ink"
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
               className="z-[1000] w-[min(300px,calc(100vw-24px))] border border-line bg-background p-3 text-ink shadow-[0_10px_30px_rgba(11,9,9,0.18)]"
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
