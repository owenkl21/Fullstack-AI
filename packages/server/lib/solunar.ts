/*
 * Solunar periods, worked out rather than fetched.
 *
 * The obvious source, api.solunar.org, refuses connections, and a free service
 * with nobody behind it has already broken this product once. Solunar periods
 * are pure astronomy, so there is nothing to fetch: the moon is where it is
 * whether a server answers or not.
 *
 * The theory is old and simple. Fish feed harder when the moon is overhead
 * (upper transit) or underfoot (lower transit), and again, more weakly, as it
 * rises and sets. The strong windows are the majors, the weak ones the minors.
 * Nobody has to believe the theory for the arithmetic to be worth having: the
 * scorer treats a period as a lift and never as a penalty, and the reasons say
 * plainly which window an hour sits in.
 *
 * Where the numbers come from:
 *
 * - Moonrise and moonset come from Open-Meteo for the week ahead, so the
 *   periods on the forecast page line up with the times printed beside them.
 * - A transit is the midpoint between a rise and the set that follows it, and
 *   a lower transit the midpoint between a set and the rise after it. That is
 *   the brief's own rule, and it is right to within a couple of minutes.
 * - For anything Open-Meteo did not publish, which is every catch already in
 *   the log and the two edges of the week, the rise and set are found by
 *   walking the moon's altitude. The position is the standard low precision
 *   lunar series: mean longitude, one term of the equation of the centre and
 *   one term of the latitude, which is good to a few arcminutes. That is
 *   minutes of time on a rise, and an hour either side is what a period is.
 *
 * Pure, and it depends on nothing. Every function here takes a moment and a
 * place and returns a number.
 */

const RAD = Math.PI / 180;
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/* J2000.0, which is 2000 January 1 at 12:00 UTC. */
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

/* The tilt of the earth against its orbit. */
const OBLIQUITY = RAD * 23.4397;

/*
 * The altitude at which the moon counts as risen: refraction lifts it about
 * 0.57 of a degree, its own radius adds a quarter and parallax takes nearly a
 * degree back off, which lands a little above the flat horizon.
 */
const HORIZON_DEGREES = 0.125;

const daysSinceJ2000 = (ms: number) => (ms - J2000_MS) / DAY_MS;

/*
 * Where the moon is against the stars. Mean longitude, mean anomaly and the
 * argument of latitude all run at their own steady rates; one sine term on
 * each is the whole of this approximation, and it is the one every small
 * astronomy library uses because the next terms are worth minutes of arc.
 */
function moonEquatorial(ms: number) {
   const d = daysSinceJ2000(ms);
   const meanLongitude = RAD * (218.316 + 13.176396 * d);
   const meanAnomaly = RAD * (134.963 + 13.064993 * d);
   const argumentOfLatitude = RAD * (93.272 + 13.22935 * d);

   const longitude = meanLongitude + RAD * 6.289 * Math.sin(meanAnomaly);
   const latitude = RAD * 5.128 * Math.sin(argumentOfLatitude);

   const rightAscension = Math.atan2(
      Math.sin(longitude) * Math.cos(OBLIQUITY) -
         Math.tan(latitude) * Math.sin(OBLIQUITY),
      Math.cos(longitude)
   );
   const declination = Math.asin(
      Math.sin(latitude) * Math.cos(OBLIQUITY) +
         Math.cos(latitude) * Math.sin(OBLIQUITY) * Math.sin(longitude)
   );

   return { rightAscension, declination };
}

/** How high the moon stands at a moment and a place, in degrees. */
export function moonAltitude(
   ms: number,
   latitude: number,
   longitude: number
): number {
   const { rightAscension, declination } = moonEquatorial(ms);
   const d = daysSinceJ2000(ms);
   const siderealTime = RAD * (280.16 + 360.9856235 * d) + RAD * longitude;
   const hourAngle = siderealTime - rightAscension;
   const phi = RAD * latitude;

   return (
      Math.asin(
         Math.sin(phi) * Math.sin(declination) +
            Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle)
      ) / RAD
   );
}

