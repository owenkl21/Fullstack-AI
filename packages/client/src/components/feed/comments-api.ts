import axios from 'axios';

import type { FeedComment } from '@/components/feed/types';

/*
 * The comment routes, one function each, so the thread never builds a URL.
 * Reading is open to anyone; everything else answers 401 to a reader who is
 * not signed in, and the thread never offers those to one.
 */

/** The same bound the server holds a comment, a reply and an edit to. */
export const COMMENT_LIMIT = 1000;

/** Every top-level comment, oldest first, each with all of its replies. */
export async function readThread(postId: string) {
   const { data } = await axios.get<{ comments: FeedComment[] }>(
      `/api/feed/${postId}/comments`
   );
   return data.comments ?? [];
}

/*
 * `parentId` is the comment being answered, and it may itself be a reply: the
 * server walks up to the top-level comment, so what comes back says where the
 * reply really hangs.
 */
export async function postComment(
   postId: string,
   body: string,
   parentId?: string | null
) {
   const { data } = await axios.post<{ comment: FeedComment }>(
      `/api/feed/${postId}/comments`,
      parentId ? { body, parentId } : { body }
   );
   return data.comment;
}

export async function saveComment(commentId: string, body: string) {
   const { data } = await axios.put<{ comment: FeedComment }>(
      `/api/feed/comments/${commentId}`,
      { body }
   );
   return data.comment;
}

/*
 * A removal takes the replies with it, so the answer names every row that
 * went and the post's figure afterwards rather than leaving the card to guess.
 */
export async function removeComment(commentId: string) {
   const { data } = await axios.delete<{
      removedIds: string[];
      removed: number;
      commentCount: number;
   }>(`/api/feed/comments/${commentId}`);
   return data;
}

/** A toggle. It answers with the state and the figure the table now holds. */
export async function toggleCommentLike(commentId: string) {
   const { data } = await axios.post<{ liked: boolean; likeCount: number }>(
      `/api/feed/comments/${commentId}/likes`
   );
   return data;
}
