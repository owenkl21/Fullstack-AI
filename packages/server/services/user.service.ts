import { clerkClient } from '@clerk/express';
import { prisma } from '../lib/prisma';
import { uploadsService } from './uploads.service';

type UserProfileInput = {
   displayName?: string;
   bio?: string | null;
   username?: string;
   avatarUrl?: string | null;
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

const maybeResolveAvatarReadUrl = async (avatarValue: string | null) => {
   if (!avatarValue) {
      return null;
   }

   if (!avatarValue.startsWith('users/')) {
      return avatarValue;
   }

   try {
      const signed = await uploadsService.getReadUrl(avatarValue);
      return signed.readUrl;
   } catch (error) {
      console.warn(
         '[user:avatar] Failed to resolve avatar storage key to read URL.',
         {
            avatarValue,
            error,
         }
      );
      return avatarValue;
   }
};

const withResolvedAvatar = async (
   profile: ProfileShape
): Promise<ProfileShape> => ({
   ...profile,
   avatarUrl: await maybeResolveAvatarReadUrl(profile.avatarUrl),
});

const syncAvatarToClerk = async (
   clerkUserId: string,
   avatarValue: string | null | undefined
) => {
   if (avatarValue === undefined) {
      return;
   }

   if (avatarValue === null) {
      await clerkClient.users.deleteUserProfileImage(clerkUserId);
      return;
   }

   const avatarUrl = await maybeResolveAvatarReadUrl(avatarValue);

   if (!avatarUrl) {
      await clerkClient.users.deleteUserProfileImage(clerkUserId);
      return;
   }

   const response = await fetch(avatarUrl);
   if (!response.ok) {
      throw new Error(
         `Failed to fetch avatar image for Clerk sync: ${response.status} ${response.statusText}`
      );
   }

   const contentType =
      response.headers.get('content-type') ?? 'application/octet-stream';
   const bytes = await response.arrayBuffer();
   const extension =
      contentType === 'image/png'
         ? 'png'
         : contentType === 'image/webp'
           ? 'webp'
           : 'jpg';
   const file = new File([bytes], `avatar.${extension}`, {
      type: contentType,
   });

   await clerkClient.users.updateUserProfileImage(clerkUserId, { file });
};

const syncAvatarToClerkWithRetry = async (
   clerkUserId: string,
   avatarValue: string | null | undefined
) => {
   let lastError: unknown;

   for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
         await syncAvatarToClerk(clerkUserId, avatarValue);
         return;
      } catch (error) {
         lastError = error;
         console.warn(
            '[user:updateProfile] Avatar sync to Clerk attempt failed.',
            {
               clerkUserId,
               attempt,
               error,
            }
         );
      }
   }

   throw lastError;
};

type ClerkFallbackMetadata = {
   appProfile?: {
      displayName?: string;
      bio?: string | null;
      username?: string;
      avatarUrl?: string | null;
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
      avatarUrl: overrides?.avatarUrl ?? identity.imageUrl,
      createdAt: new Date(identity.clerkUser.createdAt),
      updatedAt: new Date(),
   };
};

const persistFallbackProfileToClerk = async (
   clerkUserId: string,
   profile: Pick<ProfileShape, 'displayName' | 'bio' | 'username' | 'avatarUrl'>
) => {
   const clerkUser = await clerkClient.users.getUser(clerkUserId);
   const metadata = (clerkUser.unsafeMetadata ?? {}) as ClerkFallbackMetadata;
   const existingProfile = metadata.appProfile ?? {};

   await clerkClient.users.updateUser(clerkUserId, {
      unsafeMetadata: {
         ...metadata,
         appProfile: {
            ...existingProfile,
            displayName: profile.displayName,
            bio: profile.bio,
            username: profile.username,
            avatarUrl: profile.avatarUrl,
         },
      },
   });
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
            return {
               profile: await withResolvedAvatar(profile),
               storage: 'database',
            } satisfies ProfileResult;
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
         profile: await withResolvedAvatar(
            await getFallbackProfileFromClerk(clerkUserId)
         ),
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
               avatarUrl: input.avatarUrl,
            },
            update: {
               displayName: input.displayName,
               bio: input.bio,
               username: requestedUsername,
               avatarUrl: input.avatarUrl,
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

         await syncAvatarToClerkWithRetry(clerkUserId, input.avatarUrl);

         return {
            profile: await withResolvedAvatar(profile),
            storage: 'database',
         } satisfies ProfileResult;
      } catch (error) {
         if (isDatabaseConnectivityError(error)) {
            console.error(
               '[user:updateProfile] Database unavailable. Persisting profile to Clerk fallback metadata.',
               { clerkUserId, error }
            );

            const fallbackProfile = await getFallbackProfileFromClerk(
               clerkUserId,
               input
            );

            await persistFallbackProfileToClerk(clerkUserId, {
               displayName: fallbackProfile.displayName,
               bio: fallbackProfile.bio,
               username: fallbackProfile.username,
               avatarUrl: fallbackProfile.avatarUrl,
            });

            await syncAvatarToClerkWithRetry(
               clerkUserId,
               fallbackProfile.avatarUrl
            );

            return {
               profile: await withResolvedAvatar(fallbackProfile),
               storage: 'clerk_fallback',
            } satisfies ProfileResult;
         }

         throw error;
      }
   },
};
