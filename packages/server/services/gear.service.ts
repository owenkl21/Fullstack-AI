import { prisma } from '../lib/prisma';
import { uploadsService } from './uploads.service';
import { userService } from './user.service';

type GearType = 'ROD' | 'REEL' | 'BAIT' | 'LURE' | 'LINE' | 'HOOK' | 'WEIGHTS';

type GearImageInput = {
   storageKey: string;
   url: string;
};

type GearInput = {
   name: string;
   brand: string;
   type: GearType;
   image?: GearImageInput | null;
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

const withSignedImageUrls = async <T extends { imageUrl: string | null }>(
   gear: T[]
) => {
   const imageUrls = gear
      .map((entry) => entry.imageUrl)
      .filter((url): url is string => Boolean(url));

   if (imageUrls.length === 0) {
      return gear;
   }

   const images = await prisma.image.findMany({
      where: { url: { in: imageUrls } },
      select: { url: true, storageKey: true },
   });

   const storageKeyByUrl = new Map(
      images.map((image) => [image.url, image.storageKey])
   );

   return Promise.all(
      gear.map(async (entry) => {
         if (!entry.imageUrl) {
            return entry;
         }

         const storageKey = storageKeyByUrl.get(entry.imageUrl);
         if (!storageKey) {
            return entry;
         }

         try {
            const signed = await uploadsService.getReadUrl(storageKey);
            return { ...entry, imageUrl: signed.readUrl };
         } catch (error) {
            console.warn(
               '[gear:list] Falling back to persisted image URL because generating read URL failed.',
               {
                  storageKey,
                  error,
               }
            );

            return entry;
         }
      })
   );
};

export const gearService = {
   async createGear(clerkId: string, input: GearInput) {
      const user = await getUserByClerkId(clerkId);

      return prisma.$transaction(async (tx) => {
         const gear = await tx.gear.create({
            data: {
               createdById: user.id,
               name: input.name,
               brand: input.brand,
               type: input.type,
               imageUrl: input.image
                  ? stripSignedUrlParams(input.image.url)
                  : null,
            },
         });

         if (input.image) {
            await tx.image.upsert({
               where: { storageKey: input.image.storageKey },
               create: {
                  uploadedById: user.id,
                  storageKey: input.image.storageKey,
                  url: stripSignedUrlParams(input.image.url),
               },
               update: {
                  url: stripSignedUrlParams(input.image.url),
               },
            });
         }

         return gear;
      });
   },

   async listGear() {
      const gear = await prisma.gear.findMany({
         orderBy: { createdAt: 'desc' },
      });

      return withSignedImageUrls(gear);
   },

   async listMyGear(clerkId: string) {
      const user = await getUserByClerkId(clerkId);

      const gear = await prisma.gear.findMany({
         where: { createdById: user.id },
         orderBy: { createdAt: 'desc' },
      });

      return withSignedImageUrls(gear);
   },

   async updateGear(clerkId: string, gearId: string, input: GearInput) {
      const user = await getUserByClerkId(clerkId);

      const existing = await prisma.gear.findFirst({
         where: { id: gearId, createdById: user.id },
         select: { id: true },
      });

      if (!existing) {
         return null;
      }

      const updated = await prisma.gear.update({
         where: { id: gearId },
         data: {
            name: input.name,
            brand: input.brand,
            type: input.type,
            ...(input.image === undefined
               ? {}
               : {
                    imageUrl: input.image
                       ? stripSignedUrlParams(input.image.url)
                       : null,
                 }),
         },
      });

      if (input.image) {
         await prisma.image.upsert({
            where: { storageKey: input.image.storageKey },
            create: {
               uploadedById: user.id,
               storageKey: input.image.storageKey,
               url: stripSignedUrlParams(input.image.url),
            },
            update: {
               url: stripSignedUrlParams(input.image.url),
            },
         });
      }

      return updated;
   },

   async deleteGear(clerkId: string, gearId: string) {
      const user = await getUserByClerkId(clerkId);

      const existing = await prisma.gear.findFirst({
         where: { id: gearId, createdById: user.id },
         select: { id: true },
      });

      if (!existing) {
         return null;
      }

      await prisma.gear.delete({ where: { id: gearId } });
      return { id: gearId };
   },
};
