/*
 * The shape the feed route returns today, plus the fields the post would read if
 * the API carried them. Everything optional here is absent from the current
 * payload and the block simply leaves that line out until it arrives.
 */

export type FeedScope = 'GLOBAL' | 'NEARBY';
export type FeedType = 'CATCH' | 'SITE';

export type FeedImage = {
   image: {
      id: string;
      url: string;
      focusX?: number | null;
      focusY?: number | null;
   };
};

export type FeedComment = {
   id: string;
   body: string;
   createdAt?: string | null;
   user: { id?: string; displayName: string; username: string };
};

export type FeedAuthor = {
   id: string;
   displayName: string;
   username: string;
   avatarUrl?: string | null;
};

export type FeedPost = {
   id: string;
   type: FeedType;
   scope: FeedScope;
   content: string | null;
   createdAt?: string | null;
   likeCount: number;
   commentCount: number;
   likedByMe: boolean;
   savedByMe?: boolean;
   latitude?: number | null;
   longitude?: number | null;
   catch: {
      id: string;
      title: string;
      images: FeedImage[];
      /* The species and both measurements now come down with the post. B5 of
         appendix E (both units on the record) is still open, so the source of a
         weight is reported rather than converted. */
      species?: string | null;
      lengthCm?: number | null;
      weightKg?: number | null;
      lengthSource?: string | null;
      weightSource?: string | null;
      /* TODO(api): appendix E A2.1 (a catch has no location of its own). Without
         it a catch post has no spot name and no position, so `Near me` can never
         return one. */
      site?: { id: string; name: string } | null;
   } | null;
   site: {
      id: string;
      name: string;
      images: FeedImage[];
      /* TODO(api): the feed select omits waterType, so a spot post cannot say
         what kind of water it is. */
      waterType?: string | null;
   } | null;
   author: FeedAuthor;
   authorFollowedByMe?: boolean;
   authorIsMe?: boolean;
   comments: FeedComment[];
};

/** A post with the distance worked out, when we know where the reader is. */
export type FeedPostInView = FeedPost & { distanceKm: number | null };

export type ScopeFilter = 'everywhere' | 'near-me';
export type ShowFilter = 'all' | 'catches' | 'spots';
