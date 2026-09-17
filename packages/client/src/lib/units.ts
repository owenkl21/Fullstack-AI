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

/**
 * A competition figure, written for whichever measure the competition uses.
 *
 * The competition decides whether a fish is judged on length or on weight; the
 * reader decides whether that is shown in centimetres or inches. Those are two
 * different decisions and this is where they meet.
 */
export function formatMeasure(
   value: number | null | undefined,
   measure: 'LENGTH' | 'WEIGHT',
   system: UnitSystem
): string | null {
   return measure === 'LENGTH'
      ? formatLength(value, system)
      : formatMass(value, system);
}
