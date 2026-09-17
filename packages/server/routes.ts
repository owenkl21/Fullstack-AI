import express from 'express';
import type { Request, Response } from 'express';
import { chatController } from './controllers/chat.controller';
import { groupsController } from './controllers/groups.controller';
import { statsController } from './controllers/stats.controller';
import { fishingController } from './controllers/fishing.controller';
import { userController } from './controllers/user.controller';
import { uploadsController } from './controllers/uploads.controller';
import { competitionsController } from './controllers/competitions.controller';
import { gearController } from './controllers/gear.controller';
import { feedController } from './controllers/feed.controller';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './lib/auth';
import { setAuthContext } from './lib/auth-context';
import { userService } from './services/user.service';

const router = express.Router();

/*
 * The session lives in our own MySQL, so this is a local read rather than the
 * round trip to Clerk every authenticated request used to make. It also drops
 * the upsert that ran on every request, and the swallowed error around it.
 */
async function requireApiAuth(
   req: Request,
   res: Response,
   next: express.NextFunction
) {
   const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
   });

   if (!session?.user) {
      return res.status(401).json({
         code: 'unauthorized',
         message: 'Authentication required.',
      });
   }

   setAuthContext(req, session.user);

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

/* A reference table, not anyone's data, so no sign-in needed to name a fish. */
router.get('/api/species', fishingController.searchSpecies);

/* The social layer. Boards are public; your own numbers are not. */
router.get('/api/stats/me', requireApiAuth, statsController.myStats);
router.get('/api/stats/rivals', requireApiAuth, statsController.rivals);
router.get('/api/competitions/species', statsController.speciesBoards);

/* Competitions anglers run themselves. The species board above is a different
 * thing that happens to share the word, so it is registered first. */
router.get('/api/competitions', requireApiAuth, competitionsController.list);
router.post('/api/competitions', requireApiAuth, competitionsController.create);
router.get(
   '/api/competitions/:competitionId/standings',
   requireApiAuth,
   competitionsController.standings
);
router.post(
   '/api/competitions/:competitionId/join',
   requireApiAuth,
   competitionsController.join
);
router.delete(
   '/api/competitions/:competitionId/join',
   requireApiAuth,
   competitionsController.leave
);

/* Groups. Every one of these needs a session; a group board is not public. */
router.get('/api/groups/me', requireApiAuth, groupsController.listMine);
router.post('/api/groups', requireApiAuth, groupsController.create);
router.post('/api/groups/join', requireApiAuth, groupsController.join);
router.get(
   '/api/groups/:groupId/boards',
   requireApiAuth,
   groupsController.boards
);

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
/* Must sit after /me, or "me" would be read as a user id. */
router.get(
   '/api/users/:userId',
   requireApiAuth,
   userController.getPublicProfile
);
router.patch(
   '/api/users/me',
   requireApiAuth,
   userController.updateCurrentProfile
);
router.get(
   '/api/users/me/connections',
   requireApiAuth,
   userController.listMyConnections
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
