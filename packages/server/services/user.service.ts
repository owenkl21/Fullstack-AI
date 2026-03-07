import { clerkClient } from '@clerk/express';
import { prisma } from '../lib/prisma';

type UserProfileInput = {
   displayName?: string;
   bio?: string | null;
   username?: string;
};

const buildDefaultUsername = (clerkUserId: string) =>
   `clerk_${clerkUserId.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()}`;

const buildPlaceholderEmail = (clerkUserId: string) =>
   `${buildDefaultUsername(clerkUserId)}@placeholder.local`;

const buildPlaceholderDisplayName = () => 'New Angler';

const getPrimaryEmail = async (clerkUserId: string) => {
   const clerkUser = await clerkClient.users.getUser(clerkUserId);
   const primaryEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId
   );

   if (!primaryEmail?.emailAddress) {
      throw new Error('Authenticated Clerk user is missing a primary email.');
   }

   const defaultDisplayName =
      clerkUser.fullName ||
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
      primaryEmail.emailAddress;

   return {
      clerkUser,
      email: primaryEmail.emailAddress,
      displayName: defaultDisplayName,
      username: clerkUser.username ?? buildDefaultUsername(clerkUser.id),
      imageUrl: clerkUser.imageUrl,
   };
};

export const userService = {
   async syncAuthenticatedUser(clerkUserId: string) {
      try {
         const identity = await getPrimaryEmail(clerkUserId);

         return prisma.user.upsert({
            where: { clerkId: clerkUserId },
            create: {
               clerkId: clerkUserId,
               email: identity.email,
               username: identity.username,
               displayName: identity.displayName,
               avatarUrl: identity.imageUrl,
            },
            update: {
               email: identity.email,
               avatarUrl: identity.imageUrl,
            },
         });
      } catch (error) {
         console.warn(
            '[user:sync] Falling back to placeholder identity for authenticated Clerk user.',
            error
         );

         return prisma.user.upsert({
            where: { clerkId: clerkUserId },
            create: {
               clerkId: clerkUserId,
               email: buildPlaceholderEmail(clerkUserId),
               username: buildDefaultUsername(clerkUserId),
               displayName: buildPlaceholderDisplayName(),
            },
            update: {},
         });
      }
   },

   async getProfileByClerkId(clerkUserId: string) {
      return prisma.user.findUnique({
         where: { clerkId: clerkUserId },
         select: {
            id: true,
            clerkId: true,
            email: true,
            username: true,
            displayName: true,
            bio: true,
            avatarUrl: true,
            createdAt: true,
            updatedAt: true,
         },
      });
   },

   async deleteByClerkId(clerkUserId: string) {
      return prisma.user.deleteMany({
         where: { clerkId: clerkUserId },
      });
   },

   async updateProfileByClerkId(clerkUserId: string, input: UserProfileInput) {
      return prisma.user.upsert({
         where: { clerkId: clerkUserId },
         create: {
            clerkId: clerkUserId,
            email: buildPlaceholderEmail(clerkUserId),
            username: input.username ?? buildDefaultUsername(clerkUserId),
            displayName: input.displayName ?? buildPlaceholderDisplayName(),
            bio: input.bio,
         },
         update: {
            displayName: input.displayName,
            bio: input.bio,
            username: input.username,
         },
         select: {
            id: true,
            clerkId: true,
            email: true,
            username: true,
            displayName: true,
            bio: true,
            avatarUrl: true,
            createdAt: true,
            updatedAt: true,
         },
      });
   },
};
