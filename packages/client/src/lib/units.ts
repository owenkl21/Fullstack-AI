import { useSyncExternalStore } from 'react';

/*
 * The units an angler reads in.
 *
 * Everything is stored and sent in metric: centimetres and kilograms. The unit
 * is a property of the reader, not of the record, so two anglers can open the
 * same competition and each see the figures the way they think about fish while
 * the standings underneath are identical.
 *
 * Kept in localStorage rather than fetched, so a page never renders in the
 * wrong unit for a moment and then jumps.
 */

export type UnitSystem = 'METRIC' | 'IMPERIAL';

const KEY = 'unit-system';

const CM_PER_INCH = 2.54;
const KG_PER_POUND = 0.45359237;

export function readUnitSystem(): UnitSystem {
   try {
      return localStorage.getItem(KEY) === 'IMPERIAL' ? 'IMPERIAL' : 'METRIC';
   } catch {
      /* South Africa is metric, so that is the safe assumption. */
      return 'METRIC';
   }
}

export function writeUnitSystem(system: UnitSystem) {
   try {
      localStorage.setItem(KEY, system);
   } catch {
      /* Storage refused. The choice lasts for this page and no longer. */
   }
}

/** A length held in centimetres, written the way the reader wants it. */
export function formatLength(
   cm: number | null | undefined,
   system: UnitSystem
): string | null {
   if (typeof cm !== 'number' || !Number.isFinite(cm)) {
      return null;
   }

   if (system === 'IMPERIAL') {
      return `${(cm / CM_PER_INCH).toFixed(1)} in`;
   }

   /* Whole centimetres: nobody measures a fish to the millimetre on a beach. */
   return `${Math.round(cm)} cm`;
}

/** A mass held in kilograms, written the way the reader wants it. */
export function formatMass(
   kg: number | null | undefined,
   system: UnitSystem
): string | null {
   if (typeof kg !== 'number' || !Number.isFinite(kg)) {
      return null;
   }

   if (system === 'IMPERIAL') {
      return `${(kg / KG_PER_POUND).toFixed(2)} lb`;
   }

   return `${kg.toFixed(2)} kg`;
}

/*
 * Centimetres or inches, kilograms or pounds: two choices, not one.
 *
 * A South African carp angler weighs in pounds and measures in centimetres,
 * so the length and the weight are chosen apart. Where nothing was chosen the
 * old single setting speaks for both. The choice is the reader's alone and
 * only ever changes how a figure is written: the record, the wire and every
 * ranking stay in centimetres and kilograms.
 */
export type LengthUnit = 'cm' | 'in';
export type MassUnit = 'kg' | 'lb';
export type Units = { length: LengthUnit; mass: MassUnit };
/* Either way of saying it; the old setting still arrives from older pages. */
export type UnitChoice = UnitSystem | Units;

const LENGTH_KEY = 'unit-length';
const MASS_KEY = 'unit-mass';
const UNITS_CHANGED = 'fisherfeed:units';

function readStoredUnits(): Units {
   const imperial = readUnitSystem() === 'IMPERIAL';
   let length: LengthUnit = imperial ? 'in' : 'cm';
   let mass: MassUnit = imperial ? 'lb' : 'kg';
   try {
      const l = localStorage.getItem(LENGTH_KEY);
      const m = localStorage.getItem(MASS_KEY);
      if (l === 'cm' || l === 'in') length = l;
      if (m === 'kg' || m === 'lb') mass = m;
   } catch {
      /* Storage refused: the old setting, or metric. */
   }
   return { length, mass };
}

/* One object per choice, so a component reading it only redraws when the
   choice itself changes. */
let unitsSnapshot: Units | null = null;

export function readUnits(): Units {
   unitsSnapshot ??= readStoredUnits();
   return unitsSnapshot;
}

