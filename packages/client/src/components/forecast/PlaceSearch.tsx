import { MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { useEffect, useId, useMemo, useRef, useState, type Ref } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
   describePlace,
   formatCoordinate,
   parseGoogleMapsCoordinates,
   readPair,
} from '@/lib/maps';
import { searchPlaces, type PlaceHit } from './forecast-api';

/*
 * A place, by name, by its figures, or by a link.
 *
 * Typing "Kommetjie" should land on Kommetjie, not on a form. So the field
 * looks things up as you type, after a short pause, and offers the few places
 * that match with their province under them, because there is more than one
 * Melkbos and the wrong one is a long drive.
 *
 * A pair of coordinates and a link copied from Maps are read here rather than
 * sent anywhere. "-34.1275, 18.4487" used to go to the geocoder as prose and
 * come back as a restaurant in Kalk Bay, and a pasted link came back with
 * nothing at all and said nothing about it.
 */

/* A position typed or pasted is a result like any other, named by its figures. */
const atPosition = (lat: number, lng: number): PlaceHit => ({
   id: `at:${lat.toFixed(5)},${lng.toFixed(5)}`,
   name: `${formatCoordinate(lat)}, ${formatCoordinate(lng)}`,
   region: null,
   country: null,
   latitude: lat,
   longitude: lng,
   kind: 'A position',
});

/*
 * A link, rather than anything with two numbers in it. The link parser's last
 * pattern matches any "5, 6" inside a string, so "Shop 5, 6th Avenue" would
 * otherwise become a position in the Gulf of Guinea.
 */
const LINK = /^(https?:\/\/|www\.)|maps\.app|goo\.gl|google\.[a-z.]+\/maps/i;

/** A pair of figures or a Maps link, read without asking the server. */
const readDirect = (text: string): PlaceHit | null => {
   const pair = readPair(text);
   if (pair) return atPosition(pair.lat, pair.lng);
   if (!LINK.test(text.trim())) return null;
   const link = parseGoogleMapsCoordinates(text);
   if (link) return atPosition(link.parsedLatitude, link.parsedLongitude);
   return null;
};

/*
 * Two rows for one place, and the same place twice, are both noise.
 *
 * The order is the server's, which already ranks against where the map is
 * looking. Sorting the answer by distance again here is what put "Kalk Bay
 * Theatre" above Kalk Bay and a river in the Northern Cape above the Vaal Dam.
 */
const tidy = (rows: PlaceHit[]) => {
   const kept: PlaceHit[] = [];
   const seen = new Set<string>();
   const names = new Set<string>();
   for (const row of rows) {
      const where = describePlace(row);
      const line = `${row.name}|${where}`;
      const spot = `${row.latitude.toFixed(4)},${row.longitude.toFixed(4)}`;
      if (seen.has(line) || seen.has(spot)) continue;
      /* A row with nothing to say about itself, under a name already on the
         list, is the same place again: the bus stop beside the suburb. */
      if (!where && names.has(row.name)) continue;
      seen.add(line);
      seen.add(spot);
      names.add(row.name);
      kept.push(row);
   }
   return kept;
};

