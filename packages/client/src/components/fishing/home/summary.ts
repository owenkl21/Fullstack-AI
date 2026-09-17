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
        entry: CatchSummary;
        height: number;
        /* False when the fish was never measured, so the strip can say so
         * rather than drawing a bar that stands for a length nobody took. */
        measured: boolean;
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

   const items: SeasonItem[] = [];
   let month: string | null = null;

   season.forEach((entry) => {
      const key = monthKey(entry.caughtAt);
      if (key && key !== month) {
         month = key;
         items.push({
            kind: 'month',
            key: `month-${key}`,
            label: monthLabel(entry.caughtAt) ?? '',
         });
      }
      items.push({
         kind: 'catch',
         key: entry.id,
         entry,
         height: height(entry.length),
         measured: entry.length !== null,
      });
   });

   return items;
}

export function seasonCount(catches: CatchSummary[]) {
   const cutoff = Date.now() - YEAR_MS;
   return catches.filter(
      (entry) => new Date(entry.caughtAt).getTime() >= cutoff
   ).length;
}
