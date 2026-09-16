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
};

const SPECIES: SeedSpecies[] = [
   // Saltwater, shore
   {
      commonName: 'Dusky kob',
      scientificName: 'Argyrosomus japonicus',
      aliases: ['kob', 'kabeljou', 'daga salmon', 'salmon'],
      regionTags: ['saltwater', 'shore', 'estuary'],
   },
   {
      commonName: 'Galjoen',
      scientificName: 'Dichistius capensis',
      aliases: ['blackfish', 'damba'],
      regionTags: ['saltwater', 'shore'],
   },
   {
      commonName: 'Garrick',
      scientificName: 'Lichia amia',
      aliases: ['leervis', 'leerfish', 'leerie'],
      regionTags: ['saltwater', 'shore'],
   },
   {
      commonName: 'Elf',
      scientificName: 'Pomatomus saltatrix',
      aliases: ['shad', 'bluefish', 'tailor'],
      regionTags: ['saltwater', 'shore'],
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
   },
   {
      commonName: 'Blacktail',
      scientificName: 'Diplodus capensis',
      aliases: ['dassie'],
      regionTags: ['saltwater', 'shore', 'rock'],
   },
   {
      commonName: 'Bronze bream',
      scientificName: 'Pachymetopon grande',
      aliases: ['john brown', 'bronzie'],
      regionTags: ['saltwater', 'shore', 'rock'],
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
         },
      });
   }

   return SPECIES.length;
}
