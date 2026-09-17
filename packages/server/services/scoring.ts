/*
 * One scoring rule, not a menu.
 *
 * Length converts to mass with published FishBase parameters and points are
 * awarded per kilogram, which is how South African shore angling championships
 * already score. It is the only method that compares a 35 cm galjoen with a
 * 90 cm kob when the fish is released and never weighed.
 *
 * The whole path works without a scale on purpose. Mass comes from length by
 * default; "on a scale" changes the provenance word on the record, not the
 * arithmetic.
 *
 * Formulas are from docs/redesign/research/social.md, which cites SASAA for the
 * rounding and qualifying masses and DFFE for the size limits and closed
 * seasons.
 */

export type SizeClass = 'EDIBLE' | 'NON_EDIBLE';

export type ScoringSpecies = {
   commonName: string;
   lwA: number | null;
   lwB: number | null;
   sizeClass: SizeClass;
   minLegalCm: number | null;
   /** MM-DD, no year, so a season that wraps the new year still works. */
   closedFrom: string | null;
   closedTo: string | null;
};

export type ScoringCatch = {
   lengthCm: number | null;
   weightKg: number | null;
   weightSource: 'LENGTH' | 'SCALE';
   released: boolean;
   caughtAt: Date;
};

/* SASAA: 0.5 kg for edible species, 1.0 kg for non-edible. */
const MIN_QUALIFYING_KG: Record<SizeClass, number> = {
   EDIBLE: 0.5,
   NON_EDIBLE: 1.0,
};

/* SASAA: 2 points per kg edible, 1 point per kg non-edible. */
const POINTS_PER_KG: Record<SizeClass, number> = {
   EDIBLE: 2.0,
   NON_EDIBLE: 1.0,
};

export type ScoreResult = {
   qualifies: boolean;
   points: number;
   massKg: number | null;
   /** Where the mass came from, for the record to print honestly. */
   massFrom: 'scale' | 'length' | null;
   /** Why it does not score, in a sentence a person can read. */
   reason: string | null;
};

const NOT_SCORED = (reason: string): ScoreResult => ({
   qualifies: false,
   points: 0,
   massKg: null,
   massFrom: null,
   reason,
});

/**
 * True when `when` falls inside a closed season expressed as two MM-DD strings.
 * Handles a season that wraps the new year, which galjoen's does.
 */
export function inClosedSeason(
   species: Pick<ScoringSpecies, 'closedFrom' | 'closedTo'>,
   when: Date
): boolean {
   const { closedFrom, closedTo } = species;

   if (!closedFrom || !closedTo) {
      return false;
   }

   const md = `${String(when.getUTCMonth() + 1).padStart(2, '0')}-${String(
      when.getUTCDate()
   ).padStart(2, '0')}`;

   /* A window that does not wrap: 09-01 to 11-30. */
   if (closedFrom <= closedTo) {
      return md >= closedFrom && md <= closedTo;
   }

   /* One that does: 10-15 to 02-28. */
   return md >= closedFrom || md <= closedTo;
}

/**
 * The mass a catch scores on, in kilograms, or null when it cannot be known.
 *
 * Null is a real answer here and is not an error: a species with no published
 * length-weight parameters cannot be converted, and saying so is better than
 * inventing a coefficient.
 */
export function massKgFor(
   entry: ScoringCatch,
   species: ScoringSpecies
): { massKg: number; from: 'scale' | 'length' } | null {
   if (entry.weightSource === 'SCALE' && entry.weightKg != null) {
      return { massKg: entry.weightKg, from: 'scale' };
   }

   if (entry.lengthCm == null || species.lwA == null || species.lwB == null) {
      return null;
   }

   /* SASAA rounds length down to the whole centimetre before converting. */
   const length = Math.floor(entry.lengthCm);
   const grams = species.lwA * Math.pow(length, species.lwB);

   return { massKg: grams / 1000, from: 'length' };
}

/**
 * Score one catch.
 *
 * An undersized fish scores only when it was released. That is stricter than
 * SASAA, who allow it because every championship fish goes back, and looser
 * than refusing it outright. It is the only version that does not reward
 * keeping an undersized fish for points.
 */
