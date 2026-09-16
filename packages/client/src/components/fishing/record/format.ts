/*
 * Display rules for catches: dates, measurements in both systems, real plurals.
 * The record defines them and the home screen and the fast log follow, so a number
 * reads the same everywhere. These belong in src/lib once that directory is free.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
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

const pad = (value: number) => String(value).padStart(2, '0');

export function toDate(
   value: string | number | Date | null | undefined
): Date | null {
   if (value === null || value === undefined) {
      return null;
   }
   const date = value instanceof Date ? value : new Date(value);
   return Number.isNaN(date.getTime()) ? null : date;
}

/** `06:42` */
export function formatClock(value: string | number | Date | null | undefined) {
   const date = toDate(value);
   return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : null;
}

/** `15 Sep` */
export function formatDayMonth(
   value: string | number | Date | null | undefined
) {
   const date = toDate(value);
   return date ? `${date.getDate()} ${MONTHS[date.getMonth()]}` : null;
}

/** `Tue 15 Sep` */
export function formatDay(value: string | number | Date | null | undefined) {
   const date = toDate(value);
   return date
      ? `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`
      : null;
}

/** `Tue 15 Sep, 06:42` */
export function formatStamp(value: string | number | Date | null | undefined) {
   const date = toDate(value);
   return date ? `${formatDay(date)}, ${formatClock(date)}` : null;
}

/** `Sep 2026` */
export function formatMonthYear(
   value: string | number | Date | null | undefined
) {
   const date = toDate(value);
   return date ? `${MONTHS[date.getMonth()]} ${date.getFullYear()}` : null;
}

export function monthKey(value: string | number | Date | null | undefined) {
   const date = toDate(value);
   return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}` : null;
}

export function monthLabel(value: string | number | Date | null | undefined) {
   const date = toDate(value);
   return date ? MONTHS[date.getMonth()] : null;
}

/** Real plurals: `1 catch`, `184 catches`. */
export function plural(count: number, one: string, many: string) {
   return `${count} ${count === 1 ? one : many}`;
}

const round = (value: number, places: number) => Number(value.toFixed(places));

export const cmToIn = (cm: number) => cm / 2.54;
export const inToCm = (inches: number) => inches * 2.54;
export const kgToLb = (kg: number) => kg * 2.2046226;
export const lbToKg = (lb: number) => lb / 2.2046226;

/** `44 cm` */
export function lengthMetric(cm: number | null | undefined) {
   return cm === null || cm === undefined ? null : `${round(cm, 1)} cm`;
}

/** `17.3 in` */
export function lengthImperial(cm: number | null | undefined) {
   return cm === null || cm === undefined ? null : `${round(cmToIn(cm), 1)} in`;
}

/** `1.9 kg` */
export function weightMetric(kg: number | null | undefined) {
   return kg === null || kg === undefined ? null : `${round(kg, 2)} kg`;
}

/** `4 lb 3 oz` */
export function weightImperial(kg: number | null | undefined) {
   if (kg === null || kg === undefined) {
      return null;
   }
   const totalOunces = Math.round(kgToLb(kg) * 16);
   const pounds = Math.floor(totalOunces / 16);
   const ounces = totalOunces % 16;
   if (pounds === 0) {
      return `${ounces} oz`;
   }
   if (ounces === 0) {
      return `${pounds} lb`;
   }
   return `${pounds} lb ${ounces} oz`;
}

/** `-34.12770, 18.44860` */
export function formatCoords(
   latitude: number | null | undefined,
   longitude: number | null | undefined
) {
   if (
      latitude === null ||
      latitude === undefined ||
      longitude === null ||
      longitude === undefined
   ) {
      return null;
   }
   return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

/** Trims a number for display without printing a trailing `.0`. */
export function trimNumber(value: number, places = 1) {
   return String(round(value, places));
}
