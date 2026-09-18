import { prisma } from '../lib/prisma';
import { notificationsService } from './notifications.service';
import { uploadsService } from './uploads.service';

type UserProfileInput = {
   displayName?: string;
   bio?: string | null;
   username?: string;
   avatarUrl?: string | null;
   bannerUrl?: string | null;
};

type ProfileShape = {
   id: string;
   email: string;
   /* Nullable: a new sign-up has no username until the angler picks one. */
   username: string | null;
   displayName: string;
   bio: string | null;
   avatarUrl: string | null;
   bannerUrl: string | null;
   createdAt: Date;
   updatedAt: Date;
};

type ProfileImage = {
   id: string;
   url: string;
   /* The same photograph at 900px and at 160px. A gallery tile is a few
    * hundred pixels square and has no business fetching a camera original. */
   cardUrl: string;
   thumbUrl: string;
   sourceType: 'CATCH' | 'SITE';
   sourceId: string;
   sourceTitle: string;
};

type ProfileView = ProfileShape & {
   /* The avatar at 160px and the banner at 900px, beside the originals. Both
    * are drawn small and neither is worth a full resolution download. */
   avatarThumbUrl: string | null;
   bannerCardUrl: string | null;
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
   avatarThumbUrl: string | null;
};

type ReadUrls = {
   url: string | null;
   cardUrl: string | null;
   thumbUrl: string | null;
};

/**
 * An angler's photograph at all three sizes.
 *
 * A value that is not a storage key is a URL somebody else is hosting, and
 * there are no variants of that: it is handed back as all three so the caller
 * has nothing to branch on.
 */
export const resolveAvatarReadUrls = async (
   avatarValue: string | null
): Promise<ReadUrls> => {
   if (!avatarValue) {
      return { url: null, cardUrl: null, thumbUrl: null };
   }

   if (!avatarValue.startsWith('users/')) {
      return {
         url: avatarValue,
         cardUrl: avatarValue,
         thumbUrl: avatarValue,
      };
   }

   try {
      const signed = await uploadsService.getReadUrl(avatarValue);
      return {
         url: signed.readUrl,
         cardUrl: signed.cardReadUrl,
         thumbUrl: signed.thumbReadUrl,
      };
   } catch (error) {
      console.warn(
         '[user:avatar] Failed to resolve avatar storage key to read URL.',
         {
            avatarValue,
            error,
         }
      );
      return { url: avatarValue, cardUrl: null, thumbUrl: null };
   }
};

/* Kept as it was for the two services that only ever draw one size. */
export const maybeResolveAvatarReadUrl = async (avatarValue: string | null) =>
   (await resolveAvatarReadUrls(avatarValue)).url;

const maybeResolveImageReadUrl = async (
   image: { id: string; url: string; storageKey: string },
   context: string
): Promise<{ url: string; cardUrl: string; thumbUrl: string }> => {
   try {
      const signed = await uploadsService.getReadUrl(image.storageKey);
      return {
         url: signed.readUrl,
         cardUrl: signed.cardReadUrl,
         thumbUrl: signed.thumbReadUrl,
      };
   } catch (error) {
      console.warn(
         `[${context}] Failed to resolve image read URL, falling back to persisted URL.`,
         {
            imageId: image.id,
            storageKey: image.storageKey,
            error,
         }
      );
      return { url: image.url, cardUrl: image.url, thumbUrl: image.url };
   }
};

const withResolvedAvatar = async (
   profile: ProfileShape
): Promise<
   ProfileShape & {
      avatarThumbUrl: string | null;
      bannerCardUrl: string | null;
   }
> => {
   const [avatar, banner] = await Promise.all([
      resolveAvatarReadUrls(profile.avatarUrl),
      resolveAvatarReadUrls(profile.bannerUrl ?? null),
   ]);

   return {
      ...profile,
      avatarUrl: avatar.url,
      avatarThumbUrl: avatar.thumbUrl,
      bannerUrl: banner.url,
      bannerCardUrl: banner.cardUrl,
   };
};

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
         bannerUrl: true,
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
            ...(await maybeResolveImageReadUrl(
               entry.images[0]!.image,
               'user:profileCatchImage'
            )),
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
            ...(await maybeResolveImageReadUrl(
               entry.images[0]!.image,
               'user:profileSiteImage'
            )),
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
      bannerUrl: profile.bannerUrl,
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

/*
 * Someone else's profile.
 *
 * Deliberately a separate query from buildProfileView rather than that one with
 * a flag on it. The owner's view selects their email address and every catch
 * they have, both of which would be a leak here, and a boolean threaded through
 * a query that long is exactly how that kind of leak happens later.
 *
 * Only PUBLIC records appear. GROUPS is not PUBLIC: it means the people in that
 * group, and this page is shown to anyone.
 */
const buildPublicProfileView = async (
   userId: string,
   viewerId: string | null
) => {
   const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
         id: true,
         username: true,
         displayName: true,
         bio: true,
         avatarUrl: true,
         bannerUrl: true,
         createdAt: true,
         /* No email. This page is public. */
         _count: { select: { followers: true, following: true } },
         catches: {
            where: { deletedAt: null, visibility: 'PUBLIC' },
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
            where: { deletedAt: null, visibility: 'PUBLIC' },
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
            ...(await maybeResolveImageReadUrl(
               entry.images[0]!.image,
               'user:publicCatchImage'
            )),
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
            ...(await maybeResolveImageReadUrl(
               entry.images[0]!.image,
               'user:publicSiteImage'
            )),
            sourceType: 'SITE' as const,
            sourceId: entry.id,
            sourceTitle: entry.name,
         }))
   );

   /* Whether the reader already follows them, so the button knows what it is. */
   const followed = viewerId
      ? await prisma.follow.findFirst({
           where: { followerId: viewerId, followingId: userId },
           select: { followerId: true },
        })
      : null;

   /*
    * The avatar is resolved on its own rather than through withResolvedAvatar,
    * because that takes the owner's shape and an email address is required by
    * it. There is no email on this object at all, which is the point.
    */
   const [avatar, banner] = await Promise.all([
      resolveAvatarReadUrls(profile.avatarUrl),
      resolveAvatarReadUrls(profile.bannerUrl),
   ]);

   return {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: avatar.url,
      avatarThumbUrl: avatar.thumbUrl,
      bannerUrl: banner.url,
      bannerCardUrl: banner.cardUrl,
      createdAt: profile.createdAt,
      followersCount: profile._count.followers,
      followingCount: profile._count.following,
      galleryImages: [...catchImages, ...siteImages].slice(0, 12),
      isYou: viewerId === userId,
      followedByYou: Boolean(followed),
   };
};

export const userService = {
   /** Another angler's profile, as anyone is allowed to see it. */
   async getPublicProfile(userId: string, viewerId: string | null) {
      const profile = await buildPublicProfileView(userId, viewerId);
      return profile ? { profile } : null;
   },

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
            bannerUrl: input.bannerUrl,
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

      await notificationsService.notify({
         userId: targetUserId,
         actorId: actor.id,
         kind: 'FOLLOW',
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
            /* A followers sheet is a column of 40px photographs, so it reads
             * the thumb and never the original. */
            const resolvedAvatar = await resolveAvatarReadUrls(
               target.avatarUrl
            );

            return {
               id: target.id,
               username: target.username,
               displayName: target.displayName,
               avatarUrl: resolvedAvatar.url,
               avatarThumbUrl: resolvedAvatar.thumbUrl,
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
