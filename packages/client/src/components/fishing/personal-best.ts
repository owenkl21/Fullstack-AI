import type { PersonalBest } from '@/components/social/api';
import type { Units } from '@/lib/units';

/*
 * How a personal best is written, in the reader's units. Held apart from the
 * cards so the profile's list says it the same way.
 */

const CM_PER_INCH = 2.54;
const KG_PER_POUND = 0.45359237;

/* The figure and its unit, apart, so a card can set the unit small. */
export function weightParts(kg: number, units: Units): [string, string] {
   if (units.mass === 'lb') {
      const lb = kg / KG_PER_POUND;
      return [lb >= 10 ? lb.toFixed(1) : lb.toFixed(2), 'lb'];
   }
   /* A tenth for anything over a kilogram, as a scale is read out; two
      places under it, where a tenth is most of the fish. */
   return [kg >= 1 ? kg.toFixed(1) : kg.toFixed(2), 'kg'];
}

export function lengthParts(cm: number, units: Units): [string, string] {
   if (units.length === 'in') {
      return [(cm / CM_PER_INCH).toFixed(1), 'in'];
   }
   return [String(Math.round(cm)), 'cm'];
}

/** The figure a best was judged on, as one string: "8.3 kg" or "52 cm". */
export function bestFigure(best: PersonalBest, units: Units) {
   return best.by === 'WEIGHT' && best.weightKg != null
      ? weightParts(best.weightKg, units).join(' ')
      : lengthParts(best.lengthCm ?? 0, units).join(' ');
}