export type MoonEventKind = 'moonrise' | 'moonset';

export type MoonEvent = { kind: MoonEventKind; at: number };

export type SolunarPeriod = {
   kind: 'major' | 'minor';
   /** The middle of the window, in milliseconds. */
   at: number;
   what: 'overhead' | 'underfoot' | 'moonrise' | 'moonset';
};

/** The words the reasons use, so nothing has to translate them twice. */
export const PERIOD_WORDS: Record<SolunarPeriod['what'], string> = {
   overhead: 'the moon overhead',
   underfoot: 'the moon underfoot',
   moonrise: 'moonrise',
   moonset: 'moonset',
};

/*
 * A major runs an hour either side of the transit and a minor half an hour
 * either side of the rise or set, which is the common reading of the theory.
 * The edge is where the lift has faded to nothing, so an hour a little outside
 * a window still counts for something rather than falling off a cliff.
 */
const CORE_MINUTES = { major: 60, minor: 30 } as const;
const EDGE_MINUTES = { major: 110, minor: 65 } as const;
const PEAK = { major: 1, minor: 0.62 } as const;

/*
 * Every rise and set in a window, walked out of the altitude curve.
 *
 * Ten minute steps: the moon climbs at most about fifteen degrees an hour, so
 * a crossing can never hide between two samples, and the bisection that
 * follows brings each one inside a second.
 */
function walkEvents(
   fromMs: number,
   toMs: number,
   latitude: number,
   longitude: number
): MoonEvent[] {
   const step = 10 * MINUTE_MS;
   const events: MoonEvent[] = [];
   let previous = moonAltitude(fromMs, latitude, longitude) - HORIZON_DEGREES;

   for (let t = fromMs + step; t <= toMs; t += step) {
      const current = moonAltitude(t, latitude, longitude) - HORIZON_DEGREES;

      if (previous === 0 || current === 0 || previous * current < 0) {
         const kind: MoonEventKind =
            current > previous ? 'moonrise' : 'moonset';
         let low = t - step;
         let high = t;
         let lowValue = previous;

         for (let i = 0; i < 22; i += 1) {
            const middle = (low + high) / 2;
            const value =
               moonAltitude(middle, latitude, longitude) - HORIZON_DEGREES;
            if (lowValue * value <= 0) {
               high = middle;
            } else {
               low = middle;
               lowValue = value;
            }
         }

         events.push({ kind, at: Math.round((low + high) / 2) });
      }

      previous = current;
   }

   return events;
}

/*
 * The rises and sets Open-Meteo published, with the walked ones filling the
 * gaps. A published time wins wherever the two agree to within an hour and a
 * half, which they always do; the walk is there for the day Open-Meteo has no
 * rise to publish, and for the hours either side of the week it was asked for.
 */
function mergeEvents(walked: MoonEvent[], published: MoonEvent[]): MoonEvent[] {
   const merged = [...published];

   for (const event of walked) {
      const already = published.some(
         (known) =>
            known.kind === event.kind &&
            Math.abs(known.at - event.at) < 90 * MINUTE_MS
      );
      if (!already) merged.push(event);
   }

   return merged.sort((a, b) => a.at - b.at);
}

/**
 * The major and minor periods covering a window of time at a place.
 *
 * `published` is whatever Open-Meteo already said about the days in question.
 * Pass none and the whole thing comes out of the altitude curve, which is what
 * every catch already in the log needs.
 */
