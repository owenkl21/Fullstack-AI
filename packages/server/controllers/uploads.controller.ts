import type { Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import {
   directUploadQuerySchema,
   getReadUrlSchema,
   proxyUploadQuerySchema,
   signUploadSchema,
} from '../schemas/uploads.schema';
import { uploadsService } from '../services/uploads.service';

const unauthorizedResponse = {
   code: 'unauthorized',
   message: 'Authentication required.',
};

const uploadHeadersByContentType = {
   'image/jpeg': 'image/jpeg',
   'image/png': 'image/png',
   'image/webp': 'image/webp',
} as const;

const isNoSuchBucketError = (error: unknown) => {
   if (typeof error !== 'object' || error === null) {
      return false;
   }

   const maybeError = error as { name?: string; Code?: string; code?: string };
   return (
      maybeError.name === 'NoSuchBucket' ||
      maybeError.Code === 'NoSuchBucket' ||
      maybeError.code === 'NoSuchBucket'
   );
};

const resolveBucketName = () =>
   process.env.CLOUDFLARE_R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET_NAME;

const bucketNotFoundResponse = {
   code: 'r2_bucket_not_found',
   message: `Upload bucket \"${resolveBucketName() || '(not set)'}\" was not found. Verify CLOUDFLARE_R2_BUCKET (or CLOUDFLARE_R2_BUCKET_NAME).`,
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
         if (isNoSuchBucketError(error)) {
            console.warn('[uploads:signUpload] bucket not found', {
               bucket: resolveBucketName() || null,
            });
            return res.status(500).json(bucketNotFoundResponse);
         }

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
         if (isNoSuchBucketError(error)) {
            console.warn('[uploads:getDirectUploadData] bucket not found', {
               bucket: resolveBucketName() || null,
            });
            return res.status(500).json(bucketNotFoundResponse);
         }

         console.error('[uploads:getDirectUploadData] failed', error);
         return res.status(500).json({
            code: 'failed_to_prepare_direct_upload',
            message: 'Unable to prepare direct upload target.',
         });
      }
   },

   async proxyUpload(req: Request, res: Response) {
      const auth = getAuth(req);

      if (!auth.userId) {
         return res.status(401).json(unauthorizedResponse);
      }

      const query = proxyUploadQuerySchema.safeParse(req.query);

      if (!query.success) {
         return res.status(400).json(query.error.format());
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
         return res.status(400).json({
            code: 'invalid_upload_payload',
            message: 'Expected a binary image payload.',
         });
      }

      try {
         const proxiedUpload = await uploadsService.proxyUpload({
            clerkUserId: auth.userId,
            scope: uploadsService.inferScopeFromStorageKey(
               auth.userId,
               query.data.storageKey
            ),
            storageKey: query.data.storageKey,
            contentType: uploadHeadersByContentType[query.data.contentType],
            body: req.body,
         });

         return res.json(proxiedUpload);
      } catch (error) {
         if (isNoSuchBucketError(error)) {
            console.warn('[uploads:proxyUpload] bucket not found', {
               bucket: resolveBucketName() || null,
            });
            return res.status(500).json(bucketNotFoundResponse);
         }

         console.error('[uploads:proxyUpload] failed to proxy upload', error);

         return res.status(500).json({
            code: 'failed_to_proxy_upload',
            message: 'Unable to upload image.',
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
         if (isNoSuchBucketError(error)) {
            console.warn('[uploads:getReadUrl] bucket not found', {
               bucket: resolveBucketName() || null,
            });
            return res.status(500).json(bucketNotFoundResponse);
         }

         console.error('[uploads:getReadUrl] failed to sign read URL', error);
         return res.status(500).json({
            code: 'failed_to_sign_read_url',
            message: 'Unable to prepare image URL.',
         });
      }
   },
};
