import type { Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import {
   createFeedCommentSchema,
   createFeedPostSchema,
   listFeedSchema,
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
      return res.json({ posts });
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

   async listComments(req: Request, res: Response) {
      const postId = asSingleParam(req.params.postId);
      if (!postId) {
         return res.status(400).json({ code: 'missing_post_id' });
      }

      const comments = await feedService.listComments(postId);
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

      const comment = await feedService.createComment(
         auth.userId,
         postId,
         parseResult.data.body
      );
      if (!comment) {
         return res.status(404).json({ code: 'feed_post_not_found' });
      }

      return res.status(201).json({ comment });
   },

   async deleteComment(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const commentId = asSingleParam(req.params.commentId);
      if (!commentId) {
         return res.status(400).json({ code: 'missing_comment_id' });
      }

      const deleted = await feedService.deleteComment(auth.userId, commentId);
      if (!deleted) {
         return res.status(404).json({ code: 'feed_comment_not_found' });
      }

      return res.status(204).send();
   },
};
