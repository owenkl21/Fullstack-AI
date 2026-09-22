import crypto from 'node:crypto';
import { prisma } from '../lib/prisma';
import {
   generateVapidKeys,
   isVapidPair,
   sendWebPush,
   type VapidKeys,
} from '../lib/web-push';

/*
 * Telling a phone in a pocket what the inbox already knows.
 *
 * A browser that has asked for it is kept as a row; when a notification is
 * written, every row its reader owns is sent one sealed message. Nothing in
 * here is allowed to matter to the thing that caused it: a follow is kept
 * whether or not a push service in California is answering today, so sending
 * is started and not waited for, and every failure ends in a log line.
 */

const VAPID_SETTING = 'vapid-keys';
/* A phone, a tablet, a laptop, a work machine, each in a couple of browsers.
 * Past that the oldest rows are browsers nobody opens any more. */
const MAX_PER_USER = 12;
/* The sealed record tops out at 4096 bytes; the words are the only part of
 * it that grows. */
const BODY_MAX = 140;

const subject = () =>
   (process.env.VAPID_SUBJECT ?? '').trim() || 'mailto:info@fisherfeed.com';

const hashOf = (endpoint: string) =>
   crypto.createHash('sha256').update(endpoint).digest('hex');

const parsePair = (value: string | null | undefined): VapidKeys | null => {
   if (!value) return null;
   try {
      const pair = JSON.parse(value) as Partial<VapidKeys>;
      if (
         typeof pair.publicKey === 'string' &&
         typeof pair.privateKey === 'string' &&
         isVapidPair(pair as VapidKeys)
      ) {
         return { publicKey: pair.publicKey, privateKey: pair.privateKey };
      }
   } catch {
      /* Not JSON: treated the same as not there. */
   }
   return null;
};

/*
 * The pair every message is signed with. The environment wins when it holds
 * one, so a host that wants to own its keys can. Otherwise the pair is made
 * once and kept in the database, because every browser subscribes against the
 * public half: a server that made a new pair on each deploy would orphan all
 * of them each time, silently.
 */
async function loadKeys(): Promise<VapidKeys> {
   const fromEnv = {
      publicKey: (process.env.VAPID_PUBLIC_KEY ?? '').trim(),
      privateKey: (process.env.VAPID_PRIVATE_KEY ?? '').trim(),
   };
   if (fromEnv.publicKey && fromEnv.privateKey) {
      if (isVapidPair(fromEnv)) return fromEnv;
      console.warn(
         '[push] VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set but are not a pair. Using the stored pair.'
      );
   }

   const stored = await prisma.serverSetting.findUnique({
      where: { key: VAPID_SETTING },
   });
   const kept = parsePair(stored?.value);
   if (kept) return kept;

   const made = generateVapidKeys();
   if (stored) {
      /* A row that does not hold a pair is no use to anybody: replace it. */
      await prisma.serverSetting.update({
         where: { key: VAPID_SETTING },
         data: { value: JSON.stringify(made) },
      });
      return made;
   }
   try {
      await prisma.serverSetting.create({
         data: { key: VAPID_SETTING, value: JSON.stringify(made) },
      });
      return made;
   } catch (error) {
      /* Two instances booting together both get here. The key is the primary
       * key, so one create wins, and the loser signs with the winner's pair. */
      const theirs = await prisma.serverSetting.findUnique({
         where: { key: VAPID_SETTING },
      });
      const pair = parsePair(theirs?.value);
      if (pair) return pair;
      throw error;
   }
}

let keys: Promise<VapidKeys> | null = null;
const vapidKeys = () => {
   /* A failed read is not remembered, so the next caller tries again. */
   keys ??= loadKeys().catch((error) => {
      keys = null;
      throw error;
   });
   return keys;
};

export type PushMessage = {
   title: string;
   body: string;
   url: string;
   tag: string;
   /* Buzz again when this replaces an older line with the same tag. */
   renotify: boolean;
   icon: string;
   badge: string;
};

type Announced = {
   id: string;
   userId: string;
   actorId: string | null;
   kind: string;
   postId: string | null;
   commentId?: string | null;
   competitionId: string | null;
   /* The fish a BADGE line is about. */
   catchId?: string | null;
   body: string | null;
};

