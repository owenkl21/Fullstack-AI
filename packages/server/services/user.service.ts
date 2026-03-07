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

const getErrorCode = (error: unknown) => {
   if (typeof error !== 'object' || error === null || !('code' in error)) {
      return null;
   }

   return String((error as { code?: unknown }).code);
};

const isDuplicateConstraintError = (error: unknown) => {
   const code = getErrorCode(error);

   return (
      code === 'P2002' ||
      code === 'ER_DUP_ENTRY' ||
      code === '1062' ||
      code === '23000'
   );
};

const isDatabaseConnectivityError = (error: unknown) => {
   if (typeof error !== 'object' || error === null) {
      return false;
   }

   const maybeCode = getErrorCode(error);
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

const findAvailableUsername = async (
   preferredUsername: string,
   clerkUserId: string
) => {
   const base = preferredUsername.trim();
   let suffix = 0;

   while (suffix < 100) {
      const candidate = suffix === 0 ? base : `${base}_${suffix}`;
      const existingUser = await prisma.user.findUnique({
         where: { username: candidate },
         select: { clerkId: true },
      });

      if (!existingUser || existingUser.clerkId === clerkUserId) {
         return candidate;
      }

      suffix += 1;
   }

   throw new Error('Unable to allocate unique username.');
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
      let identity: Awaited<ReturnType<typeof getPrimaryEmail>>;

      try {
         identity = await getPrimaryEmail(clerkUserId);
      } catch (error) {
         console.warn(
            '[user:sync] Clerk identity incomplete; syncing fallback placeholder identity to database.',
            {
               clerkUserId,
               error,
            }
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

      try {
         return await prisma.user.upsert({
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
         if (!isDuplicateConstraintError(error)) {
            throw error;
         }

         const fallbackUsername = await findAvailableUsername(
            buildDefaultUsername(clerkUserId),
            clerkUserId
         );

         return prisma.user.upsert({
            where: { clerkId: clerkUserId },
            create: {
               clerkId: clerkUserId,
               email: identity.email,
               username: fallbackUsername,
               displayName: identity.displayName,
               avatarUrl: identity.imageUrl,
            },
            update: {
               email: identity.email,
               avatarUrl: identity.imageUrl,
            },
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
         const requestedUsername = input.username
            ? await findAvailableUsername(input.username, clerkUserId)
            : undefined;

         const profile = await prisma.user.upsert({
            where: { clerkId: clerkUserId },
            create: {
               clerkId: clerkUserId,
               email: buildPlaceholderEmail(clerkUserId),
               username: requestedUsername ?? buildDefaultUsername(clerkUserId),
               displayName: input.displayName ?? buildPlaceholderDisplayName(),
               bio: input.bio,
            },
            update: {
               displayName: input.displayName,
               bio: input.bio,
               username: requestedUsername,
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
         if (isDatabaseConnectivityError(error)) {
            console.error(
               '[user:updateProfile] Database unavailable; refusing Clerk-only fallback so profile changes are not lost from primary storage.',
               { clerkUserId, error }
            );
         }

         throw error;
      }
   },
};
