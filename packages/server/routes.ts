import express from 'express';
import type { Request, Response } from 'express';
import { chatController } from './controllers/chat.controller';
import { fishingController } from './controllers/fishing.controller';
import { userController } from './controllers/user.controller';
import { getAuth } from '@clerk/express';
import { userService } from './services/user.service';

const router = express.Router();

async function requireApiAuth(
   req: Request,
   res: Response,
   next: express.NextFunction
) {
   const auth = getAuth(req);

   if (!auth.isAuthenticated || !auth.userId) {
      return res.status(401).json({
         code: 'unauthorized',
         message: 'Authentication required.',
      });
   }

   try {
      await userService.syncAuthenticatedUser(auth.userId);
   } catch (error) {
      console.warn(
         '[auth] Failed to sync user from Clerk to database. Continuing with authenticated request.',
         {
            userId: auth.userId,
            error,
         }
      );
   }

   return next();
}

router.get('/', (_req: Request, res: Response) => {
   res.send('Hello World!');
});

router.get('/api/hello', (_req: Request, res: Response) => {
   res.json({ message: 'Hello from the API!' });
});

router.post('/api/chat', requireApiAuth, chatController.sendMessage);

router.post(
   '/api/fishing/conditions',
   requireApiAuth,
   fishingController.getConditions
);

router.get('/api/users/me', requireApiAuth, userController.getCurrentProfile);
router.patch(
   '/api/users/me',
   requireApiAuth,
   userController.updateCurrentProfile
);

export default router;
