/*
 * Fifty catches, generated deterministically rather than hand written, so the
 * set stays consistent and a second run produces exactly the same rows.
 *
 * On weight: the research asked for weights computed from FishBase
 * length-weight parameters (W = a x L^b) but does not carry the a and b values
 * for these species, and inventing them would put fabricated numbers on screen
 * dressed as computed ones. Lengths are seeded and weight is left null, which
 * is a real state the interface already handles: it prints "Not measured"
 * rather than a dash or an invented zero. Add the parameters and the weights
 * can be computed properly.
 */

export type SeedCatch = {
   id: string;
   anglerId: string;
   spotId: string;
   speciesName: string;
   title: string;
   notes: string;
   lengthCm: number;
   caughtAt: Date;
   released: boolean;
};

/* Typical shore-caught lengths, not record sizes. */
const SPECIES_PLAN: {
   name: string;
   min: number;
   max: number;
   spots: string[];
   /* Endangered: these are seeded released, never kept. */
   alwaysRelease?: boolean;
}[] = [
   {
      name: 'Dusky kob',
      min: 45,
      max: 95,
      spots: [
         'seed_spot_strandfontein',
         'seed_spot_macassar',
         'seed_spot_bergriver',
      ],
      alwaysRelease: true,
   },
   {
      name: 'White steenbras',
      min: 40,
      max: 75,
      spots: ['seed_spot_langebaan', 'seed_spot_macassar'],
      alwaysRelease: true,
   },
   {
      name: 'Galjoen',
      min: 28,
      max: 48,
      spots: [
         'seed_spot_kommetjie',
         'seed_spot_scarborough',
         'seed_spot_olifantsbos',
      ],
   },
   {
      name: 'Elf',
      min: 30,
      max: 55,
      spots: [
         'seed_spot_glencairn',
         'seed_spot_gordons',
         'seed_spot_strandfontein',
      ],
   },
   {
      name: 'Garrick',
      min: 60,
      max: 105,
      spots: ['seed_spot_pringle', 'seed_spot_rooiels', 'seed_spot_hermanus'],
   },
   {
      name: 'Blacktail',
      min: 20,
      max: 34,
      spots: ['seed_spot_millers', 'seed_spot_rooiels', 'seed_spot_kommetjie'],
   },
   {
      name: 'Bronze bream',
      min: 30,
      max: 50,
      spots: ['seed_spot_rooiels', 'seed_spot_hermanus'],
   },
   {
      name: 'Spotted grunter',
      min: 35,
      max: 62,
      spots: ['seed_spot_langebaan', 'seed_spot_bergriver'],
   },
   {
      name: 'Hottentot',
      min: 22,
      max: 36,
      spots: [
         'seed_spot_millers',
         'seed_spot_yzerfontein',
         'seed_spot_glencairn',
      ],
   },
   {
      name: 'Largemouth bass',
      min: 25,
      max: 45,
      spots: ['seed_spot_clanwilliam'],
   },
];

const ANGLER_IDS = [
   'seed_angler_thabo',
   'seed_angler_nadia',
   'seed_angler_sipho',
   'seed_angler_karen',
   'seed_angler_riaan',
   'seed_angler_lerato',
   'seed_angler_deon',
   'seed_angler_amara',
];

const NOTES = [
   'Came in on the push, just before the tide turned.',
   'Second cast. Nothing else moved all morning.',
   'Wind dropped at last light and it switched on.',
   'Took a sardine head sitting in the gully.',
   'Long fight on light line. Took its time going back.',
   'Water was dirty after the rain, which helped.',
   'Quiet session, this one saved it.',
   'Missed two before this one stuck.',
];

const TITLES = [
   'Evening fish',
   'First light',
   'Off the ledge',
   'On the push',
   'Last cast',
   'After the rain',
   'Dawn session',
   'Between the gullies',
];

/*
 * A small deterministic generator, so the seed never depends on Math.random
 * and the same run produces the same fifty rows.
 */
const stepper = (seed: number) => {
   let state = seed;
   return () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
   };
};

/* Same reason as the seeder: constant lists, strict index access. */
const pick = <T>(items: T[], index: number): T => {
   const picked = items[index % items.length];

   if (!picked) {
      throw new Error('Seed plan list is empty.');
   }

   return picked;
};

export function buildCatches(count = 50): SeedCatch[] {
   const next = stepper(20260916);
   const out: SeedCatch[] = [];
   /* Anchor to a fixed date so re-running does not shift every record. */
   const anchor = Date.UTC(2026, 8, 16, 0, 0, 0);

   for (let i = 0; i < count; i += 1) {
      const plan = pick(SPECIES_PLAN, i);
      const spotId = pick(plan.spots, Math.floor(next() * plan.spots.length));
      const anglerId = pick(ANGLER_IDS, Math.floor(next() * ANGLER_IDS.length));
      const lengthCm = Math.round(plan.min + next() * (plan.max - plan.min));

      /* Spread across roughly the last nine months, at plausible hours. */
      const daysBack = Math.floor(next() * 270);
      const hour = pick([5, 6, 7, 17, 18, 19, 20], Math.floor(next() * 7));
      const caughtAt = new Date(anchor - daysBack * 86400000 + hour * 3600000);

      out.push({
         id: `seed_catch_${String(i + 1).padStart(2, '0')}`,
         anglerId,
         spotId,
         speciesName: plan.name,
         title: pick(TITLES, Math.floor(next() * TITLES.length)),
         notes: pick(NOTES, Math.floor(next() * NOTES.length)),
         lengthCm,
         caughtAt,
         released: plan.alwaysRelease ? true : next() > 0.35,
      });
   }

   return out;
}
