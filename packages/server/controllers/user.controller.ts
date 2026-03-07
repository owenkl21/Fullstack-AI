import type { Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import { Prisma } from '../generated/prisma/client';
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

      const profile = await userService.getProfileByClerkId(auth.userId);

      if (!profile) {
         return res.status(404).json({
            code: 'profile_not_found',
            message: 'Profile not found for authenticated user.',
         });
      }

      return res.json({ profile });
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
         const profile = await userService.updateProfileByClerkId(
            auth.userId,
            parsed.data
         );

         return res.json({ profile });
      } catch (error) {
         if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
         ) {
            return res.status(409).json({
               code: 'username_already_exists',
               message: 'That username is already in use.',
            });
         }

         throw error;
      }
   },
};
