import type { Request, Response } from 'express';
import { getAuth } from '../lib/auth-context';
import { updateProfileSchema } from '../schemas/user.schema';
import { userService } from '../services/user.service';

/* Express can hand back a repeated query or route value as an array. */
const asSingleParam = (value: string | string[] | undefined) =>
   Array.isArray(value) ? value[0] : value;

export const userController = {
   /*
    * Another angler's profile. Behind auth, because the whole app is, but the
    * shape it returns is the public one: no email, and only records the owner
    * marked PUBLIC.
    */
   getPublicProfile: async (req: Request, res: Response) => {
      const auth = getAuth(req);
      const userId = asSingleParam(req.params.userId);

      if (!userId) {
         return res.status(400).json({
            code: 'user_id_required',
            message: 'A user id is required.',
         });
      }

      /* Your own id here is your own profile, so send them to the owner view
       * rather than showing someone a stripped copy of themselves. */
      if (auth.userId === userId) {
         const own = await userService.getProfile(userId);
         return own?.profile
            ? res.json({ profile: { ...own.profile, isYou: true } })
            : res.status(404).json({
                 code: 'profile_not_found',
                 message: 'That angler could not be found.',
              });
      }

      const result = await userService.getPublicProfile(
         userId,
         auth.userId ?? null
      );

      if (!result?.profile) {
         return res.status(404).json({
            code: 'profile_not_found',
            message: 'That angler could not be found.',
         });
      }

      return res.json({ profile: result.profile });
   },

   getCurrentProfile: async (req: Request, res: Response) => {
      const auth = getAuth(req);

      if (!auth.userId) {
         return res.status(401).json({
            code: 'unauthorized',
            message: 'Authentication required.',
         });
      }

      const result = await userService.getProfile(auth.userId);

      if (!result?.profile) {
         return res.status(404).json({
            code: 'profile_not_found',
            message: 'Profile not found for authenticated user.',
         });
      }

      return res.json({
         profile: result.profile,
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
         const result = await userService.updateProfile(
            auth.userId,
            parsed.data
         );

         /* The race on the unique index lands here too: the service turns
          * the duplicate key into the same answer as a handle seen taken. */
         if ('code' in result) {
            return result.code === 'username_taken'
               ? res.status(409).json({
                    code: 'username_already_exists',
                    message: 'That username is already in use.',
                 })
               : res.status(400).json({
                    code: 'username_reserved',
                    message: 'That username is reserved.',
                 });
         }

         return res.json({
            profile: result.profile,
         });
      } catch (error) {
         console.error('[user:updateCurrentProfile] failed to update profile', {
            userId: auth.userId,
            error,
         });

         return res.status(500).json({
            code: 'internal_server_error',
            message: 'Unexpected server error',
         });
      }
   },

   /*
    * Whether a handle is free, asked while it is being typed. Answers what
    * the handle becomes once normalised, so the page can show @owen for
    * "@Owen" and the reader is never surprised by what gets saved.
    */
   checkHandle: async (req: Request, res: Response) => {
      const auth = getAuth(req);

      if (!auth.userId) {
         return res.status(401).json({
            code: 'unauthorized',
            message: 'Authentication required.',
         });
      }

      /* Cut well past the longest handle there can be: what is left is still
       * refused as too long, and the answer never echoes a whole query string
       * back. */
      const raw =
         typeof req.query.handle === 'string'
            ? req.query.handle.trim().slice(0, 64)
            : '';
      const check = await userService.checkHandle(raw, auth.userId);

      return res.json(
         check.available
            ? { available: true, normalised: check.handle }
            : {
                 available: false,
                 reason: check.reason,
                 normalised: check.handle,
              }
      );
   },

   /*
    * Other anglers by name or handle. Behind auth like the profiles it links
    * to, and the answer depends on who asks: the reader is left out, and each
    * row says whether the reader already follows that angler.
    */
   searchAnglers: async (req: Request, res: Response) => {
      const auth = getAuth(req);

      if (!auth.userId) {
         return res.status(401).json({
            code: 'unauthorized',
            message: 'Authentication required.',
         });
      }

      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const cursor =
         typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

      const result = await userService.searchAnglers(auth.userId, q, cursor);

      return res.json(result);
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

      const result = await userService.follow(auth.userId, targetUserId);

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
      const users = await userService.listConnections(
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

      const result = await userService.unfollow(auth.userId, targetUserId);

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
