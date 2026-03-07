import { clerkClient } from '@clerk/express';
import { prisma } from '../lib/prisma';

type UserProfileInput = {
   displayName?: string;
   bio?: string | null;
   username?: string;
};

type ProfileShape = {
   id: string;
   clerkId: string;
   email: string;
   username: string;
   displayName: string;
   bio: string | null;
   avatarUrl: string | null;
   createdAt: Date;
   updatedAt: Date;
};

type ProfileResult = {
   profile: ProfileShape;
   storage: 'database' | 'clerk_fallback';
};

type ClerkFallbackMetadata = {
   appProfile?: {
      displayName?: string;
      bio?: string | null;
   };
};

const buildDefaultUsername = (clerkUserId: string) =>
   `clerk_${clerkUserId.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()}`;

const buildPlaceholderEmail = (clerkUserId: string) =>
   `${buildDefaultUsername(clerkUserId)}@placeholder.local`;

const buildPlaceholderDisplayName = () => 'New Angler';

const isDatabaseConnectivityError = (error: unknown) => {
   if (typeof error !== 'object' || error === null) {
      return false;
   }

   const maybeCode =
      'code' in error ? String((error as { code?: unknown }).code) : null;
   const maybeMessage =
      'message' in error
         ? String((error as { message?: unknown }).message)
         : '';

   return (
      maybeCode === '45028' ||
      maybeCode === 'P1000' ||
      maybeCode === 'P1001' ||
      maybeMessage.includes('pool timeout') ||
      maybeMessage.includes('Access denied for user')
   );
};

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

const getFallbackProfileFromClerk = async (
   clerkUserId: string,
   overrides?: UserProfileInput
): Promise<ProfileShape> => {
   const identity = await getPrimaryEmail(clerkUserId);
   const metadata = (identity.clerkUser.unsafeMetadata ??
      {}) as ClerkFallbackMetadata;
   const profileMetadata = metadata.appProfile ?? {};

   return {
      id: `clerk-${clerkUserId}`,
      clerkId: clerkUserId,
      email: identity.email,
      username: overrides?.username ?? identity.username,
      displayName:
         overrides?.displayName ??
         profileMetadata.displayName ??
         identity.displayName ??
         buildPlaceholderDisplayName(),
      bio: overrides?.bio ?? profileMetadata.bio ?? null,
      avatarUrl: identity.imageUrl,
      createdAt: new Date(identity.clerkUser.createdAt),
      updatedAt: new Date(),
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
      try {
         const profile = await prisma.user.findUnique({
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

         if (profile) {
            return { profile, storage: 'database' } satisfies ProfileResult;
         }
      } catch (error) {
         if (!isDatabaseConnectivityError(error)) {
            throw error;
         }

         console.warn(
            '[user:getProfile] Database unavailable. Falling back to Clerk profile.',
            {
               clerkUserId,
               error,
            }
         );
      }

      return {
         profile: await getFallbackProfileFromClerk(clerkUserId),
         storage: 'clerk_fallback',
      } satisfies ProfileResult;
   },

   async deleteByClerkId(clerkUserId: string) {
      return prisma.user.deleteMany({
         where: { clerkId: clerkUserId },
      });
   },

   async updateProfileByClerkId(clerkUserId: string, input: UserProfileInput) {
      try {
         const profile = await prisma.user.upsert({
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

         return { profile, storage: 'database' } satisfies ProfileResult;
      } catch (error) {
         if (!isDatabaseConnectivityError(error)) {
            throw error;
         }

         const clerkUser = await clerkClient.users.getUser(clerkUserId);
         const existingMetadata = (clerkUser.unsafeMetadata ?? {}) as Record<
            string,
            unknown
         >;
         const existingAppProfile =
            (existingMetadata.appProfile as ClerkFallbackMetadata['appProfile']) ??
            {};

         await clerkClient.users.updateUser(clerkUserId, {
            username: input.username,
            unsafeMetadata: {
               ...existingMetadata,
               appProfile: {
                  ...existingAppProfile,
                  displayName: input.displayName,
                  bio: input.bio,
               },
            },
         });

         console.warn(
            '[user:updateProfile] Database unavailable, profile saved to Clerk unsafeMetadata.appProfile fallback.',
            { clerkUserId }
         );

         return {
            profile: await getFallbackProfileFromClerk(clerkUserId, input),
            storage: 'clerk_fallback',
         } satisfies ProfileResult;
      }
   },
};
