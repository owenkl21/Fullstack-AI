import { MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { searchPlaces, type PlaceHit } from './forecast-api';

/*
 * A place, by name.
 *
 * Typing "Kommetjie" should land on Kommetjie, not on a form. So the field
 * looks things up as you type, after a short pause, and offers the few places
 * that match with their province beside them, because there is more than one
 * Melkbos and the wrong one is a long drive.
 */
export function PlaceSearch({
   onPick,
   onUseMine,
   locating = false,
   className,
}: {
   onPick: (place: PlaceHit) => void;
   onUseMine: () => void;
   locating?: boolean;
   className?: string;
}) {
   const id = useId();
   const [query, setQuery] = useState('');
   const [hits, setHits] = useState<PlaceHit[]>([]);
   const [open, setOpen] = useState(false);
   const [active, setActive] = useState(0);
   const [searching, setSearching] = useState(false);
   const box = useRef<HTMLDivElement>(null);

   useEffect(() => {
      const q = query.trim();
      if (q.length < 2) {
         setHits([]);
         setSearching(false);
         return;
      }

      const controller = new AbortController();
      setSearching(true);
      const timer = window.setTimeout(() => {
         searchPlaces(q, controller.signal)
            .then((found) => {
               setHits(found);
               setActive(0);
               setOpen(true);
            })
            .catch((error) => {
               if (!axios.isCancel(error)) setHits([]);
            })
            .finally(() => setSearching(false));
      }, 280);

      return () => {
         window.clearTimeout(timer);
         controller.abort();
      };
   }, [query]);

   /* A click anywhere else closes the list. */
   useEffect(() => {
      if (!open) return;
      const away = (event: MouseEvent) => {
         if (!box.current?.contains(event.target as Node)) setOpen(false);
      };
      document.addEventListener('mousedown', away);
      return () => document.removeEventListener('mousedown', away);
   }, [open]);

   const choose = (place: PlaceHit) => {
      onPick(place);
      setQuery('');
      setHits([]);
      setOpen(false);
   };

   const listId = `${id}-list`;

   return (
      <div className={cn('flex flex-wrap items-start gap-3', className)}>
         <div ref={box} className="relative w-full max-w-[420px] min-w-[240px]">
            <label htmlFor={id} className="sr-only">
               Search for a place
            </label>
            <MagnifyingGlassIcon
               aria-hidden="true"
               className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-3"
            />
            <input
               id={id}
               type="search"
               role="combobox"
               aria-expanded={open && hits.length > 0}
               aria-controls={listId}
               aria-autocomplete="list"
               aria-activedescendant={
                  open && hits[active]
                     ? `${listId}-${hits[active].id}`
                     : undefined
               }
               autoComplete="off"
               value={query}
               placeholder="A beach, a town, a headland"
               onChange={(event) => setQuery(event.target.value)}
               onFocus={() => hits.length && setOpen(true)}
               onKeyDown={(event) => {
                  if (!open || !hits.length) return;
                  if (event.key === 'ArrowDown') {
                     event.preventDefault();
                     setActive((i) => Math.min(i + 1, hits.length - 1));
                  } else if (event.key === 'ArrowUp') {
                     event.preventDefault();
                     setActive((i) => Math.max(i - 1, 0));
                  } else if (event.key === 'Enter') {
                     event.preventDefault();
                     const hit = hits[active];
                     if (hit) choose(hit);
                  } else if (event.key === 'Escape') {
                     setOpen(false);
                  }
               }}
               className="input-line h-11 !pl-10 text-[16px]"
            />

            {open && (hits.length > 0 || searching) ? (
               <ul
                  id={listId}
                  role="listbox"
                  className="blk absolute right-0 left-0 z-40 mt-1 max-h-72 overflow-y-auto border border-line py-1"
               >
                  {hits.map((hit, index) => (
                     <li
                        key={hit.id}
                        id={`${listId}-${hit.id}`}
                        role="option"
                        aria-selected={index === active}
                        onMouseEnter={() => setActive(index)}
                        onMouseDown={(event) => {
                           event.preventDefault();
                           choose(hit);
                        }}
                        className={cn(
                           'flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2',
                           index === active
                              ? 'bg-ink text-background'
                              : 'text-ink'
                        )}
                     >
                        <span className="g-tracked text-[17px]">
                           {hit.name}
                        </span>
                        <span
                           className={cn(
                              'truncate text-[14px]',
                              index === active
                                 ? 'text-background/80'
                                 : 'text-ink-3'
                           )}
                        >
                           {[hit.region, hit.country]
                              .filter(Boolean)
                              .join(', ')}
                        </span>
                     </li>
                  ))}
                  {searching && !hits.length ? (
                     <li className="px-3 py-2 text-[14px] text-ink-3">
                        Looking
                     </li>
                  ) : null}
               </ul>
            ) : null}
         </div>

         <Button
            type="button"
            variant="outline"
            onClick={onUseMine}
            disabled={locating}
            className="h-11"
         >
            <MapPinIcon aria-hidden="true" />
            {locating ? 'Finding you' : 'Where I am'}
         </Button>
      </div>
   );
}
