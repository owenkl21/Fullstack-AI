import crypto from 'node:crypto';

/*
 * "On a scale" means somebody read it off a scale.
 *
 * A weight marked as off a scale is ranked as the real thing on the boards,
 * so the mark has to be earned. The angler photographs the scale; the reader
 * (Claude, services/vision.service.ts) reads the figure off it; and the
 * reading comes back with a proof, a signature over who asked and what was
 * read, that only this server can make. When the catch is saved, a weight
 * marked as off a scale keeps that mark only if the proof is good and the
 * weight is the one the photograph shows. Anything else is kept as by eye:
 * the weight still counts, as an estimate.
 */

const secret = () =>
   (
      process.env.SCALE_PROOF_SECRET ??
      process.env.BETTER_AUTH_SECRET ??
      ''
   ).trim();

const KG_PER_POUND = 0.45359237;

type Unit = 'kg' | 'lb';

const message = (userId: string, value: number, unit: Unit) =>
   `scale|${userId}|${value.toFixed(3)}|${unit}`;

/** The proof for one reading, or null when the server has no secret. */
export function scaleProof(
   userId: string,
   value: number,
   unit: Unit
): string | null {
   const key = secret();
   if (!key || !Number.isFinite(value) || value <= 0) return null;
   return crypto
      .createHmac('sha256', key)
      .update(message(userId, value, unit))
      .digest('base64url');
}

function proofHolds(
   userId: string,
   value: number,
   unit: Unit,
   proof: string
): boolean {
   const wanted = scaleProof(userId, value, unit);
   if (!wanted) return false;
   const a = Buffer.from(wanted);
   const b = Buffer.from(proof);
   return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/*
 * The weight source to keep. Only SCALE is ever changed, and only to EYE:
 * a scale weight with no good proof, or one that is not what the photograph
 * of the scale reads, within two per cent or twenty grams.
 */
export function checkedWeightSource(
   userId: string,
   input: {
      weight?: number | null;
      weightSource?: 'LENGTH' | 'SCALE' | 'EYE';
      readMeasure?: number | null;
      readMeasureUnit?: string | null;
      readProof?: string | null;
   }
): 'LENGTH' | 'SCALE' | 'EYE' | undefined {
   if (input.weightSource !== 'SCALE') return input.weightSource;
   const weight = input.weight;
   const read = input.readMeasure;
   const unit = input.readMeasureUnit;
   if (
      typeof weight !== 'number' ||
      !(weight > 0) ||
      typeof read !== 'number' ||
      !(read > 0) ||
      (unit !== 'kg' && unit !== 'lb') ||
      !input.readProof ||
      !proofHolds(userId, read, unit, input.readProof)
   ) {
      return 'EYE';
   }
   const readKg = unit === 'lb' ? read * KG_PER_POUND : read;
   const tolerance = Math.max(0.02, readKg * 0.02);
   return Math.abs(weight - readKg) <= tolerance ? 'SCALE' : 'EYE';
}
