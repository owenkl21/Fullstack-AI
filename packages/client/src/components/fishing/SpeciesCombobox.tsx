import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { cn } from '@/lib/utils';
import {
   NOT_SURE,
   type Species,
   speciesKey,
} from '@/components/fishing/quicklog/species';

/*
 * The fish, from one list.
 *
 * A search box over every species the product knows, the ones this angler
 * logs first. A name that is not there can be added from the same box, and
 * the server checks it against what it has however it is spelt, so "Dusky
 * Kob" and "duskykob" stay one row. "Not sure" is always at the bottom.
 */
export function SpeciesCombobox({
   value,
   onChange,
   species,
   recent = [],
   onCreated,
   label = 'Species',
   error,
   placeholder = 'Search or add a species',
   inputRef,
}: {
   value: string;
   onChange: (name: string) => void;
   species: Species[];
   recent?: string[];
   onCreated?: (made: Species) => void;
   label?: string;
   error?: string | null;
   placeholder?: string;
   inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
   const id = useId();
   const [query, setQuery] = useState('');
   const [open, setOpen] = useState(false);
   const [active, setActive] = useState(0);
   const [adding, setAdding] = useState(false);
   const [problem, setProblem] = useState<string | null>(null);
   const box = useRef<HTMLDivElement>(null);
   const ownRef = useRef<HTMLInputElement>(null);
   const input = inputRef ?? ownRef;

   const q = query.trim();
   const k = speciesKey(q);

   const options = useMemo(() => {
      const recentKeys = new Set(recent.map(speciesKey));
      const byRecent = (a: Species, b: Species) => {
         const ra = recentKeys.has(speciesKey(a.commonName)) ? 0 : 1;
         const rb = recentKeys.has(speciesKey(b.commonName)) ? 0 : 1;
         return ra - rb || a.commonName.localeCompare(b.commonName);
      };
      if (!k) return [...species].sort(byRecent).slice(0, 12);
      const hit = (s: Species) =>
         speciesKey(s.commonName).includes(k) ||
         speciesKey(s.scientificName ?? '').includes(k) ||
         (s.aliases ?? []).some((a) => speciesKey(a).includes(k));
      return species.filter(hit).sort(byRecent).slice(0, 12);
   }, [species, recent, k]);

   const exact = species.find(
      (s) =>
         speciesKey(s.commonName) === k ||
         (s.aliases ?? []).some((a) => speciesKey(a) === k)
   );
   const canAdd = q.length >= 2 && !exact && !adding;

   /* Everything the list can hold, in order: matches, Add, Not sure. */
   const rows = [
      ...options.map((s) => ({ kind: 'pick' as const, species: s })),
      ...(canAdd ? [{ kind: 'add' as const }] : []),
      { kind: 'unsure' as const },
   ];

   useEffect(() => {
      if (!open) return;
      const away = (event: MouseEvent) => {
         if (!box.current?.contains(event.target as Node)) setOpen(false);
      };
      document.addEventListener('mousedown', away);
      return () => document.removeEventListener('mousedown', away);
   }, [open]);

   const pick = (name: string) => {
      onChange(name);
      setQuery('');
      setOpen(false);
      setProblem(null);
   };

   const add = async () => {
      if (!canAdd) return;
      setAdding(true);
      setProblem(null);
      try {
         const { data } = await axios.post<{
            species: Species;
            created: boolean;
         }>('/api/species', { name: q });
         if (data.created) onCreated?.(data.species);
         pick(data.species.commonName);
      } catch {
         setProblem('Could not add that species. Try again.');
      } finally {
         setAdding(false);
      }
   };

   const choose = (row: (typeof rows)[number]) => {
      if (row.kind === 'pick') pick(row.species.commonName);
      else if (row.kind === 'add') void add();
      else pick(NOT_SURE);
   };

   const listId = `${id}-list`;

   return (
      <div ref={box} className="relative flex flex-col gap-2">
         {label ? (
            <label htmlFor={id} className="lab">
               {label}
            </label>
         ) : (
            <label htmlFor={id} className="sr-only">
               Species
            </label>
         )}
         {value && !open ? (
            <div className="flex items-center justify-between gap-3 border border-ink px-3 py-2">
               <span className="g-tracked text-[21px]">{value}</span>
               <button
                  type="button"
                  onClick={() => {
                     setOpen(true);
                     requestAnimationFrame(() => input.current?.focus());
                  }}
                  className="g-tracked text-[15px] text-teal-text hover:opacity-80"
               >
                  Change
               </button>
            </div>
         ) : null}
         <div className={cn('relative', value && !open && 'hidden')}>
            <MagnifyingGlassIcon
               aria-hidden="true"
               className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-ink-3"
            />
            <input
               ref={input}
               id={id}
               type="search"
               role="combobox"
               aria-expanded={open}
               aria-controls={listId}
               aria-autocomplete="list"
               autoComplete="off"
               value={query}
               placeholder={placeholder}
               onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                  setOpen(true);
               }}
               onFocus={() => setOpen(true)}
               onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                     event.preventDefault();
                     setOpen(true);
                     setActive((i) => Math.min(i + 1, rows.length - 1));
                  } else if (event.key === 'ArrowUp') {
                     event.preventDefault();
                     setActive((i) => Math.max(i - 1, 0));
                  } else if (event.key === 'Enter') {
                     event.preventDefault();
                     const row = rows[active];
                     if (row) choose(row);
                  } else if (event.key === 'Escape') {
                     setOpen(false);
                  }
               }}
               className="input-line h-12 w-full !pl-10 text-[16px]"
               aria-invalid={error ? true : undefined}
            />
            {open ? (
               <ul
                  id={listId}
                  role="listbox"
                  className="blk absolute right-0 left-0 z-40 mt-1 max-h-72 overflow-y-auto border border-line py-1"
               >
                  {rows.map((row, index) => {
                     const on = index === active;
                     const base = cn(
                        'flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left',
                        on ? 'bg-ink text-background' : 'text-ink'
                     );
                     const key =
                        row.kind === 'pick'
                           ? row.species.id
                           : row.kind === 'add'
                             ? 'add'
                             : 'unsure';
                     return (
                        <li
                           key={key}
                           role="option"
                           aria-selected={on}
                           onMouseEnter={() => setActive(index)}
                           onMouseDown={(event) => {
                              event.preventDefault();
                              choose(row);
                           }}
                           className={base}
                        >
                           {row.kind === 'pick' ? (
                              <>
                                 <span className="g-tracked text-[17px]">
                                    {row.species.commonName}
                                 </span>
                                 {row.species.scientificName ? (
                                    <span
                                       className={cn(
                                          'truncate text-[13px] italic',
                                          on
                                             ? 'text-background/80'
                                             : 'text-ink-3'
                                       )}
                                    >
                                       {row.species.scientificName}
                                    </span>
                                 ) : null}
                              </>
                           ) : row.kind === 'add' ? (
                              <span className="inline-flex items-center gap-2 text-[15px]">
                                 <PlusIcon
                                    aria-hidden="true"
                                    className="size-4"
                                 />
                                 {adding ? 'Adding' : `Add "${q}"`}
                              </span>
                           ) : (
                              <span className="g-tracked text-[17px]">
                                 {NOT_SURE}
                              </span>
                           )}
                        </li>
                     );
                  })}
               </ul>
            ) : null}
         </div>
         {error ? (
            <p className="text-[15px] text-destructive">{error}</p>
         ) : null}
         {problem ? (
            <p className="text-[15px] text-destructive">{problem}</p>
         ) : null}
      </div>
   );
}