export function PlaceSearch({
   onPick,
   onUseMine,
   locating = false,
   showMine = true,
   near = null,
   keepQuery = false,
   inputRef,
   className,
}: {
   onPick: (place: PlaceHit) => void;
   onUseMine: () => void;
   locating?: boolean;
   /** Off where the page already has its own way of going to the angler. */
   showMine?: boolean;
   /* Where the reader is, or is looking: of two Kommetjies, the near one first. */
   near?: { latitude: number; longitude: number } | null;
   /**
    * Leave what was asked in the field after a pick. The map keeps it, because
    * the pin standing on the water is the answer to a question that should
    * still be on the screen; the forecast clears it, because the page itself
    * changes to the place.
    */
   keepQuery?: boolean;
   /** So a page can send the reader here, from an empty map for instance. */
   inputRef?: Ref<HTMLInputElement>;
   className?: string;
}) {
   const id = useId();
   const [query, setQuery] = useState('');
   const [answer, setAnswer] = useState<{
      /* The question this answer belongs to, so a stale one never shows. */
      asked: string;
      hits: PlaceHit[];
      failed: boolean;
   }>({ asked: '', hits: [], failed: false });
   const [shut, setShut] = useState(false);
   const [active, setActive] = useState(0);
   const box = useRef<HTMLDivElement>(null);

   const q = query.trim();
   const direct = useMemo(() => (q.length > 3 ? readDirect(q) : null), [q]);

   /* The near-enough centre, as a string, so panning the map a hundred metres
      does not fire the search again. */
   const nearKey = near
      ? `${near.latitude.toFixed(2)},${near.longitude.toFixed(2)}`
      : '';
   const nearRef = useRef(near);
   /* Kept in a ref, and kept current by an effect of its own, so the search
      below can read where the map is looking without asking again when it
      shifts a hundred metres. */
   useEffect(() => {
      nearRef.current = near;
   }, [near]);

   useEffect(() => {
      if (direct || q.length < 2) return;

      const controller = new AbortController();
      let live = true;
      const timer = window.setTimeout(() => {
         searchPlaces(q, controller.signal, nearRef.current)
            .then((found) => {
               if (live)
                  setAnswer({
                     asked: q,
                     hits: tidy(found),
                     failed: false,
                  });
            })
            .catch((error) => {
               if (live && !axios.isCancel(error))
                  setAnswer({ asked: q, hits: [], failed: true });
            });
      }, 280);

      return () => {
         live = false;
         window.clearTimeout(timer);
         controller.abort();
      };
   }, [q, nearKey, direct]);

   /* A click anywhere else closes the list. */
   useEffect(() => {
      const away = (event: MouseEvent) => {
         if (!box.current?.contains(event.target as Node)) setShut(true);
      };
      document.addEventListener('mousedown', away);
      return () => document.removeEventListener('mousedown', away);
   }, []);

   const answered = answer.asked === q;
   const hits = direct ? [direct] : answered ? answer.hits : [];
   const working = !direct && q.length >= 2 && !answered;
   const failed = !direct && answered && answer.failed;
   const nothing = !direct && answered && !answer.failed && hits.length === 0;
   const at = Math.min(active, Math.max(hits.length - 1, 0));
   const open =
      !shut &&
      q.length >= 2 &&
      (hits.length > 0 || working || failed || nothing);

   const choose = (place: PlaceHit) => {
      onPick(place);
      if (!keepQuery) setQuery('');
      setShut(true);
      setActive(0);
   };

   const listId = `${id}-list`;

   /*
    * The field and the locate control share one row on a phone. Two rows for
    * two controls is forty four pixels of a screen that has a week of weather
    * to fit in, so the control loses its words and keeps its mark: a square
    * the size of a thumb, named for anyone listening. On a desk it is the
    * worded button it has always been, and there the word stands alone,
    * because a mark beside a label is two names for one thing.
    */
   return (
      <div className={cn('flex items-start gap-2', className)}>
         <div ref={box} className="relative min-w-0 flex-1 md:max-w-[420px]">
            <label htmlFor={id} className="sr-only">
               Search for a place
            </label>
            <MagnifyingGlassIcon
               aria-hidden="true"
               className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-3"
            />
            <input
               id={id}
               ref={inputRef}
               type="search"
               role="combobox"
               aria-expanded={open && hits.length > 0}
               aria-controls={listId}
               aria-autocomplete="list"
               aria-activedescendant={
                  open && hits[at] ? `${listId}-${hits[at].id}` : undefined
               }
               autoComplete="off"
               value={query}
               placeholder="A beach, a town, a headland"
               onChange={(event) => {
                  setQuery(event.target.value);
                  setShut(false);
                  setActive(0);
               }}
               onPaste={(event) => {
                  /* A link or a pair goes straight to the pin, the way the
                     log's picker has always handled a paste. */
                  const pasted = event.clipboardData.getData('text');
                  const found = pasted ? readDirect(pasted) : null;
                  if (!found) return;
                  event.preventDefault();
                  setQuery(keepQuery ? pasted : '');
                  setShut(true);
                  onPick(found);
               }}
               onFocus={() => setShut(false)}
               onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                     setShut(true);
                     return;
                  }
                  if (!open || !hits.length) return;
                  if (event.key === 'ArrowDown') {
                     event.preventDefault();
                     setActive(Math.min(at + 1, hits.length - 1));
                  } else if (event.key === 'ArrowUp') {
                     event.preventDefault();
                     setActive(Math.max(at - 1, 0));
                  } else if (event.key === 'Enter') {
                     event.preventDefault();
                     const hit = hits[at];
                     if (hit) choose(hit);
                  }
               }}
               className="input-line h-11 !pl-10 text-[16px]"
            />

            {open ? (
               <ul
                  id={listId}
                  role="listbox"
                  className="blk absolute right-0 left-0 z-40 mt-1 max-h-72 overflow-y-auto border border-line py-1"
               >
                  {hits.map((hit, index) => {
                     const where = describePlace(hit);
                     return (
                        <li
                           key={hit.id}
                           id={`${listId}-${hit.id}`}
                           role="option"
                           aria-selected={index === at}
                           onMouseEnter={() => setActive(index)}
                           onMouseDown={(event) => {
                              event.preventDefault();
                              choose(hit);
                           }}
                           onTouchEnd={(event) => {
                              event.preventDefault();
                              choose(hit);
                           }}
                           className={cn(
                              'flex min-h-11 cursor-pointer flex-col justify-center px-3 py-2',
                              index === at
                                 ? 'bg-ink text-background'
                                 : 'text-ink'
                           )}
                        >
                           <span
                              className={cn(
                                 'truncate text-[17px]',
                                 hit.id.startsWith('at:') ? 'num' : 'g-tracked'
                              )}
                           >
                              {hit.name}
                           </span>
                           {where ? (
                              <span
                                 className={cn(
                                    'truncate text-[14px]',
                                    index === at
                                       ? 'text-background/80'
                                       : 'text-ink-3'
                                 )}
                              >
                                 {where}
                              </span>
                           ) : null}
                        </li>
                     );
                  })}
                  {working ? (
                     <li className="px-3 py-2 text-[14px] text-ink-3">
                        Looking
                     </li>
                  ) : null}
                  {nothing ? (
                     <li className="px-3 py-2 text-[14px] text-ink-2">
                        Nothing by that name. Try the nearest town.
                     </li>
                  ) : null}
                  {failed ? (
                     <li className="px-3 py-2 text-[14px] text-ink-2">
                        The search did not answer. Try again.
                     </li>
                  ) : null}
               </ul>
            ) : null}
         </div>

         {showMine ? (
            <>
               <button
                  type="button"
                  onClick={onUseMine}
                  disabled={locating}
                  aria-label={locating ? 'Finding you' : 'Where I am'}
                  className="flex size-11 shrink-0 items-center justify-center border border-line-2 text-ink transition-colors duration-150 [transition-timing-function:var(--ease)] hover:border-ink disabled:opacity-60 md:hidden"
               >
                  <MapPinIcon aria-hidden="true" className="size-5" />
               </button>
               <Button
                  type="button"
                  variant="outline"
                  onClick={onUseMine}
                  disabled={locating}
                  className="hidden h-11 md:inline-flex"
               >
                  {locating ? 'Finding you' : 'Where I am'}
               </Button>
            </>
         ) : null}
      </div>
   );
}
