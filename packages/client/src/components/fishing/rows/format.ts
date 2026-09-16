/*
 * The vocabulary the list rows share: one date format, real plurals, measurements
 * in the unit they were stored in, and plain words wherever the database keeps an
 * enum. Every date on a list surface goes through formatDateTime, so a catch reads
 * the same way in every row it appears in and on every device.
 */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
   'Jan',
   'Feb',
   'Mar',
   'Apr',
   'May',
   'Jun',
   'Jul',
   'Aug',
   'Sep',
   'Oct',
   'Nov',
   'Dec',
];

type DateInput = string | Date | null | undefined;

function toDate(value: DateInput): Date | null {
   if (!value) {
      return null;
   }

   const date = value instanceof Date ? value : new Date(value);
   return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * `Tue 15 Sep, 06:42`. Fixed spelling and a 24 hour clock, so the row does not
 * change shape with the browser locale. The time is the reader's own.
 */
export function formatDateTime(value: DateInput): string | null {
   const date = toDate(value);
   if (!date) {
      return null;
   }

   const hours = String(date.getHours()).padStart(2, '0');
   const minutes = String(date.getMinutes()).padStart(2, '0');

   return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}, ${hours}:${minutes}`;
}

/** The calendar year, used by the year filter. */
export function yearOf(value: DateInput): string | null {
   const date = toDate(value);
   return date ? String(date.getFullYear()) : null;
}

/** Sortable epoch for a date that may be missing. */
export function timeOf(value: DateInput): number {
   const date = toDate(value);
   return date ? date.getTime() : 0;
}

/** `1 catch`, `2 catches`. Pass the plural where adding an s is wrong. */
export function plural(count: number, one: string, many?: string): string {
   return `${count} ${count === 1 ? one : (many ?? `${one}s`)}`;
}

function trimNumber(value: number, maxDecimals: number): string {
   return String(Number(value.toFixed(maxDecimals)));
}

/** `44 cm`, or nothing at all when the fish was never measured. */
export function formatLength(value: number | null | undefined): string | null {
   if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return null;
   }

   return `${trimNumber(value, 1)} cm`;
}

/** `1.9 kg`, or nothing at all when the fish was never weighed. */
export function formatWeight(value: number | null | undefined): string | null {
   if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return null;
   }

   return `${trimNumber(value, 2)} kg`;
}

const WATER_TYPE_WORDS: Record<string, string> = {
   SALTWATER: 'Saltwater',
   FRESHWATER: 'Freshwater',
   BRACKISH: 'Brackish',
};

/** The water as a person says it. Anything unmapped prints nothing. */
export function waterTypeWord(value: string | null | undefined): string | null {
   if (!value) {
      return null;
   }

   return WATER_TYPE_WORDS[value.toUpperCase()] ?? null;
}

const GEAR_TYPE_WORDS: Record<string, { one: string; many: string }> = {
   ROD: { one: 'Rod', many: 'Rods' },
   REEL: { one: 'Reel', many: 'Reels' },
   BAIT: { one: 'Bait', many: 'Bait' },
   LURE: { one: 'Lure', many: 'Lures' },
   LINE: { one: 'Line', many: 'Line' },
   HOOK: { one: 'Hook', many: 'Hooks' },
   WEIGHTS: { one: 'Weight', many: 'Weights' },
};

const OTHER_GEAR = { one: 'Other gear', many: 'Other gear' };

/** Gear type as a heading word, singular and plural. Never the stored value. */
export function gearTypeWords(value: string | null | undefined): {
   one: string;
   many: string;
} {
   if (!value) {
      return OTHER_GEAR;
   }

   return GEAR_TYPE_WORDS[value.toUpperCase()] ?? OTHER_GEAR;
}

/**
 * A metadata line carries one middle dot and commas after that, so the eye has a
 * single break to land on. Empty parts drop out rather than printing a gap.
 */
export function metaLine(
   lead: string | null,
   ...rest: (string | null)[]
): string {
   const tail = rest.filter((part): part is string => Boolean(part));
   const head = lead ?? tail.shift() ?? '';

   if (!tail.length) {
      return head;
   }

   return `${head} · ${tail.join(', ')}`;
}

/** The order tackle is grouped in on the gear page, tackle first, terminal last. */
export const GEAR_TYPE_ORDER = [
   'ROD',
   'REEL',
   'LINE',
   'LURE',
   'BAIT',
   'HOOK',
   'WEIGHTS',
];
