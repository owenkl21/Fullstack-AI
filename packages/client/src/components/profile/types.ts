/* The shape of an angler as the profile endpoint sends it, plus the small helpers
 * the profile screens share. Kept here so the read view, the settings form and the
 * connections sheet all speak about the same person in the same words. */

export type GalleryImage = {
   id: string;
   /* The original, and the two sizes the server signs beside it. A gallery
    * tile is a few hundred pixels square, so it reads the 900px copy. */
   url: string;
   cardUrl?: string | null;
   thumbUrl?: string | null;
   sourceType: 'CATCH' | 'SITE';
   sourceId: string;
   sourceTitle: string;
};

export type UserProfile = {
   id: string;
   displayName: string;
   username: string;
   bio: string | null;
   email: string;
   avatarUrl: string | null;
   /* The 160px copy, which is the only one an 80px circle should ever load. */
   avatarThumbUrl?: string | null;
   /* The wide photograph behind the name. */
   bannerUrl: string | null;
   bannerCardUrl?: string | null;
   followersCount: number;
   followingCount: number;
   galleryImages: GalleryImage[];
   createdAt: string;
   updatedAt: string;
};

export type ProfileResponse = {
   profile: UserProfile;
};

export type ConnectionUser = {
   id: string;
   /* Null for an angler who has not picked a handle yet. */
   username: string | null;
   displayName: string;
   avatarUrl: string | null;
   avatarThumbUrl?: string | null;
};

/** One row of the angler search: a person, how followed they are, and by you. */
export type AnglerResult = ConnectionUser & {
   followersCount: number;
   followedByMe: boolean;
};

/** What the angler's own log adds up to, counted from the catches endpoint. */
export type ProfileTallies = {
   catches: number;
   spots: number;
   bestLengthCm: number | null;
   bestCatchId: string | null;
   bestCatchTitle: string | null;
   /* The earliest fish in the log, which is what "fishing since" means. The
    * account's own createdAt is when they signed up, which on an angler who
    * wrote up an old season reads years out. */
   firstCaughtAt: string | null;
};

export const plural = (count: number, one: string, many = `${one}s`) =>
   `${count} ${count === 1 ? one : many}`;

/** Mar 2025, the month an angler started keeping the log. */
export const monthAndYear = (value: string | null | undefined) => {
   if (!value) {
      return null;
   }

   const date = new Date(value);

   if (Number.isNaN(date.getTime())) {
      return null;
   }

   return new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      year: 'numeric',
   }).format(date);
};

/** The first letter of a name, for the avatar when there is no photograph. */
/*
 * Two initials where there are two names. A lone O set in League Gothic, which
 * is a condensed face, is read as a zero rather than as a person: on the
 * profile it sat in a grey circle and looked like a counter showing nought.
 */
export const initialOf = (name: string) => {
   const words = name.trim().split(/\s+/).filter(Boolean);
   if (!words.length) {
      return '?';
   }

   const first = words[0]?.charAt(0) ?? '';
   const last =
      words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? '') : '';
   return (first + last).toUpperCase() || '?';
};
