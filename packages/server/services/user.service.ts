import { clerkClient } from '@clerk/express';
import { prisma } from '../lib/prisma';

type UserProfileInput = {
   displayName?: string;
   bio?: string | null;
   username?: string;
};

const buildDefaultUsername = (clerkUserId: string) =>
   `clerk_${clerkUserId.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()}`;

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

   async updateProfileByClerkId(clerkUserId: string, input: UserProfileInput) {
      return prisma.user.update({
         where: { clerkId: clerkUserId },
         data: {
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
