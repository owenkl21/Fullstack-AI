import type { Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import { Prisma } from '@prisma/client';
import { updateProfileSchema } from '../schemas/user.schema';
import { userService } from '../services/user.service';

export const userController = {
   getCurrentProfile: async (req: Request, res: Response) => {
      const auth = getAuth(req);

      if (!auth.userId) {
         return res.status(401).json({
            code: 'unauthorized',
            message: 'Authentication required.',
         });
      }

      const result = await userService.getProfileByClerkId(auth.userId);

      if (!result?.profile) {
         return res.status(404).json({
            code: 'profile_not_found',
            message: 'Profile not found for authenticated user.',
         });
      }

      return res.json({
         profile: result.profile,
         storage: result.storage,
      });
   },

   updateCurrentProfile: async (req: Request, res: Response) => {
      const auth = getAuth(req);

      if (!auth.userId) {
         return res.status(401).json({
            code: 'unauthorized',
            message: 'Authentication required.',
         });
      }

      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }

      try {
         const result = await userService.updateProfileByClerkId(
            auth.userId,
            parsed.data
         );

         return res.json({
            profile: result.profile,
            storage: result.storage,
         });
      } catch (error) {
         const prismaErrorCode =
            error instanceof Prisma.PrismaClientKnownRequestError
               ? error.code
               : typeof error === 'object' && error !== null && 'code' in error
                 ? String((error as { code?: unknown }).code)
                 : null;

         if (prismaErrorCode === 'P2002') {
            return res.status(409).json({
               code: 'username_already_exists',
               message: 'That username is already in use.',
            });
         }

         console.error('[user:updateCurrentProfile] failed to update profile', {
            clerkId: auth.userId,
            error,
         });

         return res.status(500).json({
            code: 'internal_server_error',
            message: 'Unexpected server error',
         });
      }
   },

   followUser: async (req: Request, res: Response) => {
      const auth = getAuth(req);

      if (!auth.userId) {
         return res.status(401).json({
            code: 'unauthorized',
            message: 'Authentication required.',
         });
      }

      const targetUserId = String(req.params.userId ?? '');
      if (!targetUserId) {
         return res.status(400).json({
            code: 'invalid_user_id',
            message: 'Target user id is required.',
         });
      }

      const result = await userService.followByClerkId(
         auth.userId,
         targetUserId
      );

      if (!result) {
         return res.status(404).json({
            code: 'profile_not_found',
            message: 'Target profile was not found.',
         });
      }

      if ('code' in result && result.code === 'cannot_follow_self') {
         return res.status(400).json({
            code: result.code,
            message: 'You cannot follow yourself.',
         });
      }

      return res.json(result);
   },

   listMyConnections: async (req: Request, res: Response) => {
      const auth = getAuth(req);

      if (!auth.userId) {
         return res.status(401).json({
            code: 'unauthorized',
            message: 'Authentication required.',
         });
      }

      const typeParam = String(req.query.type ?? 'followers');
      const type =
         typeParam === 'following'
            ? 'following'
            : typeParam === 'followers'
              ? 'followers'
              : null;

      if (!type) {
         return res.status(400).json({
            code: 'invalid_connection_type',
            message: 'Connection type must be followers or following.',
         });
      }

      const search = String(req.query.search ?? '').trim();
      const users = await userService.listConnectionsByClerkId(
         auth.userId,
         type,
         search
      );

      return res.json({ users });
   },

   unfollowUser: async (req: Request, res: Response) => {
      const auth = getAuth(req);

      if (!auth.userId) {
         return res.status(401).json({
            code: 'unauthorized',
            message: 'Authentication required.',
         });
      }

      const targetUserId = String(req.params.userId ?? '');
      if (!targetUserId) {
         return res.status(400).json({
            code: 'invalid_user_id',
            message: 'Target user id is required.',
         });
      }

      const result = await userService.unfollowByClerkId(
         auth.userId,
         targetUserId
      );

      if (!result) {
         return res.status(404).json({
            code: 'profile_not_found',
            message: 'Target profile was not found.',
         });
      }

      if ('code' in result && result.code === 'cannot_follow_self') {
         return res.status(400).json({
            code: result.code,
            message: 'You cannot unfollow yourself.',
         });
      }

      return res.json(result);
   },
};