const clip = (text: string | null | undefined) => {
   const flat = (text ?? '').replace(/\s+/g, ' ').trim();
   return flat.length > BODY_MAX ? `${flat.slice(0, BODY_MAX - 3)}...` : flat;
};

/*
 * The same sentences and the same places the notifications page uses (see
 * client components/notifications/notification-text.ts), shaped for a lock
 * screen: who did what as the title, their words or the competition's name
 * under it. A tap opens what the line is about: the feed at the post, and at
 * the comment when there is one, the competition, or the person.
 *
 * A kind this does not know still says something true and still opens the
 * inbox, so a new kind added elsewhere is never a blank notification.
 */
const threadLink = (row: Announced) => {
   if (!row.postId) return '/notifications';
   const query = new URLSearchParams({ post: row.postId });
   if (row.commentId) query.set('comment', row.commentId);
   return `/feed?${query.toString()}`;
};
const competitionLink = (row: Announced) =>
   row.competitionId ? `/competitions/${row.competitionId}` : '/competitions';

/*
 * What a badge says, per kind, with the fish read in. The same eight sentences
 * the inbox prints (client components/badges/kinds.ts): a lock screen and the
 * notifications page should not word the same event two ways. A kind this
 * build has not heard of falls through to a line that is still true.
 */
const BADGE_SAID: Record<string, (fish: string) => string> = {
   GREAT_CATCH: (fish) => `called your ${fish} a great catch`,
   COOL_SPECIES: (fish) => `called your ${fish} a cool species`,
   PERSONAL_BEST: (fish) => `called your ${fish} a personal best`,
   RARE_VISITOR: (fish) => `called your ${fish} a rare visitor`,
   RELEASED_WELL: (fish) => `said you put your ${fish} back well`,
   YOUNG_ANGLER: (fish) => `marked your ${fish} for a young angler`,
   CATCH_OF_THE_WEEK: (fish) => `made your ${fish} catch of the week`,
   TEAM_PICK: (fish) => `made your ${fish} a team pick`,
};

/* `KIND|what was caught|the note`, and the note may hold bars of its own. */
const unpackBadge = (body: string | null) => {
   const parts = (body ?? '').split('|');
   return {
      kind: parts[0] ?? '',
      fish: parts[1]?.trim() || 'catch',
      note: parts.slice(2).join('|').trim(),
   };
};

export function pushMessageOf(row: Announced, actorName: string | null) {
   const who = actorName?.trim() || 'Somebody';
   let title = 'Something new on Fisherfeed';
   let body = '';
   let url = '/notifications';
   /* Likes are the one thing that can arrive in a burst. They still collapse
    * into one line, but only the first one makes a sound. */
   let renotify = true;

   switch (row.kind) {
      case 'FOLLOW':
         title = `${who} started following you`;
         if (row.actorId) url = `/anglers/${row.actorId}`;
         break;
      case 'COMMENT':
         title = `${who} replied to your post`;
         body = clip(row.body);
         url = threadLink(row);
         break;
      case 'COMMENT_REPLY':
         title = `${who} replied to your comment`;
         body = clip(row.body);
         url = threadLink(row);
         break;
      case 'LIKE':
         title = `${who} liked your post`;
         url = threadLink(row);
         renotify = false;
         break;
      case 'COMMENT_LIKE':
         title = `${who} liked your comment`;
         body = clip(row.body);
         url = threadLink(row);
         renotify = false;
         break;
      case 'INVITE':
         title = `${who} invited you to a competition`;
         body = clip(row.body);
         url = competitionLink(row);
         break;
      case 'INVITE_ANSWER': {
         const [answer, name] = (row.body ?? '').split('|');
         title = `${who} ${answer === 'accepted' ? 'accepted' : 'declined'} your invitation`;
         body = clip(name);
         url = competitionLink(row);
         break;
      }
      case 'BADGE': {
         const badge = unpackBadge(row.body);
         const said = BADGE_SAID[badge.kind];
         title = said
            ? `${who} ${said(badge.fish)}`
            : `${who} pinned a badge on your ${badge.fish}`;
         body = clip(badge.note);
         if (row.catchId) url = `/catches/${row.catchId}`;
         break;
      }
   }

   /* What collapses into one line: every reply on a post, every like on a
    * post, every like on one comment. */
   const about =
      (row.kind === 'COMMENT_LIKE' ? row.commentId : null) ??
      /* A badge is about its fish. Without this the chain fell through to the
         actor, and every badge the team gave would replace the last one on the
         lock screen, however many different fish they were about. */
      (row.kind === 'BADGE' ? row.catchId : null) ??
      row.postId ??
      row.competitionId ??
      row.actorId ??
      row.id;
   const message: PushMessage = {
      title,
      body,
      url,
      tag: `${row.kind}:${about}`,
      renotify,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
   };
   return message;
}

