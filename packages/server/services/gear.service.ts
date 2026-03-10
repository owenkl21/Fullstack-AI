import { prisma } from '../lib/prisma';
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

   async listMyGear(clerkId: string) {
      const user = await getUserByClerkId(clerkId);

      return prisma.gear.findMany({
         where: { createdById: user.id },
         orderBy: { createdAt: 'desc' },
      });
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
