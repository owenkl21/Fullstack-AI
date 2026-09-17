/*
 * Copy helpers for the feed. Dates read `Tue 15 Sep, 06:42`, measurements print
 * both systems with their source word, plurals are real, and a missing value is
 * a sentence somewhere else rather than a dash here.
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

/** `44 cm (17.3 in)`. Null when the angler did not measure it. */
export function formatLength(cm?: number | null): string | null {
   if (typeof cm !== 'number' || !Number.isFinite(cm) || cm <= 0) return null;
   return `${tidy(cm)} cm (${(cm / 2.54).toFixed(1)} in)`;
}

/** `1.9 kg (4 lb 3 oz)`. Pounds and ounces, never decimal pounds. */
export function formatWeight(kg?: number | null): string | null {
   if (typeof kg !== 'number' || !Number.isFinite(kg) || kg <= 0) return null;
   const totalOunces = Math.round(kg * 35.27396195);
   const pounds = Math.floor(totalOunces / 16);
   const ounces = totalOunces % 16;
   const imperial = pounds > 0 ? `${pounds} lb ${ounces} oz` : `${ounces} oz`;
   return `${tidy(kg)} kg (${imperial})`;
}

/** `1 like` / `3 likes`, never `1 likes`. */
export function plural(count: number, one: string, many: string): string {
   return `${count} ${count === 1 ? one : many}`;
}

/**
 * The counts as one sentence under the controls, or nothing at all.
 *
 * Null when there is neither, because "No likes or comments yet." printed under
 * every card in a fresh feed is twenty five identical sentences saying nothing.
 * An absence does not need announcing.
 */
export function countSentence(likes: number, comments: number): string | null {
   const likeText = likes > 0 ? plural(likes, 'like', 'likes') : null;
   const commentText =
      comments > 0 ? plural(comments, 'comment', 'comments') : null;

   if (likeText && commentText) return `${likeText} and ${commentText}.`;
   if (likeText) return `${likeText}.`;
   if (commentText) return `${commentText}.`;
   return null;
}

/** The water type as a plain word. A value we do not recognise prints nothing. */
export function waterWord(waterType?: string | null): string | null {
   if (!waterType) return null;
   const key = waterType.toLowerCase();
   if (key.includes('salt')) return 'saltwater';
   if (key.includes('fresh')) return 'freshwater';
   if (key.includes('brack')) return 'brackish';
   if (key.includes('estuar')) return 'estuary';
   return null;
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
