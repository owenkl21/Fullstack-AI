import { prisma } from '../lib/prisma';

/*
 * The fish a South African shore angler actually names, with the names they
 * actually use. Aliases matter more than usual here: the same fish is garrick
 * on one beach and leervis on the next, elf in the Cape and shad in KwaZulu
 * Natal, and neither is a nickname for the other one's "real" name.
 *
 * Scientific names are the identity; common names and aliases are what gets
 * typed. Idempotent, so it can run on every deploy.
 */

type SeedSpecies = {
   commonName: string;
   scientificName: string;
   aliases: string[];
   regionTags: string[];
   /*
    * Regulation data, from the DFFE recreational limits the social research
    * cites. Seeded because it is published and checkable.
    *
    * lwA and lwB come from FishBase itself, retrieved per species. Only the
    * species that have published figures carry them; the rest are left null
    * rather than guessed at, and a species without them does not score and
    * says exactly why.
    */
   /*
    * FishBase Bayesian length-weight estimates, total length in cm to grams.
    * These are FishBase's own published figures, retrieved per species from its
    * summary pages on 17 September 2026, not measurements of our own and not
    * guesses. A species left without them does not score, and says so.
    */
   lwA?: number;
   lwB?: number;
   sizeClass?: 'EDIBLE' | 'NON_EDIBLE';
   minLegalCm?: number;
   closedFrom?: string;
   closedTo?: string;
};

const LIMITS_SOURCE =
   'DFFE recreational fishing limits, via docs/redesign/research/social.md';

/*
 * Bayesian estimates rather than a single measured study, which is what
 * FishBase publishes for most species. Recorded as such so the interface can be
 * honest about where a mass came from.
 */
const LW_SOURCE =
   'FishBase Bayesian length-weight, TL cm to g, retrieved 2026-09-17';

