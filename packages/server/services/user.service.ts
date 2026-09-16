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
   email: string;
   /* Nullable: a new sign-up has no username until the angler picks one. */
   username: string | null;
   displayName: string;
   bio: string | null;
   avatarUrl: string | null;
   createdAt: Date;
   updatedAt: Date;
};

type ProfileImage = {
   id: string;
   url: string;
   sourceType: 'CATCH' | 'SITE';
   sourceId: string;
   sourceTitle: string;
};

type ProfileView = ProfileShape & {
   followersCount: number;
   followingCount: number;
   galleryImages: ProfileImage[];
};

type ProfileResult = {
   profile: ProfileView;
};

type ConnectionUser = {
   id: string;
   username: string;
   displayName: string;
   avatarUrl: string | null;
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

const maybeResolveImageReadUrl = async (
   image: { id: string; url: string; storageKey: string },
   context: string
) => {
   try {
      const signed = await uploadsService.getReadUrl(image.storageKey);
      return signed.readUrl;
   } catch (error) {
      console.warn(
         `[${context}] Failed to resolve image read URL, falling back to persisted URL.`,
         {
            imageId: image.id,
            storageKey: image.storageKey,
            error,
         }
      );
      return image.url;
   }
};

const withResolvedAvatar = async (
   profile: ProfileShape
): Promise<ProfileShape> => ({
   ...profile,
   avatarUrl: await maybeResolveAvatarReadUrl(profile.avatarUrl),
});

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

const findAvailableUsername = async (
   preferredUsername: string,
   userId: string
) => {
   const base = preferredUsername.trim();
   let suffix = 0;

   while (suffix < 100) {
      const candidate = suffix === 0 ? base : `${base}_${suffix}`;
      const existingUser = await prisma.user.findUnique({
         where: { username: candidate },
         select: { id: true },
      });

      if (!existingUser || existingUser.id === userId) {
         return candidate;
      }

      suffix += 1;
   }

   throw new Error('Unable to allocate unique username.');
};

const buildProfileView = async (userId: string) => {
   const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
         id: true,
         email: true,
         username: true,
         displayName: true,
         bio: true,
         avatarUrl: true,
         createdAt: true,
         updatedAt: true,
         _count: {
            select: {
               followers: true,
               following: true,
            },
         },
         catches: {
            where: { deletedAt: null },
            orderBy: { caughtAt: 'desc' },
            take: 8,
            select: {
               id: true,
               title: true,
               images: {
                  orderBy: { position: 'asc' },
                  take: 1,
                  select: {
                     image: {
                        select: { id: true, url: true, storageKey: true },
                     },
                  },
               },
            },
         },
         sites: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: {
               id: true,
               name: true,
               images: {
                  orderBy: { position: 'asc' },
                  take: 1,
                  select: {
                     image: {
                        select: { id: true, url: true, storageKey: true },
                     },
                  },
               },
            },
         },
      },
   });

   if (!profile) {
      return null;
   }

   const catchImages = await Promise.all(
      profile.catches
         .filter((entry) => entry.images[0]?.image)
         .map(async (entry) => ({
            id: entry.images[0]!.image.id,
            url: await maybeResolveImageReadUrl(
               entry.images[0]!.image,
               'user:profileCatchImage'
            ),
            sourceType: 'CATCH' as const,
            sourceId: entry.id,
            sourceTitle: entry.title,
         }))
   );

   const siteImages = await Promise.all(
      profile.sites
         .filter((entry) => entry.images[0]?.image)
         .map(async (entry) => ({
            id: entry.images[0]!.image.id,
            url: await maybeResolveImageReadUrl(
               entry.images[0]!.image,
               'user:profileSiteImage'
            ),
            sourceType: 'SITE' as const,
            sourceId: entry.id,
            sourceTitle: entry.name,
         }))
   );

   const resolvedProfile = await withResolvedAvatar({
      id: profile.id,
      email: profile.email,
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
   });

   return {
      ...resolvedProfile,
      followersCount: profile._count.followers,
      followingCount: profile._count.following,
      galleryImages: [...catchImages, ...siteImages].slice(0, 12),
   } satisfies ProfileView;
};

