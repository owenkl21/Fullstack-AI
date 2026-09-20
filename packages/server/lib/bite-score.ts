/*
 * Is it worth driving out.
 *
 * One number and a band for every hour of the week ahead, and a band for each
 * day, with the reasons behind them in plain words. The reasons are the point.
 * A score on its own is a horoscope; a score that says "your fish come in 1012
 * to 1019 and this hour is 1014" is a reading of the angler's own log, and he
 * can disagree with it.
 *
 * Three inputs, in this order of weight.
 *
 * 1. His own log. Every catch already carries the conditions it came in. The
 *    hour being rated is measured against where those catches actually sit,
 *    dimension by dimension. This is the only part of the score that is his
 *    and nobody else's, so it carries the most, and it carries less when there
 *    is less of it: the cold start is said out loud rather than papered over.
 * 2. The weather already fetched. Pressure trend, wind and its gusts, the
 *    light, swell and its period, and what the sky is doing. The rules an
 *    angler would give you standing on the ledge.
 * 3. Solunar, worked out in `lib/solunar.ts`. Only ever a lift.
 *
 * Pure. Everything comes in as a plain object and nothing is read or fetched,
 * so the whole thing can be run over a week of hours in a loop and checked
 * against real records without a database.
 */

import {
   insidePeriod,
   minutesToNearestPeriod,
   PERIOD_WORDS,
   solunarPeriods,
   solunarReading,
   type MoonEvent,
   type SolunarPeriod,
} from './solunar';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

export type Band = 'bad' | 'good' | 'great' | 'exceptional';
export type Confidence = 'thin' | 'building' | 'solid';
export type Source = 'log' | 'weather' | 'moon';

export type Reason = {
   text: string;
   from: Source;
   /** Positive lifts the score, negative drags it. */
   lift: number;
   /*
    * What the line is about. Two readings of the same thing, the general rule
    * and his own log, must never be printed one under the other, and the log
    * wins when they collide because it is his.
    */
   topic: string;
};

export type RatedHour = {
   /** The place's own clock, matching a forecast hour's `local`. */
   local: string;
   score: number;
   band: Band;
   /** The one line that moved this hour most, for a title on the cell. */
   why: string | null;
};

export type RatedDay = {
   date: string;
   score: number;
   band: Band;
   /** The best three hours of the day, on the place's clock, e.g. `05:00`. */
   bestFrom: string | null;
   bestTo: string | null;
   reasons: Reason[];
};

export type ForecastRating = {
   hours: RatedHour[];
   days: RatedDay[];
   basis: {
      /** Everything in the log. */
      catches: number;
      /** How many of those carry enough of their conditions to be read. */
      used: number;
      confidence: Confidence;
      note: string;
   };
   /** The best day of the week and when on it, for the page to point at. */
   best: { date: string; from: string | null; to: string | null } | null;
};

/* ---------- what comes in ---------- */

export type RatingHour = {
   local: string;
   /** The same moment with its offset, so it can be turned into an instant. */
   time: string;
   temperatureC: number | null;
   windSpeedKph: number | null;
   windGustKph: number | null;
   windDirectionDegrees: number | null;
   pressureMsl: number | null;
   cloudCover: number | null;
   precipitationProbability: number | null;
   precipitationMm: number | null;
   cape: number | null;
   conditionText: string | null;
   isDaytime: boolean | null;
   seaSurfaceTemperatureC: number | null;
   swellHeightM: number | null;
   swellPeriodS: number | null;
};

export type RatingDay = {
   date: string;
   sunrise: string | null;
   sunset: string | null;
   moonrise: string | null;
   moonset: string | null;
   /** Nought at new, a half at full, as `lib/moon.ts` counts it. */
   moonFraction: number | null;
};

export type LoggedConditions = {
   caughtAt: Date;
   species: string | null;
   /** Where the fish came out, for the moon. Null falls back to the place being rated. */
   latitude: number | null;
   longitude: number | null;
   windSpeedKph: number | null;
   windDirectionDegrees: number | null;
   pressureMsl: number | null;
   seaSurfaceTemperatureC: number | null;
   swellHeightM: number | null;
   swellPeriodS: number | null;
   cloudCover: number | null;
   moonIllumination: number | null;
   isDaytime: boolean | null;
};

export type UnitSystem = 'METRIC' | 'IMPERIAL';

export type RatingInput = {
   latitude: number;
   longitude: number;
   utcOffsetSeconds: number;
   /*
    * The reader's own units. Everything is modelled and stored in metric and
    * only the sentences change, because a reason is prose and prose in the
    * wrong unit is wrong.
    */
   units?: UnitSystem;
   hours: RatingHour[];
   days: RatingDay[];
   log: LoggedConditions[];
};

/* ---------- small arithmetic ---------- */

const clamp = (n: number, low = -1, high = 1) =>
   Math.min(high, Math.max(low, n));

const isNumber = (n: unknown): n is number =>
   typeof n === 'number' && Number.isFinite(n);

