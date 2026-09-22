import express from 'express';
import type { Request, Response } from 'express';
import { chatController } from './controllers/chat.controller';
import { groupsController } from './controllers/groups.controller';
import { statsController } from './controllers/stats.controller';
import { fishingController } from './controllers/fishing.controller';
import { siteMergeController } from './controllers/site-merge.controller';
import { userController } from './controllers/user.controller';
import { uploadsController } from './controllers/uploads.controller';
import { competitionsController } from './controllers/competitions.controller';
import { placesController } from './controllers/places.controller';
import { forecastController } from './controllers/forecast.controller';
import { visionController } from './controllers/vision.controller';
import { savedController } from './controllers/saved.controller';
import { notificationsController } from './controllers/notifications.controller';
import { pushController } from './controllers/push.controller';
import { waypointsController } from './controllers/waypoints.controller';
import { gearController } from './controllers/gear.controller';
import { feedController } from './controllers/feed.controller';
import { reviewsController } from './controllers/reviews.controller';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './lib/auth';
import { setAuthContext } from './lib/auth-context';
import { mailStatus } from './lib/mailer';
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

/*
 * The same read, without the refusal. For a route anyone may call whose
 * answer still depends on who is asking: a private spot is not found for a
 * stranger and is found for its owner, and the owner is only known if the
 * session was read. Without this the owner was a stranger to their own spot.
 */
async function attachApiAuth(
   req: Request,
   _res: Response,
   next: express.NextFunction
) {
   const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
   });

   if (session?.user) {
      setAuthContext(req, session.user);
   }

   return next();
}

router.get('/', (_req: Request, res: Response) => {
   res.send('Hello World!');
});

router.get('/api/hello', (_req: Request, res: Response) => {
   res.json({ message: 'Hello from the API!' });
});

/*
 * Which build is answering, and whether it can send mail, without anybody
 * reading Railway's logs. No address, no key and no error text: only what a
 * stranger could learn from trying to sign up anyway.
 */