const SPECIES: SeedSpecies[] = [
   // Saltwater, shore
   {
      commonName: 'Dusky kob',
      scientificName: 'Argyrosomus japonicus',
      aliases: ['kob', 'kabeljou', 'daga salmon', 'salmon'],
      regionTags: ['saltwater', 'shore', 'estuary'],
      lwA: 0.01,
      lwB: 3.06,
      minLegalCm: 40,
   },
   {
      commonName: 'Galjoen',
      scientificName: 'Dichistius capensis',
      aliases: ['blackfish', 'damba'],
      regionTags: ['saltwater', 'shore'],
      lwA: 0.01622,
      lwB: 3.01,
      minLegalCm: 35,
      closedFrom: '10-15',
      closedTo: '02-28',
   },
   {
      commonName: 'Garrick',
      scientificName: 'Lichia amia',
      aliases: ['leervis', 'leerfish', 'leerie'],
      regionTags: ['saltwater', 'shore'],
      lwA: 0.01413,
      lwB: 2.93,
      minLegalCm: 70,
   },
   {
      commonName: 'Elf',
      scientificName: 'Pomatomus saltatrix',
      aliases: ['shad', 'bluefish', 'tailor'],
      regionTags: ['saltwater', 'shore'],
      lwA: 0.01072,
      lwB: 2.97,
      minLegalCm: 30,
      closedFrom: '09-01',
      closedTo: '11-30',
   },
   {
      commonName: 'Yellowtail',
      scientificName: 'Seriola lalandi',
      aliases: ['geelstert', 'yellowtail amberjack'],
      regionTags: ['saltwater', 'shore', 'ski boat'],
   },
   {
      commonName: 'White steenbras',
      scientificName: 'Lithognathus lithognathus',
      aliases: ['witsteenbras', 'pignose grunter', 'steenbras'],
      regionTags: ['saltwater', 'shore', 'estuary'],
      lwA: 0.01549,
      lwB: 3.04,
      minLegalCm: 40,
   },
   {
      commonName: 'Blacktail',
      scientificName: 'Diplodus capensis',
      aliases: ['dassie'],
      regionTags: ['saltwater', 'shore', 'rock'],
      lwA: 0.01318,
      lwB: 3.04,
   },
   {
      commonName: 'Bronze bream',
      scientificName: 'Pachymetopon grande',
      aliases: ['john brown', 'bronzie'],
      regionTags: ['saltwater', 'shore', 'rock'],
      lwA: 0.02042,
      lwB: 2.97,
   },
   {
      commonName: 'White musselcracker',
      scientificName: 'Sparodon durbanensis',
      aliases: ['brusher', 'cracker'],
      regionTags: ['saltwater', 'shore', 'rock'],
   },
   {
      commonName: 'Black musselcracker',
      scientificName: 'Cymatoceps nasutus',
      aliases: ['poenskop', 'musselcracker'],
      regionTags: ['saltwater', 'shore', 'rock'],
   },
   {
      commonName: 'Zebra',
      scientificName: 'Diplodus hottentotus',
      aliases: ['wildeperd'],
      regionTags: ['saltwater', 'shore', 'rock'],
   },
   {
      commonName: 'Cape stumpnose',
      scientificName: 'Rhabdosargus holubi',
      aliases: ['stumpnose'],
      regionTags: ['saltwater', 'estuary'],
   },
   {
      commonName: 'Spotted grunter',
      scientificName: 'Pomadasys commersonnii',
      aliases: ['grunter', 'knorhaan'],
      regionTags: ['saltwater', 'estuary'],
      lwA: 0.01905,
      lwB: 2.94,
   },
   {
      commonName: 'Red roman',
      scientificName: 'Chrysoblephus laticeps',
      aliases: ['roman'],
      regionTags: ['saltwater', 'reef'],
   },
   {
      commonName: 'Hottentot',
      scientificName: 'Pachymetopon blochii',
      aliases: ['hangberger'],
      regionTags: ['saltwater', 'shore', 'rock'],
      lwA: 0.01514,
      lwB: 3.05,
   },
   {
      commonName: 'Santer',
      scientificName: 'Cheimerius nufar',
      aliases: ['soldier'],
      regionTags: ['saltwater', 'reef'],
   },
   {
      commonName: 'Cape gurnard',
      scientificName: 'Chelidonichthys capensis',
      aliases: ['gurnard', 'knorhaan'],
      regionTags: ['saltwater'],
   },
   {
      commonName: 'Smooth-hound shark',
      scientificName: 'Mustelus mustelus',
      aliases: ['houndshark', 'smoothhound'],
      regionTags: ['saltwater', 'shore'],
      sizeClass: 'NON_EDIBLE',
   },

   // Freshwater
   {
      commonName: 'Sharptooth catfish',
      scientificName: 'Clarias gariepinus',
      aliases: ['barbel', 'catfish'],
      regionTags: ['freshwater'],
   },
   {
      commonName: 'Common carp',
      scientificName: 'Cyprinus carpio',
      aliases: ['carp'],
      regionTags: ['freshwater'],
   },
   {
      commonName: 'Largemouth bass',
      scientificName: 'Micropterus salmoides',
      aliases: ['bass'],
      regionTags: ['freshwater'],
      lwA: 0.01047,
      lwB: 3.08,
   },
   {
      commonName: 'Smallmouth bass',
      scientificName: 'Micropterus dolomieu',
      aliases: ['bass'],
      regionTags: ['freshwater'],
   },
   {
      commonName: 'Rainbow trout',
      scientificName: 'Oncorhynchus mykiss',
      aliases: ['trout'],
      regionTags: ['freshwater'],
   },
   {
      commonName: 'Clanwilliam yellowfish',
      scientificName: 'Labeobarbus capensis',
      aliases: ['yellowfish'],
      regionTags: ['freshwater'],
   },
];

export async function seedSpecies() {
   /*
    * Keyed on the scientific name, which is the stable identity. Common names
    * and aliases get corrected over time, so they are updated rather than left
    * at whatever the first run wrote.
    */
   for (const entry of SPECIES) {
      const existing = await prisma.species.findFirst({
         where: { scientificName: entry.scientificName },
         select: { id: true },
      });

      if (existing) {
         await prisma.species.update({
            where: { id: existing.id },
            data: {
               commonName: entry.commonName,
               aliases: entry.aliases,
               regionTags: entry.regionTags,
               lwA: entry.lwA ?? null,
               lwB: entry.lwB ?? null,
               lwSource: entry.lwA ? LW_SOURCE : null,
               sizeClass: entry.sizeClass ?? 'EDIBLE',
               minLegalCm: entry.minLegalCm ?? null,
               closedFrom: entry.closedFrom ?? null,
               closedTo: entry.closedTo ?? null,
               limitsSource: LIMITS_SOURCE,
            },
         });
         continue;
      }

      await prisma.species.create({
         data: {
            commonName: entry.commonName,
            scientificName: entry.scientificName,
            aliases: entry.aliases,
            regionTags: entry.regionTags,
            lwA: entry.lwA ?? null,
            lwB: entry.lwB ?? null,
            lwSource: entry.lwA ? LW_SOURCE : null,
            sizeClass: entry.sizeClass ?? 'EDIBLE',
            minLegalCm: entry.minLegalCm ?? null,
            closedFrom: entry.closedFrom ?? null,
            closedTo: entry.closedTo ?? null,
            limitsSource: LIMITS_SOURCE,
         },
      });
   }

   return SPECIES.length;
}
