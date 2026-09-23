import type { CatchBadge } from '@/components/badges/badges-api';

/*
 * The shape the feed route returns today, plus the fields the post would read if
 * the API carried them. Everything optional here is absent from the current
 * payload and the block simply leaves that line out until it arrives.
 */

export type FeedScope = 'GLOBAL' | 'NEARBY';
/*
 * A post is a catch. Spots used to post themselves as well, which put the same
 * mark in front of the reader twice: once when it was added and again under
 * every fish taken there. The rows written before that rule are still in the
 * table and the feed route no longer returns them.
 */
export type FeedType = 'CATCH';

export type FeedImage = {
   image: {
      id: string;
      /* The original, and the two sizes the server makes beside it. A card is
       * at most 960px wide, so it reads `cardUrl` and the original is only
       * ever fetched by the record the card points at. */
      url: string;
      cardUrl?: string | null;
      thumbUrl?: string | null;
      /* How the angler framed it (lib/framing.ts); all null when they never did. */
      focusX?: number | null;
      focusY?: number | null;
      zoom?: number | null;
   };
};

/*
 * A comment, or a reply to one. The thread is one level deep: a top-level
 * comment (`parentId` null) carries the replies the client holds and how many
 * there are in all, and a reply carries neither. A handle is optional, because
 * an account exists before its angler has picked one.
 */
export type FeedComment = {
   id: string;
   parentId?: string | null;
   body: string;
   createdAt?: string | null;
   /* Set when the author changed the words, and by nothing else. */
   editedAt?: string | null;
   likeCount?: number;
   likedByMe?: boolean;
   /* verified is the app's own tick, from the server's column alone. */
   user: {
      id?: string;
      displayName: string;
      username?: string | null;
      verified?: boolean;
      /* On the Fisherfeed team: the badge beside the name. */
      team?: boolean;
   };
   replies?: FeedComment[];
   replyCount?: number;
};

export type FeedAuthor = {
   id: string;
   displayName: string;
   username: string;
   avatarUrl?: string | null;
   avatarCardUrl?: string | null;
   /* The one an avatar is allowed to load. Forty pixels of photograph never
    * justifies a camera original, and the feed draws twenty five of them. */
   avatarThumbUrl?: string | null;
   /* The app's own account. One in the whole product carries it. */
   verified?: boolean;
   /* On the Fisherfeed team: the badge beside the name. */
   team?: boolean;
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
      /* What the Fisherfeed team has called this fish. On the catch and not on
         the post: the same badges show on the record and in a row. */
      badges?: CatchBadge[];
      site?: { id: string; name: string } | null;
   } | null;
   /* The spot the fish was taken at, as the post recorded it. An angler who
      asked to keep the mark to themselves has none here: the catch still holds
      the position, the post does not. */
   site: { id: string; name: string } | null;
   author: FeedAuthor;
   authorFollowedByMe?: boolean;
   authorIsMe?: boolean;
   comments: FeedComment[];
   /*
    * How many top-level comments the post has. `commentCount` is the figure
    * beside the bubble and counts replies as well, so it cannot say how many
    * comments the thread has not shown yet. This one can.
    */
   threadCount?: number;
};

/** A post with the distance worked out, when we know where the reader is. */
export type FeedPostInView = FeedPost & { distanceKm: number | null };

export type ScopeFilter = 'everywhere' | 'near-me';
