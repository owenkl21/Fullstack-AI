import { useMemo, useState, type ReactNode } from 'react';
import { SearchField } from '@/components/fishing/rows/SearchField';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

/*
 * The panel's table.
 *
 * Written by hand against the markup the product already has, rather than
 * pulled from a table library: the three things a library would give here are
 * a comparator, a filter and a slice, and each of those is four lines. What a
 * library would also give is its own idea of a row, a head and a control, and
 * every one of those would have to be argued back into the house language.
 *
 * So: .lab column heads on a hairline rule, .num figures, the product's own
 * search field, and a pager that says where you are rather than a strip of
 * page numbers. Sorting is a button in the head, which is also the only way a
 * keyboard gets at it; aria-sort tells a screen reader what the button did.
 */

export type Column<Row> = {
   key: string;
   head: string;
   /* The figure or word this column sorts, searches and exports on. */
   value: (row: Row) => string | number | null;
   /* What is drawn, when that is not simply the value. */
   cell?: (row: Row) => ReactNode;
   align?: 'left' | 'right';
   /* Tailwind width for the column, so the name column takes what is left. */
   width?: string;
   /* Hidden below the sm breakpoint, for the columns a phone can do without. */
   small?: boolean;
   sortable?: boolean;
};

type Direction = 'asc' | 'desc';

/*
 * Words sort as words and figures as figures. A column of numbers compared as
 * strings puts 100 before 20, which on a leaderboard is not a quirk, it is
 * wrong.
 */
const compare = (a: string | number | null, b: string | number | null) => {
   if (a === null && b === null) return 0;
   /* Nothing sorts last whichever way the column is pointing, because a blank
      is not the smallest value, it is the absence of one. */
   if (a === null) return 1;
   if (b === null) return -1;
   if (typeof a === 'number' && typeof b === 'number') return a - b;
   return String(a).localeCompare(String(b), 'en', { sensitivity: 'base' });
};

/*
 * One field of a CSV row: quoted when it holds anything that would break it,
 * and defused when it starts with something a spreadsheet would run.
 *
 * Every word in these tables was typed by an angler. A display name beginning
 * = + - or @ is a formula the moment this is pasted into Excel or Sheets, and
 * the one person pasting it is the one person who can see everybody's address.
 * A leading apostrophe is the ordinary fix: the spreadsheet eats it and shows
 * the text, and nothing runs.
 */