/** A value walked along a run of anchors, flat outside the ends. */
function along(x: number, points: [number, number][]): number {
   const first = points[0];
   const last = points[points.length - 1];
   if (!first || !last) return 0;
   if (x <= first[0]) return first[1];
   if (x >= last[0]) return last[1];

   for (let i = 0; i < points.length - 1; i += 1) {
      const from = points[i];
      const to = points[i + 1];
      if (!from || !to || x > to[0]) continue;
      const span = to[0] - from[0];
      if (span === 0) return to[1];
      return from[1] + ((x - from[0]) / span) * (to[1] - from[1]);
   }

   return last[1];
}

function quantile(sorted: number[], q: number): number {
   if (sorted.length === 0) return 0;
   if (sorted.length === 1) return sorted[0] as number;
   const at = (sorted.length - 1) * q;
   const low = Math.floor(at);
   const high = Math.ceil(at);
   const a = sorted[low] as number;
   const b = sorted[high] as number;
   return a + (b - a) * (at - low);
}

/*
 * How well a figure sits inside the figures his fish came in.
 *
 * Quantiles rather than a mean and a spread, because a log is not a bell
 * curve: an angler fishes the conditions he can get to, and one holiday week
 * of flat calm would drag a mean around. The middle half of the log scores
 * full, the outer tenths taper, and a figure a whole spread past the edge is
 * as wrong as this says anything is.
 */
function fitToLog(x: number, values: number[], leastCount: number) {
   if (values.length < leastCount) return null;

   const sorted = [...values].sort((a, b) => a - b);
   const q10 = quantile(sorted, 0.1);
   const q25 = quantile(sorted, 0.25);
   const q75 = quantile(sorted, 0.75);
   const q90 = quantile(sorted, 0.9);
   const spread = Math.max(q90 - q10, 1e-6);

   const value = along(x, [
      [q10 - spread, -1],
      [q10, 0.3],
      [q25, 1],
      [q75, 1],
      [q90, 0.3],
      [q90 + spread, -1],
   ]);

   return { value: clamp(value), q25, q75, n: sorted.length };
}

/** The share of a log within a wrapped distance of a figure, against chance. */
function fitCircular(
   x: number,
   values: number[],
   wrap: number,
   within: number,
   leastCount: number
) {
   if (values.length < leastCount) return null;

   const near = values.filter((v) => {
      const raw = Math.abs(((((v - x) % wrap) + wrap) % wrap) as number);
      return Math.min(raw, wrap - raw) <= within;
   });

   const share = near.length / values.length;
   const chance = (2 * within) / wrap;

   return {
      value: clamp((share - chance) / 0.45),
      hits: near.length,
      n: values.length,
   };
}

const CARDINALS = [
   'N',
   'NNE',
   'NE',
   'ENE',
   'E',
   'ESE',
   'SE',
   'SSE',
   'S',
   'SSW',
   'SW',
   'WSW',
   'W',
   'WNW',
   'NW',
   'NNW',
];

export const toCardinal = (degrees: number | null): string | null => {
   if (!isNumber(degrees)) return null;
   const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
   return CARDINALS[index] ?? null;
};

const WORDS = [
   'none',
   'one',
   'two',
   'three',
   'four',
   'five',
   'six',
   'seven',
   'eight',
   'nine',
   'ten',
   'eleven',
   'twelve',
];