export function writeUnits(next: Partial<Units>) {
   const merged = { ...readUnits(), ...next };
   try {
      localStorage.setItem(LENGTH_KEY, merged.length);
      localStorage.setItem(MASS_KEY, merged.mass);
   } catch {
      /* The choice lasts for this page and no longer. */
   }
   unitsSnapshot = merged;
   window.dispatchEvent(new Event(UNITS_CHANGED));
}

function subscribeUnits(changed: () => void) {
   /* Another tab changed it: read it again. */
   const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== LENGTH_KEY && event.key !== MASS_KEY)
         return;
      unitsSnapshot = readStoredUnits();
      changed();
   };
   window.addEventListener(UNITS_CHANGED, changed);
   window.addEventListener('storage', onStorage);
   return () => {
      window.removeEventListener(UNITS_CHANGED, changed);
      window.removeEventListener('storage', onStorage);
   };
}

/** The reader's units, redrawn wherever they are changed, even in another tab. */
export function useUnits(): Units {
   return useSyncExternalStore(subscribeUnits, readUnits, readUnits);
}

export const unitsOf = (choice: UnitChoice): Units =>
   typeof choice === 'string'
      ? choice === 'IMPERIAL'
         ? { length: 'in', mass: 'lb' }
         : { length: 'cm', mass: 'kg' }
      : choice;

/** The unit a competition's figures are shown in for this reader. */
export const unitFor = (measure: 'LENGTH' | 'WEIGHT', choice: UnitChoice) =>
   measure === 'LENGTH' ? unitsOf(choice).length : unitsOf(choice).mass;

/* A tenth, and no ".0" on a whole figure. */
const tenths = (n: number) => String(Math.round(n * 10) / 10);

/**
 * A competition figure, written for whichever measure the competition uses.
 *
 * The competition decides whether a fish is judged on length or on weight; the
 * reader decides whether that is shown in centimetres or inches. Those are two
 * different decisions and this is where they meet. It is converted once, from
 * what the server holds, and rounded only here: lengths to a tenth, because
 * two fish a few millimetres apart are a place apart on a board, and weights
 * to two places, which is what a scale shows.
 */
export function formatMeasure(
   value: number | null | undefined,
   measure: 'LENGTH' | 'WEIGHT',
   choice: UnitChoice
): string | null {
   if (typeof value !== 'number' || !Number.isFinite(value)) return null;
   const unit = unitFor(measure, choice);
   if (unit === 'in') return `${tenths(value / CM_PER_INCH)} in`;
   if (unit === 'cm') return `${tenths(value)} cm`;
   if (unit === 'lb') return `${(value / KG_PER_POUND).toFixed(2)} lb`;
   return `${value.toFixed(2)} kg`;
}

const KPH_PER_MPH = 1.609344;
const M_PER_FOOT = 0.3048;

/*
 * Weather figures, as numbers, in the reader's units.
 *
 * A forecast grid prints the unit once in the row label and the bare figure in
 * every cell, so these return numbers rather than strings.
 */
export function tempIn(c: number | null | undefined, system: UnitSystem) {
   if (typeof c !== 'number' || !Number.isFinite(c)) return null;
   return Math.round(system === 'IMPERIAL' ? (c * 9) / 5 + 32 : c);
}

export function speedIn(kph: number | null | undefined, system: UnitSystem) {
   if (typeof kph !== 'number' || !Number.isFinite(kph)) return null;
   return Math.round(system === 'IMPERIAL' ? kph / KPH_PER_MPH : kph);
}

export function heightIn(m: number | null | undefined, system: UnitSystem) {
   if (typeof m !== 'number' || !Number.isFinite(m)) return null;
   return Math.round((system === 'IMPERIAL' ? m / M_PER_FOOT : m) * 10) / 10;
}

export const unitOf = (
   kind: 'temp' | 'speed' | 'height',
   system: UnitSystem
) =>
   kind === 'temp'
      ? system === 'IMPERIAL'
         ? '°F'
         : '°C'
      : kind === 'speed'
        ? system === 'IMPERIAL'
           ? 'mph'
           : 'km/h'
        : system === 'IMPERIAL'
          ? 'ft'
          : 'm';