export const userService = {
   async getProfile(userId: string) {
      const profile = await buildProfileView(userId);

      if (!profile) {
         return null;
      }

      return { profile } satisfies ProfileResult;
   },

   async deleteAccount(userId: string) {
      return prisma.user.deleteMany({
         where: { id: userId },
      });
   },

   async updateProfile(userId: string, input: UserProfileInput) {
      const requestedUsername = input.username
         ? await findAvailableUsername(input.username, userId)
         : undefined;

      /*
       * Update, not upsert. The row exists: better-auth created it at sign-up,
       * so a missing one means the session points at a user that is gone, and
       * inventing a placeholder would hide that.
       */
      await prisma.user.update({
         where: { id: userId },
         data: {
            displayName: input.displayName,
            bio: input.bio,
            username: requestedUsername,
            avatarUrl: input.avatarUrl,
         },
         select: { id: true },
      });

      const profile = await buildProfileView(userId);

      if (!profile) {
         throw new Error('Failed to load profile after update.');
      }

      return { profile } satisfies ProfileResult;
   },

   async follow(userId: string, targetUserId: string) {
      const actor = await prisma.user.findUniqueOrThrow({
         where: { id: userId },
         select: { id: true },
      });

      if (actor.id === targetUserId) {
         return { code: 'cannot_follow_self' as const };
      }

      const target = await prisma.user.findFirst({
         where: { id: targetUserId, deletedAt: null },
         select: { id: true },
      });

      if (!target) {
         return null;
      }

      await prisma.follow.upsert({
         where: {
            followerId_followingId: {
               followerId: actor.id,
               followingId: targetUserId,
            },
         },
         create: {
            followerId: actor.id,
            followingId: targetUserId,
         },
         update: {},
      });

      return { following: true } as const;
   },

   async listConnections(
      userId: string,
      type: 'followers' | 'following',
      search?: string
   ) {
      const actor = await prisma.user.findUniqueOrThrow({
         where: { id: userId },
         select: { id: true },
      });
      const normalizedSearch = search?.trim();

      const whereClause =
         type === 'followers'
            ? {
                 followingId: actor.id,
                 follower: {
                    deletedAt: null,
                    ...(normalizedSearch
                       ? {
                            OR: [
                               {
                                  username: {
                                     contains: normalizedSearch,
                                     mode: 'insensitive' as const,
                                  },
                               },
                               {
                                  displayName: {
                                     contains: normalizedSearch,
                                     mode: 'insensitive' as const,
                                  },
                               },
                            ],
                         }
                       : {}),
                 },
              }
            : {
                 followerId: actor.id,
                 following: {
                    deletedAt: null,
                    ...(normalizedSearch
                       ? {
                            OR: [
                               {
                                  username: {
                                     contains: normalizedSearch,
                                     mode: 'insensitive' as const,
                                  },
                               },
                               {
                                  displayName: {
                                     contains: normalizedSearch,
                                     mode: 'insensitive' as const,
                                  },
                               },
                            ],
                         }
                       : {}),
                 },
              };

      const rows = await prisma.follow.findMany({
         where: whereClause,
         orderBy: { createdAt: 'desc' },
         select:
            type === 'followers'
               ? {
                    follower: {
                       select: {
                          id: true,
                          username: true,
                          displayName: true,
                          avatarUrl: true,
                       },
                    },
                 }
               : {
                    following: {
                       select: {
                          id: true,
                          username: true,
                          displayName: true,
                          avatarUrl: true,
                       },
                    },
                 },
      });

      const users: ConnectionUser[] = await Promise.all(
         rows.map(async (entry: any) => {
            const target =
               type === 'followers' ? entry.follower : entry.following;
            const resolvedAvatar = await maybeResolveAvatarReadUrl(
               target.avatarUrl
            );

            return {
               id: target.id,
               username: target.username,
               displayName: target.displayName,
               avatarUrl: resolvedAvatar,
            };
         })
      );

      return users;
   },
   async unfollow(userId: string, targetUserId: string) {
      const actor = await prisma.user.findUniqueOrThrow({
         where: { id: userId },
         select: { id: true },
      });

      if (actor.id === targetUserId) {
         return { code: 'cannot_follow_self' as const };
      }

      const target = await prisma.user.findFirst({
         where: { id: targetUserId, deletedAt: null },
         select: { id: true },
      });

      if (!target) {
         return null;
      }

      await prisma.follow.deleteMany({
         where: {
            followerId: actor.id,
            followingId: targetUserId,
         },
      });

      return { following: false } as const;
   },
};
