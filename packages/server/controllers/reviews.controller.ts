import type { Request, Response } from 'express';
import { getAuth } from '../lib/auth-context';
import { listReviewsSchema, writeReviewSchema } from '../schemas/review.schema';
import { reviewsService } from '../services/reviews.service';

const unauthorizedResponse = {
   code: 'unauthorized',
   message: 'Authentication required.',
};

const asSingleParam = (value: string | string[] | undefined) =>
   Array.isArray(value) ? value[0] : value;

export const reviewsController = {
   /*
    * Public, but the answer depends on who is asking: your own rating comes
    * back as `yours` rather than as one of the others, and the owner of a
    * private spot can read its ratings. The route carries attachApiAuth for
    * exactly that reason, and without it every viewer flag here is false.
    */
   async list(req: Request, res: Response) {
      const siteId = asSingleParam(req.params.siteId);
      if (!siteId) {
         return res.status(400).json({ code: 'missing_site_id' });
      }

      const parseResult = listReviewsSchema.safeParse(req.query);
      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }

      const auth = getAuth(req);
      const result = await reviewsService.listForSite({
         siteId,
         viewerId: auth.userId,
         ...parseResult.data,
      });

      if (!result) {
         return res.status(404).json({ code: 'site_not_found' });
      }

      return res.json(result);
   },

   async leave(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const siteId = asSingleParam(req.params.siteId);
      if (!siteId) {
         return res.status(400).json({ code: 'missing_site_id' });
      }

      const parseResult = writeReviewSchema.safeParse(req.body);
      if (!parseResult.success) {
         return res.status(400).json(parseResult.error.format());
      }

      const result = await reviewsService.leave({
         siteId,
         userId: auth.userId,
         rating: parseResult.data.rating,
         body: parseResult.data.body,
      });

      if (result === 'site_not_found') {
         return res.status(404).json({ code: 'site_not_found' });
      }

      if (result === 'own_site') {
         return res.status(403).json({
            code: 'own_site',
            message: 'You cannot rate your own spot.',
         });
      }

      return res.json(result);
   },

   async remove(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const siteId = asSingleParam(req.params.siteId);
      if (!siteId) {
         return res.status(400).json({ code: 'missing_site_id' });
      }

      const result = await reviewsService.remove({
         siteId,
         userId: auth.userId,
      });

      if (!result) {
         return res.status(404).json({ code: 'review_not_found' });
      }

      /*
       * The summary rather than a 204. Taking a rating down changes the
       * average and the count on the page it was taken down from, and a body
       * here saves the page reading the whole list back to learn that.
       */
      return res.json(result);
   },
};
