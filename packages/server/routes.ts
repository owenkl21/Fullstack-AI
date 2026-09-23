import { readFileSync } from 'node:fs';
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
import { adminController } from './controllers/admin.controller';
import { resetController } from './controllers/reset.controller';
import { backupController } from './controllers/backup.controller';
import { badgesController } from './controllers/badges.controller';
/*
 * The role guard: it reads the role off the row behind the session and drops
 * anybody else out of the router, so the answer is the 404 a path that was
 * never registered gives.
 */
import {
   isAdminEmail,
   isVerifiedEmail,
   requireAdmin as requireAdminRole,
   settleAdminRole,
} from './lib/admin';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './lib/auth';
import { setAuthContext } from './lib/auth-context';
import { mailStatus } from './lib/mailer';
import { userService } from './services/user.service';

/*
 * Which commit is serving. The deploy writes build-id.txt beside the server,
 * because railway up sends a folder rather than a repository and nothing on
 * the far side would otherwise know. Read once at boot: a file that is not
 * there is a local run, which says so with null.
 */
const BUILD_ID = (() => {
   const fromEnv = process.env.RAILWAY_GIT_COMMIT_SHA?.trim();
   if (fromEnv) return fromEnv.slice(0, 7);
   try {
      return (
         readFileSync(new URL('./build-id.txt', import.meta.url), 'utf8')
            .trim()
            .slice(0, 7) || null
      );
   } catch {
      return null;
   }
})();

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
   await settleIfTheTeam(session.user);

   return next();
}

/*
 * The role is granted when a session is made, which leaves out the one case
 * that matters most: an account signed in already when its address was
 * confirmed, or when the address was first named as the team's. That reader
 * would have to sign out and in again to be let in, with nothing saying so.
 * Cheap on every other request: an address that is not the team's costs a
 * string compare and no query.
 */
async function settleIfTheTeam(user: {
   id: string;
   email?: string | null;
   role?: unknown;
   verified?: unknown;
}) {
   const owesRole = isAdminEmail(user.email) && user.role !== 'ADMIN';
   const owesTick = isVerifiedEmail(user.email) && user.verified !== true;
   if (!owesRole && !owesTick) return;
   await settleAdminRole(user.id).catch(() => undefined);
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
      await settleIfTheTeam(session.user);
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
      /*
       * Which commit is answering. Railway sets this on every build, and
       * without it the only way to tell a deploy landed was to guess from a
       * changed id, which says a build happened and not which one.
       */
      commit: BUILD_ID,
      mail: mailStatus,
      /*
       * Whether Claude can be reached at all, so a competition organiser
       * wondering why nothing was judged can be answered without anybody
       * reading Railway. Says only that a key is set, never a word of it.
       */
      claude: process.env.ANTHROPIC_API_KEY?.trim() ? 'ready' : 'off',
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

/*
 * The badges the Fisherfeed team pins on a fish. Admin only, all three of
 * them, including the read: an angler already gets every badge on a catch with
 * the catch itself, and this one exists for the picker, so there is no reason
 * for it to answer anybody else. The guard reads the role from the session's
 * own user row on every request, and a signed-in angler gets a 404, the same
 * answer as a path that is not there.
 */
router.get(
   '/api/catches/:catchId/badges',
   requireAdminRole,
   badgesController.list
);
router.post(
   '/api/catches/:catchId/badges',
   requireAdminRole,
   badgesController.award
);
router.delete(
   '/api/catches/:catchId/badges/:kind',
   requireAdminRole,
   badgesController.remove
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
/* Clearing is a delete: only ever the caller's own inbox. */
router.delete(
   '/api/notifications',
   requireApiAuth,
   notificationsController.clear
);
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
/* Edit is the author's alone. Delete is the author's, or the post owner's. */
router.put(
   '/api/feed/comments/:commentId',
   requireApiAuth,
   feedController.updateComment
);
router.delete(
   '/api/feed/comments/:commentId',
   requireApiAuth,
   feedController.deleteComment
);
router.post(
   '/api/feed/comments/:commentId/likes',
   requireApiAuth,
   feedController.toggleCommentLike
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

/*
 * The admin panel. One guard, and it is the role guard, which reads the session
 * and then reads the role off that session's own row on every request. Nothing
 * here reads a flag the browser sent, and the client's copy of "am I an admin"
 * only ever decides what to draw, never what may be answered.
 *
 * requireApiAuth is deliberately NOT in front of it. It would answer a signed
 * out caller with 401 while an ordinary angler got 404, and the difference
 * between the two is a map of the admin surface. requireAdmin drops everybody
 * who is not the admin out of the router, so all three cases read alike.
 *
 * It is the one route in the product that returns another person's email
 * address, which is why there is a single door rather than six.
 */
/*
 * Emptying the log, behind the same guard as the panel: anybody else gets the
 * 404 a path that is not there gives, and the phrase is checked in the
 * controller. Declared before the section route so that "reset" is never read
 * as the name of a panel section.
 */
router.get('/api/admin/reset', requireAdminRole, resetController.preview);
router.post('/api/admin/reset', requireAdminRole, resetController.startFresh);
/* Copies of the log, taken and fetched by the team alone. */
router.get('/api/admin/backups', requireAdminRole, backupController.list);
router.post('/api/admin/backups', requireAdminRole, backupController.take);
router.get('/api/admin/backups/link', requireAdminRole, backupController.link);

/* The tick, given or taken from the people section. */
router.post(
   '/api/admin/users/:userId/verified',
   requireAdminRole,
   adminController.setVerified
);
router.get('/api/admin/:section', requireAdminRole, adminController.section);

export default router;
