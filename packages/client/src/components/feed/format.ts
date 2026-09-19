/*
 * Copy helpers for the feed. Dates read `Tue 15 Sep, 06:42`, a measurement is
 * one figure in the system it was taken in, plurals are real, and a value that
 * was never taken is simply absent: nothing here ever prints a dash or the
 * words "not measured" in its place.
 */

const STAMP = new Intl.DateTimeFormat('en-GB', {
   weekday: 'short',
   day: 'numeric',
   month: 'short',
   hour: '2-digit',
   minute: '2-digit',
   hour12: false,
});

function part(
   parts: Intl.DateTimeFormatPart[],
   type: Intl.DateTimeFormatPartTypes
) {
   return parts.find((entry) => entry.type === type)?.value ?? '';
}

function toDate(value?: string | null) {
   if (!value) return null;
   const date = new Date(value);
   return Number.isNaN(date.getTime()) ? null : date;
}

/** `Tue 15 Sep, 06:42`, the one date format in the product. */
export function formatStamp(value?: string | null): string | null {
   const date = toDate(value);
   if (!date) return null;
   const parts = STAMP.formatToParts(date);
   /* The year is written only when it is not this one. */
   const year =
      date.getFullYear() === new Date().getFullYear()
         ? ''
         : ` ${date.getFullYear()}`;
   return `${part(parts, 'weekday')} ${part(parts, 'day')} ${part(parts, 'month')}${year}, ${part(parts, 'hour')}:${part(parts, 'minute')}`;
}

/**
 * A suffix only, never the whole date. Past a week the stamp carries it alone,
 * so this returns null and the sentence is shorter.
 */
export function formatRelative(
   value?: string | null,
   now: number = Date.now()
): string | null {
   const date = toDate(value);
   if (!date) return null;

   const seconds = Math.round((now - date.getTime()) / 1000);
   if (seconds < 0) return null;
   if (seconds < 60) return 'just now';

   const minutes = Math.floor(seconds / 60);
   if (minutes < 60) return `${minutes} min ago`;

   const hours = Math.floor(minutes / 60);
   if (hours < 24) return `${hours} h ago`;

   const days = Math.floor(hours / 24);
   if (days === 1) return 'yesterday';
   if (days <= 7) return `${days} days ago`;

   return null;
}

function tidy(value: number) {
   return Number.isInteger(value)
      ? String(value)
      : String(Number(value.toFixed(1)));
}

/**
 * `44 cm`. Null when the angler did not measure it.
 *
 * One system, not two. The card carries the size as a single League Gothic
 * line beside the species, and `44 cm (17.3 in) · 1.9 kg (4 lb 3 oz)` wrapped
 * onto three lines of parentheses on a phone and buried the fish. The record
 * is where a catch is read closely, and the record still prints both.
 */
export function formatLength(cm?: number | null): string | null {
   if (typeof cm !== 'number' || !Number.isFinite(cm) || cm <= 0) return null;
   return `${tidy(cm)} cm`;
}

/** `1.9 kg`. Null when it was never weighed. */
export function formatWeight(kg?: number | null): string | null {
   if (typeof kg !== 'number' || !Number.isFinite(kg) || kg <= 0) return null;
   return `${tidy(kg)} kg`;
}

/**
 * How a figure was taken, as the quiet word that sits beside it.
 *
 * The API sends the enum the log form wrote, so a card used to read
 * `43 cm LENGTH`. `LENGTH` is not a way of measuring at all: it is a weight the
 * server worked out from a length, and it has no word because there is nothing
 * to tell the reader that the figures do not already say.
 */
export function sourceWord(source?: string | null): string | null {
   switch (source) {
      case 'EYE':
         return 'By eye';
      case 'TAPE':
         return 'On a tape';
      case 'SCALE':
         return 'On a scale';
      default:
         return null;
   }
}

/** `1 like` / `3 likes`, never `1 likes`. */
export function plural(count: number, one: string, many: string): string {
   return `${count} ${count === 1 ? one : many}`;
}

/**
 * How old a reply is, in the fewest characters that still say it: `2 h`,
 * `40 min`, `3 d`. It rides after a name on one line, so it drops the `ago`
 * the feed's own meta line keeps. Past a week it hands back the stamp, because
 * `9 d` is a number nobody converts.
 */
export function formatAge(
   value?: string | null,
   now: number = Date.now()
): string | null {
   const date = toDate(value);
   if (!date) return null;

   const seconds = Math.round((now - date.getTime()) / 1000);
   if (seconds < 0) return null;
   if (seconds < 60) return 'now';

   const minutes = Math.floor(seconds / 60);
   if (minutes < 60) return `${minutes} min`;

   const hours = Math.floor(minutes / 60);
   if (hours < 24) return `${hours} h`;

   const days = Math.floor(hours / 24);
   if (days <= 7) return `${days} d`;

   return formatStamp(value);
}

/** `800 m away` under a kilometre, `12 km away` above it. */
export function formatDistance(km?: number | null): string | null {
   if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) return null;
   if (km < 1)
      return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m away`;
   return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

/** Joins the parts of a metadata line, dropping the ones that have no value. */
export function joinMeta(parts: Array<string | null | undefined>): string {
   return parts.filter((entry): entry is string => Boolean(entry)).join(' · ');
}

/** Great circle distance in kilometres, used to refine the nearby list. */
export function distanceInKm(
   origin: { latitude: number; longitude: number },
   target: { latitude: number; longitude: number }
): number {
   const toRad = (value: number) => (value * Math.PI) / 180;
   const radius = 6371;
   const dLat = toRad(target.latitude - origin.latitude);
   const dLon = toRad(target.longitude - origin.longitude);
   const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(origin.latitude)) *
         Math.cos(toRad(target.latitude)) *
         Math.sin(dLon / 2) *
         Math.sin(dLon / 2);

   return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