async function deliver(userId: string, message: PushMessage) {
   const rows = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
   });
   if (rows.length === 0) return { sent: 0, failed: 0 };

   const pair = await vapidKeys();
   const payload = JSON.stringify(message);
   let sent = 0;
   let failed = 0;

   await Promise.all(
      rows.map(async (row) => {
         try {
            const result = await sendWebPush(row, payload, {
               keys: pair,
               subject: subject(),
               tag: message.tag,
            });
            if (result.ok) {
               sent += 1;
               await prisma.pushSubscription.update({
                  where: { id: row.id },
                  data: { lastSuccessAt: new Date() },
               });
               return;
            }
            failed += 1;
            if (result.gone) {
               /* The browser unsubscribed, or was uninstalled. It is not
                * coming back under this address. */
               await prisma.pushSubscription.deleteMany({
                  where: { id: row.id },
               });
               return;
            }
            /* The host and no more: the rest of the address is the secret
             * that lets anybody holding it write to that browser. */
            console.warn('[push] not taken', {
               status: result.status,
               host: new URL(row.endpoint).host,
            });
         } catch (error) {
            failed += 1;
            console.warn('[push] could not send', String(error));
         }
      })
   );
   return { sent, failed };
}

export const pushService = {
   async publicKey() {
      return (await vapidKeys()).publicKey;
   },

   /*
    * Keyed on the browser, not on the pair of browser and angler. A phone
    * that somebody else signs in on and turns notifications on for becomes
    * theirs, and stops hearing about the last person's likes.
    */
   async save(
      userId: string,
      input: { endpoint: string; p256dh: string; auth: string },
      userAgent: string | null
   ) {
      const endpointHash = hashOf(input.endpoint);
      const agent = userAgent ? userAgent.slice(0, 300) : null;
      await prisma.pushSubscription.upsert({
         where: { endpointHash },
         create: {
            userId,
            endpointHash,
            endpoint: input.endpoint,
            p256dh: input.p256dh,
            auth: input.auth,
            userAgent: agent,
         },
         update: {
            userId,
            p256dh: input.p256dh,
            auth: input.auth,
            userAgent: agent,
         },
      });

      const surplus = await prisma.pushSubscription.findMany({
         where: { userId },
         orderBy: { createdAt: 'desc' },
         skip: MAX_PER_USER,
         select: { id: true },
      });
      if (surplus.length > 0) {
         await prisma.pushSubscription.deleteMany({
            where: { id: { in: surplus.map((row) => row.id) } },
         });
      }
   },

   /** Only ever your own: somebody else's address removes nothing. */
   async remove(userId: string, endpoint: string) {
      const result = await prisma.pushSubscription.deleteMany({
         where: { userId, endpointHash: hashOf(endpoint) },
      });
      return { removed: result.count };
   },

   /** A line to your own browsers, so the switch can be seen to work. */
   async test(userId: string) {
      return deliver(userId, {
         title: 'Notifications are on',
         body: 'This is how Fisherfeed will tell you when something happens.',
         url: '/notifications',
         tag: 'test',
         renotify: true,
         icon: '/icons/icon-192.png',
         badge: '/icons/badge-96.png',
      });
   },

   /*
    * Called with a notification that has just been written. Not awaited by
    * its caller and not able to throw into it: the follow, the reply or the
    * like that caused this has already been kept.
    */
   announce(row: Announced) {
      void (async () => {
         try {
            const listening = await prisma.pushSubscription.count({
               where: { userId: row.userId },
            });
            if (listening === 0) return;
            const actor = row.actorId
               ? await prisma.user.findUnique({
                    where: { id: row.actorId },
                    select: { displayName: true },
                 })
               : null;
            await deliver(
               row.userId,
               pushMessageOf(row, actor?.displayName ?? null)
            );
         } catch (error) {
            console.warn('[push] could not announce', String(error));
         }
      })();
   },
};