export function scoreCatch(
   entry: ScoringCatch,
   species: ScoringSpecies | null
): ScoreResult {
   if (!species) {
      return NOT_SCORED('No species recorded, so it cannot be scored.');
   }

   if (inClosedSeason(species, entry.caughtAt)) {
      return NOT_SCORED(
         `${species.commonName} was in its closed season on that date, so it does not score.`
      );
   }

   const mass = massKgFor(entry, species);

   if (!mass) {
      return NOT_SCORED(
         entry.lengthCm == null
            ? 'No length recorded, so the mass cannot be worked out.'
            : `No published length to weight figures for ${species.commonName} yet, so it cannot be scored.`
      );
   }

   const floor = MIN_QUALIFYING_KG[species.sizeClass];

   if (mass.massKg < floor) {
      return {
         qualifies: false,
         points: 0,
         massKg: mass.massKg,
         massFrom: mass.from,
         reason: `Under the ${floor} kg minimum for scoring.`,
      };
   }

   if (
      species.minLegalCm != null &&
      entry.lengthCm != null &&
      Math.floor(entry.lengthCm) < species.minLegalCm &&
      !entry.released
   ) {
      return {
         qualifies: false,
         points: 0,
         massKg: mass.massKg,
         massFrom: mass.from,
         reason: `Under the ${species.minLegalCm} cm minimum size and not marked released.`,
      };
   }

   const points =
      Math.round(POINTS_PER_KG[species.sizeClass] * mass.massKg * 10) / 10;

   return {
      qualifies: true,
      points,
      massKg: mass.massKg,
      massFrom: mass.from,
      reason: null,
   };
}

export type ScoredEntry = ScoreResult & {
   anglerId: string;
   speciesId: string | null;
   caughtAt: Date;
   lengthCm: number | null;
};

export type Standing = {
   anglerId: string;
   points: number;
   qualifyingCount: number;
   totalMassKg: number;
   distinctSpecies: number;
   longestCm: number;
   /** When this angler reached their score, which breaks the last tie. */
   reachedAt: Date | null;
};

/* One shoal of small hottentot should not decide a month. */
export const MAX_ENTRIES_PER_SPECIES_PER_DAY = 3;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Standings for a set of already-scored entries.
 *
 * Ties break in the order the research sets out: most qualifying fish, then
 * highest total mass, then whoever got there first. The last one exists because
 * a list has to render in some order; the copy still says "Joint first".
 */
export function buildStandings(entries: ScoredEntry[]): Standing[] {
   const perAngler = new Map<
      string,
      Standing & { seen: Map<string, number> }
   >();

   /* Oldest first, so the capped entries kept are the earliest of a day. */
   const ordered = [...entries].sort(
      (a, b) => a.caughtAt.getTime() - b.caughtAt.getTime()
   );

   for (const entry of ordered) {
      if (!entry.qualifies) {
         continue;
      }

      const current =
         perAngler.get(entry.anglerId) ??
         ({
            anglerId: entry.anglerId,
            points: 0,
            qualifyingCount: 0,
            totalMassKg: 0,
            distinctSpecies: 0,
            longestCm: 0,
            reachedAt: null,
            seen: new Map<string, number>(),
         } as Standing & { seen: Map<string, number> });

      /* The per species per day cap. */
      const key = `${entry.speciesId ?? 'none'}:${dayKey(entry.caughtAt)}`;
      const already = current.seen.get(key) ?? 0;

      if (already >= MAX_ENTRIES_PER_SPECIES_PER_DAY) {
         perAngler.set(entry.anglerId, current);
         continue;
      }

      current.seen.set(key, already + 1);
      current.points = Math.round((current.points + entry.points) * 10) / 10;
      current.qualifyingCount += 1;
      current.totalMassKg += entry.massKg ?? 0;
      current.longestCm = Math.max(
         current.longestCm,
         entry.lengthCm ? Math.floor(entry.lengthCm) : 0
      );
      current.reachedAt = entry.caughtAt;

      perAngler.set(entry.anglerId, current);
   }

   /* Distinct species counted after the fact, so the cap does not affect it. */
   for (const [anglerId, standing] of perAngler) {
      const species = new Set(
         entries
            .filter(
               (e) => e.anglerId === anglerId && e.qualifies && e.speciesId
            )
            .map((e) => e.speciesId as string)
      );
      standing.distinctSpecies = species.size;
   }

   return [...perAngler.values()]
      .map(({ seen: _seen, ...standing }) => standing)
      .sort(
         (a, b) =>
            b.points - a.points ||
            b.qualifyingCount - a.qualifyingCount ||
            b.totalMassKg - a.totalMassKg ||
            (a.reachedAt?.getTime() ?? 0) - (b.reachedAt?.getTime() ?? 0)
      );
}

/** True when these two share a score and should be described as joint. */
export const isJoint = (a: Standing, b: Standing) =>
   a.points === b.points &&
   a.qualifyingCount === b.qualifyingCount &&
   a.totalMassKg === b.totalMassKg;
