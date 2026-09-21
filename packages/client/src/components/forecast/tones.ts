import type { Band, Reason } from './forecast-api';
import type { CSSProperties } from 'react';

/*
 * Colour, where it says something.
 *
 * The instrument is a black block, so every colour here is mixed over that
 * ground rather than over paper, and every one of them is a run rather than a
 * set of steps. Air moves a degree or two an hour and UV a point; a banded
 * tint jumps between two hours a body could not tell apart, and the jump is
 * read as news. A continuous mix shades along the row instead, so the eye
 * follows the warming, the burning and the building wind without reading a
 * single figure.
 *
 * Every hue is a signal token (--cold, --warm, --green, --hot, --wind-2,
 * --rain, --uv-1, --uv-2, --sun, --storm) reached through var(), so the same
 * palette carries a bar, a tint and a curve, and the night values follow
 * without a second set of rules here.
 */

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/* A signal token at a strength, over whatever ground it lands on. */
const mix = (token: string, percent: number): CSSProperties => ({
   background: `color-mix(in srgb, var(${token}) ${Math.round(percent)}%, transparent)`,
});

/*
 * Strengths run higher than they would on paper. A 14 per cent wash reads on
 * white and disappears on #0b0909, so the tints in the block start where they
 * can be seen and climb from there. Checked against the night block too, which
 * lifts to #161414 and takes them a shade quieter.
 */

/*
 * Air temperature. The comfortable middle, 15 to 22 degrees, is left plain:
 * colour that is always on is decoration, and the instrument should only
 * colour an hour that is cold enough or hot enough to change a plan.
 */
export const tempTint = (c: number | null): CSSProperties | undefined => {
   if (c === null) return undefined;
   if (c < 15) return mix('--cold', 10 + clamp((15 - c) / 12) * 46);
   if (c <= 22) return undefined;
   if (c <= 30) return mix('--warm', 8 + ((c - 22) / 8) * 44);
   return mix('--hot', 34 + clamp((c - 30) / 8) * 22);
};

/*
 * UV, as one strip that blends hour to hour: nothing under 3, the morning
 * climbing through --uv-1, the middle of the day into --uv-2, and the hours
 * that burn a fair-skinned angler in twenty minutes in --hot.
 */
export const uvTint = (uv: number | null): CSSProperties | undefined => {
   if (uv === null || uv < 3) return undefined;
   if (uv < 6) return mix('--uv-1', 14 + ((uv - 3) / 3) * 24);
   if (uv < 8) return mix('--uv-2', 38 + ((uv - 6) / 2) * 12);
   return mix('--hot', 50 + clamp((uv - 8) / 4) * 16);
};

/*
 * The chance of rain, on the same run. Under 15 per cent is a dry hour and
 * gets nothing, and a certain one is the deepest wash the block will take
 * while the figure on top of it still reads.
 */
export const rainTint = (percent: number | null): CSSProperties | undefined => {
   if (percent === null || percent < 15) return undefined;
   return mix('--rain', 8 + clamp((percent - 15) / 85) * 44);
};

/*
 * Wind, as one continuous ramp from calm to blown out.
 *
 * The bands an angler thinks in are real, so they are the anchors: calm,
 * fishable, getting up, hard, and the wind that ends a session. Between the
 * anchors the colour is interpolated in oklab, which walks a hue round rather
 * than through the grey a straight sRGB mix puts in the middle, so a wind
 * building through the afternoon reads as one movement rather than four steps.
 * Under 12 km/h there is no hue at all: a calm hour is a short grey bar,
 * because a colour for calm is a colour that is always on.
 *
 * The run goes teal, green, yellow-green, yellow, orange, red, and green is
 * the anchor that makes it so. Teal straight to amber crosses oklab's
 * low-chroma middle, and it crossed it exactly where a shore angler is
 * reading hardest: thirty to forty km/h came out a grey olive, chroma 0.057
 * at 30 km/h, which is the colour of dishwater and says nothing. With green
 * at 30 the same speeds hold chroma 0.12 to 0.15 all the way up.
 *
 * Measured against the block rather than guessed, in both themes. On the day
 * block (#0b0909) the bars run 12 km/h #34adbd at 7.4:1, 30 km/h #37a353 at
 * 6.2:1, 35 km/h #a9a039 at 7.4:1, 38 km/h #d99a1a at 8.1:1, 48 km/h #e0761c
 * at 6.4:1 and 60 km/h #c0392b at 3.7:1; on the night block (#161414) the
 * same steps sit between 6.9:1 and 8.5:1 until the red, which is the one
 * colour that never lifts because a solid band of it carries paper text
 * elsewhere. The red at 3.7:1 is a shape and not a character, and no bar is
 * ever alone: the height says the speed and the figure under it prints it.
 */
