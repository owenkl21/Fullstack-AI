import type { CSSProperties } from 'react';

/*
 * Colour, where it says something.
 *
 * Wind in four bands a shore angler already thinks in: light, fishable,
 * strong, blown out. Rain by how likely. UV by how burning. The sky in the
 * colour of the sky. Each band is a class in index.css that sets a tint
 * behind the figure, and for the loud bands a solid colour with its own
 * text colour, so the cell reads in day and night alike. Everything else
 * stays ink, so the colour is read as a signal rather than decoration.
 *
 * Every hue is a token (--cold, --warm, --hot, --wind-2, --wind-3, --rain,
 * --uv-1, --uv-2, --storm, --sun), reached through the utilities the theme
 * block builds from them, so the same palette carries a tint, a bar and a
 * curve and the night values follow without a second set of classes here.
 */

export const windTone = (kph: number | null) =>
   kph === null
      ? ''
      : kph < 15
        ? 'text-ink-2'
        : kph < 30
          ? 'text-teal-text'
          : kph < 45
            ? 'text-wind-2'
            : 'text-wind-3';

/*
 * The fill of a wind bar, in the same four bands. A light wind has no colour
 * of its own anywhere else, so its bar is drawn in the rule colour: it still
 * has a height, and height is what says how hard it is blowing.
 */
export const windBar = (kph: number | null) =>
   kph === null || kph < 15
      ? 'bg-line-2'
      : kph < 30
        ? 'bg-teal'
        : kph < 45
          ? 'bg-wind-2'
          : 'bg-wind-3';

export const rainCell = (percent: number | null) =>
   percent === null || percent < 20
      ? ''
      : percent < 50
        ? 'tone tone-rain-1'
        : percent < 75
          ? 'tone tone-rain-2'
          : 'tone tone-rain-3';

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
   /* As text these take the lifted night values; the solid bands keep the
      deep ones, which is why rain reads as --cold here (the same day hue). */
   if (/thunder|storm/.test(t)) return 'text-storm-text';
   if (/rain|drizzle|shower/.test(t)) return 'text-cold';
   if (/fog|mist/.test(t)) return 'text-ink-3';
   if (/overcast/.test(t)) return 'text-ink-2';
   if (/cloud/.test(t)) return 'text-ink-2';
   return 'text-sun';
};

export const skyCell = (text: string | null | undefined) => {
   const t = (text ?? '').toLowerCase();
   if (/thunder|storm/.test(t)) return 'tone tone-sky-storm';
   if (/rain|drizzle|shower/.test(t)) return 'tone tone-sky-rain';
   if (/fog|mist|overcast/.test(t)) return 'tone tone-sky-grey';
   if (/cloud/.test(t)) return '';
   return 'tone tone-sky-clear';
};

/*
 * Temperature and UV as a run of colour rather than three steps.
 *
 * Air moves a degree or two an hour, so a banded tint jumps between two cells
 * that differ by nothing a body would notice. These give each hour its own
 * mix of the same token, so a row of them shades from one end of the day to
 * the other and the eye follows the warming without reading a single figure.
 * A flat tint per cell rather than a gradient across the row: this product
 * puts no gradient on a surface, and an hour is the honest unit anyway,
 * because that is how often the model speaks.
 *
 * The comfortable middle, 15 to 22 degrees, is left plain. Colour that is
 * always on is decoration.
 */
const mix = (token: string, percent: number): CSSProperties => ({
   background: `color-mix(in srgb, var(${token}) ${Math.round(percent)}%, transparent)`,
});

export const tempTint = (c: number | null): CSSProperties | undefined => {
   if (c === null) return undefined;
   if (c < 15) return mix('--cold', Math.min(1, (15 - c) / 12) * 40);
   if (c <= 22) return undefined;
   if (c <= 30) return mix('--warm', ((c - 22) / 8) * 40);
   return mix('--hot', 24 + Math.min(1, (c - 30) / 8) * 16);
};

export const uvTint = (uv: number | null): CSSProperties | undefined => {
   if (uv === null || uv < 3) return undefined;
   if (uv < 6) return mix('--uv-1', ((uv - 3) / 3) * 24 + 8);
   if (uv < 8) return mix('--uv-2', ((uv - 6) / 2) * 10 + 28);
   return mix('--hot', 30 + Math.min(1, (uv - 8) / 4) * 12);
};
