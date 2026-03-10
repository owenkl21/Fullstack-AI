import { prisma } from '../lib/prisma';
import { getCoordinates } from '../clients/geocoding.client';
import { getCurrentWeather } from '../clients/weather.client';
import { uploadsService } from './uploads.service';
import { userService } from './user.service';

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

type UpdateCatchInput = Omit<CreateCatchInput, 'images'>;
type UpdateFishingSiteInput = Omit<CreateFishingSiteInput, 'images'>;

const resolveOptionalRelationIds = async (input: {
   siteId?: string | null;
}) => {
   const site = input.siteId
      ? await prisma.fishingSite.findUnique({
           where: { id: input.siteId },
           select: { id: true },
        })
      : null;

   return {
      siteId: site?.id ?? null,
   };
};

const catchDetailInclude = {
   createdBy: { select: { id: true, displayName: true, username: true } },
   site: { select: { id: true, name: true, latitude: true, longitude: true } },
   species: { select: { id: true, commonName: true, scientificName: true } },
   gear: {
      select: { id: true, name: true, brand: true, type: true, imageUrl: true },
   },
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

const buildPlaceholderIdentity = (clerkId: string) => {
   const normalized = clerkId.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
   const username = `clerk_${normalized}`;

   return {
      email: `${username}@placeholder.local`,
      username,
      displayName: 'New Angler',
   };
};

async function getUserByClerkId(clerkId: string) {
   const existing = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
   });

   if (existing) {
      return existing;
   }

   await userService.syncAuthenticatedUser(clerkId);

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
         try {
            const signed = await uploadsService.getReadUrl(
               entry.image.storageKey
            );

            return {
               ...entry,
               image: {
                  ...entry.image,
                  url: signed.readUrl,
               },
            };
         } catch (error) {
            console.warn(
               '[fishing:create] Falling back to persisted image URL because generating read URL failed.',
               {
                  storageKey: entry.image.storageKey,
                  error,
               }
            );

            return entry;
         }
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
      });

      const created = await prisma.$transaction(async (tx) => {
         const catchRecord = await tx.catch.create({
            data: {
               createdById: user.id,
               siteId: relations.siteId,
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
      const catchRecord = await prisma.catch.findFirst({
         where: { id: catchId, deletedAt: null },
         include: catchDetailInclude,
      });

      if (!catchRecord) {
         return null;
      }

      return withResolvedImageUrls(catchRecord);
   },

   async listMyCatches(clerkId: string) {
      const user = await getUserByClerkId(clerkId);

      return prisma.catch.findMany({
         where: { createdById: user.id, deletedAt: null },
         orderBy: { caughtAt: 'desc' },
         select: {
            id: true,
            title: true,
            caughtAt: true,
            site: { select: { id: true, name: true } },
         },
      });
   },

   async updateCatch(
      clerkId: string,
      catchId: string,
      input: UpdateCatchInput
   ) {
      const user = await getUserByClerkId(clerkId);
      const relations = await resolveOptionalRelationIds({
         siteId: input.siteId,
      });

      return prisma.$transaction(async (tx) => {
         const existing = await tx.catch.findFirst({
            where: { id: catchId, createdById: user.id, deletedAt: null },
            select: { id: true, siteId: true },
         });

         if (!existing) {
            return null;
         }

         if (existing.siteId && existing.siteId !== relations.siteId) {
            await tx.fishingSite.update({
               where: { id: existing.siteId },
               data: { catchCount: { decrement: 1 } },
            });
         }

         if (relations.siteId && existing.siteId !== relations.siteId) {
            await tx.fishingSite.update({
               where: { id: relations.siteId },
               data: { catchCount: { increment: 1 } },
            });
         }

         const updated = await tx.catch.update({
            where: { id: catchId },
            data: {
               title: input.title,
               notes: input.notes,
               caughtAt: input.caughtAt,
               siteId: relations.siteId,
               weight: input.weight,
               length: input.length,
               count: input.count ?? 1,
               weather: input.weather,
               waterTemp: input.waterTemp,
               depth: input.depth,
            },
            include: catchDetailInclude,
         });

         return withResolvedImageUrls(updated);
      });
   },

   async deleteCatch(clerkId: string, catchId: string) {
      const user = await getUserByClerkId(clerkId);

      return prisma.$transaction(async (tx) => {
         const existing = await tx.catch.findFirst({
            where: { id: catchId, createdById: user.id, deletedAt: null },
            select: { id: true, siteId: true },
         });

         if (!existing) {
            return null;
         }

         await tx.catch.update({
            where: { id: catchId },
            data: { deletedAt: new Date() },
         });

         if (existing.siteId) {
            await tx.fishingSite.update({
               where: { id: existing.siteId },
               data: { catchCount: { decrement: 1 } },
            });
         }

         return { id: catchId };
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
      const site = await prisma.fishingSite.findFirst({
         where: { id: siteId, deletedAt: null },
         include: siteDetailInclude,
      });

      if (!site) {
         return null;
      }

      return withResolvedImageUrls(site);
   },

   async listMyFishingSites(clerkId: string) {
      const user = await getUserByClerkId(clerkId);

      return prisma.fishingSite.findMany({
         where: { createdById: user.id, deletedAt: null },
         orderBy: { createdAt: 'desc' },
         select: {
            id: true,
            name: true,
            createdAt: true,
            catchCount: true,
         },
      });
   },

   async updateFishingSite(
      clerkId: string,
      siteId: string,
      input: UpdateFishingSiteInput
   ) {
      const user = await getUserByClerkId(clerkId);
      const existing = await prisma.fishingSite.findFirst({
         where: { id: siteId, createdById: user.id, deletedAt: null },
         select: { id: true },
      });

      if (!existing) {
         return null;
      }

      const updated = await prisma.fishingSite.update({
         where: { id: siteId },
         data: {
            name: input.name,
            description: input.description,
            latitude: input.latitude,
            longitude: input.longitude,
            waterType: input.waterType,
            accessNotes: input.accessNotes,
         },
         include: siteDetailInclude,
      });

      return withResolvedImageUrls(updated);
   },

   async deleteFishingSite(clerkId: string, siteId: string) {
      const user = await getUserByClerkId(clerkId);
      const existing = await prisma.fishingSite.findFirst({
         where: { id: siteId, createdById: user.id, deletedAt: null },
         select: { id: true },
      });

      if (!existing) {
         return null;
      }

      await prisma.fishingSite.update({
         where: { id: siteId },
         data: { deletedAt: new Date() },
      });

      return { id: siteId };
   },
};