const RAMP: { at: number; token: string }[] = [
   { at: 12, token: '--teal' },
   { at: 20, token: '--teal' },
   { at: 30, token: '--green' },
   { at: 38, token: '--sun' },
   { at: 48, token: '--wind-2' },
   { at: 60, token: '--hot' },
];

export function windColour(kph: number | null): string {
   if (kph === null)
      return 'color-mix(in srgb, var(--paper-2) 25%, transparent)';
   if (kph < 12) {
      /* Calm: paper at low strength, a little firmer as it picks up. */
      return `color-mix(in srgb, var(--paper-2) ${Math.round(28 + clamp(kph / 12) * 20)}%, transparent)`;
   }
   for (let i = 0; i < RAMP.length - 1; i += 1) {
      const from = RAMP[i];
      const to = RAMP[i + 1];
      if (kph >= to.at) continue;
      if (from.token === to.token) return `var(${from.token})`;
      const t = Math.round(((kph - from.at) / (to.at - from.at)) * 100);
      return `color-mix(in oklab, var(${to.token}) ${t}%, var(${from.token}))`;
   }
   return 'var(--hot)';
}

/*
 * The sky mark's own colour, on the page ground as well as in the block, so
 * the day strip and the hour row read the same weather the same way.
 */
export const skyTone = (text: string | null | undefined) => {
   const t = (text ?? '').toLowerCase();
   if (/thunder|storm/.test(t)) return 'text-storm-text';
   if (/rain|drizzle|shower/.test(t)) return 'text-cold';
   if (/fog|mist/.test(t)) return 'text-ink-3';
   if (/overcast|cloud/.test(t)) return 'text-ink-2';
   return 'text-sun';
};

/*
 * The day strip's mini-bar, out on the page ground where a color-mix over
 * black would be wrong. Steps rather than a run there: the bar is eight pixels
 * wide and says which day is the windy one, not by how much. The steps are the
 * ramp's own anchors, so the week and the day tell the same story in the same
 * colours and Saturday's green tab is Saturday's green bars.
 */
export const windBar = (kph: number | null) =>
   kph === null || kph < 12
      ? 'bg-line-2'
      : kph < 20
        ? 'bg-teal'
        : kph < 34
          ? 'bg-green'
          : kph < 48
            ? 'bg-wind-2'
            : 'bg-wind-3';

/*
 * The four bands of the rating, in the ramp the instrument already owns.
 *
 * No new hues. The wind ramp runs teal, green, amber, orange, red from the
 * wind you can fish to the wind that ends a session, so the rating reads it
 * backwards: red for an hour not worth the drive, amber for an ordinary one,
 * green for a good one and teal, the product's own accent, for the rare hour
 * that earns the word. The height of the bar says the same thing again, and
 * the panel above the hours prints the word, so the colour is never carrying
 * it alone.
 */
const BAND_TOKEN: Record<Band, string> = {
   bad: '--wind-3',
   good: '--sun',
   great: '--green',
   exceptional: '--teal',
};

export const bandFill = (band: Band) => `var(${BAND_TOKEN[band]})`;

export const BAND_WORD: Record<Band, string> = {
   bad: 'Bad',
   good: 'Good',
   great: 'Great',
   exceptional: 'Exceptional',
};

/* The bands worst to best, the order the verdict's scale reads in. */
export const BANDS: Band[] = ['bad', 'good', 'great', 'exceptional'];

/*
 * The word in front of a reason, by what it is about rather than where it
 * came from. A reason from the weather is about the wind or the light, and
 * that is the word a reader scans the list for. Two topics can share a word,
 * the wind's speed and its direction, and each still says its own sentence.
 */
const REASON_WORD: Partial<Record<string, string>> = {
   'moon-period': 'Moon',
   light: 'Light',
   wind: 'Wind',
   'wind-direction': 'Wind',
   gust: 'Gust',
   pressure: 'Pressure',
   swell: 'Swell',
   'swell-period': 'Swell',
   sky: 'Sky',
   water: 'Water',
   'time-of-day': 'Time',
   veto: 'No go',
};

/* A topic the map has not met yet still gets a word, its source. */
const SOURCE_WORD: Record<Reason['from'], string> = {
   log: 'Log',
   weather: 'Weather',
   moon: 'Moon',
};

export const reasonWord = (reason: Reason) =>
   REASON_WORD[reason.topic] ?? SOURCE_WORD[reason.from];
