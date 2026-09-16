/* The shape of an angler as the profile endpoint sends it, plus the small helpers
 * the profile screens share. Kept here so the read view, the settings form and the
 * connections sheet all speak about the same person in the same words. */

export type GalleryImage = {
   id: string;
   url: string;
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
   followersCount: number;
   followingCount: number;
   galleryImages: GalleryImage[];
   createdAt: string;
   updatedAt: string;
};

export type ProfileResponse = {
   profile: UserProfile;
   storage?: 'database' | 'clerk_fallback';
};

export type ConnectionUser = {
   id: string;
   username: string;
   displayName: string;
   avatarUrl: string | null;
};

/** What the angler's own log adds up to, counted from the catches endpoint. */
export type ProfileTallies = {
   catches: number;
   spots: number;
   bestLengthCm: number | null;
   bestCatchId: string | null;
   bestCatchTitle: string | null;
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
export const initialOf = (name: string) =>
   name.trim().charAt(0).toUpperCase() || '?';