export function solunarPeriods(
   fromMs: number,
   toMs: number,
   latitude: number,
   longitude: number,
   published: MoonEvent[] = []
): SolunarPeriod[] {
   if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

   /*
    * Half a day of margin at each end. A period near midnight is decided by a
    * rise on the other side of the boundary, and without the margin the first
    * and last hours of a week would quietly lose their majors.
    */
   const from = fromMs - 14 * HOUR_MS;
   const to = toMs + 14 * HOUR_MS;

   const events = mergeEvents(
      walkEvents(from, to, latitude, longitude),
      published.filter((event) => event.at >= from && event.at <= to)
   );

   const periods: SolunarPeriod[] = events.map((event) => ({
      kind: 'minor',
      at: event.at,
      what: event.kind,
   }));

   /*
    * A transit is the midpoint of the rise and the set on either side of it,
    * which is the brief's own rule and right to a couple of minutes. Rise to
    * set is the moon overhead; set to the next rise is the moon underfoot.
    * A pair more than eighteen hours apart is a gap in the events rather than
    * a real arc, so it is left alone.
    */
   for (let i = 0; i < events.length - 1; i += 1) {
      const first = events[i];
      const second = events[i + 1];
      if (!first || !second) continue;
      if (first.kind === second.kind) continue;
      if (second.at - first.at > 18 * HOUR_MS) continue;

      periods.push({
         kind: 'major',
         at: Math.round((first.at + second.at) / 2),
         what: first.kind === 'moonrise' ? 'overhead' : 'underfoot',
      });
   }

   return periods
      .filter((period) => period.at >= from && period.at <= to)
      .sort((a, b) => a.at - b.at);
}

export type SolunarReading = {
   /** Nought when no period is anywhere near, one at the peak of a major. */
   value: number;
   period: SolunarPeriod | null;
   /** How far this moment sits from that period, in minutes. */
   minutesAway: number | null;
};

/*
 * How much of a lift a moment gets from the moon.
 *
 * Never negative. An hour with no period near it is an ordinary hour, not a
 * bad one, and a scorer that punished the other twenty hours of the day for
 * not being a solunar window would be saying something the theory does not.
 *
 * Spring tides carry the lift: the periods are held to be strongest around the
 * new and the full moon, which is also when a shore angler gets the most water
 * movement. A quarter moon keeps three quarters of the lift.
 */
export function solunarReading(
   atMs: number,
   periods: SolunarPeriod[],
   moonFraction: number | null
): SolunarReading {
   let best: SolunarReading = { value: 0, period: null, minutesAway: null };

   for (const period of periods) {
      const away = Math.abs(atMs - period.at) / MINUTE_MS;
      const core = CORE_MINUTES[period.kind];
      const edge = EDGE_MINUTES[period.kind];
      if (away > edge) continue;

      const falloff =
         away <= core ? 1 : Math.max(0, (edge - away) / (edge - core));
      const value = PEAK[period.kind] * falloff;

      if (value > best.value || best.period === null) {
         best = { value, period, minutesAway: Math.round(away) };
      }
   }

   if (best.value === 0) return { value: 0, period: null, minutesAway: null };

   return { ...best, value: best.value * springLift(moonFraction) };
}

/*
 * How close the moon is to new or full, as a lift between 0.75 and 1. Seven
 * days off either of them is a quarter moon, which is as weak as it gets.
 */
export function springLift(moonFraction: number | null): number {
   if (moonFraction === null || !Number.isFinite(moonFraction)) return 0.85;

   const fraction = ((moonFraction % 1) + 1) % 1;
   const toNew = Math.min(fraction, 1 - fraction);
   const toFull = Math.abs(fraction - 0.5);
   const daysAway = Math.min(toNew, toFull) * 29.530588853;
   const springness = Math.max(0, Math.min(1, 1 - daysAway / 7));

   return 0.75 + 0.25 * springness;
}

/** Minutes from a moment to the middle of the nearest period, whatever its kind. */
export function minutesToNearestPeriod(
   atMs: number,
   periods: SolunarPeriod[]
): { minutes: number; period: SolunarPeriod } | null {
   let best: { minutes: number; period: SolunarPeriod } | null = null;

   for (const period of periods) {
      const minutes = Math.abs(atMs - period.at) / MINUTE_MS;
      if (!best || minutes < best.minutes) best = { minutes, period };
   }

   return best;
}

/** Whether a moment sits inside a period's core window. */
export const insidePeriod = (minutes: number, period: SolunarPeriod) =>
   minutes <= CORE_MINUTES[period.kind];
