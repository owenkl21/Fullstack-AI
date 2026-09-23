import type { FeedComment, FeedPost } from '@/components/feed/types';

/*
 * What a thread does to the post that holds it, as plain functions of the
 * post. The card keeps three figures that have to agree with the list at all
 * times: `commentCount` beside the bubble (comments and replies together),
 * `threadCount` (top-level comments only) and each comment's `replyCount`.
 * Every change to the list goes through here so none of them is ever patched
 * by hand in a click handler and left behind.
 */

type Threaded = Pick<FeedPost, 'comments' | 'commentCount' | 'threadCount'>;

/** The most rows the server returns for one thread read. */
const THREAD_READ_CAP = 1000;

/** A row the server has not answered for yet. It cannot be acted on. */
export const isPending = (comment: FeedComment) =>
   comment.id.startsWith('pending-');

const topLevelTotal = (post: Threaded) =>
   Math.max(post.threadCount ?? 0, post.comments.length);

/** Rows in hand: every comment and every reply the client holds. */
const rowsIn = (comments: FeedComment[]) =>
   comments.reduce((n, entry) => n + 1 + (entry.replies?.length ?? 0), 0);

export function addComment<T extends Threaded>(
   post: T,
   comment: FeedComment
): T {
   return {
      ...post,
      comments: [...post.comments, { replies: [], replyCount: 0, ...comment }],
      commentCount: post.commentCount + 1,
      threadCount: topLevelTotal(post) + 1,
   };
}

/** Under `parentId`, which is always a top-level comment. */
export function addReply<T extends Threaded>(
   post: T,
   parentId: string,
   reply: FeedComment
): T {
   let landed = false;
   const comments = post.comments.map((entry) => {
      if (entry.id !== parentId) return entry;
      landed = true;
      const replies = [...(entry.replies ?? []), reply];
      return {
         ...entry,
         replies,
         replyCount: Math.max(entry.replyCount ?? 0, replies.length - 1) + 1,
      };
   });
   if (!landed) return post;
   return { ...post, comments, commentCount: post.commentCount + 1 };
}

/*
 * Change one row wherever it sits. The update is handed the row as it stands,
 * so a comment that comes back from the server without its replies can keep
 * the ones the client holds.
 */
export function patchComment<T extends Threaded>(
   post: T,
   commentId: string,
   update: (comment: FeedComment) => FeedComment
): T {
   return {
      ...post,
      comments: post.comments.map((entry) => {
         if (entry.id === commentId) return update(entry);
         if (!entry.replies?.some((reply) => reply.id === commentId)) {
            return entry;
         }
         return {
            ...entry,
            replies: entry.replies.map((reply) =>
               reply.id === commentId ? update(reply) : reply
            ),
         };
      }),
   };
}

/*
 * The server has answered for a row written here, and the saved row takes its
 * stand-in's place. A read of the whole thread that landed while the send was
 * on its way may already hold the saved row; then the stand-in simply goes,
 * so the comment is never on the card twice.
 */
export function settleComment<T extends Threaded>(
   post: T,
   pendingId: string,
   saved: FeedComment
): T {
   if (locate(post.comments, saved.id)) {
      return dropComments(post, [pendingId]);
   }
   return patchComment(post, pendingId, () => saved);
}

/*
 * Take rows out. A top-level comment takes its replies with it, as the server
 * does. `commentCount` is the server's figure when it sent one; without it
 * (a reply that never sent) the count drops by the rows that actually left.
 */
export function dropComments<T extends Threaded>(
   post: T,
   ids: string[],
   commentCount?: number
): T {
   const gone = new Set(ids);
   let rows = 0;
   let topLevel = 0;
   const comments: FeedComment[] = [];

   for (const entry of post.comments) {
      if (gone.has(entry.id)) {
         rows +=
            1 + Math.max(entry.replyCount ?? 0, entry.replies?.length ?? 0);
         topLevel += 1;
         continue;
      }
      const replies = (entry.replies ?? []).filter(
         (reply) => !gone.has(reply.id)
      );
      const lost = (entry.replies?.length ?? 0) - replies.length;
      rows += lost;
      comments.push(
         lost > 0
            ? {
                 ...entry,
                 replies,
                 replyCount: Math.max(
                    (entry.replyCount ?? 0) - lost,
                    replies.length
                 ),
              }
            : entry
      );
   }

   if (rows === 0) return post;
   return {
      ...post,
      comments,
      commentCount: Math.max(
         0,
         typeof commentCount === 'number'
            ? commentCount
            : post.commentCount - rows
      ),
      threadCount: Math.max(comments.length, topLevelTotal(post) - topLevel),
   };
}

/*
 * The whole thread has been read. It replaces what the card held, except for
 * rows still on their way to the server, which the read cannot know about and
 * which would otherwise vanish for a moment and come back.
 */
export function mergeThread<T extends Threaded>(
   post: T,
   all: FeedComment[]
): T {
   const pendingReplies = new Map<string, FeedComment[]>();
   for (const entry of post.comments) {
      const waiting = (entry.replies ?? []).filter(isPending);
      if (waiting.length) pendingReplies.set(entry.id, waiting);
   }

   const comments = [
      ...all.map((entry) => {
         const replies = [
            ...(entry.replies ?? []),
            ...(pendingReplies.get(entry.id) ?? []),
         ];
         return {
            ...entry,
            replies,
            replyCount: Math.max(entry.replyCount ?? 0, replies.length),
         };
      }),
      ...post.comments.filter(isPending),
   ];

   /*
    * Everything is in hand now, so the figures are counted, not carried. The
    * one exception is a thread so long the server cut the read short, where
    * the figure on the card is still the better of the two.
    */
   const rows = rowsIn(comments);
   const whole = rowsIn(all) < THREAD_READ_CAP;
   return {
      ...post,
      comments,
      commentCount: whole ? rows : Math.max(post.commentCount, rows),
      threadCount: whole
         ? comments.length
         : Math.max(topLevelTotal(post), comments.length),
   };
}

/** Where a comment sits: its top-level comment, and whether it is a reply. */
export function locate(comments: FeedComment[], commentId: string) {
   for (const entry of comments) {
      if (entry.id === commentId) return { top: entry, isReply: false };
      if (entry.replies?.some((reply) => reply.id === commentId)) {
         return { top: entry, isReply: true };
      }
   }
   return null;
}
