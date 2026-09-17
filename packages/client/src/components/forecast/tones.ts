/*
 * Colour, where it says something.
 *
 * Wind in four bands a shore angler already thinks in: light, fishable,
 * strong, blown out. Rain by how likely. UV by how burning. The sky in the
 * colour of the sky. Each band is a class in index.css that sets a tint
 * behind the figure, and for the loud bands a solid colour with its own
 * text colour, so the cell reads in day and night alike. Everything else
 * stays ink, so the colour is read as a signal rather than decoration.
 */

export const windTone = (kph: number | null) =>
   kph === null
      ? ''
      : kph < 15
        ? 'text-ink-2'
        : kph < 30
          ? 'text-teal-text'
          : kph < 45
            ? 'text-[#c97b1c]'
            : 'text-[#c0392b]';

/* The cell behind a wind or gust figure. */
export const windCell = (kph: number | null) =>
   kph === null
      ? ''
      : kph < 15
        ? ''
        : kph < 30
          ? 'tone tone-wind-1'
          : kph < 45
            ? 'tone tone-wind-2'
            : 'tone tone-wind-3';

export const rainCell = (percent: number | null) =>
   percent === null || percent < 20
      ? ''
      : percent < 50
        ? 'tone tone-rain-1'
        : percent < 75
          ? 'tone tone-rain-2'
          : 'tone tone-rain-3';

export const uvCell = (uv: number | null) =>
   uv === null || uv < 3
      ? ''
      : uv < 6
        ? 'tone tone-uv-1'
        : uv < 8
          ? 'tone tone-uv-2'
          : 'tone tone-uv-3';

export const waterCell = (c: number | null) =>
   c === null
      ? ''
      : c < 13
        ? 'tone tone-water-cold'
        : c >= 18
          ? 'tone tone-water-warm'
          : '';

export const skyTone = (text: string | null | undefined) => {
   const t = (text ?? '').toLowerCase();
   if (/thunder|storm/.test(t)) return 'text-[#8e44ad]';
   if (/rain|drizzle|shower/.test(t)) return 'text-[#1f6fb2]';
   if (/fog|mist/.test(t)) return 'text-ink-3';
   if (/overcast/.test(t)) return 'text-ink-2';
   if (/cloud/.test(t)) return 'text-ink-2';
   return 'text-[#d99a1a]';
};

export const skyCell = (text: string | null | undefined) => {
   const t = (text ?? '').toLowerCase();
   if (/thunder|storm/.test(t)) return 'tone tone-sky-storm';
   if (/rain|drizzle|shower/.test(t)) return 'tone tone-sky-rain';
   if (/fog|mist|overcast/.test(t)) return 'tone tone-sky-grey';
   if (/cloud/.test(t)) return '';
   return 'tone tone-sky-clear';
};
