import express from 'express';
import type { Request, Response } from 'express';
import { chatController } from './controllers/chat.controller';
import { fishingController } from './controllers/fishing.controller';
import { userController } from './controllers/user.controller';
import { uploadsController } from './controllers/uploads.controller';
import { gearController } from './controllers/gear.controller';
import { feedController } from './controllers/feed.controller';
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

router.get(
   '/api/weather/current',
   requireApiAuth,
   fishingController.getCurrentWeatherByCoordinates
);

router.post('/api/catches', requireApiAuth, fishingController.createCatch);

router.get('/api/catches/me', requireApiAuth, fishingController.listMyCatches);
router.put(
   '/api/catches/:catchId',
   requireApiAuth,
   fishingController.updateCatch
);
router.delete(
   '/api/catches/:catchId',
   requireApiAuth,
   fishingController.deleteCatch
);
router.post('/api/uploads/sign', requireApiAuth, uploadsController.signUpload);
router.put('/api/uploads/proxy', requireApiAuth, uploadsController.proxyUpload);
router.post('/api/uploads/read-url', uploadsController.getReadUrl);
router.get(
   '/api/uploads/direct',
   requireApiAuth,
   uploadsController.getDirectUploadData
);
router.get('/api/catches/:catchId', fishingController.getCatchById);
router.get('/api/sites', fishingController.listFishingSites);

router.get(
   '/api/sites/me',
   requireApiAuth,
   fishingController.listMyFishingSites
);
router.put(
   '/api/sites/:siteId',
   requireApiAuth,
   fishingController.updateFishingSite
);
router.delete(
   '/api/sites/:siteId',
   requireApiAuth,
   fishingController.deleteFishingSite
);
router.post('/api/sites', requireApiAuth, fishingController.createFishingSite);
router.get('/api/sites/:siteId', fishingController.getFishingSiteById);

router.get('/api/feed', feedController.listFeed);
router.post('/api/feed', requireApiAuth, feedController.createFeedPost);
router.put('/api/feed/:postId', requireApiAuth, feedController.updateFeedPost);
router.delete(
   '/api/feed/:postId',
   requireApiAuth,
   feedController.deleteFeedPost
);
router.post(
   '/api/feed/:postId/likes',
   requireApiAuth,
   feedController.toggleLike
);
router.get('/api/feed/:postId/comments', feedController.listComments);
router.post(
   '/api/feed/:postId/comments',
   requireApiAuth,
   feedController.createComment
);
router.delete(
   '/api/feed/comments/:commentId',
   requireApiAuth,
   feedController.deleteComment
);

router.post('/api/gear', requireApiAuth, gearController.createGear);
router.get('/api/gear', requireApiAuth, gearController.listGear);
router.get('/api/gear/me', requireApiAuth, gearController.listMyGear);
router.put('/api/gear/:gearId', requireApiAuth, gearController.updateGear);
router.delete('/api/gear/:gearId', requireApiAuth, gearController.deleteGear);

router.get('/api/users/me', requireApiAuth, userController.getCurrentProfile);
router.patch(
   '/api/users/me',
   requireApiAuth,
   userController.updateCurrentProfile
);
router.post(
   '/api/users/:userId/follow',
   requireApiAuth,
   userController.followUser
);
router.delete(
   '/api/users/:userId/follow',
   requireApiAuth,
   userController.unfollowUser
);

export default router;
