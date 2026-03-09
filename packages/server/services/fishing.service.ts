import { prisma } from '../lib/prisma';
import { getCoordinates } from '../clients/geocoding.client';
import { getCurrentWeather } from '../clients/weather.client';
import { uploadsService } from './uploads.service';

type CreateImageInput = {
   storageKey: string;
   url: string;
};

const stripSignedUrlParams = (url: string) => {
   try {
      const parsed = new URL(url);
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
   } catch {
      return url;
   }
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

const resolveOptionalRelationIds = async (input: {
   siteId?: string | null;
   speciesId?: string | null;
   gearId?: string | null;
}) => {
   const [site, species, gear] = await Promise.all([
      input.siteId
         ? prisma.fishingSite.findUnique({
              where: { id: input.siteId },
              select: { id: true },
           })
         : null,
      input.speciesId
         ? prisma.species.findUnique({
              where: { id: input.speciesId },
              select: { id: true },
           })
         : null,
      input.gearId
         ? prisma.gear.findUnique({
              where: { id: input.gearId },
              select: { id: true },
           })
         : null,
   ]);

   return {
      siteId: site?.id ?? null,
      speciesId: species?.id ?? null,
      gearId: gear?.id ?? null,
   };
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

const withResolvedImageUrls = async <
   T extends {
      images: Array<{
         image: { id: string; storageKey: string; url: string };
      }>;
   },
>(
   record: T
): Promise<T> => {
   const images = await Promise.all(
      record.images.map(async (entry) => {
         const signed = await uploadsService.getReadUrl(entry.image.storageKey);

         return {
            ...entry,
            image: {
               ...entry.image,
               url: signed.readUrl,
            },
         };
      })
   );

   return {
      ...record,
      images,
   };
};

export const fishingService = {
   async listFishingSites() {
      return prisma.fishingSite.findMany({
         where: { deletedAt: null },
         orderBy: { name: 'asc' },
         select: {
            id: true,
            name: true,
         },
      });
   },

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
      const relations = await resolveOptionalRelationIds({
         siteId: input.siteId,
         speciesId: input.speciesId,
         gearId: input.gearId,
      });

      const created = await prisma.$transaction(async (tx) => {
         const catchRecord = await tx.catch.create({
            data: {
               createdById: user.id,
               siteId: relations.siteId,
               speciesId: relations.speciesId,
               gearId: relations.gearId,
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

         if (relations.siteId) {
            await tx.fishingSite.update({
               where: { id: relations.siteId },
               data: { catchCount: { increment: 1 } },
            });
         }

         for (const [position, image] of input.images.entries()) {
            const normalizedUrl = stripSignedUrlParams(image.url);
            const createdImage = await tx.image.upsert({
               where: { storageKey: image.storageKey },
               create: {
                  uploadedById: user.id,
                  storageKey: image.storageKey,
                  url: normalizedUrl,
               },
               update: {
                  url: normalizedUrl,
               },
            });

            await tx.catchImage.upsert({
               where: {
                  catchId_imageId: {
                     catchId: catchRecord.id,
                     imageId: createdImage.id,
                  },
               },
               create: {
                  catchId: catchRecord.id,
                  imageId: createdImage.id,
                  position,
               },
               update: {
                  position,
               },
            });
         }

         return tx.catch.findUniqueOrThrow({
            where: { id: catchRecord.id },
            include: catchDetailInclude,
         });
      });

      return withResolvedImageUrls(created);
   },

   async getCatchById(catchId: string) {
      const catchRecord = await prisma.catch.findUnique({
         where: { id: catchId },
         include: catchDetailInclude,
      });

      if (!catchRecord) {
         return null;
      }

      return withResolvedImageUrls(catchRecord);
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
                  url: stripSignedUrlParams(image.url),
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

      return withResolvedImageUrls(created);
   },

   async getFishingSiteById(siteId: string) {
      const site = await prisma.fishingSite.findUnique({
         where: { id: siteId },
         include: siteDetailInclude,
      });

      if (!site) {
         return null;
      }

      return withResolvedImageUrls(site);
   },
};
