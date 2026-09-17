import type { CatchSummary } from '@/components/fishing/record/api';
import {
   formatClock,
   formatDay,
   formatMonthYear,
   monthKey,
   monthLabel,
   plural,
   toDate,
} from '@/components/fishing/record/format';

/*
 * What the home screen is allowed to say. Every sentence here is counted off the
 * angler's own catches: no estimate, no invented fact, and nothing at all when
 * there is nothing true to say yet.
 */

export type LogSentence = {
   text: string;
   link: { to: string; label: string } | null;
};

const newestFirst = (a: CatchSummary, b: CatchSummary) =>
   new Date(b.caughtAt).getTime() - new Date(a.caughtAt).getTime();

export function sortByNewest(catches: CatchSummary[]) {
   return [...catches].sort(newestFirst);
}

export function logSentence(catches: CatchSummary[]): LogSentence | null {
   const sorted = sortByNewest(catches);
   const recent = sorted[0];
   if (!recent) {
      return null;
   }

   const spot = recent.site;
   if (spot) {
      const here = sorted.filter((entry) => entry.site?.id === spot.id);
      const minutes = here
         .map((entry) => toDate(entry.caughtAt))
         .filter((date): date is Date => date !== null)
         .map((date) => ({
            date,
            minute: date.getHours() * 60 + date.getMinutes(),
         }));

      if (here.length > 1 && minutes.length > 1) {
         const earliest = minutes.reduce((low, item) =>
            item.minute < low.minute ? item : low
         );
         const latest = minutes.reduce((high, item) =>
            item.minute > high.minute ? item : high
         );
         const window =
            earliest.minute === latest.minute
               ? `all at ${formatClock(earliest.date)}`
               : `all between ${formatClock(earliest.date)} and ${formatClock(latest.date)}`;
         return {
            text: `${plural(here.length, 'catch', 'catches')} at ${spot.name}, ${window}.`,
            link: { to: `/sites/${spot.id}`, label: `Open ${spot.name}` },
         };
      }

      return {
         text: `Your only catch at ${spot.name} came at ${formatClock(recent.caughtAt)} on ${formatDay(
            recent.caughtAt
         )}.`,
         link: { to: `/sites/${spot.id}`, label: `Open ${spot.name}` },
      };
   }

   const oldest = sorted[sorted.length - 1];
   const since = formatMonthYear(oldest.caughtAt);
   return {
      text: since
         ? `You have logged ${plural(sorted.length, 'catch', 'catches')} since ${since}, none of them at a saved spot.`
         : `You have logged ${plural(sorted.length, 'catch', 'catches')}, none of them at a saved spot.`,
      link: { to: '/catches/me', label: 'See all your catches' },
   };
}

export type SeasonItem =
   | { kind: 'month'; key: string; label: string }
   | {
        kind: 'catch';
        key: string;
        /* The best fish of that day, which is what the tile opens and shows. */
        entry: CatchSummary;
        height: number;
        /* False when the fish was never measured, so the strip can say so
         * rather than drawing a bar that stands for a length nobody took. */
        measured: boolean;
        /* How many fish came out that day. One is the quiet case. */
        count: number;
     };

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const MIN_TILE = 88;
const MAX_TILE = 178;

/**
 * The last twelve months, oldest first: a tile per catch scaled to its length, a
 * month label where the month turns over. Blank trips are not kept yet, so the
 * strip has nothing to say about the empty mornings.
 */
// TODO(api): appendix E, blank trips are not stored, so the strip cannot mark them.
export function seasonItems(catches: CatchSummary[]): SeasonItem[] {
   const cutoff = Date.now() - YEAR_MS;
   const season = sortByNewest(catches)
      .filter((entry) => new Date(entry.caughtAt).getTime() >= cutoff)
      .slice(0, 40)
      .reverse();

   if (season.length === 0) {
      return [];
   }

   const lengths = season
      .map((entry) => entry.length)
      .filter((value): value is number => typeof value === 'number');
   const shortest = lengths.length > 0 ? Math.min(...lengths) : null;
   const longest = lengths.length > 0 ? Math.max(...lengths) : null;

   const height = (length: number | null) => {
      /*
       * An unmeasured fish sits at the floor. It used to be given 124, between
       * the 88 floor and the 178 ceiling, so a fish nobody measured stood
       * taller than a measured 41cm galjoen next to it and the row of bars
       * stopped telling the truth about the season.
       */
      if (length === null) {
         return MIN_TILE;
      }

      if (shortest === null || longest === null || longest === shortest) {
         /* One length, or all the same: there is no scale to place it on. */
         return 124;
      }
      const ratio = (length - shortest) / (longest - shortest);
      return Math.round(MIN_TILE + ratio * (MAX_TILE - MIN_TILE));
   };

   /*
    * One tile a day, not one a fish.
    *
    * A tile per catch meant a morning that produced three fish looked like
    * three separate outings, and a good season scrolled sideways forever. A
    * season is read in days on the water: the tile is the day, its height is
    * the best fish of that day, and the count says how many came out.
    */
   const byDay = new Map<string, CatchSummary[]>();
   for (const entry of season) {
      const day = new Date(entry.caughtAt).toISOString().slice(0, 10);
      const list = byDay.get(day) ?? [];
      list.push(entry);
      byDay.set(day, list);
   }

   const items: SeasonItem[] = [];
   let month: string | null = null;

   for (const [day, entries] of byDay) {
      /* The fish the day is remembered for. An unmeasured one never wins. */
      const best = entries.reduce((a, b) =>
         (b.length ?? -1) > (a.length ?? -1) ? b : a
      );

      const key = monthKey(best.caughtAt);
      if (key && key !== month) {
         month = key;
         items.push({
            kind: 'month',
            key: `month-${key}`,
            label: monthLabel(best.caughtAt) ?? '',
         });
      }

      items.push({
         kind: 'catch',
         key: `day-${day}`,
         entry: best,
         height: height(best.length),
         measured: best.length !== null,
         /* Fish, not records: one log can carry three of the same species. */
         count: entries.reduce((n, entry) => n + (entry.count ?? 1), 0),
      });
   }

   return items;
}

export function seasonCount(catches: CatchSummary[]) {
   const cutoff = Date.now() - YEAR_MS;
   return catches.filter(
      (entry) => new Date(entry.caughtAt).getTime() >= cutoff
   ).length;
}
