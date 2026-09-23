import type { Request, Response } from 'express';
import { getAuth } from '../lib/auth-context';
import {
   createFeedCommentSchema,
   createFeedPostSchema,
   feedCommentIdSchema,
   listFeedSchema,
   updateFeedCommentSchema,
   updateFeedPostSchema,
} from '../schemas/feed.schema';
import { feedService } from '../services/feed.service';

const unauthorizedResponse = {
   code: 'unauthorized',
   message: 'Authentication required.',
};

const asSingleParam = (value: string | string[] | undefined) =>
   Array.isArray(value) ? value[0] : value;

export const feedController = {
   async listFeed(req: Request, res: Response) {
      const parseResult = listFeedSchema.safeParse(req.query);
      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }

      const auth = getAuth(req);
      const posts = await feedService.listFeed({
         userId: auth.userId ?? undefined,
         ...parseResult.data,
      });

      return res.json({
         posts,
         offset: parseResult.data.offset,
         limit: parseResult.data.limit,
         hasMore: posts.length === parseResult.data.limit,
         nextOffset: parseResult.data.offset + posts.length,
      });
   },

   async createFeedPost(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const parseResult = createFeedPostSchema.safeParse(req.body);
      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }

      const post = await feedService.createFeedPost(
         auth.userId,
         parseResult.data
      );
      return res.status(201).json({ post });
   },

   async updateFeedPost(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const postId = asSingleParam(req.params.postId);
      if (!postId) {
         return res.status(400).json({ code: 'missing_post_id' });
      }

      const parseResult = updateFeedPostSchema.safeParse(req.body);
      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }

      const post = await feedService.updateFeedPost(
         auth.userId,
         postId,
         parseResult.data
      );
      if (!post) {
         return res.status(404).json({ code: 'feed_post_not_found' });
      }

      return res.json({ post });
   },

   async deleteFeedPost(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const postId = asSingleParam(req.params.postId);
      if (!postId) {
         return res.status(400).json({ code: 'missing_post_id' });
      }

      const deleted = await feedService.deleteFeedPost(auth.userId, postId);
      if (!deleted) {
         return res.status(404).json({ code: 'feed_post_not_found' });
      }

      return res.status(204).send();
   },

   async toggleLike(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const postId = asSingleParam(req.params.postId);
      if (!postId) {
         return res.status(400).json({ code: 'missing_post_id' });
      }

      const result = await feedService.toggleLike(auth.userId, postId);
      if (!result) {
         return res.status(404).json({ code: 'feed_post_not_found' });
      }

      return res.json(result);
   },

   /* Open to anyone. A signed-in reader gets their own likes back with it. */
   async listComments(req: Request, res: Response) {
      const postId = asSingleParam(req.params.postId);
      if (!postId) {
         return res.status(400).json({ code: 'missing_post_id' });
      }

      const auth = getAuth(req);
      const comments = await feedService.listComments(
         postId,
         auth.userId ?? undefined
      );
      if (!comments) {
         return res.status(404).json({ code: 'feed_post_not_found' });
      }

      return res.json({ comments });
   },

   async createComment(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const postId = asSingleParam(req.params.postId);
      if (!postId) {
         return res.status(400).json({ code: 'missing_post_id' });
      }

      const parseResult = createFeedCommentSchema.safeParse(req.body);
      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }

      const result = await feedService.createComment(
         auth.userId,
         postId,
         parseResult.data.body,
         parseResult.data.parentId
      );
      if ('error' in result) {
         /*
          * A comment that was removed while the reply was being written is
          * the one a reader can actually meet, so it has its own code and the
          * thread can say so instead of "try again".
          */
         if (result.error === 'parent_not_found') {
            return res.status(404).json({ code: 'feed_comment_not_found' });
         }
         if (result.error === 'parent_not_in_post') {
            return res.status(400).json({ code: 'parent_not_in_post' });
         }
         return res.status(404).json({ code: 'feed_post_not_found' });
      }

      return res.status(201).json({ comment: result.comment });
   },

   async updateComment(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const commentId = feedCommentIdSchema.safeParse(
         asSingleParam(req.params.commentId)
      );
      if (!commentId.success) {
         return res.status(400).json({ code: 'missing_comment_id' });
      }

      const parseResult = updateFeedCommentSchema.safeParse(req.body);
      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }

      const comment = await feedService.updateComment(
         auth.userId,
         commentId.data,
         parseResult.data.body
      );
      if (!comment) {
         return res.status(404).json({ code: 'feed_comment_not_found' });
      }

      return res.json({ comment });
   },

   /*
    * Answers with what went rather than with an empty 204: a removal can take
    * replies with it, and the card needs the post's new figure and the ids to
    * drop without reading the thread again.
    */
   async deleteComment(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const commentId = feedCommentIdSchema.safeParse(
         asSingleParam(req.params.commentId)
      );
      if (!commentId.success) {
         return res.status(400).json({ code: 'missing_comment_id' });
      }

      const deleted = await feedService.deleteComment(
         auth.userId,
         commentId.data
      );
      if (!deleted) {
         return res.status(404).json({ code: 'feed_comment_not_found' });
      }

      return res.json(deleted);
   },

   async toggleCommentLike(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const commentId = feedCommentIdSchema.safeParse(
         asSingleParam(req.params.commentId)
      );
      if (!commentId.success) {
         return res.status(400).json({ code: 'missing_comment_id' });
      }

      const result = await feedService.toggleCommentLike(
         auth.userId,
         commentId.data
      );
      if (!result) {
         return res.status(404).json({ code: 'feed_comment_not_found' });
      }

      return res.json(result);
   },
};