const csvField = (value: string | number | null) => {
   const raw = value === null ? '' : String(value);
   /* Figures are left alone, so a negative one stays a number in the sheet. */
   const text =
      typeof value === 'string' && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
   return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function AdminTable<Row>({
   caption,
   rows,
   columns,
   rowKey,
   searchLabel = 'Search the table',
   searchPlaceholder = 'Search',
   pageSize = 12,
   csvName,
   empty = 'Nothing here yet.',
   initialSort,
}: {
   /* Names the table for a screen reader, and names the file in the clipboard. */
   caption: string;
   rows: Row[];
   columns: Column<Row>[];
   rowKey: (row: Row) => string;
   searchLabel?: string;
   searchPlaceholder?: string;
   pageSize?: number;
   /* Given, the table offers its rows as CSV for an organiser to paste out. */
   csvName?: string;
   empty?: string;
   initialSort?: { key: string; direction: Direction };
}) {
   const [query, setQuery] = useState('');
   const [sort, setSort] = useState<{ key: string; direction: Direction }>(
      initialSort ?? { key: columns[0]?.key ?? '', direction: 'asc' }
   );
   const [page, setPage] = useState(0);

   const found = useMemo(() => {
      const needle = query.trim().toLowerCase();
      if (!needle) return rows;
      /* Searched across every column's value, so a reader can type a handle, a
         species or a number and find the row without picking a field first. */
      return rows.filter((row) =>
         columns.some((column) =>
            String(column.value(row) ?? '')
               .toLowerCase()
               .includes(needle)
         )
      );
   }, [rows, columns, query]);

   const ordered = useMemo(() => {
      const column = columns.find((c) => c.key === sort.key);
      if (!column) return found;
      /* The direction is turned inside the comparison rather than by reversing
         the finished list, because reversing flips the blanks to the top and
         compare puts them at the bottom on purpose. */
      const way = sort.direction === 'desc' ? -1 : 1;
      return [...found].sort((a, b) => {
         const left = column.value(a);
         const right = column.value(b);
         if (left === null || right === null) return compare(left, right);
         return way * compare(left, right);
      });
   }, [found, columns, sort]);

   const pages = Math.max(1, Math.ceil(ordered.length / pageSize));
   const current = Math.min(page, pages - 1);
   const shown = ordered.slice(current * pageSize, (current + 1) * pageSize);

   const turn = (key: string) => {
      setPage(0);
      /* A new column opens on the order that answers the question: biggest
         first for a figure, A to Z for a name. Which of the two it is can only
         be read off a row, and an empty table has none, so the sample is taken
         carefully rather than by reaching for rows[0] and letting the column's
         own accessor fall over on undefined. */
      const sample = ordered[0] ?? found[0] ?? rows[0];
      const numeric =
         sample !== undefined &&
         typeof columns.find((c) => c.key === key)?.value(sample) === 'number';
      setSort((was) =>
         was.key === key
            ? { key, direction: was.direction === 'asc' ? 'desc' : 'asc' }
            : { key, direction: numeric ? 'desc' : 'asc' }
      );
   };

   const copyCsv = async () => {
      const exported = columns;
      const lines = [
         exported.map((column) => csvField(column.head)).join(','),
         /* Everything the filter kept, in the order on screen, not only the
            page: an organiser copying a table wants the table. */
         ...ordered.map((row) =>
            exported.map((column) => csvField(column.value(row))).join(',')
         ),
      ];
      try {
         await navigator.clipboard.writeText(lines.join('\n'));
         toast({
            title: `${caption} copied as CSV, ${ordered.length} rows.`,
         });
      } catch {
         toast({
            title: 'Could not reach the clipboard.',
            description: 'The browser refused it.',
            variant: 'error',
         });
      }
   };

   return (
      <div className="min-w-0">
         <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <SearchField
               id={`search-${caption.replace(/\W+/g, '-').toLowerCase()}`}
               label={searchLabel}
               placeholder={searchPlaceholder}
               value={query}
               onChange={(next) => {
                  setQuery(next);
                  setPage(0);
               }}
            />
            {csvName ? (
               <button
                  type="button"
                  onClick={copyCsv}
                  className="g-tracked inline-flex h-11 items-center border border-line px-4 text-[15px] text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
               >
                  Copy as CSV
               </button>
            ) : null}
         </div>

         <div className="mt-3 w-full min-w-0 overflow-x-auto">
            <table className="w-full border-collapse text-left">
               <caption className="sr-only">{caption}</caption>
               <thead>
                  <tr className="border-b border-ink">
                     {columns.map((column) => {
                        const sorted = sort.key === column.key;
                        const sortable = column.sortable !== false;
                        return (
                           <th
                              key={column.key}
                              scope="col"
                              aria-sort={
                                 sorted
                                    ? sort.direction === 'asc'
                                       ? 'ascending'
                                       : 'descending'
                                    : 'none'
                              }
                              /* The same right gutter the cells carry. Without
                                 it a right-aligned head's sort caret sat
                                 against the next head and the two read as one
                                 word: "Catches Water". */
                              className={cn(
                                 'lab py-1.5 pr-3 font-normal last:pr-0',
                                 column.width,
                                 column.align === 'right' && 'text-right',
                                 column.small && 'hidden sm:table-cell'
                              )}
                           >
                              {sortable ? (
                                 <button
                                    type="button"
                                    onClick={() => turn(column.key)}
                                    className={cn(
                                       'lab inline-flex min-h-11 items-center gap-1 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
                                       sorted && 'text-ink'
                                    )}
                                 >
                                    {column.head}
                                    {/* The caret only appears on the column
                                        doing the ordering: one on every head
                                        reads as decoration and says nothing. */}
                                    <span aria-hidden="true">
                                       {sorted
                                          ? sort.direction === 'asc'
                                             ? '↑'
                                             : '↓'
                                          : ''}
                                    </span>
                                 </button>
                              ) : (
                                 column.head
                              )}
                           </th>
                        );
                     })}
                  </tr>
               </thead>
               <tbody>
                  {shown.map((row, i) => (
                     <tr
                        key={rowKey(row)}
                        className="fact border-b border-line"
                        style={{ '--i': i } as React.CSSProperties}
                     >
                        {columns.map((column) => (
                           <td
                              key={column.key}
                              className={cn(
                                 'py-2.5 pr-3 text-[15px] last:pr-0',
                                 column.align === 'right' &&
                                    'num text-right whitespace-nowrap',
                                 column.small && 'hidden sm:table-cell'
                              )}
                           >
                              {column.cell
                                 ? column.cell(row)
                                 : (column.value(row) ?? '')}
                           </td>
                        ))}
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         {ordered.length === 0 ? (
            <p className="mt-3 text-[15px] text-ink-2">
               {query ? `Nothing matches "${query.trim()}".` : empty}
            </p>
         ) : null}

         {pages > 1 ? (
            <div className="mt-3 flex items-center justify-between gap-4">
               <p className="num text-[13px] text-ink-3">
                  {current * pageSize + 1} to{' '}
                  {Math.min((current + 1) * pageSize, ordered.length)} of{' '}
                  {ordered.length}
               </p>
               <div className="flex gap-2">
                  <button
                     type="button"
                     onClick={() => setPage((p) => Math.max(0, p - 1))}
                     disabled={current === 0}
                     className="g-tracked inline-flex h-11 min-w-11 items-center justify-center border border-line px-3 text-[15px] text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-2"
                  >
                     Back
                  </button>
                  <button
                     type="button"
                     onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                     disabled={current >= pages - 1}
                     className="g-tracked inline-flex h-11 min-w-11 items-center justify-center border border-line px-3 text-[15px] text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-2"
                  >
                     Next
                  </button>
               </div>
            </div>
         ) : null}
      </div>
   );
}
