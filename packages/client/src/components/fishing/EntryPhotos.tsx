import type { ReactNode } from 'react';
import { CheckIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import {
   PhotoBlock,
   type UploadedPhoto,
} from '@/components/fishing/quicklog/PhotoBlock';
import {
   needsMeasurePhoto,
   type Competition,
} from '@/components/social/competitions-api';
import { usePhone } from '@/lib/media';
import { cn } from '@/lib/utils';

/*
 * The two photographs a competition entry is judged on, in the order a
 * steward would ask for them.
 *
 * First the fish: the whole fish, clearly, which is the picture that goes on
 * the board. Then the same fish on the measure, the tape or board or the
 * scale, with the figure readable and the fish in the frame. Numbered, one
 * line each on what makes the picture right, and a small drawing of the
 * framing beside it, because a picture of a picture says it faster than a
 * sentence on a riverbank.
 *
 * The second is shut until the first is in. That is the order the judge
 * reads them in and the only order in which "the same fish" means anything.
 * Each is saved as what it is (the fish, the measure), never as the first
 * and second of a list.
 */

/* ---- the drawings ------------------------------------------------------ */

/* One fish, facing left, nose at the origin, 46 long and 22 deep. */
const FISH =
   'M0 0 C6 -9 24 -11 36 -4 L46 -10 L44 0 L46 10 L36 4 C24 11 6 9 0 0 Z';

function Drawing({ children, label }: { children: ReactNode; label: string }) {
   return (
      <svg
         viewBox="0 0 88 64"
         role="img"
         aria-label={label}
         className="h-16 w-[88px] shrink-0 border border-line bg-bg-2 text-ink-2"
         fill="none"
         stroke="currentColor"
         strokeWidth={1.4}
         strokeLinecap="round"
         strokeLinejoin="round"
      >
         {children}
      </svg>
   );
}

/* The fish side on, filling a camera's frame. */
export function FishDrawing() {
   return (
      <Drawing label="A drawing: the whole fish side on, filling the frame">
         <path d="M8 16 V8 H16 M72 8 H80 V16 M80 48 V56 H72 M16 56 H8 V48" />
         <g transform="translate(19 32) scale(1.08)">
            <path d={FISH} />
            <circle cx="6" cy="-2" r="1.1" fill="currentColor" stroke="none" />
         </g>
      </Drawing>
   );
}

/* The fish flat on a board, nose against the stop, the tail's mark in teal. */
export function LengthDrawing() {
   const ticks = Array.from({ length: 16 }, (_, i) => 10 + i * 4.6);
   return (
      <Drawing label="A drawing: the fish flat on a measuring board, nose at zero, the figure at the tail">
         <path d="M6 22 V50 M6 40 H82 V50 H6" />
         {ticks.map((x, i) => (
            <path
               key={x}
               d={`M${x} 40 V${i % 5 === 0 ? 45 : 43}`}
               strokeWidth={1}
            />
         ))}
         <g transform="translate(7 31) scale(1.36 0.78)">
            <path d={FISH} />
         </g>
         <path d="M71 26 V50" className="stroke-teal" strokeWidth={1.8} />
      </Drawing>
   );
}

/* The fish hanging on a scale, the display lit in teal. */
export function WeightDrawing() {
   return (
      <Drawing label="A drawing: the fish hanging on a scale, the display readable, fish and scale in one frame">
         <path d="M44 3 V8" />
         <rect x="32" y="8" width="24" height="14" rx="1.5" />
         <rect
            x="36"
            y="12"
            width="16"
            height="6"
            className="fill-teal stroke-teal"
            strokeWidth={0.6}
         />
         <path d="M44 22 V26 C44 29 41 29 41 27" />
         <g transform="translate(44 30) rotate(90) scale(0.66)">
            <path d={FISH} />
         </g>
      </Drawing>
   );
}

/* ---- a step ------------------------------------------------------------ */

export function PhotoStep({
   n,
   title,
   guidance,
   drawing,
   done,
   required,
   locked = false,
   lockedText,
   children,
}: {
   n: number;
   title: string;
   guidance: string;
   drawing: ReactNode;
   done: boolean;
   required: boolean;
   locked?: boolean;
   lockedText?: string;
   children: ReactNode;
}) {
   const id = `entry-photo-step-${n}`;
   return (
      <li
         className="flex flex-col gap-3"
         data-entry-step={n}
         data-locked={locked || undefined}
      >
         <div className="flex items-start gap-3.5">
            {/* The number, or a tick once the photograph is in. */}
            <span
               aria-hidden="true"
               className={cn(
                  'grid size-9 shrink-0 place-items-center border transition-colors duration-300 [transition-timing-function:var(--ease)]',
                  done
                     ? 'border-ink bg-ink text-background'
                     : locked
                       ? 'border-line-2 text-ink-3'
                       : 'border-ink text-ink'
               )}
            >
               {done ? (
                  <CheckIcon strokeWidth={2.2} className="size-[18px]" />
               ) : (
                  <span className="g num text-[22px] leading-none">
                     {String(n).padStart(2, '0')}
                  </span>
               )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
               <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <h3
                     id={id}
                     className={cn(
                        'g text-[22px] leading-none',
                        locked && 'text-ink-3'
                     )}
                  >
                     <span className="sr-only">Photo {n}: </span>
                     {title}
                  </h3>
                  <span
                     className={cn(
                        'lab',
                        done
                           ? 'text-ink-2'
                           : required
                             ? 'text-teal-text'
                             : 'text-ink-3'
                     )}
                  >
                     {done ? 'In' : required ? 'Required' : 'Optional'}
                  </span>
               </div>
               <p
                  className={cn(
                     'text-[14px] leading-[1.45]',
                     locked ? 'text-ink-3' : 'text-ink-2'
                  )}
               >
                  {guidance}
               </p>
            </div>
            <span className={cn(locked && 'opacity-50')}>{drawing}</span>
         </div>
         {locked ? (
            <div
               aria-disabled="true"
               className="flex h-[150px] flex-col items-center justify-center gap-2.5 border border-dashed border-line-2 bg-bg-2 text-ink-3"
            >
               <LockClosedIcon
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className="size-6"
               />
               <span className="text-[15px]">{lockedText}</span>
            </div>
         ) : (
            <div className="entry-step-open">{children}</div>
         )}
      </li>
   );
}

/* ---- the pair ---------------------------------------------------------- */

/* What the second step says, by what the competition is judged on. */
function measureGuidance(measure: Competition['measure']) {
   return measure === 'LENGTH'
      ? 'The same fish flat on the tape or board, nose at zero, the figure at the tail readable.'
      : 'The same fish on the scale, the display readable, fish and figure in one frame.';
}

/** The measure photograph as a step of its own; the long form draws it alone. */
export function MeasureStep({
   competition,
   measurePhoto,
   onMeasurePhoto,
   onMeasureBusy,
   onMeasureFile,
   locked = false,
   n = 2,
}: {
   competition: Competition;
   measurePhoto: UploadedPhoto | null;
   onMeasurePhoto: (photo: UploadedPhoto | null) => void;
   onMeasureBusy: (busy: boolean) => void;
   /* The file as picked, for the time the camera wrote in it. */
   onMeasureFile?: (file: File) => void;
   locked?: boolean;
   n?: number;
}) {
   const phone = usePhone();
   const length = competition.measure === 'LENGTH';
   return (
      <PhotoStep
         n={n}
         title="On the measure"
         guidance={measureGuidance(competition.measure)}
         drawing={length ? <LengthDrawing /> : <WeightDrawing />}
         done={measurePhoto !== null}
         required
         locked={locked}
         lockedText="Add the fish photo first."
      >
         <PhotoBlock
            variant="cell"
            idPrefix="measure-photo"
            title={
               phone
                  ? length
                     ? 'Photograph it on the tape'
                     : 'Photograph it on the scale'
                  : length
                    ? 'Choose the tape photo'
                    : 'Choose the scale photo'
            }
            second={phone ? 'Choose one instead' : ''}
            retake
            initial={measurePhoto}
            onChange={onMeasurePhoto}
            onBusyChange={onMeasureBusy}
            onFile={onMeasureFile}
         />
      </PhotoStep>
   );
}

/**
 * Both steps, for the quick log. `fish` is the page's own photo block (it
 * carries the namer's band and the framing tool), drawn as step one.
 */
export function EntryPhotoSteps({
   competition,
   fish,
   fishIn,
   fishDone,
   measurePhoto,
   onMeasurePhoto,
   onMeasureBusy,
   onMeasureFile,
   className,
}: {
   competition: Competition;
   fish: ReactNode;
   /* A fish photo is chosen: step two opens, even while it is still going up. */
   fishIn: boolean;
   /* The fish photo is up. */
   fishDone: boolean;
   measurePhoto: UploadedPhoto | null;
   onMeasurePhoto: (photo: UploadedPhoto | null) => void;
   onMeasureBusy: (busy: boolean) => void;
   onMeasureFile?: (file: File) => void;
   className?: string;
}) {
   const both = needsMeasurePhoto(competition);
   return (
      <ol
         aria-label="The photos for this entry"
         className={cn('flex flex-col gap-7', className)}
      >
         <PhotoStep
            n={1}
            title="The fish"
            guidance="The whole fish, side on, in good light. This is the photo on the board."
            drawing={<FishDrawing />}
            done={fishDone}
            required
         >
            {fish}
         </PhotoStep>
         {both ? (
            <MeasureStep
               competition={competition}
               measurePhoto={measurePhoto}
               onMeasurePhoto={onMeasurePhoto}
               onMeasureBusy={onMeasureBusy}
               onMeasureFile={onMeasureFile}
               locked={!fishIn && !measurePhoto}
            />
         ) : null}
      </ol>
   );
}
