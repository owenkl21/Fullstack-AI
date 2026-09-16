import {
   cmToIn,
   inToCm,
   kgToLb,
   lbToKg,
   trimNumber,
} from '@/components/fishing/record/format';

/* Unit handling for the two big numerals: what is typed is converted, never lost. */

export type LengthUnit = 'cm' | 'in';
export type WeightUnit = 'kg' | 'lb';
export type MeasureUnit = LengthUnit | WeightUnit;

const parse = (raw: string) => {
   const value = Number(raw.trim().replace(',', '.'));
   return raw.trim() && Number.isFinite(value) ? value : null;
};

const toMetric = (value: number, unit: MeasureUnit) =>
   unit === 'in' ? inToCm(value) : unit === 'lb' ? lbToKg(value) : value;

const fromMetric = (value: number, unit: MeasureUnit) =>
   unit === 'in' ? cmToIn(value) : unit === 'lb' ? kgToLb(value) : value;

/** The typed value in centimetres or kilograms, or null when there is nothing usable. */
export function toMetricValue(raw: string, unit: MeasureUnit) {
   const value = parse(raw);
   if (value === null || value <= 0) {
      return null;
   }
   return Number(toMetric(value, unit).toFixed(2));
}

/** The same measurement written in another unit. */
export function convertTyped(raw: string, from: MeasureUnit, to: MeasureUnit) {
   const value = parse(raw);
   if (value === null) {
      return raw;
   }
   return trimNumber(fromMetric(toMetric(value, from), to), 1);
}