/* Small counts read better as words in a sentence, larger ones as figures. */
const count = (n: number) => WORDS[n] ?? String(n);
const Count = (n: number) => {
   const word = count(n);
   return word.charAt(0).toUpperCase() + word.slice(1);
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/*
 * The reader's units, in a sentence. Kilometres an hour, metres and degrees
 * Celsius are what the model works in; an angler reading in feet and miles
 * should not be handed a line in somebody else's.
 */
const KPH_PER_MPH = 1.609344;
const M_PER_FOOT = 0.3048;

type Writers = {
   /** With the unit on it. */
   speed: (kph: number) => string;
   height: (m: number) => string;
   temp: (c: number) => string;
   /** The bare figure, for the near end of a range. */
   speedFigure: (kph: number) => string;
   heightFigure: (m: number) => string;
   tempFigure: (c: number) => string;
};

const writersFor = (units: UnitSystem): Writers => {
   const imperial = units === 'IMPERIAL';
   const speedFigure = (kph: number) =>
      String(Math.round(imperial ? kph / KPH_PER_MPH : kph));
   const heightFigure = (m: number) =>
      round1(imperial ? m / M_PER_FOOT : m).toFixed(1);
   const tempFigure = (c: number) =>
      imperial ? String(Math.round((c * 9) / 5 + 32)) : round1(c).toFixed(1);

   return {
      speedFigure,
      heightFigure,
      tempFigure,
      speed: (kph) => `${speedFigure(kph)} ${imperial ? 'mph' : 'km/h'}`,
      height: (m) => `${heightFigure(m)} ${imperial ? 'ft' : 'm'}`,
      temp: (c) => `${tempFigure(c)}${imperial ? '\u00b0F' : '\u00b0C'}`,
   };
};

/** An instant out of an Open-Meteo stamp, which always carries its offset. */
const instant = (stamp: string | null): number | null => {
   if (!stamp) return null;
   const ms = new Date(stamp).getTime();
   return Number.isNaN(ms) ? null : ms;
};

/** `05:00` off a local stamp. */
const clock = (local: string) => local.slice(11, 16);

/* ---------- the weather block ---------- */

type Part = { weight: number; value: number; reason: Reason | null };

const part = (
   weight: number,
   value: number,
   reason: Reason | null = null
): Part => ({ weight, value, reason });

/*
 * What an angler would tell you standing on the ledge, as arithmetic.
 *
 * Every rule runs along anchors rather than stepping between bands, so an
 * hour is never a different colour from the hour beside it over a hundredth
 * of a millibar. The anchors are shore fishing numbers: the wind that stops
 * you casting, the swell that stops you standing there, the pressure that
 * has been falling all afternoon.
 */
function weatherScore(
   hour: RatingHour,
   before: RatingHour[],
   sunrise: number | null,
   sunset: number | null,
   write: Writers
): { value: number; reasons: Reason[]; veto: Reason | null } {
   const parts: Part[] = [];
   let veto: Reason | null = null;
   const at = instant(hour.time);

   /* Pressure, over the six hours in front of this one. */
   const sixBack = before[before.length - 6];
   const threeBack = before[before.length - 3];
   const earlier = isNumber(sixBack?.pressureMsl)
      ? { p: sixBack.pressureMsl as number, hours: 6 }
      : isNumber(threeBack?.pressureMsl)
        ? { p: threeBack.pressureMsl as number, hours: 3 }
        : null;

   if (isNumber(hour.pressureMsl) && earlier) {
      const delta = hour.pressureMsl - earlier.p;
      const value = along(delta, [
         [-6, 0.95],
         [-2, 0.6],
         [-0.8, 0.1],
         [0.8, -0.05],
         [3, -0.55],
         [6, -0.85],
      ]);
      const size = Math.abs(round1(delta));
      const word = delta < 0 ? 'falling' : 'rising';
      parts.push(
         part(
            1,
            value,
            size < 0.8
               ? null
               : {
                    from: 'weather',
                    lift: value,
                    topic: 'pressure',
                    text: `Pressure ${word} ${size} hPa over the ${count(earlier.hours)} hours before it.`,
                 }
         )
      );
   }

   /* Wind. The band you can cast into, and the wind that ends a session. */
   if (isNumber(hour.windSpeedKph)) {
      const speed = hour.windSpeedKph;
      const value = along(speed, [
         [0, -0.25],
         [5, 0.15],
         [10, 0.5],
         [16, 0.6],
         [22, 0.35],
         [28, 0],
         [35, -0.5],
         [42, -0.85],
         [50, -1],
      ]);
      const cardinal = toCardinal(hour.windDirectionDegrees);
      const from = cardinal ? `${cardinal} ` : '';
      parts.push(
         part(1.2, value, {
            from: 'weather',
            lift: value,
            topic: 'wind',
            text:
               value >= 0.45
                  ? `Wind ${from}${write.speed(speed)}, inside the band you can fish.`
                  : value <= -0.3
                    ? `Wind ${from}${write.speed(speed)}, hard enough to spoil it.`
                    : `Wind ${from}${write.speed(speed)}.`,
         })
      );

      if (speed >= 45) {
         veto = {
            from: 'weather',
            lift: -1.5,
            topic: 'veto',
            text: `Wind ${write.speed(speed)}. That is not a session.`,
         };
      }
   }

   /* The spread between the mean and the gust, which is what snarls a cast. */
   if (isNumber(hour.windSpeedKph) && isNumber(hour.windGustKph)) {
      const spread = hour.windGustKph - hour.windSpeedKph;
      const value = along(spread, [
         [8, 0],
         [18, -0.35],
         [30, -0.8],
      ]);
      parts.push(
         part(
            0.5,
            value,
            value > -0.3
               ? null
               : {
                    from: 'weather',
                    lift: value,
                    topic: 'gust',
                    text: `Gusting to ${write.speed(hour.windGustKph)} off a ${write.speedFigure(hour.windSpeedKph)} mean, so it comes in bursts.`,
                 }
         )
      );

      if (hour.windGustKph >= 60 && !veto) {
         veto = {
            from: 'weather',
            lift: -1.5,
            topic: 'veto',
            text: `Gusting ${write.speed(hour.windGustKph)}. That is not a session.`,
         };
      }
   }

   /* First and last light, which is the oldest rule there is. */
   if (at !== null && (sunrise !== null || sunset !== null)) {
      const away = Math.min(
         sunrise === null ? Infinity : Math.abs(at - sunrise) / MINUTE_MS,
         sunset === null ? Infinity : Math.abs(at - sunset) / MINUTE_MS
      );
      const night = hour.isDaytime === false;
      const value = Number.isFinite(away)
         ? along(away, [
              [0, 1],
              [45, 0.85],
              [90, 0.4],
              [150, 0],
              [240, night ? 0.05 : -0.35],
           ])
         : 0;
      const nearer =
         sunrise !== null &&
         (sunset === null || Math.abs(at - sunrise) <= Math.abs(at - sunset));
      parts.push(
         part(
            1,
            value,
            value < 0.45
               ? null
               : {
                    from: 'weather',
                    lift: value,
                    topic: 'light',
                    text:
                       away <= 45
                          ? `Inside ${nearer ? 'first' : 'last'} light.`
                          : `Within ${Math.round(away / 30) / 2} hours of ${nearer ? 'first' : 'last'} light.`,
                 }
         )
      );
   }

   /* Swell, where there is any. Inland this whole block is simply absent. */
   if (isNumber(hour.swellHeightM)) {
      const swell = hour.swellHeightM;
      const value = along(swell, [
         [0, -0.7],
         [0.6, -0.1],
         [1.1, 0.5],
         [2.4, 0.5],
         [3, 0],
         [3.6, -0.7],
         [4.5, -1],
      ]);
      parts.push(
         part(0.9, value, {
            from: 'weather',
            lift: value,
            topic: 'swell',
            text:
               value >= 0.45
                  ? `Swell ${write.height(swell)}, enough to work the gullies.`
                  : swell < 0.6
                    ? `Swell ${write.height(swell)}, too flat to stir anything.`
                    : `Swell ${write.height(swell)}, big water.`,
         })
      );

      if (swell >= 4 && !veto) {
         veto = {
            from: 'weather',
            lift: -1.5,
            topic: 'veto',
            text: `Swell ${write.height(swell)}. Nobody should be on the rocks in that.`,
         };
      }
   }

   if (isNumber(hour.swellPeriodS)) {
      const value = along(hour.swellPeriodS, [
         [4, -0.6],
         [7, -0.1],
         [9, 0.35],
         [13, 0.5],
         [17, 0.1],
         [20, -0.1],
      ]);
      parts.push(
         part(
            0.4,
            value,
            value <= -0.3
               ? {
                    from: 'weather',
                    lift: value,
                    topic: 'swell-period',
                    text: `${Math.round(hour.swellPeriodS)} second period, so it is wind chop rather than swell.`,
                 }
               : null
         )
      );
   }

   /* The sky. Thunder first: an angler on a point holds a carbon rod. */
   const stormy = /thunder|storm/i.test(hour.conditionText ?? '');
   const cape = isNumber(hour.cape) ? hour.cape : 0;

   if (stormy || cape >= 1000) {
      const text = stormy
         ? 'Thunderstorm forecast. A carbon rod on a point is a lightning rod.'
         : 'Enough energy in the air for thunder.';
      parts.push(
         part(0.8, -1, { from: 'weather', lift: -1, topic: 'sky', text })
      );
      if (stormy && !veto)
         veto = { from: 'weather', lift: -1.5, topic: 'veto', text };
   } else if (
      isNumber(hour.precipitationProbability) &&
      hour.precipitationProbability >= 70 &&
      isNumber(hour.precipitationMm) &&
      hour.precipitationMm >= 1.5
   ) {
      parts.push(
         part(0.5, -0.45, {
            from: 'weather',
            lift: -0.45,
            topic: 'sky',
            text: `${hour.precipitationProbability}% chance of rain, and ${round1(hour.precipitationMm)} mm of it.`,
         })
      );
   } else if (isNumber(hour.cloudCover) && hour.isDaytime === true) {
      const value = along(hour.cloudCover, [
         [0, -0.3],
         [25, -0.05],
         [55, 0.25],
         [95, 0.25],
      ]);
      parts.push(part(0.4, value, null));
   }

   const total = parts.reduce((sum, p) => sum + p.weight, 0);
   const value =
      total === 0
         ? 0
         : parts.reduce((s, p) => s + p.weight * p.value, 0) / total;

   const reasons = parts
      .map((p) => p.reason)
      .filter((r): r is Reason => r !== null);

   return { value: clamp(value), reasons, veto };
}

/* ---------- the log block ---------- */

type LogDimension = {
   key: string;
   /* What a line about this dimension is about, so it never doubles up. */
   topic: string;
   weight: number;
   values: number[];
   /** What this hour reads, on the same scale. */
   at: number | null;
   leastCount: number;
   /** Circular readings wrap; the rest are compared against quantiles. */
   circular?: { wrap: number; within: number };
   say: (fit: {
      value: number;
      q25?: number;
      q75?: number;
      hits?: number;
      n: number;
   }) => string | null;
};

type LogReading = {
   value: number;
   reasons: Reason[];
   /** How much of the log's weight could actually be read. */
   coverage: number;
};

function logScore(hour: RatingHour, dimensions: LogDimension[]): LogReading {
   const parts: Part[] = [];
   let offered = 0;

   for (const dimension of dimensions) {
      offered += dimension.weight;
      if (dimension.at === null) continue;

      const fit = dimension.circular
         ? fitCircular(
              dimension.at,
              dimension.values,
              dimension.circular.wrap,
              dimension.circular.within,
              dimension.leastCount
           )
         : fitToLog(dimension.at, dimension.values, dimension.leastCount);

      if (!fit) continue;

      const text = dimension.say(fit);
      parts.push(
         part(
            dimension.weight,
            fit.value,
            text === null
               ? null
               : { from: 'log', lift: fit.value, topic: dimension.topic, text }
         )
      );
   }

   const total = parts.reduce((sum, p) => sum + p.weight, 0);
   const value =
      total === 0
         ? 0
         : parts.reduce((s, p) => s + p.weight * p.value, 0) / total;

   return {
      value: clamp(value),
      reasons: parts
         .map((p) => p.reason)
         .filter((r): r is Reason => r !== null),
      coverage: offered === 0 ? 0 : total / offered,
   };
}

/* ---------- putting the three together ---------- */

/*
 * The weights the brief asks for: his own log first, the weather second, the
 * moon third. The log's share is earned rather than assumed, and whatever it
 * has not earned goes to the other two in their own proportion, so a brand
 * new log gives a forecast read purely on the weather and the moon rather
 * than a score with a hole in it.
 */
const WEIGHTS = { log: 0.5, weather: 0.3, moon: 0.2 } as const;

const bandFor = (score: number): Band =>
   score < 45
      ? 'bad'
      : score < 66
        ? 'good'
        : score < 82
          ? 'great'
          : 'exceptional';

/*
 * A day is scored on its best three hours running rather than its average
 * one, because that is what an angler drives out for. Measured over a real
 * week those windows land about six points above the run of the hours, so the
 * day scale is set six points higher and a great day still means something.
 */
const bandForDay = (score: number): Band => bandFor(score - 6);

export const BAND_WORDS: Record<Band, string> = {
   bad: 'Bad',
   good: 'Good',
   great: 'Great',
   exceptional: 'Exceptional',
};

/*
 * The lines worth printing.
 *
 * Strongest first, and one per subject: the general wind rule and the wind
 * his own fish came on are the same subject said twice, and the log wins
 * because it is his. Never more than one line about any one thing.
 */
const RANK: Record<Source, number> = { log: 0, weather: 1, moon: 2 };

function pickReasons(reasons: Reason[], take: number): Reason[] {
   const byTopic = new Map<string, Reason>();

   for (const reason of reasons) {
      const held = byTopic.get(reason.topic);
      if (
         !held ||
         RANK[reason.from] < RANK[held.from] ||
         (RANK[reason.from] === RANK[held.from] &&
            Math.abs(reason.lift) > Math.abs(held.lift))
      ) {
         byTopic.set(reason.topic, reason);
      }
   }

   return [...byTopic.values()]
      .sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift))
      .slice(0, take);
}

