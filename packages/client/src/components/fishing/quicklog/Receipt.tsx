import { useEffect, useState, type ReactNode } from 'react';
import {
   CameraIcon,
   ClockIcon,
   MapPinIcon,
   SignalIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { formatClock, formatCoords } from '@/components/fishing/record/format';
import type { FixStatus } from './useFix';

/*
 * The receipt: when, and where.
 *
 * The time is stamped the moment the log opens and replaced by the shutter
 * time the instant a photograph says otherwise, because the photograph was
 * taken with the fish in hand and the log was opened in the car park. Both
 * can be changed. The position is whichever is best of the photograph's own
 * GPS, the phone's fix, and a pin the angler drops; the line says which.
 */
export type TimeSource = 'clock' | 'photo' | 'typed';

export type Where = {
   latitude: number;
   longitude: number;
   source: 'phone' | 'photo' | 'pin';
   accuracy?: number;
};

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) =>
   `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function Receipt({
   at,
   timeSource,
   onTime,
   where,
   fixStatus,
   pinOpen,
   onTogglePin,
   children,
}: {
   at: Date;
   timeSource: TimeSource;
   onTime: (next: Date) => void;
   where: Where | null;
   fixStatus: FixStatus;
   pinOpen: boolean;
   onTogglePin: () => void;
   /* The map, when the pin is open. */
   children?: ReactNode;
}) {
   const [drawing, setDrawing] = useState(false);
   const [editingTime, setEditingTime] = useState(false);

   useEffect(() => {
      const timer = window.setTimeout(() => setDrawing(true), 300);
      return () => window.clearTimeout(timer);
   }, []);

   const seeking =
      !where && (fixStatus === 'seeking' || fixStatus === 'waiting');

   const timeNote =
      timeSource === 'photo'
         ? 'From the photograph'
         : timeSource === 'typed'
           ? 'Set by you'
           : 'When you tapped Log';

   const whereLine = where
      ? where.source === 'photo'
         ? 'From the photograph'
         : where.source === 'pin'
           ? 'Pin dropped'
           : `Phone fix${where.accuracy ? `, within ${Math.round(where.accuracy)} m` : ''}`
      : fixStatus === 'denied'
        ? 'No position. Location is off for this site.'
        : fixStatus === 'unsupported'
          ? 'No position from this browser.'
          : fixStatus === 'waiting'
            ? 'No fix yet.'
            : 'Getting a fix';

   const WhereIcon =
      where?.source === 'photo'
         ? CameraIcon
         : where?.source === 'pin'
           ? MapPinIcon
           : SignalIcon;

   const action =
      'g-tracked inline-flex h-11 items-center text-[16px] text-teal-text';

   return (
      <div
         aria-live="polite"
         className="flex flex-col rule-dashed-left bg-bg-2 p-3.5 [border-left-width:3px]"
      >
         <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col">
               <span className="g num text-[40px] leading-none">
                  {formatClock(at)}
               </span>
               <span className="mt-1 flex items-center gap-1.5 text-[14px] text-ink-3">
                  {timeSource === 'photo' ? (
                     <CameraIcon className="size-4" aria-hidden="true" />
                  ) : (
                     <ClockIcon className="size-4" aria-hidden="true" />
                  )}
                  {timeNote}
                  {at.toDateString() !== new Date().toDateString()
                     ? `, ${at.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`
                     : ''}
               </span>
            </div>
            <button
               type="button"
               className={action}
               aria-expanded={editingTime}
               onClick={() => setEditingTime((open) => !open)}
            >
               {editingTime ? 'Done' : 'Change'}
            </button>
         </div>

         {editingTime ? (
            <label className="mt-2 flex flex-col">
               <span className="lab">Caught at</span>
               <input
                  type="datetime-local"
                  className="input-line num mt-1.5 text-[16px]"
                  value={toLocalInput(at)}
                  max={toLocalInput(new Date())}
                  onChange={(event) => {
                     const next = new Date(event.target.value);
                     if (!Number.isNaN(next.getTime())) onTime(next);
                  }}
               />
            </label>
         ) : null}

         <span
            className={cn('fixline mt-3', (drawing || !seeking) && 'go')}
            aria-hidden="true"
         />

         <div className="mt-2 flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1.5 text-[15px]">
               <WhereIcon
                  className={cn(
                     'size-4 shrink-0',
                     where ? 'text-ink' : 'text-ink-3'
                  )}
                  aria-hidden="true"
               />
               <span
                  className={cn('truncate', where ? 'text-ink' : 'text-ink-3')}
               >
                  {whereLine}
               </span>
               {where ? (
                  <span className="num hidden text-[13px] text-ink-3 sm:inline">
                     {formatCoords(where.latitude, where.longitude)}
                  </span>
               ) : null}
            </span>
            <button
               type="button"
               className={action}
               aria-expanded={pinOpen}
               onClick={onTogglePin}
            >
               {pinOpen
                  ? 'Done'
                  : where?.source === 'pin'
                    ? 'Move the pin'
                    : 'Drop a pin'}
            </button>
         </div>

         {pinOpen ? <div className="mt-3">{children}</div> : null}
      </div>
   );
}
