import type { Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import {
   directUploadQuerySchema,
   getReadUrlSchema,
   signUploadSchema,
} from '../schemas/uploads.schema';
import { uploadsService } from '../services/uploads.service';

const unauthorizedResponse = {
   code: 'unauthorized',
   message: 'Authentication required.',
};

export const uploadsController = {
   async signUpload(req: Request, res: Response) {
      const auth = getAuth(req);

      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const parsed = signUploadSchema.safeParse(req.body);

      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }

      try {
         const signed = await uploadsService.signUpload({
            clerkUserId: auth.userId,
            ...parsed.data,
         });

         return res.json(signed);
      } catch (error) {
         console.error('[uploads:signUpload] failed to sign upload URL', error);
         return res.status(500).json({
            code: 'failed_to_sign_upload',
            message: 'Unable to prepare upload URL.',
         });
      }
   },

   async getDirectUploadData(req: Request, res: Response) {
      const auth = getAuth(req);

      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const parsed = directUploadQuerySchema.safeParse(req.query);

      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }

      try {
         const directUpload = await uploadsService.getDirectUploadData({
            clerkUserId: auth.userId,
            ...parsed.data,
         });

         return res.json(directUpload);
      } catch (error) {
         console.error('[uploads:getDirectUploadData] failed', error);
         return res.status(500).json({
            code: 'failed_to_prepare_direct_upload',
            message: 'Unable to prepare direct upload target.',
         });
      }
   },

   async getReadUrl(req: Request, res: Response) {
      const parsed = getReadUrlSchema.safeParse(req.body);

      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }

      try {
         const signed = await uploadsService.getReadUrl(parsed.data.storageKey);
         return res.json(signed);
      } catch (error) {
         console.error('[uploads:getReadUrl] failed to sign read URL', error);
         return res.status(500).json({
            code: 'failed_to_sign_read_url',
            message: 'Unable to prepare image URL.',
         });
      }
   },
};
