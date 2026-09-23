import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

/*
 * What you can do with a point on the map, as one small menu.
 *
 * The map used to keep three behaviours behind two gestures and a mode: a tap
 * did nothing, a toggle armed the next tap to drop a mark, a press and hold
 * dropped one directly, and "Log here" logged the middle of the view whatever
 * had been tapped. Now a tap on open map asks one question, what do you want
 * to do here, and every answer uses the point that was tapped.
 *
 * A place the search found opens the same menu with its name on it, because
 * the things worth doing with Struisbaai are the things worth doing with any
 * other point.
 *
 * This is only the contents. The map decides where it stands: a popover beside
 * the point on a desktop, the app's sheet on a phone.
 */
export type MapPoint = {
   lat: number;
   lng: number;
   /* A searched place brings its name. A tapped point has only its figures. */
   name?: string | null;
   /* What the place is and where: "Town, Western Cape". */
   where?: string | null;
};

/* Five places is about a metre, which is what the log and the marks keep. */
const pointFigures = (point: { lat: number; lng: number }) =>
   `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;

/*
 * The clipboard API only exists in a secure context, and the app is opened
 * over plain http on a phone on the same network, where it is undefined. The
 * old selection trick still works there.
 */
const copyText = async (text: string) => {
   if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
   }
   const holder = document.createElement('textarea');
   holder.value = text;
   holder.setAttribute('readonly', '');
   holder.style.position = 'fixed';
   holder.style.opacity = '0';
   document.body.appendChild(holder);
   holder.select();
   const done = document.execCommand('copy');
   holder.remove();
   if (!done) throw new Error('copy refused');
};

const row =
   'g-tracked flex min-h-12 w-full items-center px-4 text-left text-[17px] transition-colors duration-150 [transition-timing-function:var(--ease)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal md:min-h-11';

export function PointMenu({
   point,
   onLog,
   onSaveSpot,
   onMark,
   onForecast,
   onClose,
   takeFocus = false,
}: {
   point: MapPoint;
   onLog: () => void;
   /* Resolves once the spot is saved, so the row can say it is working. */
   onSaveSpot: (name: string) => Promise<void>;
   onMark: () => void;
   onForecast: () => void;
   onClose: () => void;
   /*
    * Where the keyboard lands as the menu opens. 'row' puts it on the first
    * row, for a menu a keyboard opened. 'menu' puts it on the list itself,
    * for one a mouse opened: the arrows and Tab still walk straight into the
    * rows, but no ring is drawn round Log a catch here under a pointer that
    * never asked for one, which is what Chrome does with a row focused by
    * script after a click. Nothing, in a sheet, which opens under a thumb.
    */
   takeFocus?: 'row' | 'menu' | false;
}) {
   const id = useId();
   const list = useRef<HTMLUListElement | null>(null);
   const nameField = useRef<HTMLInputElement | null>(null);
   const [naming, setNaming] = useState(false);
   const [spotName, setSpotName] = useState(point.name ?? '');
   const [saving, setSaving] = useState(false);
   const [copied, setCopied] = useState(false);
   const copiedTimer = useRef<number | null>(null);

   const figures = pointFigures(point);

   useEffect(() => {
      if (takeFocus === 'menu') list.current?.focus({ preventScroll: true });
      else if (takeFocus === 'row')
         list.current
            ?.querySelector<HTMLElement>('[role="menuitem"]')
            ?.focus({ preventScroll: true });
   }, [takeFocus]);

   useEffect(() => {
      if (naming) nameField.current?.focus({ preventScroll: true });
   }, [naming]);

   useEffect(
      () => () => {
         if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
      },
      []
   );

   const copy = () => {
      void copyText(figures)
         .then(() => {
            setCopied(true);
            if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
            copiedTimer.current = window.setTimeout(
               () => setCopied(false),
               2000
            );
            toast({ title: 'Copied.', description: figures });
         })
         .catch(() =>
            toast({
               title: 'Could not copy.',
               description: 'Select the figures and copy them by hand.',
               variant: 'error',
            })
         );
   };

   /* Up and down walk the rows, as a menu should. Tab still leaves it. */
   const onMenuKey = (event: KeyboardEvent<HTMLUListElement>) => {
      const items = [
         ...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
            []),
      ];
      if (!items.length) return;
      const at = items.indexOf(document.activeElement as HTMLElement);
      const go = (index: number) => {
         event.preventDefault();
         items[(index + items.length) % items.length]?.focus();
      };
      if (event.key === 'ArrowDown') go(at + 1);
      else if (event.key === 'ArrowUp') go(at < 0 ? items.length - 1 : at - 1);
      else if (event.key === 'Home') go(0);
      else if (event.key === 'End') go(items.length - 1);
   };

   const save = () => {
      const name = spotName.trim();
      if (name.length < 2 || saving) return;
      setSaving(true);
      void onSaveSpot(name).finally(() => setSaving(false));
   };

   return (
      <div className="flex flex-col">
         <div className="px-4 pt-3.5 pb-3">
            <p className="lab">{point.name ? 'Found' : 'Here'}</p>
            {point.name ? (
               <>
                  <h2 className="g mt-1.5 text-[26px] break-words">
                     {point.name}
                  </h2>
                  {point.where ? (
                     <p className="mt-1 text-[14px] text-ink-3">
                        {point.where}
                     </p>
                  ) : null}
               </>
            ) : null}
            <div className="mt-1.5 flex items-center justify-between gap-3">
               <p
                  className={cn(
                     'num select-all',
                     point.name ? 'text-[15px] text-ink-2' : 'text-[19px]'
                  )}
               >
                  {figures}
               </p>
               {/* A small box with a thumb's worth of target around it, so
                   it can sit beside the figures without pushing the rows
                   apart. */}
               <button
                  type="button"
                  onClick={copy}
                  aria-label={
                     copied ? 'Copied the position' : 'Copy the position'
                  }
                  className="g-tracked tap-inline inline-flex h-8 shrink-0 items-center border border-line-2 px-2.5 text-[14px] text-ink transition-colors duration-150 [transition-timing-function:var(--ease)] hover:border-ink"
               >
                  {copied ? 'Copied' : 'Copy'}
               </button>
            </div>
         </div>

         {naming ? (
            <form
               className="border-t border-line px-4 pt-3 pb-4"
               onSubmit={(event) => {
                  event.preventDefault();
                  save();
               }}
            >
               <label htmlFor={`${id}-name`} className="lab">
                  Call it
               </label>
               <input
                  id={`${id}-name`}
                  ref={nameField}
                  value={spotName}
                  maxLength={120}
                  autoComplete="off"
                  onChange={(event) => setSpotName(event.target.value)}
                  placeholder="The ledge below the lighthouse"
                  className="input-line mt-1 text-[16px]"
               />
               <p className="mt-2 text-[14px] text-ink-3">
                  Private to you until you change it on the spot.
               </p>
               <div className="mt-3 flex gap-2">
                  <button
                     type="submit"
                     disabled={saving || spotName.trim().length < 2}
                     className="g-tracked inline-flex min-h-11 flex-1 items-center justify-center bg-teal px-4 text-[16px] text-teal-ink disabled:opacity-60"
                  >
                     {saving ? 'Saving' : 'Save the spot'}
                  </button>
                  <button
                     type="button"
                     onClick={() => setNaming(false)}
                     className="g-tracked inline-flex min-h-11 items-center justify-center border border-line-2 px-4 text-[16px] text-ink hover:border-ink"
                  >
                     Cancel
                  </button>
               </div>
            </form>
         ) : (
            <ul
               ref={list}
               role="menu"
               aria-label="What to do here"
               /* Focusable by script only, so a mouse can hand it the
                  keyboard without a ring; the rows are the tab stops. */
               tabIndex={-1}
               onKeyDown={onMenuKey}
               className="flex flex-col border-t border-line outline-none"
            >
               <li role="none">
                  <button
                     type="button"
                     role="menuitem"
                     onClick={onLog}
                     className={cn(
                        row,
                        'bg-teal text-teal-ink hover:brightness-95 focus-visible:outline-ink'
                     )}
                  >
                     Log a catch here
                  </button>
               </li>
               {(
                  [
                     ['Save as a spot', () => setNaming(true)],
                     ['Drop a private mark', onMark],
                     ['Forecast here', onForecast],
                  ] as [string, () => void][]
               ).map(([label, run]) => (
                  <li key={label} role="none" className="border-t border-line">
                     <button
                        type="button"
                        role="menuitem"
                        onClick={run}
                        className={cn(row, 'text-ink hover:bg-bg-2')}
                     >
                        {label}
                     </button>
                  </li>
               ))}
               <li role="none" className="border-t border-line">
                  <button
                     type="button"
                     role="menuitem"
                     onClick={onClose}
                     className={cn(row, 'text-ink-2 hover:bg-bg-2')}
                  >
                     Close
                  </button>
               </li>
            </ul>
         )}
      </div>
   );
}
