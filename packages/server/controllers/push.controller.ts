import type { Request, Response } from 'express';
import z from 'zod';
import { getAuth } from '../lib/auth-context';
import { pushService } from '../services/push.service';

const unauthorized = {
   code: 'unauthorized',
   message: 'Authentication required.',
};

/*
 * The address in a subscription is one this server will later POST to, and it
 * arrives from a browser, which means from anybody. Left open it is a way to
 * make the API knock on doors inside its own network. Every browser that does
 * web push is served by one of four companies, so the address has to be https
 * and has to belong to one of them.
 */
const PUSH_HOSTS = [
   '.googleapis.com',
   '.google.com',
   '.push.services.mozilla.com',
   '.notify.windows.com',
   '.push.apple.com',
];

/*
 * Off a deploy, one more origin can be named in PUSH_TEST_ORIGIN, so the whole
 * path (subscribe, a follow, the sealed message, the prune on 410) can be run
 * against a stand-in push service on a laptop. Railway sets
 * RAILWAY_ENVIRONMENT_NAME on every deploy and nothing sets NODE_ENV there, so
 * either one means production, and production never reads the variable.
 */
const inProduction =
   Boolean(process.env.RAILWAY_ENVIRONMENT_NAME?.trim()) ||
   process.env.NODE_ENV === 'production';
const testOrigin = () =>
   inProduction ? '' : (process.env.PUSH_TEST_ORIGIN ?? '').trim();

const isPushService = (value: string) => {
   try {
      const url = new URL(value);
      if (testOrigin() && url.origin === testOrigin()) return true;
      if (url.protocol !== 'https:' || url.username || url.password) {
         return false;
      }
      if (url.port && url.port !== '443') return false;
      const host = `.${url.hostname.toLowerCase()}`;
      return PUSH_HOSTS.some((suffix) => host.endsWith(suffix));
   } catch {
      return false;
   }
};

const endpoint = z
   .string()
   .trim()
   .min(20)
   .max(2048)
   .refine(isPushService, 'Not a push service this app sends to.');

/* base64url, the only alphabet a browser writes its keys in. */
const key = (min: number, max: number) =>
   z
      .string()
      .trim()
      .min(min)
      .max(max)
      .regex(/^[A-Za-z0-9_-]+=*$/);

const saveSchema = z.object({
   endpoint,
   keys: z.object({
      /* A 65 byte point is 87 characters; a 16 byte secret is 22. */
      p256dh: key(80, 120),
      auth: key(16, 64),
   }),
});

const removeSchema = z.object({ endpoint });

/* One test line every ten seconds each. Kept in memory: it guards a button,
 * not a border, and an instance that restarts forgetting it costs nothing. */
const lastTest = new Map<string, number>();
const TEST_EVERY_MS = 10_000;

export const pushController = {
   async key(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      try {
         /* The pair never changes under a running server, but a browser that
          * cached an old answer across a database reset would subscribe with
          * a key nothing signs with any more. */
         res.setHeader('Cache-Control', 'no-store');
         return res.json({ publicKey: await pushService.publicKey() });
      } catch (error) {
         console.warn('[push] no key', String(error));
         return res.status(503).json({
            code: 'push_unavailable',
            message: 'Notifications cannot be turned on right now.',
         });
      }
   },

   async save(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const parsed = saveSchema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json(parsed.error.format());
      const agent = req.headers['user-agent'];
      await pushService.save(
         auth.userId,
         {
            endpoint: parsed.data.endpoint,
            p256dh: parsed.data.keys.p256dh,
            auth: parsed.data.keys.auth,
         },
         typeof agent === 'string' ? agent : null
      );
      return res.status(201).json({ saved: true });
   },

   async remove(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const parsed = removeSchema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json(parsed.error.format());
      return res.json(
         await pushService.remove(auth.userId, parsed.data.endpoint)
      );
   },

   async test(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const now = Date.now();
      if (now - (lastTest.get(auth.userId) ?? 0) < TEST_EVERY_MS) {
         return res.status(429).json({
            code: 'too_soon',
            message: 'One was just sent. Give it a few seconds.',
         });
      }
      lastTest.set(auth.userId, now);
      /* The map is only ever as big as the people pressing the button in the
       * same ten seconds. */
      for (const [userId, at] of lastTest) {
         if (now - at > TEST_EVERY_MS) lastTest.delete(userId);
      }
      return res.json(await pushService.test(auth.userId));
   },
};
