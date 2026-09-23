import { useEffect, useState, type ReactNode } from 'react';
import {
   CameraIcon,
   ClockIcon,
   MapPinIcon,
   SignalIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { formatClock, formatCoords } from '@/components/fishing/record/format';
import { DateTimeField } from '@/components/ui/date-time-field';
import { fromLocalValue, toLocalValue } from '@/lib/local-time';
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
   /*
    * Four answers, best last. The map's own point is where the map was
    * looking when the log was opened from it: a guess at the water, not a
    * fix, so a photograph's GPS overtakes it. Only a pin the angler put down
    * by hand holds against the photograph.
    */
   source: 'phone' | 'photo' | 'pin' | 'map';
   accuracy?: number;
};

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
           : where.source === 'map'
             ? 'From the map'
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
         : where?.source === 'pin' || where?.source === 'map'
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
            <DateTimeField
               className="mt-2"
               label="Caught at"
               value={toLocalValue(at)}
               max={toLocalValue(new Date())}
               onChange={(value) => {
                  /* A half filled field reports empty and a year still being
                     typed reads as none; the time stands until there is a
                     whole one to replace it with. */
                  const next = fromLocalValue(value);
                  if (next) onTime(next);
               }}
            />
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
