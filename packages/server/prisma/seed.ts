import { prisma } from '../lib/prisma';

async function main() {
   const [anglerOne, anglerTwo] = await Promise.all([
      prisma.user.upsert({
         where: { email: 'angler.one@example.com' },
         update: {},
         create: {
            clerkId: 'seed_angler_one',
            email: 'angler.one@example.com',
            username: 'anglerone',
            displayName: 'Angler One',
            bio: 'Weekend freshwater angler',
         },
      }),
      prisma.user.upsert({
         where: { email: 'angler.two@example.com' },
         update: {},
         create: {
            clerkId: 'seed_angler_two',
            email: 'angler.two@example.com',
            username: 'anglertwo',
            displayName: 'Angler Two',
            bio: 'Coastal fishing enthusiast',
         },
      }),
   ]);

   const site = await prisma.fishingSite.upsert({
      where: { id: 'phase0-sample-site' },
      update: {},
      create: {
         id: 'phase0-sample-site',
         createdById: anglerOne.id,
         name: 'Sunrise Pier',
         description: 'Public pier with easy access and mixed water depth.',
         latitude: 32.7157,
         longitude: -117.1611,
         waterType: 'SALTWATER',
         accessNotes: 'Parking lot available before 6AM.',
      },
   });

   const species = await prisma.species.upsert({
      where: { id: 'phase0-sample-species' },
      update: {},
      create: {
         id: 'phase0-sample-species',
         commonName: 'Halibut',
         scientificName: 'Paralichthys californicus',
      },
   });

   const gear = await prisma.gear.upsert({
      where: { id: 'phase0-sample-gear' },
      update: {},
      create: {
         id: 'phase0-sample-gear',
         name: 'Medium spinning combo',
         category: 'Rod/Reel',
         description: '7ft medium power spinning setup with braided line.',
      },
   });

   await prisma.catch.upsert({
      where: { id: 'phase0-sample-catch' },
      update: {},
      create: {
         id: 'phase0-sample-catch',
         createdById: anglerTwo.id,
         siteId: site.id,
         speciesId: species.id,
         title: 'Morning halibut near the pier edge',
         gearId: gear.id,
         notes: 'Caught on cut bait right after the tide changed.',
         caughtAt: new Date(),
         length: 24.5,
         weight: 6.2,
         weather: 'Clear',
      },
   });

   console.log('Phase 0 seed data loaded.');
}

main()
   .catch((error) => {
      console.error(error);
      process.exit(1);
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