router.get('/api/health', (_req: Request, res: Response) => {
   res.json({
      deployment: process.env.RAILWAY_DEPLOYMENT_ID ?? null,
      mail: mailStatus,
   });
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
/*
 * Signed in, and only for the caller's own photographs. It used to sign any
 * key for anybody, and a key is written plainly in every card link, so a
 * stranger could trade a card for the original and its location with it.
 */
router.post(
   '/api/uploads/read-url',
   requireApiAuth,
   uploadsController.getReadUrl
);
router.get(
   '/api/uploads/direct',
   requireApiAuth,
   uploadsController.getDirectUploadData
);
router.get(
   '/api/catches/:catchId',
   attachApiAuth,
   fishingController.getCatchById
);
/* Public, and the reader's own private spots ride along when there is one. */
router.get('/api/sites', attachApiAuth, fishingController.listFishingSites);

/* Two pins on the same water, made one. Reading suggestions changes nothing;
   the merge itself moves catches and cannot undo itself, so it is a POST. */
router.get(
   '/api/sites/merge-suggestions',
   requireApiAuth,
   siteMergeController.suggestions
);
router.post('/api/sites/merge', requireApiAuth, siteMergeController.merge);

/* A reference table, not anyone's data, so no sign-in needed to name a fish. */
router.get('/api/species', fishingController.searchSpecies);
/* A name the table does not have yet. Deduped against what it has, however
 * it is spelt or capitalised, so one fish never becomes two rows. */
router.post('/api/species', requireApiAuth, fishingController.createSpecies);

/* The social layer. Boards are public; your own numbers are not. */
router.get('/api/stats/me', requireApiAuth, statsController.myStats);
router.get('/api/stats/rivals', requireApiAuth, statsController.rivals);
router.get('/api/stats/progress', requireApiAuth, statsController.myProgress);
router.get(
   '/api/users/:userId/progress',
   attachApiAuth,
   statsController.progressOf
);
router.get('/api/competitions/species', statsController.speciesBoards);

/* Slipways, marinas and tackle shops, proxied from OpenStreetMap because
 * Overpass refuses a browser's cross-origin request. Public data, no auth. */
router.get('/api/places', placesController.list);
router.get('/api/places/search', placesController.search);
router.get('/api/places/name', placesController.name);

/* Reading a photograph: a figure off a tape or a scale, or the fish's name. */
router.post('/api/vision/read', requireApiAuth, visionController.readMeasure);
router.post('/api/vision/identify', requireApiAuth, visionController.identify);

/* The week ahead at a place. Public, like the places. */
/*
 * Signed out this is the week and nothing more. Signed in the same answer
 * carries a rating read off the reader's own log, so the session is attached
 * rather than required.
 */
router.get('/api/forecast', attachApiAuth, forecastController.get);

/* Keeping somebody else's spot or gear. A reference, never a copy, so what the
 * owner does with it afterwards still applies. */
router.get('/api/saved/spots', requireApiAuth, savedController.listSpots);
router.post(
   '/api/saved/spots/:siteId',
   requireApiAuth,
   savedController.saveSpot
);
router.delete(
   '/api/saved/spots/:siteId',
   requireApiAuth,
   savedController.removeSpot
);
router.get('/api/saved/posts', requireApiAuth, savedController.listPosts);
router.post(
   '/api/saved/posts/:postId',
   requireApiAuth,
   savedController.savePost
);
router.delete(
   '/api/saved/posts/:postId',
   requireApiAuth,
   savedController.removePost
);

/* What happened to you. Polled, never pushed. */
router.get('/api/notifications', requireApiAuth, notificationsController.list);
router.get(
   '/api/notifications/unread',
   requireApiAuth,
   notificationsController.unread
);
router.post(
   '/api/notifications/read',
   requireApiAuth,
   notificationsController.markRead
);

/* Web push: the key a browser subscribes with, the browsers that have, and a
 * line to your own to see it work. All four are yours alone. */
router.get('/api/push/key', requireApiAuth, pushController.key);
router.post('/api/push/subscriptions', requireApiAuth, pushController.save);
router.delete('/api/push/subscriptions', requireApiAuth, pushController.remove);
router.post('/api/push/test', requireApiAuth, pushController.test);

router.get('/api/saved/gear', requireApiAuth, savedController.listGear);
router.post(
   '/api/saved/gear/:gearId',
   requireApiAuth,
   savedController.saveGear
);
router.delete(
   '/api/saved/gear/:gearId',
   requireApiAuth,
   savedController.removeGear
);

/* Private marks on the map. Never listed for anyone but their owner. */
router.get('/api/waypoints', requireApiAuth, waypointsController.listMine);
router.post('/api/waypoints', requireApiAuth, waypointsController.create);
router.put(
   '/api/waypoints/:waypointId',
   requireApiAuth,
   waypointsController.update
);
router.delete(
   '/api/waypoints/:waypointId',
   requireApiAuth,
   waypointsController.remove
);

/* Competitions anglers run themselves. The species board above is a different
 * thing that happens to share the word, so it is registered first. */
router.get('/api/competitions', requireApiAuth, competitionsController.list);
router.get(
   '/api/competitions/invites',
   requireApiAuth,
   competitionsController.myInvites
);
router.post(
   '/api/competitions/invites/:inviteId',
   requireApiAuth,
   competitionsController.answerInvite
);
router.get(
   '/api/users/me/followers',
   requireApiAuth,
   competitionsController.myFollowers
);
router.post(
   '/api/competitions/:competitionId/invite',
   requireApiAuth,
   competitionsController.invite
);
router.post('/api/competitions', requireApiAuth, competitionsController.create);
router.get(
   '/api/competitions/:competitionId/standings',
   requireApiAuth,
   competitionsController.standings
);
router.get(
   '/api/competitions/:competitionId',
   requireApiAuth,
   competitionsController.detail
);
/* A catch entered, checked, and what the organiser and the others make of it. */
router.post(
   '/api/competitions/:competitionId/entries',
   requireApiAuth,
   competitionsController.submitEntry
);
router.get(
   '/api/competitions/:competitionId/entries/:entryId',
   requireApiAuth,
   competitionsController.getEntry
);
router.delete(
   '/api/competitions/:competitionId/entries/:entryId',
   requireApiAuth,
   competitionsController.withdrawEntry
);
router.post(
   '/api/competitions/:competitionId/entries/:entryId/review',
   requireApiAuth,
   competitionsController.reviewEntry
);
router.post(
   '/api/competitions/:competitionId/entries/:entryId/flag',
   requireApiAuth,
   competitionsController.flagEntry
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
router.get(
   '/api/sites/:siteId',
   attachApiAuth,
   fishingController.getFishingSiteById
);

/*
 * What anglers make of a spot. One rating per person per spot, so the write is
 * a PUT on your own one rather than a POST of another row: a second rating
 * edits the first.
 *
 * The read is public and still needs attachApiAuth. Without it the reader is a
 * stranger to their own rating, the page offers to rate a spot they have
 * already rated, and the owner of a private spot cannot read its ratings.
 */
router.get('/api/sites/:siteId/reviews', attachApiAuth, reviewsController.list);
router.put(
   '/api/sites/:siteId/reviews/me',
   requireApiAuth,
   reviewsController.leave
);
router.delete(
   '/api/sites/:siteId/reviews/me',
   requireApiAuth,
   reviewsController.remove
);

/* Public, but a signed-in reader gets their own likes, keeps and follows back. */
router.get('/api/feed', attachApiAuth, feedController.listFeed);
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
router.get(
   '/api/feed/:postId/comments',
   attachApiAuth,
   feedController.listComments
);
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
/*
 * Finding people, and whether a handle is free while one is being typed.
 * Both sit above /:userId for the same reason /me does. No limiter of their
 * own, as nothing outside /api/auth has one: each is a small bounded read
 * behind a session, and the client waits for the typing to stop first.
 */
router.get(
   '/api/users/handle-available',
   requireApiAuth,
   userController.checkHandle
);
router.get('/api/users/search', requireApiAuth, userController.searchAnglers);
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
