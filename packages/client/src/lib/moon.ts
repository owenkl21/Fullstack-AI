/*
 * Moon phase and illumination for a moment in time.
 *
 * Open-Meteo does not publish a moon phase, and a shore angler plans around one:
 * spring tides run with the new and the full moon, and plenty of species feed
 * harder on them. It is arithmetic rather than a lookup, so there is nothing to
 * fetch and nothing to fail.
 *
 * The method is the standard mean-phase approximation from the synodic month.
 * It is accurate to well under a day, which is the resolution anyone fishing
 * actually uses, and it never disagrees with a calendar about which phase it is.
 */

const SYNODIC_DAYS = 29.530588853;

/* A known new moon: 2000 Jan 6, 18:14 UTC. */
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14) / 86400000;

export type MoonPhase = {
   /* 0 at new, 0.5 at full, approaching 1 back at new. */
   fraction: number;
   /* How much of the disc is lit, 0 to 1. */
   illumination: number;
   name: string;
   /* Spring tides run with the new and the full moon. */
   spring: boolean;
};

const NAMES = [
   'New moon',
   'Waxing crescent',
   'First quarter',
   'Waxing gibbous',
   'Full moon',
   'Waning gibbous',
   'Last quarter',
   'Waning crescent',
];

export function moonPhase(when: Date): MoonPhase {
   const days = when.getTime() / 86400000 - KNOWN_NEW_MOON;
   const fraction = (((days / SYNODIC_DAYS) % 1) + 1) % 1;

   /*
    * Illuminated fraction of the disc. Zero at new, one at full, and symmetric
    * either side, which is what the cosine gives.
    */
   const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;

   /*
    * Eight named phases, each centred on its eighth rather than starting at it,
    * so "full moon" covers the days either side of full rather than only after.
    */
   const index = Math.floor(((fraction + 1 / 16) % 1) * 8) % 8;

   /* Within about three days of new or full. */
   const toNew = Math.min(fraction, 1 - fraction);
   const toFull = Math.abs(fraction - 0.5);
   const spring = Math.min(toNew, toFull) * SYNODIC_DAYS <= 3;

   return {
      fraction,
      illumination,
      name: NAMES[index] ?? 'New moon',
      spring,
   };
}
