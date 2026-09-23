import type { Prisma } from '@prisma/client';
import { isAdmin, TEAM_HANDLE } from '../lib/admin';
import { requireEmailVerification } from '../lib/auth';
import { prisma } from '../lib/prisma';
import {
   handleProblemOf,
   nameHasBadLanguage,
   nameIsBrand,
   normaliseHandle,
   type HandleProblem,
} from '../schemas/user.schema';
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
   /* The tick beside the name. True on one account in the app. */
   verified: boolean;
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
   /* How the angler framed it, for a catch photograph: the tile is a square
    * crop, and the crop is theirs to place. Absent on a spot's photograph. */
   focusX?: number | null;
   focusY?: number | null;
   zoom?: number | null;
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
   /* Null for an angler who signed up and has not picked one yet. */
   username: string | null;
   displayName: string;
   avatarUrl: string | null;
   avatarThumbUrl: string | null;
   verified: boolean;
};

/* One row of the angler search. No email: this is a list of other people. */
type AnglerResult = ConnectionUser & {
   followersCount: number;
   followedByMe: boolean;
};

export type HandleCheck =
   | { handle: string; available: true }
   | { handle: string; available: false; reason: HandleProblem | 'taken' };

type UpdateProfileResult =
   | ProfileResult
   | {
        code:
           | 'username_taken'
           | 'username_reserved'
           | 'username_language'
           | 'display_name_reserved'
           | 'display_name_language';
     };

const SEARCH_PAGE = 20;
/* Far enough to page through any real search, short of letting one request
 * walk the whole table twenty rows at a time. */
const SEARCH_MAX_OFFSET = 400;
const SEARCH_MAX_TERM = 60;

/*
 * contains and startsWith are LIKE underneath, and Prisma hands the term over
 * as it was typed. Left alone, "%" or "_" matched every angler there is, and
 * the _ in @tess_t stood for any letter at all. A backslash in front makes
 * MySQL read each of them as the character it is.
 */
const escapeLike = (term: string) => term.replace(/[\\%_]/g, '\\$&');

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

/*
 * Whether a handle can be had by this angler.
 *
 * Their own handle is always theirs, reserved or not: an angler who held one
 * before the list existed can still save the rest of their profile, and a
 * handle stored before handles were lowercased still counts as their own.
 *
 * There used to be no refusal here at all. A taken handle was quietly renamed
 * to owen_1, owen_2 and on, so somebody who asked for @owen was saved as a
 * name they never chose and only found out from the toast.
 *
 * The lookup is plain equality and still ignores case, because the table is
 * created utf8mb4_unicode_ci and so is its unique index. A legacy @Owen stops
 * a new @owen here, and the index would stop it anyway.
 */
const checkHandleFor = async (
   raw: string,
   userId: string
): Promise<HandleCheck> => {
   const handle = normaliseHandle(raw);

   const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, role: true },
   });

   if (current?.username && current.username.toLowerCase() === handle) {
      return { handle, available: true };
   }

   /*
    * The team's handle is the admin account's and nobody else's. The brand
    * rule in the schema refuses it, and every spelling of it, to everybody;
    * this is the one account that is let past, and only for that exact word.
    */
   const problem = handleProblemOf(handle, {
      allowReserved: isAdmin(current) ? TEAM_HANDLE : null,
   });
   if (problem) {
      return { handle, available: false, reason: problem };
   }

   /* A closed account keeps its row, and the unique index with it, so its
    * handle is still taken. */
   const holder = await prisma.user.findFirst({
      where: { username: handle, id: { not: userId } },
      select: { id: true },
   });

   return holder
      ? { handle, available: false, reason: 'taken' }
      : { handle, available: true };
};

/*
 * Who the search may show. Never the reader, never a closed account, and an
 * unconfirmed one only while confirming is not required to sign in.
 */
const findableBy = (viewerId: string): Prisma.UserWhereInput => ({
   id: { not: viewerId },
   deletedAt: null,
   ...(requireEmailVerification ? { emailVerified: true } : {}),
});

const anglerSelect = {
   id: true,
   username: true,
   displayName: true,
   avatarUrl: true,
   verified: true,
   _count: { select: { followers: true } },
} satisfies Prisma.UserSelect;

/* The best known first, then by name, then by id so a page boundary never
 * lands between two rows that sort the same. */
const anglerOrder: Prisma.UserOrderByWithRelationInput[] = [
   { followers: { _count: 'desc' } },
   { displayName: 'asc' },
   { id: 'asc' },
];