export function rateForecast(input: RatingInput): ForecastRating {
   const { latitude, longitude, hours, days, log } = input;
   const write = writersFor(input.units ?? 'METRIC');

   if (hours.length === 0) {
      return {
         hours: [],
         days: [],
         basis: {
            catches: log.length,
            used: 0,
            confidence: 'thin',
            note: 'No hours to read.',
         },
         best: null,
      };
   }

   /* ---- the moon, for the week and for every catch in the log ---- */

   const published: MoonEvent[] = [];
   for (const day of days) {
      const rise = instant(day.moonrise);
      const set = instant(day.moonset);
      if (rise !== null) published.push({ kind: 'moonrise', at: rise });
      if (set !== null) published.push({ kind: 'moonset', at: set });
   }

   const firstHour = instant(hours[0]?.time ?? null) ?? Date.now();
   const lastHour =
      instant(hours[hours.length - 1]?.time ?? null) ??
      firstHour + 6 * 86_400_000;
   const weekPeriods = solunarPeriods(
      firstHour,
      lastHour,
      latitude,
      longitude,
      published
   );

   const fractionByDate = new Map(
      days.map((day) => [day.date, day.moonFraction] as const)
   );

   /*
    * Where each logged fish sat against the moon. A catch that stored its own
    * position gets its own sky; one that did not is read at the place being
    * rated, which is the nearest thing to the truth we have and, for an angler
    * who fishes one coast, close to it.
    */
   const logMoon = log.map((entry) => {
      const at = entry.caughtAt.getTime();
      const lat = isNumber(entry.latitude) ? entry.latitude : latitude;
      const lng = isNumber(entry.longitude) ? entry.longitude : longitude;
      const periods = solunarPeriods(at - HOUR_MS, at + HOUR_MS, lat, lng);
      const nearest = minutesToNearestPeriod(at, periods);
      return {
         entry,
         minutes: nearest ? nearest.minutes : null,
         period: nearest ? nearest.period : null,
         inside: nearest
            ? insidePeriod(nearest.minutes, nearest.period)
            : false,
      };
   });

   /* ---- the dimensions the log can be read on ---- */

   const readings = <T>(pick: (entry: LoggedConditions) => T | null): T[] =>
      log.map(pick).filter((v): v is T => v !== null && v !== undefined);

   const windValues = readings((c) =>
      isNumber(c.windSpeedKph) ? c.windSpeedKph : null
   );
   const directionValues = readings((c) =>
      isNumber(c.windDirectionDegrees) ? c.windDirectionDegrees : null
   );
   const pressureValues = readings((c) =>
      isNumber(c.pressureMsl) ? c.pressureMsl : null
   );
   const seaValues = readings((c) =>
      isNumber(c.seaSurfaceTemperatureC) ? c.seaSurfaceTemperatureC : null
   );
   const swellValues = readings((c) =>
      isNumber(c.swellHeightM) ? c.swellHeightM : null
   );
   const periodValues = readings((c) =>
      isNumber(c.swellPeriodS) ? c.swellPeriodS : null
   );
   const cloudValues = readings((c) =>
      isNumber(c.cloudCover) ? c.cloudCover : null
   );
   const illuminationValues = readings((c) =>
      isNumber(c.moonIllumination) ? c.moonIllumination : null
   );

   /*
    * The hour of the day a fish came out, on the clock of the place being
    * rated. It is the one reading every catch carries, so it is the first
    * thing a new log can say about its owner.
    */
   const hourValues = log.map((entry) => {
      const shifted = entry.caughtAt.getTime() + input.utcOffsetSeconds * 1000;
      const date = new Date(shifted);
      return date.getUTCHours() + date.getUTCMinutes() / 60;
   });

   const moonMinuteValues = logMoon
      .map((m) => m.minutes)
      .filter((m): m is number => m !== null);

   /* Who the fish inside a moon period were, for a sentence worth reading. */
   const insideLog = logMoon.filter((m) => m.inside);
   const moonSentence = () => {
      if (insideLog.length < 3) return null;

      const byWhat = new Map<SolunarPeriod['what'], number>();
      for (const m of insideLog) {
         if (!m.period) continue;
         byWhat.set(m.period.what, (byWhat.get(m.period.what) ?? 0) + 1);
      }
      const topWhat = [...byWhat.entries()].sort((a, b) => b[1] - a[1])[0];

      const bySpecies = new Map<string, number>();
      for (const m of insideLog) {
         const name = m.entry.species;
         if (!name) continue;
         bySpecies.set(name, (bySpecies.get(name) ?? 0) + 1);
      }
      const topSpecies = [...bySpecies.entries()].sort(
         (a, b) => b[1] - a[1]
      )[0];

      const window =
         topWhat && topWhat[1] >= Math.ceil(insideLog.length * 0.5)
            ? PERIOD_WORDS[topWhat[0]]
            : 'a moon period';

      if (topSpecies && topSpecies[1] >= 3) {
         const [name, hits] = topSpecies;
         const ofThose = log.filter((c) => c.species === name).length;
         return `${Count(hits)} of your ${count(ofThose)} ${name.toLowerCase()} came within an hour of ${window}`;
      }

      return `${Count(insideLog.length)} of your ${log.length} logged fish came within an hour of ${window}`;
   };

   const moonLine = moonSentence();

   const dimensionsFor = (hour: RatingHour): LogDimension[] => {
      const at = instant(hour.time);
      const localHour = Number(hour.local.slice(11, 13));
      const nearest =
         at === null ? null : minutesToNearestPeriod(at, weekPeriods);

      return [
         {
            key: 'pressure',
            topic: 'pressure',
            weight: 1,
            values: pressureValues,
            at: isNumber(hour.pressureMsl) ? hour.pressureMsl : null,
            leastCount: 5,
            say: (fit) =>
               fit.q25 === undefined || fit.q75 === undefined
                  ? null
                  : fit.value > 0.2
                    ? `Your fish come in ${Math.round(fit.q25)} to ${Math.round(fit.q75)} hPa, and this hour is ${Math.round(hour.pressureMsl as number)}.`
                    : fit.value < -0.2
                      ? `${Math.round(hour.pressureMsl as number)} hPa, outside the ${Math.round(fit.q25)} to ${Math.round(fit.q75)} your fish come in.`
                      : null,
         },
         {
            key: 'wind',
            topic: 'wind',
            weight: 1,
            values: windValues,
            at: isNumber(hour.windSpeedKph) ? hour.windSpeedKph : null,
            leastCount: 5,
            say: (fit) =>
               fit.q25 === undefined || fit.q75 === undefined
                  ? null
                  : fit.value > 0.2
                    ? `Your fish come on ${write.speedFigure(fit.q25)} to ${write.speed(fit.q75)} of wind, and this hour is ${write.speedFigure(hour.windSpeedKph as number)}.`
                    : fit.value < -0.2
                      ? `${write.speed(hour.windSpeedKph as number)} of wind, outside the ${write.speedFigure(fit.q25)} to ${write.speed(fit.q75)} your fish come on.`
                      : null,
         },
         {
            key: 'direction',
            topic: 'wind-direction',
            weight: 0.8,
            values: directionValues,
            at: isNumber(hour.windDirectionDegrees)
               ? hour.windDirectionDegrees
               : null,
            leastCount: 6,
            circular: { wrap: 360, within: 45 },
            say: (fit) =>
               fit.hits === undefined || fit.hits < 2 || fit.value <= 0.2
                  ? null
                  : `${Count(fit.hits)} of your ${fit.n} logged fish came on a wind out of the ${toCardinal(hour.windDirectionDegrees)}.`,
         },
         {
            key: 'time',
            topic: 'time-of-day',
            weight: 0.8,
            values: hourValues,
            at: localHour,
            leastCount: 6,
            circular: { wrap: 24, within: 2 },
            say: (fit) =>
               fit.hits === undefined || fit.hits < 3 || fit.value <= 0.2
                  ? null
                  : `${Count(fit.hits)} of your ${fit.n} fish came within two hours of this time of day.`,
         },
         {
            /*
             * How far this hour sits from a solunar period, against how far
             * his own fish sat from one. The sentence is only ever printed
             * when this hour is actually inside a window: telling a reader
             * that his fish come on the moon while the nearest period is two
             * hours off would be an argument against itself.
             */
            key: 'moon',
            topic: 'moon-period',
            weight: 0.8,
            values: moonMinuteValues,
            at: nearest ? nearest.minutes : null,
            leastCount: 6,
            say: (fit) =>
               fit.value > 0.25 &&
               moonLine !== null &&
               nearest !== null &&
               insidePeriod(nearest.minutes, nearest.period)
                  ? `${moonLine}, and this hour is inside one.`
                  : null,
         },
         {
            key: 'sea',
            topic: 'water',
            weight: 0.7,
            values: seaValues,
            at: isNumber(hour.seaSurfaceTemperatureC)
               ? hour.seaSurfaceTemperatureC
               : null,
            leastCount: 5,
            say: (fit) =>
               fit.q25 === undefined || fit.q75 === undefined
                  ? null
                  : fit.value > 0.2
                    ? `Water ${write.temp(hour.seaSurfaceTemperatureC as number)}, inside the ${write.tempFigure(fit.q25)} to ${write.temp(fit.q75)} your fish come in.`
                    : fit.value < -0.3
                      ? `Water ${write.temp(hour.seaSurfaceTemperatureC as number)}, outside the ${write.tempFigure(fit.q25)} to ${write.temp(fit.q75)} your fish come in.`
                      : null,
         },
         {
            key: 'swell',
            topic: 'swell',
            weight: 0.7,
            values: swellValues,
            at: isNumber(hour.swellHeightM) ? hour.swellHeightM : null,
            leastCount: 5,
            say: (fit) =>
               fit.q25 === undefined || fit.q75 === undefined
                  ? null
                  : fit.value > 0.2
                    ? `Swell ${write.height(hour.swellHeightM as number)}, inside the ${write.heightFigure(fit.q25)} to ${write.height(fit.q75)} your fish come in.`
                    : null,
         },
         {
            key: 'swellPeriod',
            topic: 'swell-period',
            weight: 0.4,
            values: periodValues,
            at: isNumber(hour.swellPeriodS) ? hour.swellPeriodS : null,
            leastCount: 5,
            say: () => null,
         },
         {
            key: 'illumination',
            topic: 'moon-light',
            weight: 0.5,
            values: illuminationValues,
            at: (() => {
               const fraction = fractionByDate.get(hour.local.slice(0, 10));
               return isNumber(fraction)
                  ? (1 - Math.cos(2 * Math.PI * fraction)) / 2
                  : null;
            })(),
            leastCount: 6,
            say: () => null,
         },
         {
            key: 'cloud',
            topic: 'cloud',
            weight: 0.3,
            values: cloudValues,
            at: isNumber(hour.cloudCover) ? hour.cloudCover : null,
            leastCount: 6,
            say: () => null,
         },
      ];
   };

   /*
    * How much the log has earned. Everything in it says something about the
    * time of day and the moon; only a catch that stored its weather can say
    * anything about pressure or wind, and this product has been storing that
    * for less time than it has been storing fish.
    */
   const withWeather = log.filter((entry) => {
      const has = [
         entry.windSpeedKph,
         entry.pressureMsl,
         entry.seaSurfaceTemperatureC,
         entry.swellHeightM,
      ].filter(isNumber).length;
      return has >= 2;
   }).length;

   const confidence: Confidence =
      log.length < 5 ? 'thin' : withWeather < 8 ? 'building' : 'solid';

   const earned =
      confidence === 'thin'
         ? 0
         : Math.min(1, log.length / 20) * 0.5 +
           Math.min(1, withWeather / 20) * 0.5;

   const logWeight = WEIGHTS.log * earned;
   const spare = WEIGHTS.log - logWeight;
   const weatherWeight =
      WEIGHTS.weather +
      (spare * WEIGHTS.weather) / (WEIGHTS.weather + WEIGHTS.moon);
   const moonWeight =
      WEIGHTS.moon + (spare * WEIGHTS.moon) / (WEIGHTS.weather + WEIGHTS.moon);

   const note =
      confidence === 'thin'
         ? log.length === 0
            ? 'Read from the weather and the moon. Log a few catches and this starts reading your own water.'
            : `Read from the weather and the moon. ${Count(log.length)} catches in your log is not enough to read you yet.`
         : confidence === 'building'
           ? `Read from your ${log.length} catches, ${count(withWeather)} of them with their conditions stored, so it still leans on the weather and the moon.`
           : `Read from your ${log.length} catches, ${withWeather} of them with their conditions stored.`;

   /* ---- every hour ---- */

   const sunByDate = new Map(
      days.map(
         (day) =>
            [
               day.date,
               { rise: instant(day.sunrise), set: instant(day.sunset) },
            ] as const
      )
   );

   type Worked = {
      hour: RatingHour;
      score: number;
      band: Band;
      reasons: Reason[];
   };

   const worked: Worked[] = hours.map((hour, index) => {
      const date = hour.local.slice(0, 10);
      const sun = sunByDate.get(date) ?? { rise: null, set: null };
      const at = instant(hour.time);

      const weather = weatherScore(
         hour,
         hours.slice(Math.max(0, index - 6), index),
         sun.rise,
         sun.set,
         write
      );
      const own = logScore(hour, dimensionsFor(hour));
      const moon =
         at === null
            ? { value: 0, period: null, minutesAway: null }
            : solunarReading(at, weekPeriods, fractionByDate.get(date) ?? null);

      const reasons = [...weather.reasons, ...own.reasons];

      if (moon.value >= 0.4 && moon.period) {
         const word = PERIOD_WORDS[moon.period.what];
         const when = new Date(moon.period.at + input.utcOffsetSeconds * 1000)
            .toISOString()
            .slice(11, 16);
         reasons.push({
            from: 'moon',
            lift: moon.value,
            topic: 'moon-period',
            text:
               moon.period.kind === 'major'
                  ? `Major period, ${word} at ${when}.`
                  : `Minor period, ${word} at ${when}.`,
         });
      }

      /*
       * The log's share is only as big as the part of it that could be read
       * for this hour. Inland there is no sea temperature to compare against,
       * and an hour that can only be read on two dimensions should not be
       * spoken about with the confidence of one read on eight.
       */
      const usedLogWeight = logWeight * own.coverage;
      const spread = Math.max(0, logWeight - usedLogWeight);
      const weatherShare =
         weatherWeight +
         (spread * weatherWeight) / (weatherWeight + moonWeight);
      const moonShare =
         moonWeight + (spread * moonWeight) / (weatherWeight + moonWeight);

      const raw =
         (usedLogWeight * own.value +
            weatherShare * weather.value +
            moonShare * moon.value) /
         (usedLogWeight + weatherShare + moonShare || 1);

      let score = Math.round(50 + 50 * clamp(raw));
      let band = bandFor(score);

      /*
       * Exceptional has to be earned. It needs the weather clearly on its
       * side and either his own log agreeing or a major period landing on it,
       * and it is never handed out on a log too thin to have an opinion.
       */
      if (band === 'exceptional') {
         const earnedIt =
            confidence !== 'thin' &&
            weather.value >= 0.4 &&
            (own.value >= 0.45 || moon.value >= 0.8);
         if (!earnedIt) {
            score = Math.min(score, 81);
            band = 'great';
         }
      }

      if (weather.veto) {
         score = Math.min(score, 26);
         band = 'bad';
         reasons.unshift(weather.veto);
      }

      return { hour, score, band, reasons };
   });

   /* ---- every day, off its best three hours running ---- */

   const dayRatings: RatedDay[] = days.map((day) => {
      const own = worked.filter((w) => w.hour.local.startsWith(day.date));

      if (own.length === 0) {
         return {
            date: day.date,
            score: 0,
            band: 'bad',
            bestFrom: null,
            bestTo: null,
            reasons: [],
         };
      }

      const span = Math.min(3, own.length);
      let bestAt = 0;
      let bestMean = -Infinity;

      for (let i = 0; i + span <= own.length; i += 1) {
         const mean =
            own.slice(i, i + span).reduce((sum, w) => sum + w.score, 0) / span;
         if (mean > bestMean) {
            bestMean = mean;
            bestAt = i;
         }
      }

      const window = own.slice(bestAt, bestAt + span);
      const peak = window.reduce(
         (best, w) => (w.score > best.score ? w : best),
         window[0] as Worked
      );
      const score = Math.round(bestMean);

      /*
       * A day is exceptional only when the hours inside its own best window
       * were, which is the honest reading of a word that has to stay rare.
       */
      const peaked = window.some((w) => w.band === 'exceptional');
      let band = bandForDay(score);
      if (peaked && score >= 80) band = 'exceptional';
      else if (band === 'exceptional' && !peaked) band = 'great';
      if (window.every((w) => w.band === 'bad')) band = 'bad';

      return {
         date: day.date,
         score,
         band,
         bestFrom: clock((window[0] as Worked).hour.local),
         bestTo: clock((window[window.length - 1] as Worked).hour.local),
         reasons: pickReasons(peak.reasons, 4),
      };
   });

   const best = dayRatings.reduce<RatedDay | null>(
      (top, day) => (top === null || day.score > top.score ? day : top),
      null
   );

   return {
      hours: worked.map((w) => ({
         local: w.hour.local,
         score: w.score,
         band: w.band,
         why: pickReasons(w.reasons, 1)[0]?.text ?? null,
      })),
      days: dayRatings,
      basis: { catches: log.length, used: withWeather, confidence, note },
      best:
         best === null
            ? null
            : { date: best.date, from: best.bestFrom, to: best.bestTo },
   };
}
