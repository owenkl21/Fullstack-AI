import { prisma } from '../lib/prisma';
import { getCoordinates } from '../clients/geocoding.client';
import { getCurrentWeather } from '../clients/weather.client';

type CreateImageInput = {
   storageKey: string;
   url: string;
};

type CreateCatchInput = {
   title: string;
   notes?: string | null;
   caughtAt: Date;
   siteId?: string | null;
   speciesId?: string | null;
   gearId?: string | null;
   weight?: number | null;
   length?: number | null;
   count?: number;
   weather?: string | null;
   waterTemp?: number | null;
   depth?: number | null;
   images: CreateImageInput[];
};

type CreateFishingSiteInput = {
   name: string;
   description?: string | null;
   latitude?: number | null;
   longitude?: number | null;
   waterType?: 'FRESHWATER' | 'SALTWATER' | 'BRACKISH' | 'OTHER' | null;
   accessNotes?: string | null;
   images: CreateImageInput[];
};

const catchDetailInclude = {
   createdBy: { select: { id: true, displayName: true, username: true } },
   site: { select: { id: true, name: true, latitude: true, longitude: true } },
   species: { select: { id: true, commonName: true, scientificName: true } },
   gear: { select: { id: true, name: true, category: true } },
   images: {
      include: {
         image: { select: { id: true, url: true, storageKey: true } },
      },
      orderBy: { position: 'asc' as const },
   },
};

const siteDetailInclude = {
   createdBy: { select: { id: true, displayName: true, username: true } },
   images: {
      include: {
         image: { select: { id: true, url: true, storageKey: true } },
      },
      orderBy: { position: 'asc' as const },
   },
   catches: {
      take: 10,
      orderBy: { caughtAt: 'desc' as const },
      select: {
         id: true,
         title: true,
         caughtAt: true,
         species: { select: { commonName: true } },
         createdBy: { select: { displayName: true, username: true } },
      },
   },
};

async function getUserByClerkId(clerkId: string) {
   return prisma.user.findUniqueOrThrow({
      where: { clerkId },
      select: { id: true },
   });
}

export const fishingService = {
   async getFishingConditions(locationName: string) {
      const coordinates = await getCoordinates(locationName);
      const weather = await getCurrentWeather(
         coordinates.latitude,
         coordinates.longitude
      );
      return {
         location: coordinates,
         weather,
      };
   },

   async createCatch(clerkId: string, input: CreateCatchInput) {
      const user = await getUserByClerkId(clerkId);

      const created = await prisma.$transaction(async (tx) => {
         const catchRecord = await tx.catch.create({
            data: {
               createdById: user.id,
               siteId: input.siteId,
               speciesId: input.speciesId,
               gearId: input.gearId,
               title: input.title,
               notes: input.notes,
               caughtAt: input.caughtAt,
               weight: input.weight,
               length: input.length,
               count: input.count ?? 1,
               weather: input.weather,
               waterTemp: input.waterTemp,
               depth: input.depth,
            },
         });

         if (input.siteId) {
            await tx.fishingSite.update({
               where: { id: input.siteId },
               data: { catchCount: { increment: 1 } },
            });
         }

         for (const [position, image] of input.images.entries()) {
            const createdImage = await tx.image.create({
               data: {
                  uploadedById: user.id,
                  storageKey: image.storageKey,
                  url: image.url,
               },
            });

            await tx.catchImage.create({
               data: {
                  catchId: catchRecord.id,
                  imageId: createdImage.id,
                  position,
               },
            });
         }

         return tx.catch.findUniqueOrThrow({
            where: { id: catchRecord.id },
            include: catchDetailInclude,
         });
      });

      return created;
   },

   async getCatchById(catchId: string) {
      return prisma.catch.findUnique({
         where: { id: catchId },
         include: catchDetailInclude,
      });
   },

   async createFishingSite(clerkId: string, input: CreateFishingSiteInput) {
      const user = await getUserByClerkId(clerkId);

      const created = await prisma.$transaction(async (tx) => {
         const site = await tx.fishingSite.create({
            data: {
               createdById: user.id,
               name: input.name,
               description: input.description,
               latitude: input.latitude,
               longitude: input.longitude,
               waterType: input.waterType,
               accessNotes: input.accessNotes,
            },
         });

         for (const [position, image] of input.images.entries()) {
            const createdImage = await tx.image.create({
               data: {
                  uploadedById: user.id,
                  storageKey: image.storageKey,
                  url: image.url,
               },
            });

            await tx.siteImage.create({
               data: {
                  siteId: site.id,
                  imageId: createdImage.id,
                  position,
               },
            });
         }

         return tx.fishingSite.findUniqueOrThrow({
            where: { id: site.id },
            include: siteDetailInclude,
         });
      });

      return created;
   },

   async getFishingSiteById(siteId: string) {
      return prisma.fishingSite.findUnique({
         where: { id: siteId },
         include: siteDetailInclude,
      });
   },
};
