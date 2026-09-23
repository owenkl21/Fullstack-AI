import {
   MagnifyingGlassIcon,
   MapPinIcon,
   XMarkIcon,
} from '@heroicons/react/24/outline';
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
   searchButton = false,
   clearable = false,
   onClear,
   placeholder = 'A beach, a town, a headland',
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
   /**
    * Make the magnifier the button it looks like. The field searches as you
    * type, but a reader who clicks the glass is asking for the search to
    * happen, and a drawing that does nothing taught one of them that the
    * search was broken. Pressed, it takes the first result, as Enter does,
    * and waits for one if the answer is still on its way. Off by default, so
    * a field inside somebody else's form keeps its Enter.
    */
   searchButton?: boolean;
   /** A cross that empties the field, at a size a thumb can hit. */
   clearable?: boolean;
   /** After the field is emptied, for a page with a pin to take down. */
   onClear?: () => void;
   /** What the empty field says, for a form that asks the question its own way. */
   placeholder?: string;
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
   /* Counted up to ask the same question again after the search failed. */
   const [attempt, setAttempt] = useState(0);
   /* The question that was submitted before its answer was in. A ref, since
      nothing is drawn from it: it is set by a press and read when the answer
      lands. */
   const wanted = useRef<string | null>(null);
   const box = useRef<HTMLDivElement>(null);

   /* The field's ref belongs to the page, so the field is found through the
      box around it when this component needs to put the caret back in it. */
   const focusField = () => box.current?.querySelector('input')?.focus();

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
   /* The same for picking, so an answer that lands after a submit is taken
      with the `choose` of the render it lands in. */
   const chooseRef = useRef<(place: PlaceHit) => void>(() => undefined);

   useEffect(() => {
      if (direct || q.length < 2) return;

      const controller = new AbortController();
      let live = true;
      const timer = window.setTimeout(() => {
         searchPlaces(q, controller.signal, nearRef.current)
            .then((found) => {
               if (!live) return;
               const rows = tidy(found);
               setAnswer({ asked: q, hits: rows, failed: false });
               /* Submitted while this was on its way: the first result is
                  the one Enter would have taken. */
               if (wanted.current === q && rows[0]) chooseRef.current(rows[0]);
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
   }, [q, nearKey, direct, attempt]);

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
      wanted.current = null;
   };
   useEffect(() => {
      chooseRef.current = choose;
   });

   /*
    * The magnifier, and Enter where the list is not up. With results it takes
    * the one that is lit. With the answer still on its way it remembers the
    * question and takes the first result when it lands. With nothing typed or
    * nothing found it opens the list again, which is where the field says so.
    */
   const submit = () => {
      focusField();
      setShut(false);
      if (q.length < 2) return;
      const hit = hits[at];
      if (hit) choose(hit);
      else if (failed) {
         /* The list says "Try again", and the glass is how to: the same
            question is asked again and its first answer taken. */
         wanted.current = q;
         setAnswer({ asked: '', hits: [], failed: false });
         setAttempt((count) => count + 1);
      } else if (working) wanted.current = q;
   };

   const clear = () => {
      setQuery('');
      setShut(true);
      setActive(0);
      wanted.current = null;
      onClear?.();
      focusField();
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
            {searchButton ? null : (
               <MagnifyingGlassIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-3"
               />
            )}
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
               placeholder={placeholder}
               onChange={(event) => {
                  setQuery(event.target.value);
                  setShut(false);
                  setActive(0);
                  /* The question moved on, so an old submit is not about
                     this one. */
                  wanted.current = null;
                  /* Emptied by any means, the browser's own clear included:
                     a pin that answered a question should go with it. */
                  if (query && !event.target.value) onClear?.();
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
                     /* One layer at a time. With the list up, Escape shuts
                        the list and nothing else: not the sheet this field
                        may stand in, and not the text, which Chrome empties
                        from a search field on its own. With the list down
                        it falls through to whatever holds the field. */
                     if (open) event.preventDefault();
                     setShut(true);
                     wanted.current = null;
                     return;
                  }
                  /* Enter with no list to choose from is the magnifier. */
                  if (
                     searchButton &&
                     event.key === 'Enter' &&
                     (!open || !hits.length)
                  ) {
                     event.preventDefault();
                     submit();
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
               className={cn(
                  'input-line h-11 text-[16px]',
                  searchButton ? '!pl-11' : '!pl-10',
                  /* The field's own cross, in place of the browser's small
                     one, which only some browsers draw at all. */
                  clearable && '!pr-11 [&::-webkit-search-cancel-button]:hidden'
               )}
            />

            {/* After the field in the document, so Tab reaches the field
                first and then the two controls drawn inside it. */}
            {searchButton ? (
               <button
                  type="button"
                  onClick={submit}
                  aria-label={working ? 'Searching' : 'Search'}
                  className={cn(
                     /* Darker once there is something to search for, so it
                        reads as the thing to press rather than a drawing. */
                     q.length >= 2 ? 'text-ink' : 'text-ink-3',
                     'absolute top-0 left-0 grid size-11 place-items-center transition-colors duration-150 [transition-timing-function:var(--ease)] hover:text-ink focus-visible:text-ink focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-teal'
                  )}
               >
                  <MagnifyingGlassIcon
                     aria-hidden="true"
                     className={cn(
                        'size-[18px]',
                        /* The glass breathes while the answer is on its way. */
                        working && 'animate-pulse motion-reduce:animate-none'
                     )}
                  />
               </button>
            ) : null}
            {clearable && query ? (
               <button
                  type="button"
                  onClick={clear}
                  aria-label="Clear the search"
                  className="absolute top-0 right-0 grid size-11 place-items-center text-ink-3 transition-colors duration-150 [transition-timing-function:var(--ease)] hover:text-ink focus-visible:text-ink focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-teal"
               >
                  <XMarkIcon aria-hidden="true" className="size-5" />
               </button>
            ) : null}

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