/*
 * The ranks a search is answered in, best first.
 *
 * A name that starts with what was typed is almost always the one meant, so
 * it outranks a name that only contains it: "tom" should find Tom before it
 * finds Bottom. A word inside the name counts as a start, so "kle" finds Owen
 * Kleinhans. A leading @ says the reader is typing a handle, so handles go
 * first and names come after them.
 */
const searchTiers = (
   term: string,
   byHandle: boolean
): Prisma.UserWhereInput[] =>
   byHandle
      ? [
           { username: { startsWith: term } },
           { username: { contains: term } },
           { displayName: { contains: term } },
        ]
      : [
           {
              OR: [
                 { username: { startsWith: term } },
                 { displayName: { startsWith: term } },
                 { displayName: { contains: ` ${term}` } },
              ],
           },
           {
              OR: [
                 { username: { contains: term } },
                 { displayName: { contains: term } },
              ],
           },
        ];

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
         verified: true,
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
                        select: {
                           id: true,
                           url: true,
                           storageKey: true,
                           focusX: true,
                           focusY: true,
                           zoom: true,
                        },
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
            focusX: entry.images[0]!.image.focusX,
            focusY: entry.images[0]!.image.focusY,
            zoom: entry.images[0]!.image.zoom,
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
      verified: profile.verified,
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
         verified: true,
         createdAt: true,
         /* No email. This page is public. */
         _count: { select: { followers: true, following: true } },
         catches: {
            /* Not one whose post is hidden while the team looks at it. */
            where: {
               deletedAt: null,
               visibility: 'PUBLIC',
               feedPosts: {
                  none: { hiddenAt: { not: null }, deletedAt: null },
               },
            },
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
                        select: {
                           id: true,
                           url: true,
                           storageKey: true,
                           focusX: true,
                           focusY: true,
                           zoom: true,
                        },
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
            focusX: entry.images[0]!.image.focusX,
            focusY: entry.images[0]!.image.focusY,
            zoom: entry.images[0]!.image.zoom,
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
      verified: profile.verified,
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

   /** Whether a handle is free for this angler, without taking it. */
   checkHandle(raw: string, userId: string) {
      return checkHandleFor(raw, userId);
   },

   async updateProfile(
      userId: string,
      input: UserProfileInput
   ): Promise<UpdateProfileResult> {
      let username: string | undefined;

      /*
       * The app's own name is not a name an angler may go by. A handle is
       * grey and small; the display name is the line people actually read on
       * a card, so leaving it open would have made the handle rule decorative.
       * The admin account is the exception, because it is the app.
       */
      if (input.displayName !== undefined && nameIsBrand(input.displayName)) {
         const actor = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
         });
         if (!isAdmin(actor)) return { code: 'display_name_reserved' };
      }

      /*
       * Bad language in a name is refused when the name changes, not when a
       * form sends the one the angler already has: somebody whose surname is
       * on the list, or whose name was chosen before a word was added to it,
       * can still save everything else.
       */
      if (
         input.displayName !== undefined &&
         nameHasBadLanguage(input.displayName)
      ) {
         const current = await prisma.user.findUnique({
            where: { id: userId },
            select: { displayName: true },
         });
         if (current?.displayName?.trim() !== input.displayName.trim()) {
            return { code: 'display_name_language' };
         }
      }

      if (input.username !== undefined) {
         const check = await checkHandleFor(input.username, userId);

         if (!check.available) {
            /* The schema has already refused anything malformed, so the only
             * refusals left to say are these. The handle an angler already
             * holds is let through by checkHandleFor before any of them. */
            return {
               code:
                  check.reason === 'reserved'
                     ? 'username_reserved'
                     : check.reason === 'language'
                       ? 'username_language'
                       : 'username_taken',
            };
         }

         username = check.handle;
      }

      /*
       * Update, not upsert. The row exists: better-auth created it at sign-up,
       * so a missing one means the session points at a user that is gone, and
       * inventing a placeholder would hide that.
       */
      try {
         await prisma.user.update({
            where: { id: userId },
            data: {
               displayName: input.displayName,
               bio: input.bio,
               username,
               avatarUrl: input.avatarUrl,
               bannerUrl: input.bannerUrl,
            },
            select: { id: true },
         });
      } catch (error) {
         /*
          * Two anglers asking for the same free handle in the same moment
          * both pass the check above, and the unique index is what stops the
          * second. The handle is the only unique column this writes.
          */
         if (username !== undefined && isDuplicateConstraintError(error)) {
            return { code: 'username_taken' };
         }

         throw error;
      }

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
      /* "@owen" is how a handle gets typed, and no stored handle has the @. */
      const typed = search?.trim().replace(/^@/, '').slice(0, SEARCH_MAX_TERM);
      const normalizedSearch = typed ? escapeLike(typed) : '';

      /*
       * No mode: 'insensitive'. Prisma only has it on Postgres and Mongo, and
       * on MySQL it made every search with a term in it fail. The columns are
       * utf8mb4_unicode_ci, so a plain contains already ignores case.
       */
      const matching = normalizedSearch
         ? {
              OR: [
                 { username: { contains: normalizedSearch } },
                 { displayName: { contains: normalizedSearch } },
              ],
           }
         : {};

      const whereClause =
         type === 'followers'
            ? {
                 followingId: actor.id,
                 follower: { deletedAt: null, ...matching },
              }
            : {
                 followerId: actor.id,
                 following: { deletedAt: null, ...matching },
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
                          verified: true,
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
                          verified: true,
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
               verified: Boolean(target.verified),
            };
         })
      );

      return users;
   },

   /*
    * Other anglers by name or handle, twenty at a time.
    *
    * Nothing typed is a short list of the most followed anglers the reader
    * does not follow yet, so the page opens on somebody worth following
    * rather than on an empty box. That list is one page and has no next.
    *
    * The cursor is an offset. The ranks below are several queries stitched
    * together, and an id cursor cannot say which rank it stopped in. Each
    * rank is read only as far as the page needs, and none past the offset
    * cap, so a deep page costs a bounded read rather than the whole table.
    *
    * startsWith and contains are LIKE underneath, and the columns are
    * utf8mb4_unicode_ci, so both ignore case without asking.
    */
   async searchAnglers(viewerId: string, rawQuery: string, cursor?: string) {
      const trimmed = rawQuery.trim().slice(0, SEARCH_MAX_TERM);
      const byHandle = trimmed.startsWith('@');
      const term = trimmed.replace(/^@/, '').trim();
      const visible = findableBy(viewerId);

      let rows: Prisma.UserGetPayload<{ select: typeof anglerSelect }>[];
      let nextCursor: string | null = null;

      if (!term) {
         rows = await prisma.user.findMany({
            where: {
               ...visible,
               followers: { none: { followerId: viewerId } },
            },
            orderBy: [
               { followers: { _count: 'desc' } },
               { createdAt: 'desc' },
               { id: 'asc' },
            ],
            take: SEARCH_PAGE,
            select: anglerSelect,
         });
      } else {
         const parsed = Number.parseInt(cursor ?? '', 10);
         const offset = Number.isFinite(parsed)
            ? Math.min(Math.max(parsed, 0), SEARCH_MAX_OFFSET)
            : 0;
         /* One past the page, which is how we know there is a next one. */
         const wanted = offset + SEARCH_PAGE + 1;
         const tiers = searchTiers(escapeLike(term), byHandle);
         const found: typeof rows = [];

         for (const tier of tiers) {
            if (found.length >= wanted) break;

            found.push(
               ...(await prisma.user.findMany({
                  /*
                   * Each rank leaves out everyone an earlier rank took, so
                   * nobody is listed twice. By id, not by NOT over the
                   * earlier ranks: a handle that is NULL makes that NOT come
                   * out NULL, and MySQL drops the row, so an angler without
                   * a handle could only be found by the start of their name.
                   * A rank is only reached once the ones before it were read
                   * to the end, so the ids are all of them.
                   */
                  where: {
                     AND: [visible, tier],
                     ...(found.length
                        ? { id: { notIn: found.map((row) => row.id) } }
                        : {}),
                  },
                  orderBy: anglerOrder,
                  take: wanted - found.length,
                  select: anglerSelect,
               }))
            );
         }

         rows = found.slice(offset, offset + SEARCH_PAGE);
         nextCursor =
            found.length > offset + SEARCH_PAGE &&
            offset + SEARCH_PAGE <= SEARCH_MAX_OFFSET
               ? String(offset + SEARCH_PAGE)
               : null;
      }

      const ids = rows.map((row) => row.id);
      const follows = ids.length
         ? await prisma.follow.findMany({
              where: { followerId: viewerId, followingId: { in: ids } },
              select: { followingId: true },
           })
         : [];
      const followed = new Set(follows.map((row) => row.followingId));

      const users: AnglerResult[] = await Promise.all(
         rows.map(async (row) => {
            /* A 44px circle in a list, so the thumb, the same way the
             * followers sheet reads it. */
            const avatar = await resolveAvatarReadUrls(row.avatarUrl);

            return {
               id: row.id,
               username: row.username,
               displayName: row.displayName,
               avatarUrl: avatar.url,
               avatarThumbUrl: avatar.thumbUrl,
               verified: row.verified,
               followersCount: row._count.followers,
               followedByMe: followed.has(row.id),
            };
         })
      );

      return { users, nextCursor, suggested: !term };
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
