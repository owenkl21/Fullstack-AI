/*
 * Local wall clock, "2026-09-26T06:00": the string the date and time field
 * (components/ui/date-time-field.tsx) speaks, and the one a datetime-local
 * input spoke before it. Kept apart from the field so a form can turn a Date
 * into one and back without importing a component.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/*
 * A Date as a local wall clock string. The year is four digits even when it
 * is small: a year typed a digit at a time passes through 0002 and 0020, and
 * "2-01-01" is not a value a date input will take back.
 */
export const toLocalValue = (at: Date) =>
   `${String(at.getFullYear()).padStart(4, '0')}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
   `T${pad(at.getHours())}:${pad(at.getMinutes())}`;

/*
 * The instant a local wall clock string means here, or null. Built from the
 * parts, not from new Date(string), which reads a string with no zone as
 * local time in one browser and UTC in another.
 *
 * A year before 1900 is null too. No fish and no competition is that old,
 * and it is what a year looks like halfway through being typed (0002, 0020,
 * 0202), so a form that acts on every change does not act on those. The year
 * is set on its own because new Date(2, 0, 1) is 1902, not the year 2.
 */
export function fromLocalValue(value: string | null | undefined): Date | null {
   const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value ?? '');
   if (!m || Number(m[1]) < 1900) return null;
   const at = new Date(2000, 0, 1, Number(m[4]), Number(m[5]));
   at.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
   return Number.isNaN(at.getTime()) ? null : at;
}
